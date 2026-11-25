/**
 * One pricing engine and one set of date and time rules for every way a booking is made: the
 * public booking page, the server that saves its requests, and walk-in bookings at the Front desk
 * (docs/walk-ins.md). Pure functions, safe in the browser.
 */
import { BOOKING_REQUEST_RULES } from '@/config/booking';

/** The published package fields that set a price, in pesos as the catalog stores them. */
export type PricedPackage = {
  price: number;
  paxIncluded: number;
  excessPaxFee: number;
  reservationFee: number;
};

/**
 * The package price for a guest count, in centavos: guests above the package's included guests
 * pay its per-guest fee, and the reservation fee never exceeds the total.
 */
export function packageQuote(pkg: PricedPackage, guests: number) {
  const extraGuests = Number.isFinite(guests) ? Math.max(0, guests - pkg.paxIncluded) : 0;
  const totalCents = Math.round((pkg.price + extraGuests * pkg.excessPaxFee) * 100);
  return {
    extraGuests,
    extraCents: Math.round(extraGuests * pkg.excessPaxFee * 100),
    totalCents,
    depositCents: Math.min(Math.round(pkg.reservationFee * 100), totalCents),
  };
}

export type BookingScheduleField = 'date' | 'startTime' | 'endTime';

const DAY_MS = 24 * 60 * 60_000;
const MANILA_OFFSET_MS = 8 * 60 * 60_000;

function minutesOf(clock: string) {
  const [hours, minutes] = clock.split(':').map(Number);
  return hours * 60 + minutes;
}

/** The Manila date (UTC+8, no daylight saving time) `days` after today, as YYYY-MM-DD. */
export function manilaDateAfter(days: number, now = Date.now()) {
  return new Date(now + MANILA_OFFSET_MS + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * The first date or time problem of a booking, worded as the booking page shows it, or null when
 * the event fits the booking window and the venue's hours.
 */
export function bookingScheduleProblem(
  input: { date: string; startTime: string; endTime: string },
  now = Date.now(),
): { field: BookingScheduleField; problem: string } | null {
  if (input.date < manilaDateAfter(BOOKING_REQUEST_RULES.minLeadDays, now))
    return { field: 'date', problem: 'Please choose a date from tomorrow onward.' };
  if (input.date > manilaDateAfter(BOOKING_REQUEST_RULES.maxDaysAhead, now))
    return { field: 'date', problem: 'Please choose a date within the next two years.' };
  const start = minutesOf(input.startTime);
  const end = minutesOf(input.endTime);
  if (
    start < minutesOf(BOOKING_REQUEST_RULES.firstStart) ||
    end > minutesOf(BOOKING_REQUEST_RULES.lastEnd) ||
    end - start < BOOKING_REQUEST_RULES.minDurationMinutes
  )
    return { field: 'endTime', problem: 'The event must end at least one hour after it starts.' };
  return null;
}
