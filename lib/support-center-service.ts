import 'server-only';

import {
  AuditAction,
  AuditStatus,
  Prisma,
  PublicationStatus,
  SupportCategoryStatus,
  SupportFaqStatus,
  SupportRelatedModule,
} from '@prisma/client';
import { createAuditLog, errorMetadata, getRequestContext, systemAuditActor } from '@/lib/audit';
import { prisma } from '@/lib/prisma';
const SUPPORT_MODULE = 'support_center';
type SupportCategoryShape = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  displayOrder: number;
  status: SupportCategoryStatus;
  clientVisible: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    entries?: number;
  };
};
type SupportFaqShape = {
  id: string;
  question: string;
  answer: string;
  categoryId: string | null;
  category?: SupportCategoryShape | null;
  tags: string[];
  relatedModule: SupportRelatedModule;
  status: SupportFaqStatus;
  clientVisible: boolean;
  priority: number;
  viewCount: number;
  internalNotes: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  versions?: Array<{
    id: string;
    oldQuestion: string | null;
    oldAnswer: string | null;
    newQuestion: string | null;
    newAnswer: string | null;
    changeSummary: string | null;
    changedBy: string | null;
    createdAt: Date;
  }>;
  _count?: {
    versions?: number;
  };
  currentPublishedVersion?: {
    question: string | null;
    answer: string | null;
    tags: string[];
    relatedModule: SupportRelatedModule | null;
    clientVisible: boolean | null;
    priority: number | null;
    publicationStatus: PublicationStatus;
    publishedAt: Date | null;
    expiresAt: Date | null;
    createdAt: Date;
  } | null;
};
export class SupportCenterError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'SupportCenterError';
    this.status = status;
  }
}
function text(value: unknown, maxLength = 255) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}
function optionalText(value: unknown, maxLength = 255) {
  const normalized = text(value, maxLength);
  return normalized || null;
}
function enumLabel(value: string) {
  return value.toLowerCase();
}
function categoryToDto(category: SupportCategoryShape) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    displayOrder: category.displayOrder,
    status: enumLabel(category.status),
    clientVisible: category.clientVisible,
    createdBy: category.createdBy,
    updatedBy: category.updatedBy,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
    entryCount: category._count?.entries ?? 0,
  };
}
function faqToDto(faq: SupportFaqShape, includePrivate = true) {
  return {
    id: faq.id,
    question: faq.question,
    answer: faq.answer,
    categoryId: faq.categoryId,
    categoryName: faq.category?.name ?? null,
    categorySlug: faq.category?.slug ?? null,
    tags: faq.tags,
    relatedModule: enumLabel(faq.relatedModule),
    status: includePrivate ? enumLabel(faq.status) : undefined,
    clientVisible: includePrivate ? faq.clientVisible : undefined,
    priority: faq.priority,
    viewCount: includePrivate ? faq.viewCount : undefined,
    internalNotes: includePrivate ? faq.internalNotes : undefined,
    createdBy: includePrivate ? faq.createdBy : undefined,
    updatedBy: includePrivate ? faq.updatedBy : undefined,
    createdAt: faq.createdAt.toISOString(),
    updatedAt: faq.updatedAt.toISOString(),
    versionCount: includePrivate ? (faq._count?.versions ?? faq.versions?.length ?? 0) : undefined,
    versions:
      includePrivate && faq.versions
        ? faq.versions.map((version) => ({
            id: version.id,
            oldQuestion: version.oldQuestion,
            oldAnswer: version.oldAnswer,
            newQuestion: version.newQuestion,
            newAnswer: version.newAnswer,
            changeSummary: version.changeSummary,
            changedBy: version.changedBy,
            createdAt: version.createdAt.toISOString(),
          }))
        : undefined,
  };
}
function publishedFaqToDto(faq: SupportFaqShape) {
  const version = faq.currentPublishedVersion;
  if (!version) return faqToDto(faq, false);
  return faqToDto(
    {
      ...faq,
      question: version.question ?? faq.question,
      answer: version.answer ?? faq.answer,
      tags: version.tags,
      relatedModule: version.relatedModule ?? faq.relatedModule,
      clientVisible: version.clientVisible ?? faq.clientVisible,
      priority: version.priority ?? faq.priority,
      updatedAt: version.publishedAt ?? version.createdAt,
    },
    false,
  );
}
function publicFaqWhere(search?: string, category?: string): Prisma.SupportFaqEntryWhereInput {
  return {
    status: { notIn: [SupportFaqStatus.HIDDEN, SupportFaqStatus.ARCHIVED] },
    currentPublishedVersion: {
      is: {
        publicationStatus: PublicationStatus.PUBLISHED,
        clientVisible: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    },
    OR: [
      { categoryId: null },
      {
        category: {
          status: SupportCategoryStatus.ACTIVE,
          clientVisible: true,
        },
      },
    ],
    ...(category
      ? {
          category: {
            status: SupportCategoryStatus.ACTIVE,
            clientVisible: true,
            OR: [{ id: category }, { slug: category }],
          },
        }
      : {}),
    ...(search
      ? {
          AND: [
            {
              OR: [
                {
                  currentPublishedVersion: {
                    is: { question: { contains: search, mode: 'insensitive' } },
                  },
                },
                {
                  currentPublishedVersion: {
                    is: { answer: { contains: search, mode: 'insensitive' } },
                  },
                },
                { currentPublishedVersion: { is: { tags: { has: search } } } },
              ],
            },
          ],
        }
      : {}),
  };
}
export async function getPublicFaqs(url: URL, request?: Request) {
  const search = optionalText(url.searchParams.get('search'), 200);
  const category = optionalText(url.searchParams.get('category'), 255);
  const page = Math.max(Number(url.searchParams.get('page')) || 1, 1);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 20, 1), 50);
  const where = publicFaqWhere(search ?? undefined, category ?? undefined);
  const [faqs, totalRecords] = await Promise.all([
    prisma.supportFaqEntry.findMany({
      where,
      include: { category: true, currentPublishedVersion: true },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.supportFaqEntry.count({ where }),
  ]);
  const ids = faqs.map((faq) => faq.id);
  if (ids.length) {
    await prisma.supportFaqEntry.updateMany({
      where: { id: { in: ids } },
      data: { viewCount: { increment: 1 } },
    });
    await createAuditLog({
      ...systemAuditActor(),
      action: AuditAction.READ,
      module: SUPPORT_MODULE,
      description: `Client FAQ page displayed ${ids.length} approved support FAQ entries.`,
      status: AuditStatus.INFO,
      ...(request ? getRequestContext(request) : {}),
      metadata: { faqIds: ids, search, category },
    });
  }
  return {
    faqs: faqs.map((faq) => publishedFaqToDto(faq)),
    pagination: {
      page,
      limit,
      totalRecords,
      totalPages: Math.max(1, Math.ceil(totalRecords / limit)),
    },
  };
}
export async function getPublicPopularFaqs(limitValue = 6) {
  const limit = Math.min(Math.max(limitValue, 1), 12);
  const faqs = await prisma.supportFaqEntry.findMany({
    where: publicFaqWhere(),
    include: { category: true, currentPublishedVersion: true },
    orderBy: [{ viewCount: 'desc' }, { priority: 'desc' }, { updatedAt: 'desc' }],
    take: limit,
  });
  return { faqs: faqs.map((faq) => publishedFaqToDto(faq)) };
}
export async function getPublicFaqCategories() {
  const categories = await prisma.supportCategory.findMany({
    where: {
      status: SupportCategoryStatus.ACTIVE,
      clientVisible: true,
      entries: {
        some: {
          status: { notIn: [SupportFaqStatus.HIDDEN, SupportFaqStatus.ARCHIVED] },
          currentPublishedVersion: {
            is: { publicationStatus: PublicationStatus.PUBLISHED, clientVisible: true },
          },
        },
      },
    },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    include: {
      _count: {
        select: {
          entries: {
            where: {
              status: { notIn: [SupportFaqStatus.HIDDEN, SupportFaqStatus.ARCHIVED] },
              currentPublishedVersion: {
                is: { publicationStatus: PublicationStatus.PUBLISHED, clientVisible: true },
              },
            },
          },
        },
      },
    },
  });
  return { categories: categories.map(categoryToDto) };
}
export function supportErrorResponse(
  error: unknown,
  fallback = 'Unable to process support request.',
) {
  if (error instanceof SupportCenterError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof Error && error.message.startsWith('Unauthorized')) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof Error && error.message.startsWith('Forbidden')) {
    return Response.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof SyntaxError) {
    return Response.json({ error: 'The request body is invalid.' }, { status: 400 });
  }
  console.error(fallback, errorMetadata(error));
  return Response.json({ error: fallback }, { status: 500 });
}
