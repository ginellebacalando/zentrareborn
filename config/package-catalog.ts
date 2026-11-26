/**
 * The admin package catalog as Zion's package booklets publish it (config/package-booklets.ts,
 * the event pages). The catalog prices one guest count per package, so each published rate is
 * its own catalog package: "Zion Classic (50 guests)" at ₱175,000 and "Zion Classic (100 guests)"
 * at ₱199,000. scripts/sync-package-catalog.ts writes these rows through the admin catalog, and
 * Zeni quotes them while the catalog is empty.
 */
import { eventPackagePages, type EventPackageMediaKey } from './event-package-pages';
import { packageBooklets, type BookletPackage, type PackageBooklet } from './package-booklets';

/**
 * Reservation fees published in the Terms (1) PAYMENT TERMS, config/terms.ts). Other packages
 * have no published fee: their requests go to staff review, who set it (docs/booking-automation.md).
 */
const RESERVATION_FEES: Readonly<Record<string, number>> = {
  'Zion Classic': 30_000,
  'Zion Premium': 40_000,
  'Zion Ultimate': 50_000,
};

export type CatalogInclusion = { inclusionName: string; description: string | null };

export type CatalogPackage = {
  /** The event category's slug in the catalog ("wedding-reception"). */
  categorySlug: string;
  /** The booklet package the rate belongs to ("Zion Classic"). */
  baseName: string;
  packageName: string;
  slug: string;
  description: string;
  price: number;
  paxIncluded: number;
  excessPaxFee: number;
  reservationFee: number;
  checkInTime: string | null;
  checkOutTime: string | null;
  inclusions: CatalogInclusion[];
};

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** "Zion Classic" at 50 guests is "Zion Classic (50 guests)". */
export function tierName(name: string, guests: number) {
  return `${name} (${guests} guests)`;
}

/** The booklet package a catalog rate belongs to: "Zion Classic (50 guests)" → "Zion Classic". */
export function baseNameOf(packageName: string) {
  return packageName.replace(/\s*\(\d+\s+guests?\)\s*$/i, '');
}

function describe(item: BookletPackage) {
  return [
    `${[item.series, item.name].filter(Boolean).join(': ')}${item.tagline ? ` — ${item.tagline}` : ''}.`,
    item.description,
    item.idealFor?.length ? `Ideal for: ${item.idealFor.join(', ')}.` : '',
    item.availability ? `Available: ${item.availability}.` : '',
    item.includesFrom ? `Everything in ${item.includesFrom}, plus the inclusions listed.` : '',
    ...(item.notes ?? []),
    item.ratesEffective ? `Rates effective ${item.ratesEffective}.` : '',
    'From Zion’s package booklet; the event page has the full list.',
  ]
    .filter(Boolean)
    .join('\n');
}

function inclusionsOf(item: BookletPackage): CatalogInclusion[] {
  return [
    ...(item.includesFrom
      ? [{ inclusionName: `Everything in ${item.includesFrom}`, description: null }]
      : []),
    ...item.sections.map((section) => ({
      inclusionName: section.title,
      description: [section.intro, ...section.items].filter(Boolean).join('; ').slice(0, 2000),
    })),
  ];
}

/** "Ingress: 10 AM to 6 PM" … "Egress: 11 PM to 12 MN" gives 10 AM to 12 MN, as printed. */
function scheduleWindow(item: BookletPackage) {
  const times = (item.schedule ?? []).flatMap(
    (line) => line.match(/\b\d{1,2}(?::\d{2})?\s?(?:AM|PM|MN|NN)\b/gi) ?? [],
  );
  return times.length >= 2
    ? { checkInTime: times[0], checkOutTime: times[times.length - 1] }
    : { checkInTime: null, checkOutTime: null };
}

function catalogRows(key: EventPackageMediaKey, booklet: PackageBooklet): CatalogPackage[] {
  const categorySlug = eventPackagePages[key].eventCategorySlug;
  return booklet.packages.flatMap((item) =>
    item.prices.map((tier) => ({
      categorySlug,
      baseName: item.name,
      packageName: tierName(item.name, tier.guests),
      slug: `${slugify(item.name)}-${tier.guests}`,
      description: describe(item),
      price: tier.amount,
      paxIncluded: tier.guests,
      excessPaxFee: item.excessPerHead ?? 0,
      reservationFee: RESERVATION_FEES[item.name] ?? 0,
      ...scheduleWindow(item),
      inclusions: inclusionsOf(item),
    })),
  );
}

/** Every published rate of every event page's booklet, as catalog packages. */
export const bookletCatalog: readonly CatalogPackage[] = (
  Object.entries(packageBooklets) as Array<[EventPackageMediaKey, PackageBooklet]>
).flatMap(([key, booklet]) => catalogRows(key, booklet));
