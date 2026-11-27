import { z } from 'zod';

import { automationJobLabel } from '@/lib/automation/catalog';
import { PHILIPPINE_MOBILE_ERROR, philippineMobile } from '@/lib/phone-number';

export const paymentRules = [
  'DEPOSIT_REQUIRED',
  'FULL_PAYMENT_REQUIRED',
  'NO_PAYMENT_REQUIRED',
] as const;
export type PaymentRule = (typeof paymentRules)[number];
export function canAccessAdmin(role: string, status: string) {
  return (
    (role === 'ADMIN' || role === 'SUPERADMIN') &&
    (status === 'ACTIVE' || status === 'PASSWORD_RESET_REQUIRED')
  );
}
export const bookingInput = z
  .object({
    clientName: z.string().trim().min(2).max(180),
    email: z
      .email()
      .max(255)
      .transform((v) => v.toLowerCase()),
    phone: z
      .string()
      .refine((value) => philippineMobile(value) !== null, PHILIPPINE_MOBILE_ERROR)
      .transform((value) => philippineMobile(value) ?? value),
    eventType: z.string().trim().min(2).max(100),
    packageName: z.string().trim().min(2).max(180),
    venue: z.literal('Zion Events Place'),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    guests: z.number().int().min(1).max(10000),
    totalCents: z.number().int().min(1).max(2000000000),
    depositCents: z.number().int().min(0).max(2000000000),
    paymentRule: z.enum(paymentRules),
    notes: z.string().trim().max(3000).default(''),
  })
  .strict()
  .superRefine((b, ctx) => {
    if (Date.parse(b.endsAt) <= Date.parse(b.startsAt))
      ctx.addIssue({
        code: 'custom',
        message: 'End must be after start.',
        path: ['endsAt'],
      });
    if (Date.parse(b.startsAt) < Date.now())
      ctx.addIssue({
        code: 'custom',
        message: 'Choose a future event date.',
        path: ['startsAt'],
      });
    if (
      b.depositCents > b.totalCents ||
      (b.paymentRule === 'DEPOSIT_REQUIRED' && b.depositCents < 1)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Specify a valid reservation fee, not more than the total.',
        path: ['depositCents'],
      });
  });
export function paidTotal(payments: { amountCents: number; voidedAt: Date | string | null }[]) {
  return payments.reduce((sum, p) => sum + (p.voidedAt ? 0 : p.amountCents), 0);
}
export function paymentStatus(total: number, paid: number) {
  return paid >= total ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID';
}
/**
 * Why a booking cannot be confirmed yet, or null when it can. Since the booking automation
 * (docs/booking-automation.md), the received payment is what secures a date: contact verification
 * is optional, but a request flagged as suspicious stays blocked until staff clear the flag.
 */
export function confirmationError(
  b: {
    approval: string;
    verification: string;
    reservation: string;
    paymentRule: string;
    depositCents: number;
    totalCents: number;
  },
  paid: number,
  reviewed: boolean,
) {
  if (!reviewed)
    return 'The venue must review its reservation and cash payment policy in Settings first.';
  if (b.approval !== 'APPROVED') return 'Approve this request first. Approval is not confirmation.';
  if (b.verification === 'FLAGGED')
    return 'This request is flagged as suspicious. Verify the client contact to clear the flag first.';
  if (b.reservation !== 'REQUESTED') return 'Only a requested reservation can be confirmed.';
  if (b.paymentRule === 'DEPOSIT_REQUIRED' && paid < b.depositCents)
    return 'The required cash reservation fee has not been received.';
  if (b.paymentRule === 'FULL_PAYMENT_REQUIRED' && paid < b.totalCents)
    return 'Full cash payment is required before confirmation.';
  return null;
}
export function overlaps(a: { startsAt: Date; endsAt: Date }, b: { startsAt: Date; endsAt: Date }) {
  return a.startsAt < b.endsAt && a.endsAt > b.startsAt;
}
export function money(cents: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(cents / 100);
}
export function eventDate(value: Date | string) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
/** The opening paragraph of a booking notice about the payment deadline or a payment. */
function noticeLead(event: string, amount: string, due: string | null, note?: string) {
  if (event === 'PAYMENT_VERIFIED')
    return 'We verified your payment with our records. Thank you! It is now recorded with your booking.';
  if (event === 'PAYMENT_REJECTED')
    return `We could not verify the payment screenshot you sent. ${note ?? ''} Please upload a clearer or the correct screenshot on your payment page${due ? ` by ${due} (Manila time)` : ''}, or contact us.`.replace(
      /\s+/g,
      ' ',
    );
  if (event === 'REQUEST_APPROVED' && due)
    return `Your request is approved and your date is on hold for you. Please pay ${amount} by ${due} (Manila time) to confirm it. If we do not receive it by then, the hold ends and the date opens to other clients.`;
  if (event === 'HOLD_EXTENDED' && due)
    return `Your payment deadline was extended. Please pay ${amount} by ${due} (Manila time) to keep your date on hold.`;
  if (event === 'HOLD_EXPIRED')
    return 'The payment deadline passed before we received your payment, so your date is no longer on hold and other clients may book it. If you still want this date, send a new booking request or contact us.';
  return null;
}

