import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RECEPTIONIST_BOOKING_CONTRACT_VERSION,
  receptionistBookingResultSchema,
  type ReceptionistBookingResult,
} from './receptionist-booking.contract';
import {
  confirmedCalendarOverlapWhere,
  createAdminCalendarSource,
  createReceptionistCalendarAvailability,
  type ReceptionistCalendarQuery,
} from './receptionist-calendar';
import { createReceptionistOrchestrationDispatch } from './receptionist-dispatch';

const now = new Date('2026-11-22T02:00:00.000Z');
const availabilityRequest = {
  schemaVersion: RECEPTIONIST_BOOKING_CONTRACT_VERSION,
  requestId: '11111111-1111-4111-8111-111111111111',
  conversationId: '22222222-2222-4222-8222-222222222222',
  turnId: '33333333-3333-4333-8333-333333333333',
  stateRevision: 5,
  sentAt: now.toISOString(),
  intent: 'availability_check' as const,
  booking: {
    serviceId: 'venue:selah-hall',
    venueId: 'selah-hall',
    preferredSlots: [{ date: '2027-02-14', startTime: '14:00', endTime: '20:00' }],
    timeZone: 'Asia/Manila' as const,
    partySize: 120,
  },
  kbReferences: [],
};

test('admin calendar source selects only an opaque conflict marker for confirmed overlap', async () => {
  let query: unknown;
  const source = createAdminCalendarSource({
    async findFirst(input) {
      query = input;
      return { id: 'opaque-id' };
    },
  });
  const window: ReceptionistCalendarQuery = {
    venue: 'Zion Events Place',
    startsAt: new Date('2027-02-14T06:00:00.000Z'),
    endsAt: new Date('2027-02-14T12:00:00.000Z'),
  };
  assert.equal(await source.hasConfirmedOverlap(window), true);
  assert.deepEqual(query, {
    where: confirmedCalendarOverlapWhere(window),
    select: { id: true },
  });
  assert.deepEqual(confirmedCalendarOverlapWhere(window), {
    venue: 'Zion Events Place',
    reservation: 'CONFIRMED',
    startsAt: { lt: window.endsAt },
    endsAt: { gt: window.startsAt },
  });
});

test('availability reads the shared venue calendar and returns no private record data', async () => {
  let received: ReceptionistCalendarQuery | undefined;
  const calendar = createReceptionistCalendarAvailability({
    source: {
      async hasConfirmedOverlap(query) {
        received = query;
        return false;
      },
    },
    now: () => now,
  });
  const result = await calendar.check(availabilityRequest);
  receptionistBookingResultSchema.parse(result);
  assert.deepEqual(received, {
    venue: 'Zion Events Place',
    startsAt: new Date('2027-02-14T06:00:00.000Z'),
    endsAt: new Date('2027-02-14T12:00:00.000Z'),
  });
  assert.equal(result.status, 'AVAILABLE');
  assert.equal(JSON.stringify(result).includes('reference'), false);
  assert.equal(JSON.stringify(result).includes('client'), false);
  assert.equal(JSON.stringify(result).includes('notes'), false);
});

test('confirmed overlap returns unavailable without exposing the conflicting event', async () => {
  const calendar = createReceptionistCalendarAvailability({
    source: {
      async hasConfirmedOverlap() {
        return true;
      },
    },
    now: () => now,
  });
  const result = await calendar.check(availabilityRequest);
  assert.equal(result.status, 'SLOT_UNAVAILABLE');
  if (result.status === 'SLOT_UNAVAILABLE') assert.deepEqual(result.alternatives, []);
});

test('calendar requires one future venue and time window before reading records', async () => {
  let reads = 0;
  const calendar = createReceptionistCalendarAvailability({
    source: {
      async hasConfirmedOverlap() {
        reads += 1;
        return false;
      },
    },
    now: () => now,
  });
  const result = await calendar.check({
    ...availabilityRequest,
    booking: {
      ...availabilityRequest.booking,
      venueId: undefined,
      preferredSlots: [{ date: '2027-02-14' }],
    },
  });
  receptionistBookingResultSchema.parse(result);
  assert.equal(result.status, 'NEEDS_INFO');
  if (result.status === 'NEEDS_INFO') {
    assert.deepEqual(result.missingFields, ['venue_id', 'time_preference']);
  }
  assert.equal(reads, 0);
});

