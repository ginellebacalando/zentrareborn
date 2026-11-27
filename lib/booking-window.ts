/**
 * The booking window: how soon and how far ahead guests can book an event. One setting
 * (Settings > Booking window) for the booking page and the server that saves its requests, walk-ins
 * at the Front desk, the event package pages and Zeni's calendar (docs/booking-window.md). Pure
 * functions, safe in the browser. Dates are Manila calendar days (UTC+8 all year) as YYYY-MM-DD.
 */

export type BookingWindow = {
  /** Events must be at least this many days after today. */
  minNoticeDays: number;
  /** Events can be booked up to this many months after today. */
  maxMonthsAhead: number;
};

/** The team plan suggests 14 days and 18 months; both are defaults Zion still has to confirm. */
export const BOOKING_WINDOW_LIMITS = {
  minNoticeDays: { min: 1, max: 180, default: 14 },
  maxMonthsAhead: { min: 1, max: 36, default: 18 },
} as const;

export const DEFAULT_BOOKING_WINDOW: BookingWindow = {
  minNoticeDays: BOOKING_WINDOW_LIMITS.minNoticeDays.default,
  maxMonthsAhead: BOOKING_WINDOW_LIMITS.maxMonthsAhead.default,
};

export type BookingWindowField = keyof BookingWindow;

function wholeIn(value: unknown, limits: { min: number; max: number }) {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= limits.min &&
    value <= limits.max
    ? value
    : null;
}

/** A stored window; anything missing or out of range falls back to the default. */
export function normalizeBookingWindow(value: unknown): BookingWindow {
  const stored =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    minNoticeDays:
      wholeIn(stored.minNoticeDays, BOOKING_WINDOW_LIMITS.minNoticeDays) ??
      DEFAULT_BOOKING_WINDOW.minNoticeDays,
    maxMonthsAhead:
      wholeIn(stored.maxMonthsAhead, BOOKING_WINDOW_LIMITS.maxMonthsAhead) ??
      DEFAULT_BOOKING_WINDOW.maxMonthsAhead,
  };
}

/** Reads the two Settings fields; the server applies the same limits. */
export function parseBookingWindow(
  noticeText: string,
  monthsText: string,
): { window: BookingWindow } | { field: BookingWindowField; problem: string } {
  const read = (text: string) => (text.trim() ? Number(text.trim()) : Number.NaN);
  const notice = wholeIn(read(noticeText), BOOKING_WINDOW_LIMITS.minNoticeDays);
  if (notice === null)
    return {
      field: 'minNoticeDays',
      problem: `Enter a whole number of days from ${BOOKING_WINDOW_LIMITS.minNoticeDays.min} to ${BOOKING_WINDOW_LIMITS.minNoticeDays.max}.`,
    };
  const months = wholeIn(read(monthsText), BOOKING_WINDOW_LIMITS.maxMonthsAhead);
  if (months === null)
    return {
      field: 'maxMonthsAhead',
      problem: `Enter a whole number of months from ${BOOKING_WINDOW_LIMITS.maxMonthsAhead.min} to ${BOOKING_WINDOW_LIMITS.maxMonthsAhead.max}.`,
    };
  return { window: { minNoticeDays: notice, maxMonthsAhead: months } };
}

const MANILA_OFFSET_MS = 8 * 60 * 60_000;

function utcOf(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month, day };
}

function isoOf(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** Today in Manila. */
export function manilaToday(now = Date.now()) {
  return new Date(now + MANILA_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, days: number) {
  const { year, month, day } = utcOf(iso);
  return isoOf(year, month - 1, day + days);
}

/** The same day `months` later (or earlier); a day the month lacks becomes its last day. */
export function addMonthsIso(iso: string, months: number) {
  const { year, month, day } = utcOf(iso);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = daysInMonth(target.getUTCFullYear(), target.getUTCMonth());
  return isoOf(target.getUTCFullYear(), target.getUTCMonth(), Math.min(day, lastDay));
}

export type BookingWindowDates = {
  today: string;
  /** The first date that can be booked. */
  earliest: string;
  /** The last date that can be booked. */
  latest: string;
};

export function bookingWindowDates(window: BookingWindow, now = Date.now()): BookingWindowDates {
  const today = manilaToday(now);
  return {
    today,
    earliest: addDaysIso(today, window.minNoticeDays),
    latest: addMonthsIso(today, window.maxMonthsAhead),
  };
}

export type WindowPosition = 'past' | 'too_soon' | 'open' | 'too_far';

/** Where a date falls: before today, inside the notice period, bookable, or beyond the window. */
export function windowPosition(date: string, dates: BookingWindowDates): WindowPosition {
  if (date < dates.today) return 'past';
  if (date < dates.earliest) return 'too_soon';
  return date > dates.latest ? 'too_far' : 'open';
}

/**
 * The first day a date beyond the window can be booked, `maxMonthsAhead` months before it. When
 * that month is shorter (31 August, 18 months earlier, is "31 February"), booking opens on the
 * first of the next month, the first day whose window reaches the date.
 */
export function bookingOpensOn(date: string, window: BookingWindow) {
  const opening = addMonthsIso(date, -window.maxMonthsAhead);
  return utcOf(opening).day < utcOf(date).day ? addDaysIso(opening, 1) : opening;
}

const MONTH_YEAR = new Intl.DateTimeFormat('en-PH', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const LONG_DATE = new Intl.DateTimeFormat('en-PH', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "May 2028". */
export function monthYearLabel(iso: string) {
  return MONTH_YEAR.format(new Date(`${iso.slice(0, 7)}-01T12:00:00Z`));
}

/** "May 27, 2028". */
export function longDateLabel(iso: string) {
  return LONG_DATE.format(new Date(`${iso}T12:00:00Z`));
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/** "Book at least 14 days ahead." */
export function noticeSentence(window: BookingWindow) {
  return `Book at least ${plural(window.minNoticeDays, 'day')} ahead.`;
}

/** "You can book up to 18 months ahead (until May 2028)." */
export function limitSentence(window: BookingWindow, dates: Pick<BookingWindowDates, 'latest'>) {
  return `You can book up to ${plural(window.maxMonthsAhead, 'month')} ahead (until ${monthYearLabel(dates.latest)}).`;
}

/** The booking page's problem for a date outside the window, or null when it fits. */
export function windowDateProblem(
  date: string,
  window: BookingWindow,
  dates: Pick<BookingWindowDates, 'earliest' | 'latest'>,
): string | null {
  if (date < dates.earliest)
    return `Choose a date from ${longDateLabel(dates.earliest)} onward. ${noticeSentence(window)}`;
  if (date > dates.latest)
    return `Choose a date up to ${longDateLabel(dates.latest)}. ${limitSentence(window, dates)}`;
  return null;
}
