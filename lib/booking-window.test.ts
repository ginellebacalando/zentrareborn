import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addMonthsIso,
  bookingOpensOn,
  bookingWindowDates,
  limitSentence,
  noticeSentence,
  normalizeBookingWindow,
  parseBookingWindow,
  windowPosition,
} from './booking-window';

const NOW = Date.parse('2026-11-27T04:00:00Z');
const window = { minNoticeDays: 14, maxMonthsAhead: 18 };

test('one booking window: 14 days of notice and 18 months ahead by default', () => {
  const dates = bookingWindowDates(window, NOW);
  assert.deepEqual(dates, { today: '2026-11-27', earliest: '2026-12-11', latest: '2028-05-27' });
  assert.equal(windowPosition('2026-11-26', dates), 'past');
  assert.equal(windowPosition('2026-12-10', dates), 'too_soon');
  assert.equal(windowPosition('2026-12-11', dates), 'open');
  assert.equal(windowPosition('2028-05-27', dates), 'open');
  assert.equal(windowPosition('2028-05-28', dates), 'too_far');
  assert.equal(noticeSentence(window), 'Book at least 14 days ahead.');
  assert.equal(
    limitSentence(window, dates),
    'You can book up to 18 months ahead (until May 2028).',
  );
  // Saved values out of range fall back to the defaults.
  assert.deepEqual(normalizeBookingWindow({ minNoticeDays: 0, maxMonthsAhead: 99 }), window);
  assert.deepEqual(normalizeBookingWindow(null), window);
});

test('months keep their day, and a far date says when its bookings open', () => {
  assert.equal(addMonthsIso('2026-08-31', 18), '2028-02-29');
  assert.equal(addMonthsIso('2027-03-31', -1), '2027-02-28');
  assert.equal(bookingOpensOn('2028-08-15', window), '2027-02-15');
  // 18 months before 31 August is "31 February": bookings open on 1 March, the first day whose
  // window reaches 31 August.
  assert.equal(bookingOpensOn('2028-08-31', window), '2027-03-01');
  assert.equal(bookingWindowDates(window, Date.parse('2027-03-01T00:00:00Z')).latest, '2028-09-01');
});

test('Settings checks the two numbers like the server', () => {
  assert.deepEqual(parseBookingWindow('14', '18'), { window });
  const fieldOf = (notice: string, months: string) => {
    const result = parseBookingWindow(notice, months);
    return 'field' in result ? result.field : null;
  };
  assert.equal(fieldOf('0', '18'), 'minNoticeDays');
  assert.equal(fieldOf('14', ''), 'maxMonthsAhead');
  assert.equal('field' in parseBookingWindow('2.5', '18'), true);
});