test('calendar rejects inherited object keys as venue identifiers', async () => {
  let reads = 0;
  const calendar = createReceptionistCalendarAvailability({
    source: {
      async hasConfirmedOverlap() {
        reads += 1;
        return false;
      },
    },
    now: () => now,
  });
  const result = await calendar.check({
    ...availabilityRequest,
    booking: { ...availabilityRequest.booking, venueId: 'constructor' },
  });
  receptionistBookingResultSchema.parse(result);
  assert.equal(result.status, 'NEEDS_INFO');
  if (result.status === 'NEEDS_INFO') assert.deepEqual(result.missingFields, ['venue_id']);
  assert.equal(reads, 0);
});

test('calendar storage failures remain fail-closed', async () => {
  const calendar = createReceptionistCalendarAvailability({
    source: {
      async hasConfirmedOverlap() {
        throw new Error('database unavailable');
      },
    },
    now: () => now,
  });
  const result = await calendar.check(availabilityRequest);
  assert.equal(result.status, 'ERROR');
  if (result.status === 'ERROR') {
    assert.equal(result.errorCode, 'PERSISTENCE_UNAVAILABLE');
    assert.equal(result.retryable, true);
  }
});

test('dispatch keeps availability local and sends mutations to the signed booking adapter', async () => {
  let calendarCalls = 0;
  let bookingCalls = 0;
  const available: ReceptionistBookingResult = {
    schemaVersion: RECEPTIONIST_BOOKING_CONTRACT_VERSION,
    requestId: availabilityRequest.requestId,
    conversationId: availabilityRequest.conversationId,
    turnId: availabilityRequest.turnId,
    stateRevision: availabilityRequest.stateRevision,
    respondedAt: now.toISOString(),
    provenance: { source: 'calendar_system', authoritative: true, observedAt: now.toISOString() },
    status: 'AVAILABLE',
    serviceId: availabilityRequest.booking.serviceId,
    slots: [
      {
        date: '2027-02-14',
        startTime: '14:00',
        endTime: '20:00',
        timeZone: 'Asia/Manila',
      },
    ],
  };
  const dispatch = createReceptionistOrchestrationDispatch({
    calendar: {
      async check() {
        calendarCalls += 1;
        return available;
      },
    },
    booking: {
      async execute(request) {
        bookingCalls += 1;
        const parsed = request as typeof availabilityRequest;
        return {
          schemaVersion: RECEPTIONIST_BOOKING_CONTRACT_VERSION,
          requestId: parsed.requestId,
          conversationId: parsed.conversationId,
          turnId: parsed.turnId,
          stateRevision: parsed.stateRevision,
          respondedAt: now.toISOString(),
          provenance: {
            source: 'orchestration_adapter',
            authoritative: false,
            observedAt: now.toISOString(),
          },
          status: 'ERROR',
          errorCode: 'NOT_CONFIGURED',
          retryable: false,
        };
      },
    },
  });

  assert.equal((await dispatch.execute(availabilityRequest)).status, 'AVAILABLE');
  assert.equal(calendarCalls, 1);
  assert.equal(bookingCalls, 0);

  const mutationRequest = {
    ...availabilityRequest,
    requestId: '44444444-4444-4444-8444-444444444444',
    intent: 'new_booking' as const,
    client: { name: 'Visitor', contact: { email: 'visitor@example.test' } },
    booking: { ...availabilityRequest.booking, specialRequests: '' },
    termsAcknowledgements: [{ kbReference: 'terms/current', acknowledgedAt: now.toISOString() }],
    context: {},
  };
  assert.equal((await dispatch.execute(mutationRequest)).status, 'ERROR');
  assert.equal(calendarCalls, 1);
  assert.equal(bookingCalls, 1);
});
