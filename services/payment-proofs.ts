import 'server-only';

import { NotificationPriority, NotificationType } from '@prisma/client';
import { z } from 'zod';
import { paidTotal } from '@/lib/admin/domain';
import {
  normalizeTransferReference,
  onlinePaymentMethods,
  PAYMENT_METHOD_LABELS,
  type OnlinePaymentMethod,
  type PaymentAccounts,
} from '@/lib/admin/payment-accounts';
import { readPaymentAccounts } from '@/lib/admin/preferences';
import { errorMetadata, getRequestContext } from '@/lib/audit';
import { enqueuePaymentProofReceived } from '@/lib/automation/payment-proofs';
import { bookingIdFromPaymentToken } from '@/lib/payment-link';
import type { PaymentPageView } from '@/lib/payment-page-types';
import {
  PAYMENT_PROOF_MAX_BYTES,
  PaymentProofFileError,
  preparePaymentProofFile,
} from '@/lib/payment-proof-file';
import { prisma } from '@/lib/prisma';

/**
 * The client side of booking automation phase 2 (docs/booking-automation.md): a private payment
 * page reached through a signed link, where a client whose date is held sees how to pay and
 * uploads a GCash or bank transfer screenshot for staff to verify. Nothing here confirms a
 * booking; only staff verification does.
 */

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;
/** Abuse guards: screenshots per booking per day, and across all bookings per hour. */
const PROOFS_PER_BOOKING_PER_DAY = 5;
const PROOFS_PER_HOUR = 60;
const OLDEST_PAYMENT_DAYS = 60;

export class PaymentProofError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = 'PaymentProofError';
  }
}

