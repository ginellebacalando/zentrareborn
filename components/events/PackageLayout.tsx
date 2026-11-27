import Link from 'next/link';
import { connection } from 'next/server';

import ClientFeatureUnavailable from '@/components/client/ClientFeatureUnavailable';
import TestimonialSection from '@/components/client/TestimonialSection';
import { ButtonLink } from '@/components/shared/Button';
import FadeIn from '@/components/shared/FadeIn';
import { eventPackagePages, type EventPackageMediaKey } from '@/config/event-package-pages';
import { eventPhotos } from '@/config/event-photos';
import { errorMetadata } from '@/lib/audit';
import { packageFamilies, type PackageFamily } from '@/lib/event-packages';
import { getPublicPackagesForCategory, ServicesPackagesError } from '@/lib/services-packages';
import { getClientFeatureAvailability } from '@/lib/system-settings';
import EventHero from './EventHero';
import EventPackages from './EventPackages';
import EventPhotoGrid from './EventPhotoGrid';
import styles from './EventPackages.module.css';

/** How the page names the event: "Debut packages", "Debuts at Zion". */
export const EVENT_NAMES: Record<EventPackageMediaKey, { one: string; many: string }> = {
  weddings: { one: 'Wedding', many: 'Weddings' },
  debuts: { one: 'Debut', many: 'Debuts' },
  birthdays: { one: 'Birthday', many: 'Birthdays' },
  christening: { one: 'Christening', many: 'Christenings' },
  genderReveal: { one: 'Gender reveal', many: 'Gender reveals' },
  christmasParty: { one: 'Christmas party', many: 'Christmas parties' },
};

type PackagesLoad =
  | { status: 'ready'; families: PackageFamily[]; bookingEvent: string }
  | { status: 'empty' | 'failed' };

/** The event's published packages from the database (lib/services-packages.ts). */
async function readPackages(categorySlug: string): Promise<PackagesLoad> {
  try {
    const { category, packages } = await getPublicPackagesForCategory(categorySlug);
    const families = packageFamilies(packages);
    return families.length
      ? { status: 'ready', families, bookingEvent: category?.categoryKey ?? '' }
      : { status: 'empty' };
  } catch (error) {
    if (error instanceof ServicesPackagesError && error.status === 404) return { status: 'empty' };
    console.error('Unable to load the event packages.', errorMetadata(error));
    return { status: 'failed' };
  }
}

/**
 * An event package page (docs/event-pages.md): a real photo of the event at Zion, the packages
 * from the published catalog with the booking estimate, real photos, then testimonies. Package
 * names, prices and inclusions come only from the database; brochure pages are never shown.
 */
export default async function PackageLayout({ eventType }: { eventType: EventPackageMediaKey }) {
  await connection();
  const page = eventPackagePages[eventType];
  const photos = eventPhotos[eventType];
  const names = EVENT_NAMES[eventType];
  const availability = await getClientFeatureAvailability('packages');
  const packages = availability.enabled ? await readPackages(page.eventCategorySlug) : null;
  const galleryHref = `/gallery?category=${photos.galleryCategory}`;

  return (
    <main id="main-content" tabIndex={-1} className="public-page responsive-page">
      <EventHero title={page.heroEyebrow} line={page.heroTitle} photo={photos.hero} />

      {!availability.enabled ? (
        <ClientFeatureUnavailable title="Packages Are Paused" message={availability.message} />
      ) : packages?.status === 'ready' ? (
        <EventPackages
          families={packages.families}
          bookingEvent={packages.bookingEvent}
          eventLabel={names.one}
        />
      ) : (
        <section id="packages" className={styles.section} aria-label={`${names.one} packages`}>
          <div
            className={styles.emptyState}
            role={packages?.status === 'failed' ? 'alert' : undefined}
          >
            <p>
              {packages?.status === 'failed'
                ? 'We couldn’t load the packages just now. Please refresh the page, or ask our team for the rates.'
                : `Our ${names.one.toLowerCase()} packages will be listed here soon. Our team can share the current rates.`}
            </p>
            <div className={styles.emptyActions}>
              <ButtonLink href="/contact" variant="primary">
                Contact our team
              </ButtonLink>
              <ButtonLink href="/visit" variant="secondary">
                Schedule an ocular visit
              </ButtonLink>
            </div>
          </div>
        </section>
      )}

      <FadeIn direction="up">
        {photos.gallery.length ? (
          <EventPhotoGrid
            title={`${names.many} at Zion`}
            photos={photos.gallery}
            galleryHref={galleryHref}
          />
        ) : (
          <p className={styles.galleryNote}>
            <Link href={galleryHref}>See photos from events at Zion in the Gallery</Link>
          </p>
        )}
      </FadeIn>

      <FadeIn direction="up">
        <TestimonialSection />
      </FadeIn>
    </main>
  );
}
