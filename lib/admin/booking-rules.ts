/**
 * Rules of the booking automation, phase 1 (docs/booking-automation.md). Pure functions shared by
 * the server and the admin screens: the system approves ordinary website requests itself and
 * holds their date until a payment deadline; staff decide only the requests listed here.
 */

/** Days a client has to pay the reservation fee before the held date is released. */
export const PAYMENT_DEADLINE_DAYS = { min: 1, max: 14, default: 3 } as const;
export const REVIEW_GUEST_LIMIT = { min: 1, max: 10000 } as const;

export type BookingRules = {
  paymentDeadlineDays: number;
  /** Requests with more guests than this go to staff review; null means no limit. */
  reviewGuestLimit: number | null;
};

export const DEFAULT_BOOKING_RULES: BookingRules = {
  paymentDeadlineDays: PAYMENT_DEADLINE_DAYS.default,
  reviewGuestLimit: null,
};

/**
 * Reads the Settings fields: the days to pay (required) and the guest limit (empty for none).
 * Returns the rules, or the field to fix and why; the server applies the same limits.
 */
export function parseBookingRules(
  daysText: string,
  guestText: string,
):
  { rules: BookingRules } | { field: 'paymentDeadlineDays' | 'reviewGuestLimit'; problem: string } {
  const days = Number(daysText.trim());
  if (
    !daysText.trim() ||
    !Number.isInteger(days) ||
    days < PAYMENT_DEADLINE_DAYS.min ||
    days > PAYMENT_DEADLINE_DAYS.max
  )
    return {
      field: 'paymentDeadlineDays',
      problem: `Enter a whole number of days from ${PAYMENT_DEADLINE_DAYS.min} to ${PAYMENT_DEADLINE_DAYS.max}.`,
    };
  if (!guestText.trim()) return { rules: { paymentDeadlineDays: days, reviewGuestLimit: null } };
  const guests = Number(guestText.trim());
  if (
    !Number.isInteger(guests) ||
    guests < REVIEW_GUEST_LIMIT.min ||
    guests > REVIEW_GUEST_LIMIT.max
  )
    return {
      field: 'reviewGuestLimit',
      problem: `Enter a whole number of guests from ${REVIEW_GUEST_LIMIT.min} to ${REVIEW_GUEST_LIMIT.max}, or leave it empty for no limit.`,
    };
  return { rules: { paymentDeadlineDays: days, reviewGuestLimit: guests } };
}

const DAY_MS = 24 * 60 * 60_000;

/** Whether the venue policy asks for money before confirmation, so a hold needs a deadline. */
export function requiresPayment(booking: { paymentRule: string; depositCents: number }) {
  return (
    booking.paymentRule === 'FULL_PAYMENT_REQUIRED' ||
    (booking.paymentRule === 'DEPOSIT_REQUIRED' && booking.depositCents > 0)
  );
}

/**
 * When an approved request's payment is due: `days` after `from`, but never after the event
 * starts, so a booking for tomorrow must be paid before it begins.
 */
export function paymentDeadline(from: Date, startsAt: Date, days: number) {
  const due = Math.min(from.getTime() + days * DAY_MS, startsAt.getTime());
  return new Date(Math.max(from.getTime(), due));
}

/**
 * Why a website request needs a staff decision before it can hold its date, or an empty list when
 * the system approves it by itself. The booking page already refuses past, unavailable and
 * out-of-hours requests; these are the cases a person has to look at.
 */
export function websiteReviewReasons(request: {
  totalCents: number;
  depositCents: number;
  paymentRule: string;
  guests: number;
  policyReviewed: boolean;
  reviewGuestLimit: number | null;
}) {
  const reasons: string[] = [];
  if (!request.policyReviewed)
    reasons.push('the venue payment policy has not been reviewed in Settings yet');
  if (request.totalCents < 1) reasons.push('custom proposal: Zion needs to quote a price');
  else if (request.paymentRule === 'NO_PAYMENT_REQUIRED')
    reasons.push('no payment is required, so staff confirm the date themselves');
  else if (!requiresPayment(request)) reasons.push('the package has no reservation fee set');
  if (request.reviewGuestLimit !== null && request.guests > request.reviewGuestLimit)
    reasons.push(`more than ${request.reviewGuestLimit} guests`);
  return reasons;
}
