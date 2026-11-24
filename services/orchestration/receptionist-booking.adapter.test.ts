import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createReceptionistBookingAdapter,
  signReceptionistBookingBody,
  verifyReceptionistBookingSignature,
} from './receptionist-booking.adapter';
import {
  RECEPTIONIST_BOOKING_CONTRACT_VERSION,
  isReceptionistBookingResultCompatible,
  receptionistBookingRequestSchema,
  receptionistBookingResultSchema,
  type ReceptionistBookingLedger,
  type ReceptionistBookingResult,
} from './receptionist-booking.contract';
import type { ReceptionistBookingConfig } from '@/lib/orchestration/config/receptionist-booking';

const now = new Date('2026-11-21T02:00:00.000Z');
const requestSecret = 'r'.repeat(43);
const responseSecret = 's'.repeat(43);
const readyConfig: ReceptionistBookingConfig = {
  state: 'ready',
  endpoint: new URL('https://automation.example.test/webhook/receptionist-booking-v1'),
  requestSecret,
  responseSecret,
  timeoutMs: 8000,
  leaseMs: 15000,
  maxAttempts: 2,
  retryBaseMs: 1000,
  maxResponseBytes: 65536,
  signatureToleranceSeconds: 300,
};

const request = {
  schemaVersion: RECEPTIONIST_BOOKING_CONTRACT_VERSION,
  requestId: '11111111-1111-4111-8111-111111111111',
  conversationId: '22222222-2222-4222-8222-222222222222',
  turnId: '33333333-3333-4333-8333-333333333333',
  stateRevision: 4,
  sentAt: now.toISOString(),
  intent: 'availability_check' as const,
  booking: {
    serviceId: 'wedding-event',
    preferredSlots: [{ date: '2027-02-14', startTime: '14:00', endTime: '20:00' }],
    timeZone: 'Asia/Manila' as const,
    partySize: 120,
  },
  kbReferences: ['PKG-WEDDING-001'],
};

const availableResult: ReceptionistBookingResult = {
  schemaVersion: RECEPTIONIST_BOOKING_CONTRACT_VERSION,
  requestId: request.requestId,
  conversationId: request.conversationId,
  turnId: request.turnId,
  stateRevision: request.stateRevision,
  respondedAt: now.toISOString(),
  provenance: {
    source: 'calendar_system',
    authoritative: true,
    observedAt: now.toISOString(),
    externalExecutionId: 'execution-1',
    recordRevision: 8,
  },
  status: 'AVAILABLE',
  serviceId: request.booking.serviceId,
  slots: [
    {
      date: '2027-02-14',
      startTime: '14:00',
      endTime: '20:00',
      timeZone: 'Asia/Manila',
    },
  ],
};

function ledger(
  acquire: ReceptionistBookingLedger['acquire'],
  state: { completed?: ReceptionistBookingResult; failed?: ReceptionistBookingResult } = {},
): ReceptionistBookingLedger {
  return {
    acquire,
    async complete(input) {
      state.completed = input.result;
    },
    async fail(input) {
      state.failed = input.result;
    },
  };
}

test('availability requests stay minimal and reject client identity fields', () => {
  assert.equal(receptionistBookingRequestSchema.parse(request).intent, 'availability_check');
  assert.throws(() =>
    receptionistBookingRequestSchema.parse({
      ...request,
      client: { name: 'Should not travel', contact: { email: 'visitor@example.test' } },
    }),
  );
});

test('results require authoritative provenance and booking-system confirmation', () => {
  assert.equal(receptionistBookingResultSchema.parse(availableResult).status, 'AVAILABLE');
  assert.throws(() =>
    receptionistBookingResultSchema.parse({
      ...availableResult,
      status: 'CONFIRMED',
      bookingReference: 'BOOK-1',
      serviceId: 'wedding-event',
      slot: availableResult.status === 'AVAILABLE' ? availableResult.slots[0] : undefined,
      settlementStatus: 'VERIFIED',
      provenance: { ...availableResult.provenance, source: 'calendar_system' },
      slots: undefined,
    }),
  );
});

test('result compatibility rejects cross-intent outcomes and mismatched services', () => {
  assert.equal(isReceptionistBookingResultCompatible(request, availableResult), true);
  assert.equal(
    isReceptionistBookingResultCompatible(request, {
      ...availableResult,
      serviceId: 'different-service',
    }),
    false,
  );
  assert.equal(
    isReceptionistBookingResultCompatible(request, {
      ...availableResult,
      status: 'CONFIRMED',
      bookingReference: 'BOOK-1',
      serviceId: request.booking.serviceId,
      slot: availableResult.slots[0],
      settlementStatus: 'VERIFIED',
      provenance: { ...availableResult.provenance, source: 'booking_system' },
    }),
    false,
  );
});

test('disabled orchestration fails closed without a ledger or network call', async () => {
  let transported = false;
  const adapter = createReceptionistBookingAdapter({
    getConfig: () => ({ state: 'disabled', reason: 'disabled' }),
    transport: async () => {
      transported = true;
      throw new Error('must not run');
    },
    now: () => now,
  });
  const result = await adapter.execute(request);
  assert.equal(result.status, 'ERROR');
  if (result.status === 'ERROR') assert.equal(result.errorCode, 'NOT_CONFIGURED');
  assert.equal(transported, false);
});

