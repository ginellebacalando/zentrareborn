import { z } from 'zod';

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
      .trim()
      .regex(/^[+\d\s()-]{7,40}$/, 'Enter a valid contact number.'),
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
  if (b.verification !== 'VERIFIED')
    return 'Verify the client contact before confirming; flagged or unreviewed requests cannot reserve dates.';
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
export function bookingEmail(
  b: {
    reference: string;
    clientName: string;
    approval: string;
    reservation: string;
    totalCents: number;
    depositCents: number;
    paymentRule: string;
  },
  paid: number,
  instructions: string,
  event: string,
) {
  const requirement =
    b.paymentRule === 'NO_PAYMENT_REQUIRED'
      ? 'No payment is required to secure this reservation.'
      : b.paymentRule === 'FULL_PAYMENT_REQUIRED'
        ? `Full cash payment of ${money(b.totalCents)} is required before confirmation.`
        : `A cash reservation fee of ${money(b.depositCents)} is required before confirmation.`;
  return {
    subject: `Zion Events Place | ${event.replaceAll('_', ' ')} | ${b.reference}`,
    body: `Hello ${b.clientName},\n\nBooking reference: ${b.reference}\nApproval: ${b.approval}\nReservation: ${b.reservation}\nPayment: ${paymentStatus(b.totalCents, paid)} (${money(paid)} received / ${money(b.totalCents)} total)\n\n${requirement}\n${instructions}\n\nApproval alone does not confirm a reservation or indicate payment. Only a CONFIRMED reservation secures the event schedule.\n\nZion Events Place`,
  };
}
