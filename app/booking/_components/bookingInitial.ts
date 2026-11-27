import type { BookingCategory, BookingInitialChoices } from './booking-types';
import {
  BOOKING_EVENT_BY_SLUG,
  BOOKING_PACKAGE_BY_SLUG,
  type BookingPrefill,
} from './bookingPrefill';

/**
 * Turns a validated link pre-fill (for example from Zeni) into the booking form's starting
 * choices. The event maps to the catalog by its key, and a package tier ("classic", "grand", …)
 * to the first published package whose name contains it; anything unmatched stays unchosen.
 */
export function bookingInitialChoices(
  prefill: BookingPrefill,
  categories: readonly BookingCategory[],
): BookingInitialChoices {
  const eventKey = Object.entries(BOOKING_EVENT_BY_SLUG).find(
    ([, label]) => label === prefill.eventType,
  )?.[0];
  const category = categories.find((candidate) => candidate.key === eventKey);
  const tier = Object.entries(BOOKING_PACKAGE_BY_SLUG).find(
    ([, label]) => label === prefill.packageTier,
  )?.[0];
  // An event page names the exact guest tier; a Zeni link names a tier word.
  const packageId =
    tier === 'custom'
      ? 'custom'
      : (category?.packages.find((candidate) =>
          prefill.packageSlug
            ? candidate.slug === prefill.packageSlug
            : tier
              ? candidate.name.toLowerCase().includes(tier)
              : false,
        )?.id ?? '');
  return {
    category: category?.slug ?? '',
    packageId: category ? packageId : '',
    date: prefill.eventDate ?? '',
    startTime: prefill.startTime ?? '',
    endTime: prefill.endTime ?? '',
    guests: prefill.guestCount ? String(prefill.guestCount) : '',
    fromZeni: prefill.fromZeni,
  };
}
