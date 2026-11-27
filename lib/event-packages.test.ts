import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { bookingInitialChoices } from '@/app/booking/_components/bookingInitial';
import { parseBookingPrefill } from '@/app/booking/_components/bookingPrefill';
import type { BookingCategory } from '@/app/booking/_components/booking-types';
import { eventPhotos } from '@/config/event-photos';
import { bookletCatalog } from '@/config/package-catalog';
import { PHOTO_PLACEHOLDERS } from '@/config/photo-placeholders';
import { packageQuote } from './booking-quote';
import {
  effectiveGroups,
  estimateBreakdown,
  familyEstimate,
  nextStepLinks,
  packageFamilies,
  priceLine,
  type PublishedPackageRow,
} from './event-packages';

/** The debut tiers as the catalog sync stores them in the database. */
const rows: PublishedPackageRow[] = bookletCatalog
  .filter((item) => item.categorySlug === 'debut')
  .map((item, index) => ({ id: `debut-${index}`, ...item }));

/** The same rows as the booking page lists them (app/booking/page.tsx). */
const bookingCategories: BookingCategory[] = [
  {
    slug: 'debut',
    key: 'debut',
    name: 'Debuts',
    imageUrl: null,
    packages: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.packageName,
      price: row.price,
      paxIncluded: row.paxIncluded,
      excessPaxFee: row.excessPaxFee,
      reservationFee: row.reservationFee,
      checkInTime: row.checkInTime,
      checkOutTime: row.checkOutTime,
      inclusions: row.inclusions.map((inclusion) => inclusion.inclusionName),
    })),
  },
];

test('the event page groups published tiers into packages, from the database rows only', () => {
  const families = packageFamilies(rows);
  assert.deepEqual(
    families.map((family) => family.name),
    ['Zion Essential', 'Zion Premium Hassle-Free'],
  );
  const [essential, premium] = families;
  assert.equal(
    priceLine(essential),
    '50 guests ₱165,000 · 100 guests ₱189,000 · ₱1,000 per extra guest',
  );
  assert.equal(essential.tagline, 'Simple yet elegant debut package');
  assert.deepEqual(essential.groups.map((group) => group.title).slice(0, 2), [
    'Venue experience',
    'Catering (food and beverages)',
  ]);
  assert.ok(essential.groups[0].items.includes('5-hour exclusive use of The Main Garden'));
  assert.equal(
    essential.groups.find((group) => group.title === 'Styling and set-up')?.intro,
    'Clean, cohesive styling suited to your celebration theme.',
  );
  // "Everything in Zion Essential" is a pointer, not a category; the comparison shows them.
  assert.equal(premium.includesFrom, 'Zion Essential');
  assert.ok(!premium.groups.some((group) => /^Everything in/.test(group.title)));
  const compared = effectiveGroups(premium, families);
  assert.equal(
    compared.find((group) => group.title === 'Venue experience')?.from,
    'Zion Essential',
  );
  assert.ok(!essential.notes.some((note) => /package booklet/.test(note)));
});

test('the estimate matches the booking page for the same link: 50, 100 and 120 guests', () => {
  const [essential] = packageFamilies(rows);
  const expected = { 50: 16_500_000, 100: 18_900_000, 120: 20_900_000 };
  for (const [guests, totalCents] of Object.entries(expected).map(
    ([key, value]) => [Number(key), value] as const,
  )) {
    const { estimate, booking } = nextStepLinks('debut', essential, guests);
    assert.equal(estimate.totalCents, totalCents, `${guests} guests`);
    // "Check dates" opens the booking page with this tier and guest count; its price agrees.
    const prefill = parseBookingPrefill(booking.slice(booking.indexOf('?')), {
      earliest: '2026-12-09',
      latest: '2028-05-25',
    });
    const initial = bookingInitialChoices(prefill, bookingCategories);
    const chosen = bookingCategories[0].packages.find((item) => item.id === initial.packageId);
    assert.ok(chosen, `${guests} guests: the booking page selects the tier`);
    assert.equal(initial.guests, String(guests));
    assert.equal(packageQuote(chosen, Number(initial.guests)).totalCents, totalCents);
  }
  assert.equal(
    estimateBreakdown(familyEstimate(essential, 120)),
    '120 guests: ₱209,000 (100 guests ₱189,000 + 20 extra guests × ₱1,000)',
  );
  // Rules to confirm with Zion, as the pricing engine applies them today: 70 guests are the
  // 50-guest rate plus 20 extra guests (₱185,000, less than the 100-guest rate), and a party
  // smaller than the smallest tier pays that tier's rate.
  assert.equal(familyEstimate(essential, 70).totalCents, 18_500_000);
  assert.equal(
    estimateBreakdown(familyEstimate(essential, 30)),
    '30 guests: ₱165,000 (the 50-guest rate)',
  );
});

test('a package without an extra-guest fee uses the tier that covers the guests', () => {
  const christening = packageFamilies(
    bookletCatalog
      .filter((item) => item.categorySlug === 'christening')
      .map((item, index) => ({ id: `christening-${index}`, ...item })),
  ).find((family) => family.name === 'Christening');
  assert.ok(christening);
  assert.equal(christening.extraGuestFee, null);
  // Not the 50-guest rate with 70 free guests: the 120-guest tier.
  const estimate = familyEstimate(christening, 120);
  assert.equal(estimate.tier.paxIncluded, 120);
  assert.equal(estimate.totalCents, 11_300_000);
  assert.equal(estimateBreakdown(estimate), '120 guests: ₱113,000');
  assert.equal(familyEstimate(christening, 60).tier.paxIncluded, 70);
  // Beyond the largest tier the page says the team quotes the price.
  const larger = familyEstimate(christening, 160);
  assert.equal(larger.aboveTiers, true);
  assert.equal(
    estimateBreakdown(larger),
    '160 guests: ₱140,000 (the 150-guest rate; our team quotes larger parties)',
  );
});

test('event pages show real photos with placeholders, and never a brochure page', () => {
  for (const [event, set] of Object.entries(eventPhotos)) {
    for (const photo of [...(set.hero ? [set.hero] : []), ...set.gallery]) {
      assert.ok(existsSync(path.join('public', photo.src)), `${event}: ${photo.src}`);
      assert.ok(PHOTO_PLACEHOLDERS[photo.src], `${event}: placeholder for ${photo.src}`);
      assert.ok(photo.alt.length > 20, `${event}: alt text for ${photo.src}`);
    }
    assert.ok(set.gallery.length <= 8, `${event}: at most 8 photos`);
  }
  for (const file of readdirSync('components/events')) {
    const source = readFileSync(path.join('components/events', file), 'utf8');
    assert.doesNotMatch(source, /images\/packages|package-booklets/, file);
  }
});
