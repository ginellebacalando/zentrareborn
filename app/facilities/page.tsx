import type { Metadata } from 'next';
import { ContentType } from '@prisma/client';
import FacilitiesShowcase, {
  featuredFacilities,
  type FacilitySpace,
} from '@/components/client/FacilitiesShowcase';
import PublicSubpageShell from '@/components/client/PublicSubpageShell';
import { listPublishedContent } from '@/services/public-content/content.service';
import FacilitiesFallback from './_components/FacilitiesFallback';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Facilities | Zion Events Place',
  description: 'Explore the indoor and outdoor event spaces available at Zion Events Place in San Pedro, Laguna.',
};

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
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

  return (
    <PublicSubpageShell heroKey="facilities">
      <FacilitiesShowcase spaces={spaces} />
    </PublicSubpageShell>
  );
}
