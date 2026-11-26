/**
 * Brings the admin package catalog in line with Zion's package booklets (config/package-catalog.ts).
 *
 * Dry run by default: prints what would change and changes nothing. With --apply it saves through
 * the admin catalog itself (validation, a new version for each changed package, an audit entry)
 * as a super administrator: it creates or updates every published rate, and archives and hides,
 * never deletes, other packages in the booklets' event categories. Running it again changes only
 * what differs. It uses the database in DATABASE_URL, which it never prints.
 *
 *   node --conditions=react-server --import tsx scripts/sync-package-catalog.ts [--apply] [--actor <username>]
 */
import { prisma } from '@/lib/prisma';
import { saveCatalog } from '@/lib/admin/catalog';
import type { AdminActor } from '@/lib/admin/access';
import { bookletCatalog, type CatalogPackage } from '@/config/package-catalog';

const apply = process.argv.includes('--apply');
const actorName = process.argv[process.argv.indexOf('--actor') + 1];

type Existing = Awaited<ReturnType<typeof existingPackages>>[number];

async function existingPackages(eventCategoryId: string) {
  return prisma.package.findMany({
    where: { eventCategoryId },
    include: { inclusions: { orderBy: { displayOrder: 'asc' } } },
  });
}

async function superAdministrator(): Promise<AdminActor> {
  const user = await prisma.user.findFirst({
    where: {
      role: 'SUPERADMIN',
      status: 'ACTIVE',
      ...(process.argv.includes('--actor') ? { username: actorName } : {}),
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, username: true, fullName: true, role: true },
  });
  if (!user) throw new Error('No active super administrator account was found.');
  return { ...user, mustChangePassword: false } as unknown as AdminActor;
}

const peso = (value: number) => `₱${value.toLocaleString('en-PH')}`;

/** The admin catalog's save payload for one booklet rate. */
function ratePayload(
  row: CatalogPackage,
  category: { id: string; coverImageUrl: string | null },
  existing?: Existing,
) {
  return {
    op: 'catalog-package',
    id: existing?.id ?? null,
    updatedAt: existing?.updatedAt.toISOString() ?? null,
    package: {
      eventCategoryId: category.id,
      packageName: row.packageName,
      slug: row.slug,
      description: row.description,
      price: row.price,
      currency: 'PHP',
      paxIncluded: row.paxIncluded,
      excessPaxFee: row.excessPaxFee,
      reservationFee: row.reservationFee,
      downPaymentAmount: 0,
      fullPaymentAmount: row.price,
      checkInTime: row.checkInTime ?? '',
      checkOutTime: row.checkOutTime ?? '',
      packageImageUrl: existing?.packageImageUrl ?? category.coverImageUrl ?? '',
      contractItemDescription: existing?.contractItemDescription ?? '',
      contractInclusionDescription: existing?.contractInclusionDescription ?? '',
      internalNotes: 'Published rate from the package booklet (config/package-catalog.ts).',
      status: 'ACTIVE',
      clientVisible: true,
      inclusions: row.inclusions.map((inclusion, displayOrder) => ({
        inclusionName: inclusion.inclusionName,
        description: inclusion.description ?? '',
        isFree: true,
        isOptional: false,
        displayOrder,
      })),
    },
  };
}

/** The same package, archived and hidden from the website, everything else unchanged. */
function archivePayload(existing: Existing) {
  return {
    op: 'catalog-package',
    id: existing.id,
    updatedAt: existing.updatedAt.toISOString(),
    package: {
      eventCategoryId: existing.eventCategoryId,
      packageName: existing.packageName,
      slug: existing.slug,
      description: existing.description ?? '',
      price: existing.price,
      currency: existing.currency,
      paxIncluded: existing.paxIncluded,
      excessPaxFee: existing.excessPaxFee,
      reservationFee: existing.reservationFee,
      downPaymentAmount: existing.downPaymentAmount,
      fullPaymentAmount: existing.fullPaymentAmount,
      checkInTime: existing.checkInTime ?? '',
      checkOutTime: existing.checkOutTime ?? '',
      packageImageUrl: existing.packageImageUrl ?? '',
      contractItemDescription: existing.contractItemDescription ?? '',
      contractInclusionDescription: existing.contractInclusionDescription ?? '',
      internalNotes: existing.internalNotes ?? '',
      status: 'ARCHIVED',
      clientVisible: false,
      inclusions: existing.inclusions.map((inclusion) => ({
        id: inclusion.id,
        inclusionName: inclusion.inclusionName,
        description: inclusion.description ?? '',
        isFree: inclusion.isFree,
        isOptional: inclusion.isOptional,
        displayOrder: inclusion.displayOrder,
      })),
    },
  };
}

/** True when the saved package already shows this booklet rate. */
function upToDate(existing: Existing, row: CatalogPackage) {
  return (
    existing.packageName === row.packageName &&
    existing.description === row.description &&
    existing.price === row.price &&
    existing.paxIncluded === row.paxIncluded &&
    existing.excessPaxFee === row.excessPaxFee &&
    existing.reservationFee === row.reservationFee &&
    (existing.checkInTime ?? null) === row.checkInTime &&
    (existing.checkOutTime ?? null) === row.checkOutTime &&
    existing.status === 'ACTIVE' &&
    existing.clientVisible &&
    JSON.stringify(existing.inclusions.map((item) => [item.inclusionName, item.description])) ===
      JSON.stringify(row.inclusions.map((item) => [item.inclusionName, item.description]))
  );
}

async function main() {
  const actor = await superAdministrator();
  const slugs = [...new Set(bookletCatalog.map((row) => row.categorySlug))];
  const plan: Array<{ label: string; payload: unknown }> = [];
  for (const categorySlug of slugs) {
    const category = await prisma.eventCategory.findUnique({ where: { slug: categorySlug } });
    if (!category) {
      console.log(`Skipped: no event category "${categorySlug}" in this database.`);
      continue;
    }
    const existing = await existingPackages(category.id);
    const rows = bookletCatalog.filter((row) => row.categorySlug === categorySlug);
    for (const row of rows) {
      const saved = existing.find((item) => item.slug === row.slug);
      if (saved && upToDate(saved, row)) continue;
      plan.push({
        label: `${saved ? 'Update' : 'Create'} ${category.name}: ${row.packageName}, ${peso(row.price)}, ${row.paxIncluded} guests${row.excessPaxFee ? `, ${peso(row.excessPaxFee)} per extra guest` : ''}, reservation fee ${row.reservationFee ? peso(row.reservationFee) : 'none (staff review)'}`,
        payload: ratePayload(row, category, saved),
      });
    }
    for (const other of existing.filter(
      (item) => item.status !== 'ARCHIVED' && !rows.some((row) => row.slug === item.slug),
    ))
      plan.push({
        label: `Archive and hide ${category.name}: ${other.packageName} (${peso(other.price)}, not in the booklet)`,
        payload: archivePayload(other),
      });
  }
  console.log(
    `${apply ? 'Applying' : 'Dry run'}: ${plan.length} change${plan.length === 1 ? '' : 's'} as ${actor.username}.`,
  );
  for (const step of plan) {
    console.log(`- ${step.label}`);
    if (apply) await saveCatalog(step.payload, actor);
  }
  if (!apply && plan.length) console.log('Nothing was changed. Run again with --apply to save.');
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'The catalog sync failed.');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