test('configured orchestration refuses network work without durable persistence', async () => {
  let transported = false;
  const adapter = createReceptionistBookingAdapter({
    getConfig: () => readyConfig,
    verifyDestination: async () => {},
    transport: async () => {
      transported = true;
      throw new Error('must not run');
    },
    now: () => now,
  });
  const result = await adapter.execute(request);
  assert.equal(result.status, 'ERROR');
  if (result.status === 'ERROR') assert.equal(result.errorCode, 'PERSISTENCE_UNAVAILABLE');
  assert.equal(transported, false);
});

test('acquired requests use exact-body signatures and persist correlated results', async () => {
  const state: { completed?: ReceptionistBookingResult } = {};
  let requestBody = '';
  const adapter = createReceptionistBookingAdapter({
    ledger: ledger(
      async () => ({ kind: 'acquired', leaseToken: 'lease-1', attempt: 1, maxAttempts: 2 }),
      state,
    ),
    getConfig: () => readyConfig,
    verifyDestination: async () => {},
    transport: async (_input, init) => {
      requestBody = String(init.body);
      const headers = new Headers(init.headers);
      assert.equal(headers.get('x-zion-idempotency-key'), request.requestId);
      assert.equal(
        verifyReceptionistBookingSignature(
          requestBody,
          headers.get('x-zion-timestamp') ?? '',
          headers.get('x-zion-signature') ?? '',
          requestSecret,
        ),
        true,
      );
      const body = JSON.stringify(availableResult);
      const timestamp = String(Math.floor(now.getTime() / 1000));
      return new Response(body, {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-zion-timestamp': timestamp,
          'x-zion-signature': signReceptionistBookingBody(body, timestamp, responseSecret),
        },
      });
    },
    now: () => now,
  });

  const result = await adapter.execute(request);
  assert.equal(JSON.parse(requestBody).client, undefined);
  assert.equal(result.status, 'AVAILABLE');
  assert.deepEqual(state.completed, availableResult);
});

test('a replayed result does not contact the workflow again', async () => {
  let transported = false;
  const adapter = createReceptionistBookingAdapter({
    ledger: ledger(async () => ({ kind: 'replay', result: availableResult })),
    getConfig: () => readyConfig,
    transport: async () => {
      transported = true;
      throw new Error('must not run');
    },
    now: () => now,
  });
  assert.equal((await adapter.execute(request)).status, 'AVAILABLE');
  assert.equal(transported, false);
});

test('stale availability replay fails closed and requires a fresh turn', async () => {
  const staleResult = {
    ...availableResult,
    respondedAt: '2026-11-21T01:00:00.000Z',
    provenance: {
      ...availableResult.provenance,
      observedAt: '2026-11-21T01:00:00.000Z',
    },
  } satisfies ReceptionistBookingResult;
  const adapter = createReceptionistBookingAdapter({
    ledger: ledger(async () => ({ kind: 'replay', result: staleResult })),
    getConfig: () => readyConfig,
    now: () => now,
  });
  const result = await adapter.execute(request);
  assert.equal(result.status, 'ERROR');
  if (result.status === 'ERROR') assert.equal(result.errorCode, 'CONFLICT');
});

test('unsigned results are rejected and recorded without inventing availability', async () => {
  const state: { failed?: ReceptionistBookingResult } = {};
  const adapter = createReceptionistBookingAdapter({
    ledger: ledger(
      async () => ({ kind: 'acquired', leaseToken: 'lease-2', attempt: 1, maxAttempts: 2 }),
      state,
    ),
    getConfig: () => readyConfig,
    verifyDestination: async () => {},
    transport: async () =>
      new Response(JSON.stringify(availableResult), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    now: () => now,
  });
  const result = await adapter.execute(request);
  assert.equal(result.status, 'ERROR');
  if (result.status === 'ERROR') {
    assert.equal(result.errorCode, 'AUTHENTICATION_FAILED');
    assert.equal(result.retryable, false);
  }
  assert.equal(state.failed?.status, 'ERROR');
});

test('a ledger failure is surfaced as persistence unavailable', async () => {
  const reported: string[] = [];
  const adapter = createReceptionistBookingAdapter({
    ledger: {
      async acquire() {
        return { kind: 'acquired', leaseToken: 'lease-3', attempt: 1, maxAttempts: 2 };
      },
      async complete() {},
      async fail() {
        throw new Error('database unavailable');
      },
    },
    getConfig: () => readyConfig,
    verifyDestination: async () => {},
    transport: async () => {
      throw new Error('network unavailable');
    },
    reportPersistenceFailure(operation) {
      reported.push(operation);
    },
    now: () => now,
  });
  const result = await adapter.execute(request);
  assert.equal(result.status, 'ERROR');
  if (result.status === 'ERROR') assert.equal(result.errorCode, 'PERSISTENCE_UNAVAILABLE');
  assert.deepEqual(reported, ['fail']);
});
