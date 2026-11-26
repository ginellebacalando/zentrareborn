import 'server-only';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import type { AdminActor } from './access';
import { AdminError } from './errors';
import { canDo } from './permissions';

const slug = z
  .string()
  .trim()
  .min(1)
  .max(140)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Use lowercase letters, numbers, and single hyphens for the slug.',
  );
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);
const image = z
  .string()
  .trim()
  .max(1500)
  .refine((value) => {
    if (!value || /^\/(?!\/)[^\r\n]*$/.test(value)) return true;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
    } catch {
      return false;
    }
  }, 'Use a local image path or an HTTPS image URL.')
  .transform((value) => value || null);
const amount = z.number().nonnegative().max(20000000).multipleOf(0.01);
const expected = {
  id: z.string().min(1).max(100).nullable(),
  updatedAt: z.iso.datetime().nullable(),
};
const categorySchema = z
  .object({
    op: z.literal('catalog-category'),
    ...expected,
    category: z
      .object({
        name: z.string().trim().min(2).max(180),
        slug,
        description: optionalText(5000),
        coverImageUrl: image,
        displayOrder: z.number().int().min(0).max(100000),
        status: z.enum(['ACTIVE', 'HIDDEN', 'ARCHIVED']),
        clientVisible: z.boolean(),
      })
      .strict(),
  })
  .strict();
const inclusionSchema = z
  .object({
    id: z.string().min(1).max(100).optional(),
    inclusionName: z.string().trim().min(1).max(200),
    description: optionalText(2000),
    isFree: z.boolean(),
    isOptional: z.boolean(),
    displayOrder: z.number().int().min(0).max(100000),
  })
  .strict();
const packageSchema = z
  .object({
    op: z.literal('catalog-package'),
    ...expected,
    package: z
      .object({
        eventCategoryId: z.string().min(1).max(100),
        packageName: z.string().trim().min(2).max(180),
        slug,
        description: optionalText(10000),
        price: amount,
        currency: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z]{3}$/),
        paxIncluded: z.number().int().min(0).max(100000),
        excessPaxFee: amount,
        reservationFee: amount,
        downPaymentAmount: amount,
        fullPaymentAmount: amount,
        checkInTime: optionalText(80),
        checkOutTime: optionalText(80),
        packageImageUrl: image,
        contractItemDescription: optionalText(5000),
        contractInclusionDescription: optionalText(10000),
        internalNotes: optionalText(5000),
        status: z.enum(['ACTIVE', 'INACTIVE', 'HIDDEN', 'ARCHIVED']),
        clientVisible: z.boolean(),
        inclusions: z.array(inclusionSchema).max(80),
      })
      .strict()
      .refine(
        (value) =>
          value.reservationFee <= value.price &&
          value.downPaymentAmount <= value.price &&
          value.fullPaymentAmount <= value.price,
        'Reservation, down payment, and full payment amounts cannot individually exceed the package price.',
      ),
  })
  .strict();
const categorySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  coverImageUrl: true,
  displayOrder: true,
  status: true,
  clientVisible: true,
  updatedAt: true,
  _count: { select: { packages: true } },
} as const;