function pesos(cents: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Today's date in Manila (UTC+8, no daylight saving) shifted by `days`, as YYYY-MM-DD. */
function manilaDate(days = 0) {
  return new Date(Date.now() + 8 * HOUR_MS + days * DAY_MS).toISOString().slice(0, 10);
}

function humanDate(iso: string) {
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', dateStyle: 'medium' }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

/** Only the configured accounts reach the page; an unused method shows no stray details. */
function offeredAccounts(accounts: PaymentAccounts, methods: OnlinePaymentMethod[]) {
  return {
    gcash: methods.includes('GCASH') ? accounts.gcash : { accountName: '', number: '' },
    bank: methods.includes('BANK_TRANSFER')
      ? accounts.bank
      : { bankName: '', accountName: '', accountNumber: '' },
  };
}

/** What the payment page of a signed link shows; an unknown or forged link shows nothing. */
export async function readPaymentPage(token: string): Promise<PaymentPageView> {
  const bookingId = bookingIdFromPaymentToken(token);
  if (!bookingId) return { state: 'invalid' };
  const booking = await prisma.adminBooking.findUnique({
    where: { id: bookingId },
    include: {
      payments: { select: { amountCents: true, voidedAt: true } },
      paymentProofs: {
        where: { status: { not: 'REPLACED' } },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          status: true,
          method: true,
          amountCents: true,
          createdAt: true,
          reviewReason: true,
        },
      },
    },
  });
  if (!booking) return { state: 'invalid' };
  const [accounts, venuePolicy] = await Promise.all([
    readPaymentAccounts(),
    prisma.adminPolicy.findUnique({ where: { id: 'venue' }, select: { cashInstructions: true } }),
  ]);
  const methods = onlinePaymentMethods(accounts);
  const required =
    booking.paymentRule === 'FULL_PAYMENT_REQUIRED' ? booking.totalCents : booking.depositCents;
  const state =
    booking.reservation === 'CONFIRMED' || booking.reservation === 'COMPLETED'
      ? 'confirmed'
      : booking.reservation === 'CANCELLED' || booking.approval === 'REJECTED'
        ? 'closed'
        : booking.approval === 'APPROVED'
          ? 'waiting'
          : 'review';
  const latest = booking.paymentProofs[0];
  return {
    state,
    reference: booking.reference,
    clientName: booking.clientName,
    eventType: booking.eventType,
    packageName: booking.packageName,
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
    amountDueCents: Math.max(0, required - paidTotal(booking.payments)),
    deadline: booking.holdExpiresAt?.toISOString() ?? null,
    cashInstructions: venuePolicy?.cashInstructions ?? '',
    methods,
    accounts: offeredAccounts(accounts, methods),
    proof: latest
      ? {
          status: latest.status as 'SUBMITTED' | 'VERIFIED' | 'REJECTED',
          method: latest.method as OnlinePaymentMethod,
          amountCents: latest.amountCents,
          submittedAt: latest.createdAt.toISOString(),
          reviewReason: latest.reviewReason,
        }
      : null,
  };
}

const proofFields = z
  .object({
    token: z.string().min(10).max(200),
    method: z.enum(['GCASH', 'BANK_TRANSFER'], 'Choose how you paid.'),
    referenceNumber: z
      .string()
      .trim()
      .min(4, 'Enter the reference number from your receipt.')
      .max(40, 'The reference number is too long.')
      .regex(/^[A-Za-z0-9 -]+$/, 'Use only letters, numbers, spaces and dashes.'),
    amount: z
      .string()
      .trim()
      .regex(/^\d{1,7}(\.\d{1,2})?$/, 'Enter the amount you paid, for example 5000.'),
    paidOn: z.iso.date('Enter the date you paid.'),
    /** Honeypot: real visitors never see or fill this field. */
    website: z.string().max(0, 'Check the payment details.').default(''),
  })
  .strict();

/**
 * Stores a client's payment screenshot for staff verification. A newer screenshot replaces one
 * still waiting, the held date stays held while staff decide, and the client and staff are told.
 */
export async function submitPaymentProof(request: Request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site')
    throw new PaymentProofError('Send your screenshot from your payment page.', 403);
  if (Number(request.headers.get('content-length') ?? 0) > PAYMENT_PROOF_MAX_BYTES + 64 * 1024)
    throw new PaymentProofError('The file is too large. Upload a screenshot under 4 MB.', 413);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new PaymentProofError('The upload could not be read. Please try again.');
  }
  const text = (key: string) => {
    const value = form.get(key);
    return typeof value === 'string' ? value : undefined;
  };
  const parsed = proofFields.safeParse({
    token: text('token'),
    method: text('method'),
    referenceNumber: text('referenceNumber'),
    amount: text('amount'),
    paidOn: text('paidOn'),
    website: text('website') ?? '',
  });
  if (!parsed.success)
    throw new PaymentProofError(parsed.error.issues[0]?.message ?? 'Check the payment details.');
  const input = parsed.data;
  const file = form.get('file');
  if (!(file instanceof File))
    throw new PaymentProofError('Choose the screenshot of your payment.');
  const bookingId = bookingIdFromPaymentToken(input.token);
  if (!bookingId) throw new PaymentProofError('This payment link is not valid.', 404);
  const amountCents = Math.round(Number(input.amount) * 100);
  if (amountCents < 100) throw new PaymentProofError('Enter the amount you paid.');
  if (input.paidOn > manilaDate())
    throw new PaymentProofError('The payment date cannot be in the future.');
  if (input.paidOn < manilaDate(-OLDEST_PAYMENT_DAYS))
    throw new PaymentProofError('Use the date of a recent payment.');
  if (!onlinePaymentMethods(await readPaymentAccounts()).includes(input.method))
    throw new PaymentProofError(
      'This payment method is not available. Choose another method or pay at the venue.',
      409,
    );
  let prepared: Awaited<ReturnType<typeof preparePaymentProofFile>>;
  try {
    prepared = await preparePaymentProofFile(file);
  } catch (error) {
    if (error instanceof PaymentProofFileError) throw new PaymentProofError(error.message);
    throw error;
  }
  const referenceNumber = normalizeTransferReference(input.referenceNumber);
  const now = new Date();
  const context = getRequestContext(request);
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM zion_admin_bookings WHERE id = ${bookingId} FOR UPDATE`;
      const booking = await tx.adminBooking.findUnique({
        where: { id: bookingId },
        include: { payments: true },
      });
      if (!booking) throw new PaymentProofError('This payment link is not valid.', 404);
      if (booking.reservation !== 'REQUESTED' || booking.approval !== 'APPROVED')
        throw new PaymentProofError('This booking is not waiting for a payment.', 409);
      const balance = booking.totalCents - paidTotal(booking.payments);
      if (amountCents > balance)
        throw new PaymentProofError(`The amount is more than the balance of ${pesos(balance)}.`);
      const [forBooking, overall] = await Promise.all([
        tx.adminPaymentProof.count({
          where: { bookingId, createdAt: { gte: new Date(now.getTime() - DAY_MS) } },
        }),
        tx.adminPaymentProof.count({
          where: { createdAt: { gte: new Date(now.getTime() - HOUR_MS) } },
        }),
      ]);
      if (forBooking >= PROOFS_PER_BOOKING_PER_DAY)
        throw new PaymentProofError(
          'You have uploaded several screenshots today. Our team will check them, or you can contact us.',
          429,
        );
      if (overall >= PROOFS_PER_HOUR)
        throw new PaymentProofError(
          'We are receiving many uploads right now. Please try again in a few minutes.',
          429,
        );
      await tx.adminPaymentProof.updateMany({
        where: { bookingId, status: 'SUBMITTED' },
        data: { status: 'REPLACED' },
      });
      const proof = await tx.adminPaymentProof.create({
        data: {
          bookingId,
          method: input.method,
          referenceNumber,
          amountCents,
          paidOn: new Date(`${input.paidOn}T00:00:00Z`),
          fileName: prepared.fileName,
          contentType: prepared.contentType,
          sizeBytes: prepared.sizeBytes,
          sha256: prepared.sha256,
          data: new Uint8Array(prepared.data),
        },
        select: { id: true },
      });
      const methodLabel = PAYMENT_METHOD_LABELS[input.method];
      await tx.auditLog.create({
        data: {
          userId: null,
          userName: booking.clientName,
          userRole: 'PUBLIC',
          action: 'CREATE',
          module: 'Payments',
          description: `Payment screenshot for ${booking.reference} received (${methodLabel}, ${pesos(amountCents)}); waiting for staff verification.`,
          status: 'SUCCESS',
          source: 'zion-admin',
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          metadata: { bookingId, proofId: proof.id },
        },
      });
      await tx.notification.create({
        data: {
          title: 'Payment screenshot to verify',
          message: `${booking.clientName} sent a ${methodLabel} payment of ${pesos(amountCents)} for ${booking.reference}.`,
          type: NotificationType.WORKFLOW,
          priority: NotificationPriority.HIGH,
          relatedModule: 'bookings',
          relatedRecordId: booking.id,
          source: 'payment-page',
        },
      });
      const notificationIds = await enqueuePaymentProofReceived(
        tx,
        booking,
        {
          id: proof.id,
          method: input.method,
          amountCents,
          referenceNumber,
          paidOn: humanDate(input.paidOn),
        },
        now,
      );
      return { status: 'SUBMITTED' as const, notificationIds };
    },
    { maxWait: 10_000, timeout: 20_000 },
  );
}

export function paymentProofErrorResponse(error: unknown) {
  if (error instanceof PaymentProofError)
    return Response.json({ error: error.message }, { status: error.status });
  console.error('Unable to save a payment screenshot.', errorMetadata(error));
  return Response.json(
    { error: 'We could not save your screenshot right now. Please try again or contact us.' },
    { status: 500 },
  );
}
