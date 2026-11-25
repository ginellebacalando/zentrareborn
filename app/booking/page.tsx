import type { Metadata } from 'next';
import { connection } from 'next/server';
import { BRAND } from '@/config/brand';
import { BOOKING_REQUEST_RULES } from '@/config/booking';
import { errorMetadata } from '@/lib/audit';
import { readPublicDateAvailability } from '@/lib/public-availability';
import { getPublicEventCategories, getPublicPackagesForCategory } from '@/lib/services-packages';
import { getClientFeatureAvailability } from '@/lib/system-settings';
import BookingRequestForm from './_components/BookingRequestForm';
import { bookingInitialChoices } from './_components/bookingInitial';
import { parseBookingPrefill } from './_components/bookingPrefill';
import type {
  BookingAvailability,
  BookingCategory,
  BookingPackage,
} from './_components/booking-types';

export const metadata: Metadata = {
  title: `Book your event | ${BRAND.wordmark}`,
  description:
    'Send a booking request to Zion Events Place: choose your event, date and package, and our team will confirm the details with you.',
};

/** Only local files and the image hosts allowed in next.config.ts reach next/image. */
function bookingImage(value: string | null) {
  if (!value) return null;
  if (value.startsWith('/')) return value;
  try {
    const { protocol, hostname } = new URL(value);
    const allowed = hostname.endsWith('.supabase.co') || hostname === 'images.unsplash.com';
    return protocol === 'https:' && allowed ? value : null;
  } catch {
    return null;
  }
}

/** A Manila calendar date (UTC+8, no daylight saving) shifted by `days`, as YYYY-MM-DD. */
function manilaIso(days: number) {
  return new Date(Date.now() + 8 * 3_600_000 + days * 86_400_000).toISOString().slice(0, 10);
}

async function publishedPackages(slug: string): Promise<BookingPackage[]> {
  try {
    const { packages } = await getPublicPackagesForCategory(slug);
    return packages.map((pkg) => ({
      id: pkg.id,
      name: pkg.packageName,
      price: pkg.price,
      paxIncluded: pkg.paxIncluded,
      excessPaxFee: pkg.excessPaxFee,
      reservationFee: pkg.reservationFee,
      checkInTime: pkg.checkInTime,
      checkOutTime: pkg.checkOutTime,
      inclusions: pkg.inclusions.map((inclusion) => inclusion.inclusionName),
    }));
  } catch {
    // A category without a published package still accepts custom-proposal requests.
    return [];
  }
}

/** The booking request page: catalog and date availability are read fresh on every visit. */
export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await connection();
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === 'string') params.set(key, value);
  }
  const today = manilaIso(0);
  const earliest = manilaIso(BOOKING_REQUEST_RULES.minLeadDays);
  const latest = manilaIso(BOOKING_REQUEST_RULES.maxDaysAhead);
  const feature = await getClientFeatureAvailability('inquirySubmissions');

  let categories: BookingCategory[] = [];
  let availability: BookingAvailability = { booked: [], inquired: [] };
  let loadFailed = false;
  try {
    const listed = (await getPublicEventCategories()).filter((category) => category !== null);
    categories = await Promise.all(
      listed.map(async (category) => ({
        slug: category.slug,
        key: category.categoryKey,
        name: category.name,
        imageUrl: bookingImage(category.coverImageUrl),
        packages: await publishedPackages(category.slug),
      })),
    );
    availability = await readPublicDateAvailability(today, latest);
  } catch (error) {
    console.error('Unable to load the booking page.', errorMetadata(error));
    loadFailed = true;
  }

  return (
    <main id="main-content" tabIndex={-1} className="public-page">
      <BookingRequestForm
        categories={categories}
        availability={availability}
        earliest={earliest}
        latest={latest}
        pausedMessage={feature.enabled ? null : feature.message}
        loadFailed={loadFailed}
        initial={bookingInitialChoices(parseBookingPrefill(params, earliest), categories)}
      />
    </main>
  );
}
