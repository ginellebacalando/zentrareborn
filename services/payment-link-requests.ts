import 'server-only';
import { z } from 'zod';
import { errorMetadata } from '@/lib/audit';
import { enqueueJobs } from '@/lib/automation/outbox';
import { onlinePaymentsOffered, paymentPageAction } from '@/lib/automation/payment-proofs';
import { paymentLinkEmail } from '@/lib/automation/templates';
import { prisma } from '@/lib/prisma';

/**
 * "Find my payment page" (/booking/pay, docs/booking-automation.md): a client who lost the email
 * enters their booking reference and email, and the link to their private payment page is emailed
 * to the address on that booking. The answer is the same whether or not anything matched, so the
 * form cannot be used to find out who has a booking.
 */
export const PAYMENT_LINK_EVENT = 'PAYMENT_LINK_RESENT';
export const PAYMENT_LINK_RULES = {
  /** One email per booking in this time, however often the form is sent. */
  quietMs: 10 * 60_000,
  perBookingPerDay: 5,
  /** All bookings together; beyond it the form asks to try again later. */
  perHour: 60,
  /** Every answer takes at least this long, so a match is not given away by timing. */
  minimumReplyMs: 400,
} as const;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export class PaymentLinkError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = 'PaymentLinkError';
  }
}

const requestSchema = z
  .object({
    // Spaces and lowercase are forgiven: "zion-2026-ab12cd34" finds ZION-2026-AB12CD34.
    reference: z
      .string()
      .transform((value) => value.replace(/\s+/g, '').toUpperCase())
      .pipe(
        z
          .string()
          .min(6, 'Enter your booking reference, for example ZION-2026-AB12CD34.')
          .max(40, 'Enter your booking reference, for example ZION-2026-AB12CD34.')
          .regex(/^[A-Z0-9-]+$/, 'Enter your booking reference, for example ZION-2026-AB12CD34.'),
      ),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email('Enter the email you used for the booking.').max(255)),
    /** Left empty by people; a form filled in by a bot gets the usual answer and nothing else. */
    website: z.string().max(200).optional().default(''),
  })
  .strict();

/**
 * Emails the booking's payment page link when the reference and email match, within the limits.
 * Returns the outbox jobs to deliver now; none when nothing matched or a limit applied.
 */
export async function requestPaymentLink(input: unknown, now = new Date()) {
  const started = Date.now();
  try {
    const parsed = requestSchema.safeParse(input);
    if (!parsed.success)
      throw new PaymentLinkError(
        parsed.error.issues[0]?.message ?? 'Enter your booking reference and email.',
      );
    const { reference, email, website } = parsed.data;
    const lastHour = await prisma.adminOutbox.count({
      where: { event: PAYMENT_LINK_EVENT, createdAt: { gte: new Date(now.getTime() - HOUR_MS) } },
    });
    if (lastHour >= PAYMENT_LINK_RULES.perHour)
      throw new PaymentLinkError(
        'We are receiving many requests right now. Please try again in a few minutes.',
        429,
      );
    if (website) return { notificationIds: [] as string[] };
    const booking = await prisma.adminBooking.findFirst({
      where: {
        reference: { equals: reference, mode: 'insensitive' },
        email: { equals: email, mode: 'insensitive' },
      },
      select: {
        id: true,
        reference: true,
        clientName: true,
        email: true,
        eventType: true,
        startsAt: true,
      },
    });
    if (!booking) return { notificationIds: [] as string[] };
    const recent = await prisma.adminOutbox.findMany({
      where: {
        event: PAYMENT_LINK_EVENT,
        bookingId: booking.id,
        createdAt: { gte: new Date(now.getTime() - DAY_MS) },
      },
      select: { createdAt: true, status: true },
    });
    // Repeats are not stored: the earlier email has the link, and the outbox stays small.
    const quiet = now.getTime() - PAYMENT_LINK_RULES.quietMs;
    if (recent.some((row) => row.createdAt.getTime() > quiet))
      return { notificationIds: [] as string[] };
    if (
      recent.filter((row) => row.status !== 'EXPIRED').length >= PAYMENT_LINK_RULES.perBookingPerDay
    )
      return { notificationIds: [] as string[] };
    const action = paymentPageAction(booking.id, await onlinePaymentsOffered(prisma));
    // Without a link nothing is sent, but the request is recorded so staff see why.
    const skipReason = action
      ? undefined
      : 'The payment link could not be built: the site address or AUTH_SECRET is missing.';
    const message = action
      ? paymentLinkEmail({ ...booking, paymentAction: action })
      : { subject: 'Payment page link not sent', text: '', html: '' };
    const notificationIds = await enqueueJobs(
      prisma,
      [
        {
          idempotencyKey: `payment-link:${booking.id}:${now.getTime()}`,
          event: PAYMENT_LINK_EVENT,
          recipient: booking.email,
          bookingId: booking.id,
          ...message,
          expiresAt: new Date(now.getTime() + DAY_MS),
          skipReason,
        },
      ],
      now,
    );
    return { notificationIds };
  } finally {
    const waited = Date.now() - started;
    if (waited < PAYMENT_LINK_RULES.minimumReplyMs)
      await new Promise((resolve) =>
        setTimeout(resolve, PAYMENT_LINK_RULES.minimumReplyMs - waited),
      );
  }
}

export function paymentLinkErrorResponse(error: unknown) {
  if (error instanceof PaymentLinkError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof SyntaxError)
    return Response.json({ error: 'The request body is invalid.' }, { status: 400 });
  console.error('Unable to send a payment page link.', errorMetadata(error));
  return Response.json(
    { error: 'We could not send the link right now. Please try again or contact us.' },
    { status: 500 },
  );
}
