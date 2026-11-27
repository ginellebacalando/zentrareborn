import type { Metadata } from 'next';
import { connection } from 'next/server';
import { BRAND } from '@/config/brand';
import { errorMetadata } from '@/lib/audit';
import { getPublicEventCategories, getPublicPackageBySlug } from '@/lib/services-packages';
import { getClientFeatureAvailability } from '@/lib/system-settings';
import { manilaDateKey, type VisitDay } from '@/lib/visit-rules';
import { VISIT_FIELD_LIMITS } from '@/lib/visit-types';
import { readPublicVisitDays } from '@/services/visits';
import VisitScheduler, { type VisitInitialDetails } from './_components/VisitScheduler';

export const metadata: Metadata = {
  title: `Schedule an ocular visit | ${BRAND.wordmark}`,
  description:
    'Choose a day and time to see Zion Events Place in person. You get a confirmation email with a calendar invitation right away.',
};

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
/** A catalog guest tier ("zion-essential-100"), as the event pages link it. */
const PACKAGE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*-\d{1,4}$/;

async function eventCategories() {
  try {
    return (await getPublicEventCategories())
      .filter((category) => category !== null)
      .map((category) => ({ key: category.categoryKey, name: category.name }));
  } catch {
    // The event choice is optional; the visit can be scheduled without it.
    return [];
  }
}

/**
 * Details an event page's "Schedule an ocular visit" link fills in: the event, the guest count and
 * a note naming the package. Each is checked on its own; anything unknown is left empty.
 */
async function visitDetails(
  params: { [key: string]: string | string[] | undefined },
  categories: { key: string; name: string }[],
): Promise<VisitInitialDetails> {
  const text = (key: string) => (typeof params[key] === 'string' ? params[key].trim() : '');
  const eventType = categories.find((category) => category.key === text('event'))?.name ?? '';
  const guests = Number(text('guests'));
  const guestCount =
    /^\d{1,5}$/.test(text('guests')) &&
    guests >= VISIT_FIELD_LIMITS.guests.min &&
    guests <= VISIT_FIELD_LIMITS.guests.max
      ? String(guests)
      : '';
  let packageName = '';
  if (PACKAGE_SLUG.test(text('package'))) {
    try {
      packageName = (await getPublicPackageBySlug(text('package'))).packageName;
    } catch {
      // An unknown or hidden package is simply not mentioned.
    }
  }
  const forGuests = guestCount ? ` for about ${guestCount} guests` : '';
  return {
    eventType,
    guests: guestCount,
    message: packageName ? `I’m interested in ${packageName}${forGuests}.` : '',
  };
}

/** The public ocular visit page; open times are read fresh on every visit. */
export default async function VisitPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await connection();
  const params = await searchParams;
  const asked = typeof params.date === 'string' && DATE_KEY.test(params.date) ? params.date : '';
  const fromZeni = params.source === 'zeni';
  const feature = await getClientFeatureAvailability('inquirySubmissions');
  let days: VisitDay[] = [];
  let slotMinutes = 60;
  let loadFailed = false;
  try {
    ({ days, slotMinutes } = await readPublicVisitDays());
  } catch (error) {
    console.error('Unable to load the visit page.', errorMetadata(error));
    loadFailed = true;
  }
  const askedOpen = asked ? days.some((day) => day.date === asked && day.slots.length) : false;
  const categories = await eventCategories();
  return (
    <main id="main-content" tabIndex={-1} className="public-page">
      <VisitScheduler
        days={days}
        slotMinutes={slotMinutes}
        eventTypes={categories.map((category) => category.name)}
        initialDetails={await visitDetails(params, categories)}
        initialDate={askedOpen ? asked : ''}
        initialDateUnavailable={Boolean(asked) && !askedOpen && !loadFailed}
        fromZeni={fromZeni}
        today={manilaDateKey(new Date())}
        pausedMessage={feature.enabled ? null : feature.message}
        loadFailed={loadFailed}
      />
    </main>
  );
}