export async function readCatalog(params: URLSearchParams, actor: AdminActor) {
  const categories = await prisma.eventCategory.findMany({
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    take: 500,
    select: categorySelect,
  });
  const selectedId = params.get('category') || categories[0]?.id;
  const category = selectedId
    ? await prisma.eventCategory.findUnique({ where: { id: selectedId }, select: categorySelect })
    : null;
  if (selectedId && !category) throw new AdminError('Event category not found.', 404);
  const page = Math.max(1, Math.min(10000, Math.trunc(Number(params.get('page'))) || 1));
  const query = (params.get('q') || '').trim().slice(0, 100);
  const where: Prisma.PackageWhereInput = {
    eventCategoryId: category?.id ?? '__none__',
    ...(query
      ? {
          OR: [
            { packageName: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [packages, total, categoryCount] = await Promise.all([
    prisma.package.findMany({
      where,
      orderBy: [{ packageName: 'asc' }, { id: 'asc' }],
      take: 25,
      skip: (page - 1) * 25,
      select: {
        id: true,
        eventCategoryId: true,
        packageName: true,
        slug: true,
        description: true,
        price: true,
        currency: true,
        paxIncluded: true,
        excessPaxFee: true,
        reservationFee: true,
        downPaymentAmount: true,
        fullPaymentAmount: true,
        checkInTime: true,
        checkOutTime: true,
        packageImageUrl: true,
        contractItemDescription: true,
        contractInclusionDescription: true,
        internalNotes: true,
        status: true,
        clientVisible: true,
        currentVersion: true,
        updatedAt: true,
        inclusions: {
          orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            inclusionName: true,
            description: true,
            isFree: true,
            isOptional: true,
            displayOrder: true,
          },
        },
      },
    }),
    prisma.package.count({ where }),
    prisma.eventCategory.count(),
  ]);
  return {
    categories,
    category,
    categoryCount,
    packages,
    total,
    page,
    canEdit: canDo(actor.role, 'edit-packages'),
  };
}
function checkRevision(
  previous: { updatedAt: Date } | null,
  id: string | null,
  expectedAt: string | null,
) {
  if (id && !previous) throw new AdminError('This catalog record no longer exists.', 404);
  if (previous && previous.updatedAt.toISOString() !== expectedAt)
    throw new AdminError('This record changed. Refresh it before saving.', 409);
  if (!id && expectedAt !== null)
    throw new AdminError('A new record cannot have an existing revision.');
}
export async function saveCatalog(raw: unknown, actor: AdminActor) {
  if (!canDo(actor.role, 'edit-packages'))
    throw new AdminError('Only a super administrator may change services and packages.', 403);
  const operation = z.object({ op: z.enum(['catalog-category', 'catalog-package']) }).parse(raw).op;
  try {
    if (operation === 'catalog-category') {
      const input = categorySchema.parse(raw);
      return await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`zion-category:${input.category.slug}`}))::text`;
        if (input.id)
          await tx.$queryRaw`SELECT id FROM event_categories WHERE id = ${input.id} FOR UPDATE`;
        const previous = input.id
          ? await tx.eventCategory.findUnique({ where: { id: input.id } })
          : null;
        checkRevision(previous, input.id, input.updatedAt);
        if (
          await tx.eventCategory.findFirst({
            where: { slug: input.category.slug, ...(input.id ? { id: { not: input.id } } : {}) },
            select: { id: true },
          })
        )
          throw new AdminError(
            'This category or package slug already exists. Choose a different slug.',
            409,
          );
        const category = previous
          ? await tx.eventCategory.update({
              where: { id: previous.id },
              data: { ...input.category, updatedBy: actor.username },
            })
          : await tx.eventCategory.create({
              data: {
                ...input.category,
                categoryKey: `${input.category.slug.replaceAll('-', '_').toUpperCase()}_${randomUUID().slice(0, 8)}`,
                createdBy: actor.username,
                updatedBy: actor.username,
              },
            });
        await catalogAudit(
          tx,
          actor,
          `${previous ? 'Updated' : 'Created'} event category ${category.name}.`,
          previous ? 'UPDATE' : 'CREATE',
        );
        return { categoryId: category.id, saved: true };
      });
    }
    const input = packageSchema.parse(raw);
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`zion-package:${input.package.eventCategoryId}:${input.package.slug}`}))::text`;
      if (input.id) await tx.$queryRaw`SELECT id FROM packages WHERE id = ${input.id} FOR UPDATE`;
      const previous = input.id ? await tx.package.findUnique({ where: { id: input.id } }) : null;
      checkRevision(previous, input.id, input.updatedAt);
      if (previous && previous.eventCategoryId !== input.package.eventCategoryId)
        throw new AdminError('Keep an existing package in its original event category.');
      const category = await tx.eventCategory.findUnique({
        where: { id: input.package.eventCategoryId },
      });
      if (!category) throw new AdminError('Choose an existing event category.');
      if (
        await tx.package.findFirst({
          where: {
            eventCategoryId: category.id,
            slug: input.package.slug,
            ...(input.id ? { id: { not: input.id } } : {}),
          },
          select: { id: true },
        })
      )
        throw new AdminError(
          'This category or package slug already exists. Choose a different slug.',
          409,
        );
      const { inclusions, ...fields } = input.package;
      const previousInclusions = previous
        ? await tx.packageInclusion.findMany({
            where: { packageId: previous.id },
            select: { id: true },
          })
        : [];
      const keptIds = inclusions.flatMap((item) => (item.id ? [item.id] : []));
      if (
        new Set(keptIds).size !== keptIds.length ||
        keptIds.some((id) => !previousInclusions.some((item) => item.id === id))
      )
        throw new AdminError(
          'An inclusion is invalid or belongs to another package. Refresh before saving.',
        );
      const version = previous ? previous.currentVersion + 1 : 1;
      const saved = previous
        ? await tx.package.update({
            where: { id: previous.id },
            data: { ...fields, currentVersion: version, updatedBy: actor.username },
          })
        : await tx.package.create({
            data: {
              ...fields,
              currentVersion: version,
              createdBy: actor.username,
              updatedBy: actor.username,
            },
          });
      await tx.packageInclusion.deleteMany({
        where: { packageId: saved.id, id: { notIn: keptIds } },
      });
      for (const inclusion of inclusions) {
        const { id, ...values } = inclusion;
        if (id) await tx.packageInclusion.update({ where: { id }, data: values });
        else await tx.packageInclusion.create({ data: { ...values, packageId: saved.id } });
      }
      const savedInclusions = await tx.packageInclusion.findMany({
        where: { packageId: saved.id },
        orderBy: { displayOrder: 'asc' },
      });
      const { internalNotes: privateNotes, ...publishedFields } = fields;
      void privateNotes;
      const snapshot = {
        ...publishedFields,
        id: saved.id,
        eventCategoryName: category.name,
        eventCategorySlug: category.slug,
        currentVersion: version,
        inclusions: savedInclusions.map(
          ({ id, inclusionName, description, isFree, isOptional, displayOrder }) => ({
            id,
            inclusionName,
            description,
            isFree,
            isOptional,
            displayOrder,
          }),
        ),
      };
      await tx.packageVersion.create({
        data: {
          packageId: saved.id,
          versionNumber: version,
          snapshotData: JSON.parse(JSON.stringify(snapshot)),
          changeSummary: previous ? 'Updated package details and inclusions.' : 'Created package.',
          createdBy: actor.username,
        },
      });
      await catalogAudit(
        tx,
        actor,
        `${previous ? 'Updated' : 'Created'} package ${saved.packageName}, version ${version}.`,
        previous ? 'UPDATE' : 'CREATE',
      );
      return { categoryId: category.id, saved: true };
    });
  } catch (error) {
    const code =
      error instanceof Prisma.PrismaClientKnownRequestError
        ? error.code
        : error && typeof error === 'object' && 'code' in error
          ? error.code
          : null;
    if (code === 'P2002' || code === '23505')
      throw new AdminError(
        'This category or package slug already exists. Choose a different slug.',
        409,
      );
    throw error;
  }
}
async function catalogAudit(
  tx: Prisma.TransactionClient,
  actor: AdminActor,
  description: string,
  action: 'CREATE' | 'UPDATE',
) {
  await tx.auditLog.create({
    data: {
      userId: actor.id,
      userName: actor.fullName || actor.username,
      userRole: actor.role,
      action,
      module: 'Services & Packages',
      description,
      status: 'SUCCESS',
      source: 'zion-admin',
    },
  });
}
