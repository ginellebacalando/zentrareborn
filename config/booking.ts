/**
 * Booking requests sent from the public booking page are stored as admin bookings (status
 * "Request") created by this actor, so the admin can tell website requests from staff-entered ones.
 */
export const WEBSITE_BOOKING_ACTOR = 'website';

/** Rules shared by the booking page and the server that saves its requests. */
export const BOOKING_REQUEST_RULES = {
  minGuests: 10,
  maxGuests: 500,
  /** Requests must be for a date at least this many days after today (Manila). */
  minLeadDays: 1,
  maxDaysAhead: 730,
  /** Earliest start and latest end, on the half hour. */
  firstStart: '08:00',
  lastEnd: '23:30',
  minDurationMinutes: 60,
  /** Abuse guard: website requests per email address in 24 hours. */
  perEmailPerDay: 3,
} as const;

export const BOOKING_PAYMENT_METHODS = [
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'GCASH', label: 'GCash' },
  { value: 'CASH', label: 'Cash at the venue' },
] as const;

export type BookingPaymentMethod = (typeof BOOKING_PAYMENT_METHODS)[number]['value'];

/** Optional services the client can ask about; staff quote them separately. */
export const BOOKING_EXTRAS = [
  'LED wall and ambient lighting',
  'Full-course catering',
  'Photo and video coverage',
  'Event styling and florals',
  'Live entertainment',
  'Poolside cocktail hour',
] as const;

/** Half-hour times from the first start to the last end, as HH:MM. */
export function bookingTimeOptions() {
  const [firstHour, firstMinute] = BOOKING_REQUEST_RULES.firstStart.split(':').map(Number);
  const [lastHour, lastMinute] = BOOKING_REQUEST_RULES.lastEnd.split(':').map(Number);
  const times: string[] = [];
  for (
    let minutes = firstHour * 60 + firstMinute;
    minutes <= lastHour * 60 + lastMinute;
    minutes += 30
  ) {
    times.push(
      `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`,
    );
  }
  return times;
}
