/**
 * The event package pages' view of the published catalog (docs/event-pages.md). Names, guest
 * tiers, prices and inclusions come only from the database rows; nothing is typed into the page.
 * Pure functions, safe in the browser. Estimates use packageQuote and cheaperTier
 * (lib/booking-quote.ts), the booking page's own pricing engine, never a formula of their own.
 */
import { BOOKING_REQUEST_RULES } from '@/config/booking';
import { cheaperTier, packageFamily, packageQuote } from '@/lib/booking-quote';

/** One published guest tier as lib/services-packages.ts returns it. */
export type PublishedPackageRow = {
  id: string;
  slug: string;
  packageName: string;
  description: string | null;
  price: number;
  paxIncluded: number;
  excessPaxFee: number;
  reservationFee: number;
  checkInTime: string | null;
  checkOutTime: string | null;
  inclusions: readonly { inclusionName: string; description: string | null }[];
};

export type PackageTier = {
  id: string;
  slug: string;
  name: string;
  price: number;
  paxIncluded: number;
  excessPaxFee: number;
  reservationFee: number;
};

export type InclusionGroup = { title: string; intro: string | null; items: string[] };

export type PackageFamily = {
  /** Lowercased name without the guest count ("zion essential"). */
  key: string;
  name: string;
  tagline: string | null;
  /** Labelled facts from the description: "Ideal for", "Available". */
  facts: { label: string; text: string }[];
  notes: string[];
  ratesEffective: string | null;
  /** The package this one includes everything from ("Zion Essential"). */
  includesFrom: string | null;
  /** Guest tiers, smallest first. */
  tiers: PackageTier[];
  /** Pesos per guest above a tier when every tier shares one; null when none or they differ. */
  extraGuestFee: number | null;
  /** "10 AM to 12 MN", when the catalog lists the hours. */
  venueHours: string | null;
  groups: InclusionGroup[];
};

const GUEST_SUFFIX = /\s*\(\d+\s+guests?\)\s*$/i;
const EVERYTHING_IN = /^Everything in (.+?)(?:, plus the inclusions listed)?\.?$/i;
/** The catalog's own pointer back to the event page (config/package-catalog.ts). */
const CATALOG_NOTE = /^From Zion[’']s package booklet/i;

function cleanSentence(text: string) {
  return text.trim().replace(/\.$/, '').trim();
}

/** The description lines the catalog writes: name and tagline, labelled facts, notes. */
function describe(description: string | null, name: string) {
  const result = {
    tagline: null as string | null,
    facts: [] as { label: string; text: string }[],
    notes: [] as string[],
    ratesEffective: null as string | null,
    includesFrom: null as string | null,
  };
  for (const raw of (description ?? '').split('\n')) {
    const line = raw.trim();
    if (!line || CATALOG_NOTE.test(line)) continue;
    const titled = line.match(/^(?:[^:]+: )?(.+?) — (.+)$/);
    if (titled && titled[1].trim().toLowerCase() === name.toLowerCase()) {
      result.tagline = cleanSentence(titled[2]);
      continue;
    }
    if (line.replace(/\.$/, '').toLowerCase() === name.toLowerCase()) continue;
    const fact = line.match(/^(Ideal for|Available):\s*(.+)$/i);
    if (fact) {
      result.facts.push({ label: fact[1], text: cleanSentence(fact[2]) });
      continue;
    }
    const rates = line.match(/^Rates effective (.+)$/i);
    if (rates) {
      result.ratesEffective = cleanSentence(rates[1]);
      continue;
    }
    const base = line.match(EVERYTHING_IN);
    if (base) {
      result.includesFrom = base[1].trim();
      continue;
    }
    result.notes.push(line);
  }
  return result;
}

/** An inclusion's text is its intro (a sentence) and items, joined with "; " by the catalog. */
function inclusionGroup(inclusion: PublishedPackageRow['inclusions'][number]): InclusionGroup {
  const parts = (inclusion.description ?? '')
    .split(/;\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const intro = parts.length > 1 && /[.!]$/.test(parts[0]) ? parts[0] : null;
  return { title: inclusion.inclusionName.trim(), intro, items: intro ? parts.slice(1) : parts };
}

/** The published tiers grouped by package, cheapest package first. */
export function packageFamilies(rows: readonly PublishedPackageRow[]): PackageFamily[] {
  const groups = new Map<string, PublishedPackageRow[]>();
  for (const row of rows) {
    const key = packageFamily(row.packageName);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const families = [...groups.entries()].map(([key, members]) => {
    const sorted = [...members].sort(
      (left, right) => left.paxIncluded - right.paxIncluded || left.price - right.price,
    );
    const first = sorted[0];
    const name = first.packageName.replace(GUEST_SUFFIX, '').trim();
    const details = describe(first.description, name);
    const fees = new Set(sorted.map((row) => row.excessPaxFee));
    const [fee] = [...fees];
    const includes = first.inclusions.find((item) => EVERYTHING_IN.test(item.inclusionName));
    return {
      key,
      name,
      tagline: details.tagline,
      facts: details.facts,
      notes: details.notes,
      ratesEffective: details.ratesEffective,
      includesFrom:
        details.includesFrom ?? includes?.inclusionName.match(EVERYTHING_IN)?.[1].trim() ?? null,
      tiers: sorted.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.packageName,
        price: row.price,
        paxIncluded: row.paxIncluded,
        excessPaxFee: row.excessPaxFee,
        reservationFee: row.reservationFee,
      })),
      extraGuestFee: fees.size === 1 && fee > 0 ? fee : null,
      venueHours:
        first.checkInTime && first.checkOutTime
          ? `${first.checkInTime} to ${first.checkOutTime}`
          : null,
      groups: first.inclusions
        .filter((item) => !EVERYTHING_IN.test(item.inclusionName))
        .map(inclusionGroup),
    } satisfies PackageFamily;
  });
  return families.sort((left, right) => left.tiers[0].price - right.tiers[0].price);
}

