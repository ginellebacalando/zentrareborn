import type { Metadata } from 'next';
import { ContentType } from '@prisma/client';
import CinematicPageHero from '@/components/client/CinematicPageHero';
import FacilitiesShowcase, {
  featuredFacilities,
  type FacilitySpace,
} from '@/components/client/FacilitiesShowcase';
import { publicPageHeroes } from '@/config/public-page-heroes';
import { listPublishedContent } from '@/services/public-content/content.service';
import FacilitiesFallback from './_components/FacilitiesFallback';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Facilities | Zion Events Place',
  description:
    'Explore the indoor and outdoor event spaces available at Zion Events Place in San Pedro, Laguna.',
};

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

export default async function FacilitiesPage() {
  const items = await listPublishedContent(ContentType.FACILITY);
  if (!items.length) return <FacilitiesFallback />;

  const spaces: FacilitySpace[] = featuredFacilities.map((space) => {
    const managedItem = items.find((item) => space.sourceSlugs.includes(item.slug));
    const payload = recordValue(managedItem?.version?.payload);
    const managedImages = stringList(payload.imageUrls);

    return {
      ...space,
      imageSrc: managedImages[0] ?? space.imageSrc,
    };
  });

  const facilitiesHero = publicPageHeroes.facilities[0];

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="public-page responsive-page relative flex min-h-screen flex-col bg-transparent"
    >
      <CinematicPageHero
        title={facilitiesHero.title}
        subtitle={facilitiesHero.subtitle}
        slides={publicPageHeroes.facilities}
        videoSrc="/videos/hero/facilities-hero.mp4"
      />
      <div className="relative z-10 w-full bg-transparent">
        <FacilitiesShowcase spaces={spaces} />
      </div>
    </main>
  );
}
