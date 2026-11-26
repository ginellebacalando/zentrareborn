import 'server-only';

import { EventCategoryStatus, PackageStatus, Prisma } from '@prisma/client';
import { errorMetadata } from '@/lib/audit';
import { prisma } from '@/lib/prisma';
import { optimizedPublicMediaPath } from '@/lib/public-media';
export class ServicesPackagesError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ServicesPackagesError';
    this.status = status;
  }
}
function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
function externalStatus(status: string) {
  return status.toLowerCase();
}
function clientServicesImageUrl(value: string | null) {
  if (!value) return null;
  const legacyMatch = value.match(
    /^\/uploads\/services-packages\/(?:category|package)\/([^/?#]+)$/,
  );
  return optimizedPublicMediaPath(legacyMatch ? `/zion-gallery/${legacyMatch[1]}` : value);
}
function categoryPayload(
  category: Awaited<ReturnType<typeof prisma.eventCategory.findFirst>> & {
    packages?: Array<{
      id: string;
      status: PackageStatus;
      clientVisible: boolean;
    }>;
  },
) {
  if (!category) return null;
  const packages = category.packages ?? [];
  const activePackageCount = packages.filter(
    (item) => item.status === PackageStatus.ACTIVE && item.clientVisible,
  ).length;
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    categoryKey: category.categoryKey,
    description: category.description,
    coverImageUrl: clientServicesImageUrl(category.coverImageUrl),
    displayOrder: category.displayOrder,
    status: externalStatus(category.status),
    clientVisible: category.clientVisible,
    packageCount: packages.length,
    activePackageCount,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}
type PublicPackageRecord = Prisma.PackageGetPayload<{
  include: {
    eventCategory: true;
    inclusions: true;
    versions: true;
  };
}>;
function publicPackagePayload(packageRecord: PublicPackageRecord) {
  const version = packageRecord.versions.find(
    (candidate) => candidate.versionNumber === packageRecord.currentVersion,
  );
  if (
    !version ||
    !version.snapshotData ||
    typeof version.snapshotData !== 'object' ||
    Array.isArray(version.snapshotData)
  ) {
    throw new ServicesPackagesError('Published package version is unavailable.', 404);
  }
  const snapshot = version.snapshotData as Record<string, Prisma.JsonValue>;
  const inclusions = Array.isArray(snapshot.inclusions)
    ? snapshot.inclusions.flatMap((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
        const inclusion = item as Record<string, Prisma.JsonValue>;
        const inclusionName = text(inclusion.inclusionName ?? inclusion.name);
        if (!inclusionName) return [];
        return [
          {
            id: text(inclusion.id) || `${packageRecord.id}-inclusion-${index + 1}`,
            inclusionName,
            description: text(inclusion.description) || null,
            isFree: inclusion.isFree !== false,
            isOptional: inclusion.isOptional === true,
            displayOrder: Number(inclusion.displayOrder) || index,
          },
        ];
      })
    : [];
  const numeric = (key: string) => {
    const value = Number(snapshot[key]);
    return Number.isFinite(value) ? value : 0;
  };
  return {
    id: packageRecord.id,
    eventCategoryId: packageRecord.eventCategoryId,
    eventCategoryName: packageRecord.eventCategory.name,
    eventCategorySlug: packageRecord.eventCategory.slug,
    packageName: text(snapshot.packageName),
    slug: text(snapshot.slug),
    description: text(snapshot.description) || null,
    price: numeric('price'),
    currency: text(snapshot.currency) || 'PHP',
    paxIncluded: numeric('paxIncluded'),
    excessPaxFee: numeric('excessPaxFee'),
    reservationFee: numeric('reservationFee'),
    downPaymentAmount: numeric('downPaymentAmount'),
    fullPaymentAmount: numeric('fullPaymentAmount'),
    checkInTime: text(snapshot.checkInTime) || null,
    checkOutTime: text(snapshot.checkOutTime) || null,
    packageImageUrl: clientServicesImageUrl(text(snapshot.packageImageUrl) || null),
    currentVersion: packageRecord.currentVersion,
    inclusions,
  };
}
export async function getPublicEventCategories() {
  const categories = await prisma.eventCategory.findMany({
    where: {
      status: EventCategoryStatus.ACTIVE,
      clientVisible: true,
    },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    include: {
      packages: {
        where: {
          status: PackageStatus.ACTIVE,
          clientVisible: true,
        },
        select: {
          id: true,
          status: true,
          clientVisible: true,
        },
      },
    },
  });
  return categories.map(categoryPayload);
}
export async function getPublicPackagesForCategory(slug: string) {
  const category = await prisma.eventCategory.findUnique({
    where: { slug },
    include: {
      packages: {
        where: {
          status: PackageStatus.ACTIVE,
          clientVisible: true,
        },
        // By guest count, then price: a guest compares the packages for their number of guests
        // ("Zion Classic (50 guests)" beside "Zion Premium (50 guests)").
        orderBy: [{ paxIncluded: 'asc' }, { price: 'asc' }, { packageName: 'asc' }],
        include: {
          eventCategory: true,
          inclusions: { orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }] },
          versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
        },
      },
    },
  });
  if (!category || category.status !== EventCategoryStatus.ACTIVE || !category.clientVisible) {
    throw new ServicesPackagesError('Event category not found.', 404);
  }
  return {
    category: categoryPayload(category),
    packages: category.packages
      .filter((packageRecord) =>
        packageRecord.versions.some(
          (version) => version.versionNumber === packageRecord.currentVersion,
        ),
      )
      .map(publicPackagePayload),
  };
}
export async function getPublicPackageBySlug(slug: string) {
  const packageRecord = await prisma.package.findFirst({
    where: {
      slug,
      status: PackageStatus.ACTIVE,
      clientVisible: true,
      eventCategory: {
        status: EventCategoryStatus.ACTIVE,
        clientVisible: true,
      },
    },
    orderBy: [{ updatedAt: 'desc' }],
    include: {
      eventCategory: true,
      inclusions: { orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }] },
      versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
    },
  });
  if (!packageRecord) {
    throw new ServicesPackagesError('Package not found.', 404);
  }
  if (
    !packageRecord.versions.some(
      (version) => version.versionNumber === packageRecord.currentVersion,
    )
  ) {
    throw new ServicesPackagesError('Published package version is unavailable.', 404);
  }
  return publicPackagePayload(packageRecord);
}
export function handleServicesError(error: unknown) {
  if (error instanceof ServicesPackagesError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof Error && error.message.startsWith('Unauthorized')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (error instanceof Error && error.message.startsWith('Forbidden')) {
    return Response.json({ error: error.message }, { status: 403 });
  }
  console.error('Services and packages operation failed:', error);
  return Response.json(
    {
      error: 'Unable to process services and packages request.',
      details: process.env.NODE_ENV === 'development' ? errorMetadata(error) : undefined,
    },
    { status: 500 },
  );
}