/** A guest count the booking page accepts (config/booking.ts). */
export function bookableGuests(value: number) {
  if (!Number.isFinite(value)) return BOOKING_REQUEST_RULES.minGuests;
  return Math.min(
    BOOKING_REQUEST_RULES.maxGuests,
    Math.max(BOOKING_REQUEST_RULES.minGuests, Math.round(value)),
  );
}

export type PackageEstimate = {
  guests: number;
  /** The guest tier the estimate uses; the booking link names it, so the booking page agrees. */
  tier: PackageTier;
  totalCents: number;
  extraGuests: number;
  extraCents: number;
  /** More guests than the largest tier of a package with no published extra-guest fee. */
  aboveTiers: boolean;
};

/**
 * The estimate for a guest count, priced by packageQuote. With a published extra-guest fee, the
 * tier the booking page suggests for that many guests (cheaperTier from the smallest tier). Without
 * one, extra guests are not free: the smallest tier that covers the guest count applies (the
 * largest beyond it, and the page says the team quotes larger parties). cheaperTier alone would
 * price 120 christening guests at the 50-guest rate.
 */
export function familyEstimate(family: PackageFamily, guests: number): PackageEstimate {
  const base = family.tiers[0];
  const perGuestFee = family.tiers.every((tier) => tier.excessPaxFee > 0);
  const tier = perGuestFee
    ? (cheaperTier(family.tiers, base, guests)?.pkg ?? base)
    : (family.tiers.find((item) => item.paxIncluded >= guests) ?? family.tiers.at(-1) ?? base);
  const quote = packageQuote(tier, guests);
  return {
    guests,
    tier,
    totalCents: quote.totalCents,
    extraGuests: quote.extraGuests,
    extraCents: quote.extraCents,
    aboveTiers: !perGuestFee && guests > tier.paxIncluded,
  };
}

/** The typed guest count, or null while it is not a count the booking page accepts. */
export function typedGuests(text: string) {
  const value = Number(text.trim());
  return text.trim() &&
    Number.isInteger(value) &&
    value >= BOOKING_REQUEST_RULES.minGuests &&
    value <= BOOKING_REQUEST_RULES.maxGuests
    ? value
    : null;
}

/** Links that open the next step with the event, guest tier and guest count filled in. */
export function nextStepLinks(bookingEvent: string, family: PackageFamily, guests: number) {
  const estimate = familyEstimate(family, guests);
  const query = new URLSearchParams({
    event: bookingEvent,
    package: estimate.tier.slug,
    guests: String(guests),
  }).toString();
  return { estimate, booking: `/booking?${query}`, visit: `/visit?${query}` };
}

const PESO = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

/** "₱165,000". */
export function formatPeso(pesos: number) {
  return PESO.format(pesos);
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * "120 guests: ₱209,000 (100 guests ₱189,000 + 20 extra guests × ₱1,000)"; "100 guests: ₱189,000"
 * at a tier's own count; a smaller party pays the tier's rate ("30 guests: ₱165,000 (the 50-guest
 * rate)").
 */
export function estimateBreakdown(estimate: PackageEstimate) {
  const total = formatPeso(estimate.totalCents / 100);
  const base = `${plural(estimate.tier.paxIncluded, 'guest')} ${formatPeso(estimate.tier.price)}`;
  const detail = estimate.aboveTiers
    ? `the ${estimate.tier.paxIncluded}-guest rate; our team quotes larger parties`
    : estimate.extraGuests
      ? `${base} + ${plural(estimate.extraGuests, 'extra guest')} × ${formatPeso(estimate.tier.excessPaxFee)}`
      : estimate.guests < estimate.tier.paxIncluded
        ? `the ${estimate.tier.paxIncluded}-guest rate`
        : '';
  return `${plural(estimate.guests, 'guest')}: ${total}${detail ? ` (${detail})` : ''}`;
}

/** "50 guests ₱165,000 · 100 guests ₱189,000 · ₱1,000 per extra guest". */
export function priceLine(family: PackageFamily) {
  return [
    ...family.tiers.map((tier) => `${plural(tier.paxIncluded, 'guest')} ${formatPeso(tier.price)}`),
    ...(family.extraGuestFee ? [`${formatPeso(family.extraGuestFee)} per extra guest`] : []),
  ].join(' · ');
}

/**
 * Inclusions to compare, by category: a package that includes everything in another shows that
 * package's categories too (its own list wins for a category both have).
 */
export function effectiveGroups(family: PackageFamily, families: readonly PackageFamily[]) {
  const base = family.includesFrom
    ? families.find((item) => item.name.toLowerCase() === family.includesFrom?.toLowerCase())
    : undefined;
  const own = new Map(family.groups.map((group) => [group.title.toLowerCase(), group]));
  const inherited = (base?.groups ?? [])
    .filter((group) => !own.has(group.title.toLowerCase()))
    .map((group) => ({ ...group, from: base?.name ?? null }));
  return [...inherited, ...family.groups.map((group) => ({ ...group, from: null }))];
}
