import { z } from 'zod';

/**
 * Optional starting values for the booking journey, usually from a Zeni link:
 * /booking?event=wedding&package=classic&date=2027-02-14&start=14:00&end=19:00&guests=120&source=zeni
 * Every field is validated on its own; anything missing or invalid is ignored, never guessed.
 */
export const BOOKING_EVENT_BY_SLUG = {
  wedding: 'Wedding',
  debut: 'Debut',
  birthday: 'Birthday',
  christening: 'Christening',
  'christmas-party': 'Christmas Party',
  'gender-reveal': 'Gender Reveal',
} as const;

export const BOOKING_PACKAGE_BY_SLUG = {
  classic: 'Zion Classic',
  signature: 'Zion Signature',
  grand: 'Zion Grand',
  custom: 'Custom Proposal',
} as const;

export type BookingPrefill = {
  eventType?: (typeof BOOKING_EVENT_BY_SLUG)[keyof typeof BOOKING_EVENT_BY_SLUG];
  packageTier?: (typeof BOOKING_PACKAGE_BY_SLUG)[keyof typeof BOOKING_PACKAGE_BY_SLUG];
  eventDate?: string;
  startTime?: string;
  endTime?: string;
  guestCount?: number;
  fromZeni: boolean;
};

const MAX_DAYS_AHEAD = 3 * 366;
const eventSchema = z.enum(
  Object.keys(BOOKING_EVENT_BY_SLUG) as [keyof typeof BOOKING_EVENT_BY_SLUG],
);
const packageSchema = z.enum(
  Object.keys(BOOKING_PACKAGE_BY_SLUG) as [keyof typeof BOOKING_PACKAGE_BY_SLUG],
);
const dateSchema = z.iso.date();
const clockSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const guestsSchema = z
  .string()
  .regex(/^\d{1,3}$/)
  .transform(Number)
  .pipe(z.number().int().min(1).max(500));

function daysBetween(from: string, to: string) {
  return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
}

/** `today` is the visitor's calendar date (YYYY-MM-DD); past and far-future dates are ignored. */
export function parseBookingPrefill(
  search: string | URLSearchParams,
  today: string,
): BookingPrefill {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const read = (key: string) => params.get(key)?.trim().toLowerCase() ?? undefined;
  const prefill: BookingPrefill = { fromZeni: read('source') === 'zeni' };

  const event = eventSchema.safeParse(read('event'));
  if (event.success) prefill.eventType = BOOKING_EVENT_BY_SLUG[event.data];
  const tier = packageSchema.safeParse(read('package'));
  if (tier.success) prefill.packageTier = BOOKING_PACKAGE_BY_SLUG[tier.data];
  const date = dateSchema.safeParse(read('date'));
  if (date.success && date.data >= today && daysBetween(today, date.data) <= MAX_DAYS_AHEAD)
    prefill.eventDate = date.data;
  const start = clockSchema.safeParse(read('start'));
  const end = clockSchema.safeParse(read('end'));
  if (start.success && end.success && start.data < end.data) {
    prefill.startTime = start.data;
    prefill.endTime = end.data;
  }
  const guests = guestsSchema.safeParse(read('guests'));
  if (guests.success) prefill.guestCount = guests.data;
  return prefill;
}

/** The journey has no time fields, so a preferred time travels in the notes for staff. */
export function bookingPrefillNote(prefill: BookingPrefill) {
  if (!prefill.startTime || !prefill.endTime) return '';
  return `Preferred time${prefill.fromZeni ? ' (from Zeni)' : ''}: ${prefill.startTime}–${prefill.endTime}, Manila time.`;
}

export function hasBookingPrefill(prefill: BookingPrefill) {
  return Boolean(
    prefill.eventType ||
    prefill.packageTier ||
    prefill.eventDate ||
    prefill.guestCount ||
    prefill.startTime,
  );
}
