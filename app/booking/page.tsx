import type { Metadata } from 'next';
import { connection } from 'next/server';
import { BRAND } from '@/config/brand';
import type { BookingPaymentMethod } from '@/config/booking';
import type { BookingStepRules } from '@/components/client/BookingSteps';
import { readBookingRules, readBookingWindow } from '@/lib/admin/preferences';
import { errorMetadata } from '@/lib/audit';
import { DEFAULT_BOOKING_WINDOW, bookingWindowDates } from '@/lib/booking-window';
import { readPublicDateAvailability } from '@/lib/public-availability';
import { getPublicEventCategories, getPublicPackagesForCategory } from '@/lib/services-packages';
import { getClientFeatureAvailability } from '@/lib/system-settings';
import { bookingPaymentChoices } from '@/services/booking-requests';
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

/** The days in "What happens next"; without Settings the guide leaves the days out. */
async function savedStepRules(): Promise<BookingStepRules | null> {
  try {
    const { paymentDeadlineDays, balanceDueDays } = await readBookingRules();
    return { paymentDeadlineDays, balanceDueDays };
  } catch (error) {
    console.error('Unable to read the booking rules.', errorMetadata(error));
    return null;
  }
}

/** The saved booking window, or the default when Settings cannot be read. */
async function savedBookingWindow() {
  try {
    return await readBookingWindow();
  } catch (error) {
    console.error('Unable to read the booking window.', errorMetadata(error));
    return DEFAULT_BOOKING_WINDOW;
  }
}

async function publishedPackages(slug: string): Promise<BookingPackage[]> {
  try {
    const { packages } = await getPublicPackagesForCategory(slug);
    return packages.map((pkg) => ({
      id: pkg.id,
      slug: pkg.slug,
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
  const bookingWindow = await savedBookingWindow();
  const stepRules = await savedStepRules();
  const { today, earliest, latest } = bookingWindowDates(bookingWindow);
  const feature = await getClientFeatureAvailability('inquirySubmissions');

  let categories: BookingCategory[] = [];
  let availability: BookingAvailability = { booked: [], inquired: [] };
  let paymentMethods: BookingPaymentMethod[] = ['CASH'];
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
    paymentMethods = await bookingPaymentChoices();
  } catch (error) {
    console.error('Unable to load the booking page.', errorMetadata(error));
    loadFailed = true;
  }

  return (
    <main id="main-content" tabIndex={-1} className="public-page">
      <BookingRequestForm
        categories={categories}
        availability={availability}
        bookingWindow={bookingWindow}
        earliest={earliest}
        latest={latest}
        pausedMessage={feature.enabled ? null : feature.message}
        loadFailed={loadFailed}
        paymentMethods={paymentMethods}
        rules={stepRules}
        initial={bookingInitialChoices(
          parseBookingPrefill(params, { earliest, latest }),
          categories,
        )}
      />
    </main>
  );
}
