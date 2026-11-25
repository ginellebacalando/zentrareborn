import test from 'node:test';
import assert from 'node:assert/strict';
import {
  confirmedCalendarOverlapWhere,
  createAdminCalendarSource,
  createReceptionistCalendarAvailability,
  type ConfirmedSpan,
  type ReceptionistCalendarQuery,
  type ReceptionistCalendarSource,
} from './receptionist-calendar';

const now = new Date('2026-11-22T02:00:00.000Z');

function source(overrides: Partial<ReceptionistCalendarSource> = {}): ReceptionistCalendarSource {
  return {
    async hasConfirmedOverlap() {
      return false;
    },
    async confirmedSpans() {
      return [];
    },
    ...overrides,
  };
}

test('the admin calendar source selects only an opaque id or the confirmed time span', async () => {
  const queries: unknown[] = [];
  const reader = createAdminCalendarSource({
    async findFirst(input) {
      queries.push(input);
      return { id: 'opaque-id' };
    },
    async findMany(input) {
      queries.push(input);
      return [];
    },
  });
  const window: ReceptionistCalendarQuery = {
    venue: 'Zion Events Place',
    startsAt: new Date('2027-02-14T06:00:00.000Z'),
    endsAt: new Date('2027-02-14T12:00:00.000Z'),
  };
  assert.equal(await reader.hasConfirmedOverlap(window), true);
  await reader.confirmedSpans(window);
  assert.deepEqual(queries[0], {
    where: confirmedCalendarOverlapWhere(window),
    select: { id: true },
  });
  assert.deepEqual(queries[1], {
    where: confirmedCalendarOverlapWhere(window),
    select: { startsAt: true, endsAt: true },
    orderBy: { startsAt: 'asc' },
    take: 500,
  });
  // Confirmed reservations and approved requests holding their date both make a slot unavailable.
  assert.deepEqual(confirmedCalendarOverlapWhere(window), {
    venue: 'Zion Events Place',
    OR: [{ reservation: 'CONFIRMED' }, { reservation: 'REQUESTED', approval: 'APPROVED' }],
    startsAt: { lt: window.endsAt },
    endsAt: { gt: window.startsAt },
  });
});

test('an explicit Manila window is checked against the shared venue calendar', async () => {
  let received: ReceptionistCalendarQuery | undefined;
  const calendar = createReceptionistCalendarAvailability({
    source: source({
      async hasConfirmedOverlap(query) {
        received = query;
        return false;
      },
    }),
    now: () => now,
  });
  const result = await calendar.check({ date: '2027-02-14', startTime: '14:00', endTime: '20:00' });
  assert.deepEqual(received, {
    venue: 'Zion Events Place',
    startsAt: new Date('2027-02-14T06:00:00.000Z'),
    endsAt: new Date('2027-02-14T12:00:00.000Z'),
  });
  assert.equal(result.status, 'AVAILABLE');
  if (result.status === 'AVAILABLE') {
    assert.equal(result.wholeDay, false);
    assert.equal(result.startTime, '14:00');
  }
  assert.doesNotMatch(JSON.stringify(result), /reference|client|notes/);
});

test('a date without a time checks the whole Manila day, including later today', async () => {
  let received: ReceptionistCalendarQuery | undefined;
  const calendar = createReceptionistCalendarAvailability({
    source: source({
      async hasConfirmedOverlap(query) {
        received = query;
        return true;
      },
    }),
    now: () => now,
  });
  const result = await calendar.check({ date: '2026-11-22' });
  assert.equal(result.status, 'UNAVAILABLE');
  assert.deepEqual(received, {
    venue: 'Zion Events Place',
    startsAt: new Date('2026-11-21T16:00:00.000Z'),
    endsAt: new Date('2026-11-22T16:00:00.000Z'),
  });
});

test('invalid, past or reversed requests never read the calendar', async () => {
  let reads = 0;
  const calendar = createReceptionistCalendarAvailability({
    source: source({
      async hasConfirmedOverlap() {
        reads += 1;
        return false;
      },
    }),
    now: () => now,
  });
  assert.deepEqual(await calendar.check({ date: '2027-02-30' }), {
    status: 'INVALID',
    reason: 'date',
    observedAt: now.toISOString(),
  });
  assert.equal((await calendar.check({ date: '2026-11-21' })).status, 'INVALID');
  const reversed = await calendar.check({
    date: '2027-02-14',
    startTime: '20:00',
    endTime: '14:00',
  });
  assert.equal(reversed.status === 'INVALID' && reversed.reason, 'time');
  const started = await calendar.check({
    date: '2026-11-22',
    startTime: '09:00',
    endTime: '11:00',
  });
  assert.equal(started.status === 'INVALID' && started.reason, 'time');
  assert.equal(reads, 0);
});

test('calendar storage failures remain fail-closed', async () => {
  const calendar = createReceptionistCalendarAvailability({
    source: source({
      async hasConfirmedOverlap() {
        throw new Error('database unavailable');
      },
    }),
    now: () => now,
  });
  assert.equal((await calendar.check({ date: '2027-02-14' })).status, 'ERROR');
});

test('unavailable dates list only Manila dates with a confirmed event in the range', async () => {
  let received: ReceptionistCalendarQuery | undefined;
  const spans: ConfirmedSpan[] = [
    // 26 Nov 2026, 14:00–19:00 Manila.
    {
      startsAt: new Date('2026-11-26T06:00:00.000Z'),
      endsAt: new Date('2026-11-26T11:00:00.000Z'),
    },
    // 30 Nov 22:00 to 1 Dec 02:00 Manila spans two dates.
    {
      startsAt: new Date('2026-11-30T14:00:00.000Z'),
      endsAt: new Date('2026-11-30T18:00:00.000Z'),
    },
    // Ends exactly at midnight Manila, so 5 Dec is not occupied.
    {
      startsAt: new Date('2026-12-04T08:00:00.000Z'),
      endsAt: new Date('2026-12-04T16:00:00.000Z'),
    },
    // Outside the requested range.
    {
      startsAt: new Date('2027-03-01T06:00:00.000Z'),
      endsAt: new Date('2027-03-01T11:00:00.000Z'),
    },
  ];
  const calendar = createReceptionistCalendarAvailability({
    source: source({
      async confirmedSpans(query) {
        received = query;
        return spans;
      },
    }),
    now: () => now,
  });
  assert.deepEqual(await calendar.unavailableDates('2026-11-22', '2027-01-21'), [
    '2026-11-26',
    '2026-11-30',
    '2026-12-01',
    '2026-12-04',
  ]);
  assert.deepEqual(received, {
    venue: 'Zion Events Place',
    startsAt: new Date('2026-11-21T16:00:00.000Z'),
    endsAt: new Date('2027-01-21T16:00:00.000Z'),
  });
  assert.deepEqual(await calendar.unavailableDates('2027-01-21', '2026-11-22'), []);
});
