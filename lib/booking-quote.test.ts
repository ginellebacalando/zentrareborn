import { test } from 'node:test';
import assert from 'node:assert/strict';
import { walkInReview } from './admin/booking-rules';
import {
  bookingScheduleProblem,
  cheaperTier,
  manilaDateAfter,
  packageQuote,
  packageFamily,
} from './booking-quote';
import { baseNameOf, bookletCatalog } from '@/config/package-catalog';

test('the catalog carries every booklet rate, with the Terms reservation fees only', () => {
  const classic = bookletCatalog.filter(
    (row) => row.categorySlug === 'wedding-reception' && row.baseName === 'Zion Classic',
  );
  assert.deepEqual(
    classic.map((row) => [row.packageName, row.price, row.paxIncluded, row.excessPaxFee]),
    [
      ['Zion Classic (50 guests)', 175000, 50, 1600],
      ['Zion Classic (100 guests)', 199000, 100, 1600],
    ],
  );
  assert.deepEqual(
    [...new Set(bookletCatalog.filter((row) => row.reservationFee).map((row) => row.baseName))],
    ['Zion Classic', 'Zion Premium', 'Zion Ultimate'],
  );
  // Slugs are unique within each event category, and every rate names its package.
  for (const slug of new Set(bookletCatalog.map((row) => row.categorySlug))) {
    const slugs = bookletCatalog.filter((row) => row.categorySlug === slug).map((row) => row.slug);
    assert.equal(new Set(slugs).size, slugs.length, slug);
  }
  assert.ok(bookletCatalog.every((row) => baseNameOf(row.packageName) === row.baseName));
  assert.ok(
    bookletCatalog.every((row) => packageFamily(row.packageName) === row.baseName.toLowerCase()),
  );
});

test('a guest tier points to the same package’s cheaper tier for the guest count', () => {
  const tiers = bookletCatalog
    .filter((row) => row.categorySlug === 'wedding-reception')
    .map((row) => ({ ...row, name: row.packageName }));
  const fifty = tiers.find((row) => row.packageName === 'Zion Classic (50 guests)')!;
  const hundred = tiers.find((row) => row.packageName === 'Zion Classic (100 guests)')!;
  // 100 guests: ₱175,000 + 50 × ₱1,600 = ₱255,000 against ₱199,000.
  assert.deepEqual(cheaperTier(tiers, fifty, 100), { pkg: hundred, totalCents: 19_900_000 });
  // 60 guests: ₱175,000 + 10 × ₱1,600 = ₱191,000 is the cheaper one already.
  assert.equal(cheaperTier(tiers, fifty, 60), null);
  assert.deepEqual(cheaperTier(tiers, hundred, 60), { pkg: fifty, totalCents: 19_100_000 });
  // Other packages are never suggested, and nothing is suggested without a guest count.
  assert.equal(
    cheaperTier(
      tiers,
      tiers.find((row) => row.baseName === 'Zion Premium')!,
      30,
    ),
    null,
  );
  assert.equal(cheaperTier(tiers, fifty, Number.NaN), null);
});

const classic = { price: 150000, paxIncluded: 100, excessPaxFee: 450, reservationFee: 5000 };
// Wednesday 25 November 2026, 20:00 in Manila.
const NOW = Date.parse('2026-11-25T20:00:00+08:00');

test('one pricing engine: extra guests pay the per-guest fee and the fee never exceeds the total', () => {
  assert.deepEqual(packageQuote(classic, 80), {
    extraGuests: 0,
    extraCents: 0,
    totalCents: 15000000,
    depositCents: 500000,
  });
  assert.deepEqual(packageQuote(classic, 150), {
    extraGuests: 50,
    extraCents: 2250000,
    totalCents: 17250000,
    depositCents: 500000,
  });
  assert.equal(
    packageQuote({ ...classic, price: 1000, reservationFee: 5000 }, 10).depositCents,
    100000,
  );
  assert.equal(packageQuote(classic, Number.NaN).extraGuests, 0);
});

test('one set of date and time rules for the website and the front desk', () => {
  assert.equal(manilaDateAfter(0, NOW), '2026-11-25');
  assert.equal(manilaDateAfter(1, NOW), '2026-11-26');
  // Settings > Booking window: 14 days of notice, up to 18 months ahead (25 May 2028).
  const window = { minNoticeDays: 14, maxMonthsAhead: 18 };
  const event = { date: '2026-12-16', startTime: '14:00', endTime: '18:00' };
  assert.equal(bookingScheduleProblem(event, window, NOW), null);
  assert.deepEqual(bookingScheduleProblem({ ...event, date: '2026-11-25' }, window, NOW), {
    field: 'date',
    problem: 'Choose a date from December 9, 2026 onward. Book at least 14 days ahead.',
  });
  assert.equal(
    bookingScheduleProblem({ ...event, date: '2026-12-08' }, window, NOW)?.field,
    'date',
  );
  assert.equal(bookingScheduleProblem({ ...event, date: '2026-12-09' }, window, NOW), null);
  assert.equal(bookingScheduleProblem({ ...event, date: '2028-05-25' }, window, NOW), null);
  assert.deepEqual(bookingScheduleProblem({ ...event, date: '2028-05-26' }, window, NOW), {
    field: 'date',
    problem:
      'Choose a date up to May 25, 2028. You can book up to 18 months ahead (until May 2028).',
  });
  for (const times of [
    { startTime: '07:30', endTime: '12:00' },
    { startTime: '20:00', endTime: '23:45' },
    { startTime: '14:00', endTime: '14:30' },
    { startTime: '18:00', endTime: '14:00' },
  ])
    assert.equal(bookingScheduleProblem({ ...event, ...times }, window, NOW)?.field, 'endTime');
});

test('at the desk only the guest limit can be approved by staff; other reasons stay with Bookings', () => {
  const request = {
    totalCents: 17250000,
    depositCents: 500000,
    paymentRule: 'DEPOSIT_REQUIRED',
    guests: 150,
    policyReviewed: true,
    reviewGuestLimit: 120,
  };
  assert.deepEqual(walkInReview(request), { blocking: [], overridable: ['more than 120 guests'] });
  assert.deepEqual(walkInReview({ ...request, reviewGuestLimit: null }), {
    blocking: [],
    overridable: [],
  });
  const custom = walkInReview({ ...request, totalCents: 0, depositCents: 0 });
  assert.deepEqual(custom.blocking, ['custom proposal: Zion needs to quote a price']);
  assert.deepEqual(custom.overridable, ['more than 120 guests']);
  assert.match(walkInReview({ ...request, policyReviewed: false }).blocking[0], /payment policy/);
});