export function bookingEmail(
  b: {
    reference: string;
    clientName: string;
    approval: string;
    reservation: string;
    totalCents: number;
    depositCents: number;
    paymentRule: string;
    /** Payment deadline of an approved request, when it holds its date (booking automation). */
    holdExpiresAt?: Date | string | null;
  },
  paid: number,
  instructions: string,
  event: string,
  note?: string,
) {
  const dueNow = money(
    b.paymentRule === 'FULL_PAYMENT_REQUIRED'
      ? b.totalCents - paid
      : Math.max(0, b.depositCents - paid),
  );
  const amount =
    b.paymentRule === 'FULL_PAYMENT_REQUIRED'
      ? `the full amount of ${dueNow}`
      : `the reservation fee of ${dueNow}`;
  const due = b.holdExpiresAt ? eventDate(b.holdExpiresAt) : null;
  const lead = noticeLead(event, amount, due, note);
  const asksForFee = !['NO_PAYMENT_REQUIRED', 'FULL_PAYMENT_REQUIRED'].includes(b.paymentRule);
  // A closed booking asks for nothing; a confirmed one only for its balance, through the
  // instructions, since the confirmation rule is already met.
  const closed = ['CANCELLED', 'COMPLETED'].includes(b.reservation) || b.approval === 'REJECTED';
  const confirmed = b.reservation === 'CONFIRMED';
  const requirement =
    closed || confirmed
      ? ''
      : b.paymentRule === 'NO_PAYMENT_REQUIRED'
        ? 'No payment is required to secure this reservation.'
        : b.paymentRule === 'FULL_PAYMENT_REQUIRED'
          ? `Full payment of ${money(b.totalCents)} is required before confirmation.`
          : `A reservation fee of ${money(b.depositCents)} is required before confirmation.`;
  const howToPay = closed || (confirmed && paid >= b.totalCents) ? '' : instructions;
  const paymentLines = [requirement, howToPay].filter(Boolean).join('\n');
  const payment = paymentStatus(b.totalCents, paid);
  const closing =
    'Approval alone does not confirm a reservation or indicate payment. Only a CONFIRMED reservation secures the event schedule.';
  return {
    // The notice's name in sentence case ("Payment deadline extended"), never the raw event code.
    subject: `Zion Events Place | ${automationJobLabel(event)} | ${b.reference}`,
    body: `Hello ${b.clientName},\n\n${lead ? `${lead}\n\n` : ''}Booking reference: ${b.reference}\nApproval: ${b.approval}\nReservation: ${b.reservation}\nPayment: ${payment} (${money(paid)} received / ${money(b.totalCents)} total)\n\n${paymentLines ? `${paymentLines}\n\n` : ''}${closing}\n\nZion Events Place`,
    /** The same notice in parts, for the email's booking summary (lib/automation/templates.ts). */
    parts: {
      greeting: `Hello ${b.clientName},`,
      lead,
      reference: b.reference,
      approval: b.approval,
      reservation: b.reservation,
      payment,
      total: money(b.totalCents),
      fee: asksForFee && b.depositCents > 0 ? money(b.depositCents) : null,
      received: money(paid),
      balance: money(Math.max(0, b.totalCents - paid)),
      requirement,
      instructions: howToPay,
      closing,
      emphasis: [dueNow, ...(due ? [due] : [])],
    },
  };
}
