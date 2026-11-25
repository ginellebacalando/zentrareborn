import type { Metadata } from 'next';
import { connection } from 'next/server';
import { BRAND } from '@/config/brand';
import { errorMetadata } from '@/lib/audit';
import { getPublicEventCategories } from '@/lib/services-packages';
import { getClientFeatureAvailability } from '@/lib/system-settings';
import { manilaDateKey, type VisitDay } from '@/lib/visit-rules';
import { readPublicVisitDays } from '@/services/visits';
import VisitScheduler from './_components/VisitScheduler';

export const metadata: Metadata = {
  title: `Schedule an ocular visit | ${BRAND.wordmark}`,
  description:
    'Choose a day and time to see Zion Events Place in person. You get a confirmation email with a calendar invitation right away.',
};

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

async function eventTypes() {
  try {
    return (await getPublicEventCategories())
      .filter((category) => category !== null)
      .map((category) => category.name);
  } catch {
    // The event choice is optional; the visit can be scheduled without it.
    return [];
  }
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
  return (
    <main id="main-content" tabIndex={-1} className="public-page">
      <VisitScheduler
        days={days}
        slotMinutes={slotMinutes}
        eventTypes={await eventTypes()}
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
