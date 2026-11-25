/**
 * Rules of the booking automation, phase 1 (docs/booking-automation.md). Pure functions shared by
 * the server and the admin screens: the system approves ordinary website requests itself and
 * holds their date until a payment deadline; staff decide only the requests listed here.
 */

/** Days a client has to pay the reservation fee before the held date is released. */
export const PAYMENT_DEADLINE_DAYS = { min: 1, max: 14, default: 3 } as const;
export const REVIEW_GUEST_LIMIT = { min: 1, max: 10000 } as const;
/** Days before the event that full payment is due; Zion's published terms say 14 (phase 3). */
export const BALANCE_DUE_DAYS = { min: 1, max: 90, default: 14 } as const;

export type BookingRules = {
  paymentDeadlineDays: number;
  /** Requests with more guests than this go to staff review; null means no limit. */
  reviewGuestLimit: number | null;
  /** How many days before the event the remaining balance must be paid. */
  balanceDueDays: number;
};

export type BookingRuleField = 'paymentDeadlineDays' | 'reviewGuestLimit' | 'balanceDueDays';

export const DEFAULT_BOOKING_RULES: BookingRules = {
  paymentDeadlineDays: PAYMENT_DEADLINE_DAYS.default,
  reviewGuestLimit: null,
  balanceDueDays: BALANCE_DUE_DAYS.default,
};

function wholeNumber(text: string, limits: { min: number; max: number }) {
  const value = Number(text.trim());
  return text.trim() && Number.isInteger(value) && value >= limits.min && value <= limits.max
    ? value
    : null;
}

/**
 * Reads the Settings fields: the days to pay the reservation fee (required), the guest limit
 * (empty for none) and the days before the event full payment is due (required). Returns the
 * rules, or the field to fix and why; the server applies the same limits.
 */
export function parseBookingRules(
  daysText: string,
  guestText: string,
  balanceText: string,
): { rules: BookingRules } | { field: BookingRuleField; problem: string } {
  const days = wholeNumber(daysText, PAYMENT_DEADLINE_DAYS);
  if (days === null)
    return {
      field: 'paymentDeadlineDays',
      problem: `Enter a whole number of days from ${PAYMENT_DEADLINE_DAYS.min} to ${PAYMENT_DEADLINE_DAYS.max}.`,
    };
  const guests = guestText.trim() ? wholeNumber(guestText, REVIEW_GUEST_LIMIT) : null;
  if (guestText.trim() && guests === null)
    return {
      field: 'reviewGuestLimit',
      problem: `Enter a whole number of guests from ${REVIEW_GUEST_LIMIT.min} to ${REVIEW_GUEST_LIMIT.max}, or leave it empty for no limit.`,
    };
  const balanceDays = wholeNumber(balanceText, BALANCE_DUE_DAYS);
  if (balanceDays === null)
    return {
      field: 'balanceDueDays',
      problem: `Enter a whole number of days from ${BALANCE_DUE_DAYS.min} to ${BALANCE_DUE_DAYS.max}.`,
    };
  return {
    rules: { paymentDeadlineDays: days, reviewGuestLimit: guests, balanceDueDays: balanceDays },
  };
}

const DAY_MS = 24 * 60 * 60_000;
/** Manila is UTC+8 all year (no daylight saving time). */
const MANILA_OFFSET_MS = 8 * 60 * 60_000;

/**
 * When the remaining balance is due: the end of the Manila day `days` before the event, as in
 * Zion's terms ("full payment ... at least fourteen (14) days prior to the event date"). A booking
 * confirmed later than that owes the balance at once.
 */
export function balanceDueDate(startsAt: Date, days: number) {
  const eventDay = new Date(startsAt.getTime() + MANILA_OFFSET_MS);
  const dueDayStart = Date.UTC(
    eventDay.getUTCFullYear(),
    eventDay.getUTCMonth(),
    eventDay.getUTCDate() - days,
  );
  return new Date(dueDayStart + DAY_MS - 1 - MANILA_OFFSET_MS);
}

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

/**
 * A walk-in booking at the Front desk follows the website's review rules, except that staff who
 * meet the client may approve a larger event themselves, with a reason for the activity log.
 * `blocking` reasons still need the decision on Bookings (a price to quote, a fee to set, the
 * policy to review); `overridable` ones can be approved at the desk.
 */
export function walkInReview(request: Parameters<typeof websiteReviewReasons>[0]) {
  const all = websiteReviewReasons(request);
  const blocking = websiteReviewReasons({ ...request, reviewGuestLimit: null });
  return { blocking, overridable: all.filter((reason) => !blocking.includes(reason)) };
}
