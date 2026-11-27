/**
 * One pricing engine and one set of date and time rules for every way a booking is made: the
 * public booking page, the server that saves its requests, and walk-in bookings at the Front desk
 * (docs/walk-ins.md). Pure functions, safe in the browser.
 */
import { BOOKING_REQUEST_RULES } from '@/config/booking';
import { bookingWindowDates, windowDateProblem, type BookingWindow } from '@/lib/booking-window';

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

/**
 * The package a guest tier belongs to. Catalog tiers are named "Zion Classic (50 guests)" and
 * "Zion Classic (100 guests)" (`tierName` in config/package-catalog.ts).
 */
export function packageFamily(name: string) {
  return name
    .replace(/\s*\(\d+\s+guests?\)\s*$/i, '')
    .trim()
    .toLowerCase();
}

/**
 * Another guest tier of the same package that costs less for this many guests, if any: 100
 * guests on "Zion Classic (50 guests)" (₱175,000 plus 50 extra guests) cost more than "Zion
 * Classic (100 guests)" at ₱199,000.
 */
export function cheaperTier<T extends PricedPackage & { name: string }>(
  packages: readonly T[],
  pkg: T,
  guests: number,
): { pkg: T; totalCents: number } | null {
  if (!Number.isFinite(guests) || guests <= 0) return null;
  const family = packageFamily(pkg.name);
  const own = packageQuote(pkg, guests).totalCents;
  let best: { pkg: T; totalCents: number } | null = null;
  for (const other of packages) {
    if (other === pkg || packageFamily(other.name) !== family) continue;
    const totalCents = packageQuote(other, guests).totalCents;
    if (totalCents < own && (!best || totalCents < best.totalCents))
      best = { pkg: other, totalCents };
  }
  return best;
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
 * the event fits the booking window (Settings > Booking window) and the venue's hours.
 */
export function bookingScheduleProblem(
  input: { date: string; startTime: string; endTime: string },
  window: BookingWindow,
  now = Date.now(),
): { field: BookingScheduleField; problem: string } | null {
  const dateProblem = windowDateProblem(input.date, window, bookingWindowDates(window, now));
  if (dateProblem) return { field: 'date', problem: dateProblem };
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
