import { test } from 'node:test';
import assert from 'node:assert/strict';
import { walkInReview } from './admin/booking-rules';
import { bookingScheduleProblem, manilaDateAfter, packageQuote } from './booking-quote';

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
  const event = { date: '2026-12-16', startTime: '14:00', endTime: '18:00' };
  assert.equal(bookingScheduleProblem(event, NOW), null);
  assert.deepEqual(bookingScheduleProblem({ ...event, date: '2026-11-25' }, NOW), {
    field: 'date',
    problem: 'Please choose a date from tomorrow onward.',
  });
  assert.equal(bookingScheduleProblem({ ...event, date: '2028-12-16' }, NOW)?.field, 'date');
  for (const times of [
    { startTime: '07:30', endTime: '12:00' },
    { startTime: '20:00', endTime: '23:45' },
    { startTime: '14:00', endTime: '14:30' },
    { startTime: '18:00', endTime: '14:00' },
  ])
    assert.equal(bookingScheduleProblem({ ...event, ...times }, NOW)?.field, 'endTime');
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
