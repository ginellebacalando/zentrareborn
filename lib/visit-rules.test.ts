import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_VISIT_RULES,
  findVisitSlot,
  manilaDateKey,
  parseClosedDates,
  visitDays,
  visitRulesProblem,
  VISIT_BOOKING_DAYS,
  type VisitRules,
} from './visit-rules';

const rules = (change: Partial<VisitRules> = {}): VisitRules => ({
  ...structuredClone(DEFAULT_VISIT_RULES),
  ...change,
});
/** A Manila wall-clock time as an instant (UTC+8, no daylight saving time). */
const manila = (date: string, time: string) => new Date(`${date}T${time}:00+08:00`);
// Wednesday 25 November 2026, 08:00 in Manila.
const NOW = manila('2026-11-25', '08:00');

test('visit rules accept the defaults and name the first field to fix', () => {
  assert.equal(visitRulesProblem(rules()), null);
  assert.equal(visitRulesProblem(rules({ weekly: rules().weekly.slice(1) }))?.field, 'weekly.0');
  const weekly = rules().weekly;
  weekly[2] = { open: '9:00', close: '18:00' };
  assert.equal(visitRulesProblem(rules({ weekly }))?.field, 'weekly.2');
  weekly[2] = { open: '17:30', close: '18:00' };
  assert.match(visitRulesProblem(rules({ weekly }))?.problem ?? '', /Tuesday must stay open/);
  assert.equal(visitRulesProblem(rules({ slotMinutes: 50 }))?.field, 'slotMinutes');
  for (const capacity of [0, 6, 1.5, Number.NaN])
    assert.equal(visitRulesProblem(rules({ capacity }))?.field, 'capacity');
  for (const noticeHours of [-1, 73, Number.NaN])
    assert.equal(visitRulesProblem(rules({ noticeHours }))?.field, 'noticeHours');
  assert.equal(visitRulesProblem(rules({ closedDates: ['2026-02-30'] }))?.field, 'closedDates');
  const many = Array.from({ length: 61 }, (_, day) =>
    new Date(Date.UTC(2027, 0, 1 + day)).toISOString().slice(0, 10),
  );
  assert.equal(visitRulesProblem(rules({ closedDates: many }))?.field, 'closedDates');
  // A day without visits needs no hours.
  weekly[2] = null;
  assert.equal(visitRulesProblem(rules({ weekly })), null);
});

test('closed dates are split, de-duplicated and sorted', () => {
  assert.deepEqual(parseClosedDates(' 2027-01-01, 2026-12-25;2026-12-25\n'), [
    '2026-12-25',
    '2027-01-01',
  ]);
  assert.deepEqual(parseClosedDates(''), []);
});

test('the Manila date changes at Manila midnight, not UTC midnight', () => {
  assert.equal(manilaDateKey(new Date('2026-11-24T15:59:00Z')), '2026-11-24');
  assert.equal(manilaDateKey(new Date('2026-11-24T16:00:00Z')), '2026-11-25');
});

test('open visit times follow the weekly hours, notice, closed dates and slot length', () => {
  const days = visitDays(rules(), NOW, 7, []);
  assert.equal(days.length, 7);
  assert.deepEqual(
    days.map((day) => [day.date, day.slots.length]),
    [
      // Wednesday: 12 hours of notice from 08:00 leaves no time today.
      ['2026-11-25', 0],
      ['2026-11-26', 8],
      ['2026-11-27', 8],
      ['2026-11-28', 8],
      // Sunday afternoons only, and no visits on Mondays.
      ['2026-11-29', 4],
      ['2026-11-30', 0],
      ['2026-12-01', 8],
    ],
  );
  assert.deepEqual(days[1].slots[0], {
    startsAt: manila('2026-11-26', '10:00').toISOString(),
    endsAt: manila('2026-11-26', '11:00').toISOString(),
    remaining: 1,
  });
  // Without notice, the rest of today is open from the next whole slot.
  const today = visitDays(rules({ noticeHours: 0 }), manila('2026-11-25', '13:15'), 1, [])[0];
  assert.equal(today.slots[0].startsAt, manila('2026-11-25', '14:00').toISOString());
  assert.equal(today.slots.length, 4);
  // A closed date offers nothing; 90-minute visits fit five times into 10:00 to 18:00.
  assert.equal(visitDays(rules({ closedDates: ['2026-11-27'] }), NOW, 3, [])[2].slots.length, 0);
  assert.deepEqual(
    visitDays(rules({ slotMinutes: 90 }), NOW, 2, [])[1].slots.map((slot) =>
      new Date(slot.startsAt).toISOString(),
    ),
    ['10:00', '11:30', '13:00', '14:30', '16:00'].map((time) =>
      manila('2026-11-26', time).toISOString(),
    ),
  );
});

test('taken visits use up capacity and events at the venue block their hours', () => {
  const taken = [
    { startsAt: manila('2026-11-26', '10:00'), endsAt: manila('2026-11-26', '11:00') },
  ];
  const full = visitDays(rules(), NOW, 2, taken)[1];
  assert.equal(full.slots[0].startsAt, manila('2026-11-26', '11:00').toISOString());
  const shared = visitDays(rules({ capacity: 2 }), NOW, 2, taken)[1];
  assert.equal(shared.slots[0].startsAt, manila('2026-11-26', '10:00').toISOString());
  assert.equal(shared.slots[0].remaining, 1);
  const event = [
    { startsAt: manila('2026-11-26', '12:00'), endsAt: manila('2026-11-26', '15:30') },
  ];
  const around = visitDays(rules({ capacity: 5 }), NOW, 2, [], event)[1].slots.map((slot) =>
    new Date(slot.startsAt).toISOString(),
  );
  assert.deepEqual(
    around,
    ['10:00', '11:00', '16:00', '17:00'].map((time) => manila('2026-11-26', time).toISOString()),
  );
});

test('a chosen time must be an open slot within the booking window', () => {
  const open = findVisitSlot(rules(), NOW, manila('2026-11-26', '10:00'), []);
  assert.equal(open?.endsAt, manila('2026-11-26', '11:00').toISOString());
  // Off the slot grid, too soon, a closed Monday, in the past or beyond the window.
  assert.equal(findVisitSlot(rules(), NOW, manila('2026-11-26', '10:30'), []), null);
  assert.equal(findVisitSlot(rules(), NOW, manila('2026-11-25', '15:00'), []), null);
  assert.equal(findVisitSlot(rules(), NOW, manila('2026-11-30', '10:00'), []), null);
  assert.equal(findVisitSlot(rules(), NOW, manila('2026-11-24', '10:00'), []), null);
  const beyond = new Date(NOW.getTime() + (VISIT_BOOKING_DAYS + 1) * 86_400_000);
  assert.equal(findVisitSlot(rules(), NOW, beyond, []), null);
  // A time someone holds is not open when the capacity is one.
  const taken = [
    { startsAt: manila('2026-11-26', '10:00'), endsAt: manila('2026-11-26', '11:00') },
  ];
  assert.equal(findVisitSlot(rules(), NOW, manila('2026-11-26', '10:00'), taken), null);
});
