import 'server-only';

import { ContentType, Prisma, PublicationStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ContentValidationError } from './content-schema';
export class CommandCenterError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'CommandCenterError';
    this.status = status;
  }
}
function versionDto(version: {
  id: string;
  versionNumber: number;
  status: PublicationStatus;
  payload: Prisma.JsonValue;
  changeSummary: string | null;
  internalNotes: string | null;
  publishAt: Date | null;
  publishedAt: Date | null;
  expiresAt: Date | null;
  approvedAt: Date | null;
  approvedBy: string | null;
  publishedBy: string | null;
  archivedAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...version,
    publishAt: version.publishAt?.toISOString() ?? null,
    publishedAt: version.publishedAt?.toISOString() ?? null,
    expiresAt: version.expiresAt?.toISOString() ?? null,
    approvedAt: version.approvedAt?.toISOString() ?? null,
    archivedAt: version.archivedAt?.toISOString() ?? null,
    createdAt: version.createdAt.toISOString(),
    updatedAt: version.updatedAt.toISOString(),
  };
}
export async function listPublishedContent(type: ContentType) {
  const now = new Date();
  const items = await prisma.contentItem.findMany({
    where: {
      type,
      versions: {
        some: {
          status: PublicationStatus.PUBLISHED,
          publishedAt: { lte: now },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      },
    },
    include: {
      collection: { select: { id: true, name: true, slug: true } },
      versions: {
        where: {
          status: PublicationStatus.PUBLISHED,
          publishedAt: { lte: now },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        orderBy: { versionNumber: 'desc' },
        take: 1,
      },
    },
    orderBy: [{ displayOrder: 'asc' }, { title: 'asc' }],
  });
  return items.map((item) => ({
    id: item.id,
    type: item.type,
    slug: item.slug,
    title: item.title,
    collection: item.collection,
    eventCategoryId: item.eventCategoryId,
    displayOrder: item.displayOrder,
    version: item.versions[0] ? versionDto(item.versions[0]) : null,
  }));
}
export function handlePublicContentError(error: unknown) {
  if (error instanceof CommandCenterError || error instanceof ContentValidationError) {
    const status = error instanceof CommandCenterError ? error.status : 422;
    return Response.json({ success: false, error: error.message }, { status });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return Response.json(
      { success: false, error: 'A conflicting record already exists.' },
      { status: 409 },
    );
  }
  console.error('Public content request failed:', error);
  return Response.json(
    { success: false, error: 'Public content request failed.' },
    { status: 500 },
  );
}
