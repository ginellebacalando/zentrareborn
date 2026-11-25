/**
 * Pre-filled links Zeni offers instead of submitting anything itself. The booking page parses
 * these values with zod (app/booking/_components/bookingPrefill.ts) and ignores anything invalid;
 * the visit page (app/visit) does the same for its preferred day.
 */
export type BookingLinkInput = {
  eventType?: string;
  packageName?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  guests?: number | null;
};

const EVENT_SLUGS: Record<string, string> = {
  wedding: 'wedding',
  weddings: 'wedding',
  debut: 'debut',
  birthday: 'birthday',
  christening: 'christening',
  'gender reveal': 'gender-reveal',
  christmas: 'christmas-party',
  'christmas party': 'christmas-party',
};

export function bookingEventSlug(eventType: string | undefined) {
  return eventType ? EVENT_SLUGS[eventType.trim().toLowerCase()] : undefined;
}

/** Only exact tier words map to the booking form's package styles; nothing is guessed. */
export function bookingPackageSlug(packageName: string | undefined) {
  const match = packageName?.match(/\b(classic|signature|grand|custom)\b/i)?.[1];
  return match?.toLowerCase();
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function buildBookingLink(input: BookingLinkInput) {
  const params = new URLSearchParams();
  const event = bookingEventSlug(input.eventType);
  const tier = bookingPackageSlug(input.packageName);
  if (event) params.set('event', event);
  if (tier) params.set('package', tier);
  if (input.date && DATE_KEY.test(input.date)) params.set('date', input.date);
  if (
    input.startTime &&
    input.endTime &&
    CLOCK.test(input.startTime) &&
    CLOCK.test(input.endTime) &&
    input.startTime < input.endTime
  ) {
    params.set('start', input.startTime);
    params.set('end', input.endTime);
  }
  if (input.guests && Number.isInteger(input.guests) && input.guests > 0 && input.guests <= 500)
    params.set('guests', String(input.guests));
  params.set('source', 'zeni');
  return `/booking?${params.toString()}`;
}

/** The ocular visit page (docs/visits.md), opened on the visitor's date when it has open times. */
export function buildVisitLink(date?: string) {
  const params = new URLSearchParams();
  if (date && DATE_KEY.test(date)) params.set('date', date);
  params.set('source', 'zeni');
  return `/visit?${params.toString()}`;
}
