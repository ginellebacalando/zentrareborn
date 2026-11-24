import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { receptionistPool } from './state-store';
import {
  ConversationError,
  openConversation,
  sealConversation,
} from '@/lib/chatbot/session-security';
import {
  receptionistBookingRequestSchema,
  receptionistBookingResultSchema,
  type ReceptionistBookingLedger,
  type ReceptionistBookingLedgerAcquireInput,
  type ReceptionistBookingLedgerCompletion,
  type ReceptionistBookingLedgerFailure,
  type ReceptionistBookingRequest,
} from '@/services/orchestration/receptionist-booking.contract';

const fingerprint = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
type LedgerRow = {
  request_id: string;
  fingerprint: string;
  conversation_id: string;
  state_revision: number;
  status: 'prepared' | 'processing' | 'completed' | 'failed';
  attempts: number;
  lease_until: Date;
  lease_token: string;
  encrypted_request: string;
  encrypted_result: string | null;
  retry_at: Date | null;
};

/** Stable, server-derived UUIDv5: browser turn IDs cannot choose another conversation. */
export function operationId(conversationId: string, turnId: string) {
  const bytes = createHash('sha1')
    .update(Buffer.from(conversationId.replaceAll('-', ''), 'hex'))
    .update(turnId)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Preserve the exact original sentAt/body across browser retries and process failures. */
export async function canonicalBookingRequest(proposed: ReceptionistBookingRequest) {
  const parsed = receptionistBookingRequestSchema.parse(proposed);
  const encrypted = sealConversation(parsed, `request:${parsed.requestId}`);
  await receptionistPool.query(
    `INSERT INTO zion_receptionist_requests
    (request_id,conversation_id,state_revision,fingerprint,status,lease_until,encrypted_request,attempts)
    VALUES ($1,$2,$3,$4,'prepared',now(),$5,0) ON CONFLICT (request_id) DO NOTHING`,
    [parsed.requestId, parsed.conversationId, parsed.stateRevision, fingerprint(parsed), encrypted],
  );
  const record = await receptionistPool.query<LedgerRow>(
    'SELECT * FROM zion_receptionist_requests WHERE request_id=$1',
    [parsed.requestId],
  );
  const row = record.rows[0];
  const original = receptionistBookingRequestSchema.parse(
    openConversation(row.encrypted_request, `request:${parsed.requestId}`),
  );
  if (fingerprint({ ...original, sentAt: '' }) !== fingerprint({ ...parsed, sentAt: '' }))
    throw new ConversationError(
      'The request details changed. Please review them before trying again.',
      409,
    );
  return original;
}

async function acquire(input: ReceptionistBookingLedgerAcquireInput) {
  const client = await receptionistPool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query<LedgerRow>(
      'SELECT * FROM zion_receptionist_requests WHERE request_id=$1 FOR UPDATE',
      [input.request.requestId],
    );
    const row = result.rows[0];
    const now = Date.now();
    if (!row) throw new Error('Canonical request was not persisted.');
    if (
      row.fingerprint !== input.requestFingerprint ||
      row.conversation_id !== input.request.conversationId ||
      row.state_revision !== input.request.stateRevision
    ) {
      await client.query('COMMIT');
      return { kind: 'conflict' as const };
    }
    if (
      row.encrypted_result &&
      (row.status === 'completed' || (row.status === 'failed' && !row.retry_at))
    ) {
      const replay = receptionistBookingResultSchema.parse(
        openConversation(row.encrypted_result, `result:${row.request_id}`),
      );
      await client.query('COMMIT');
      return { kind: 'replay' as const, result: replay };
    }
    const waitUntil =
      row.status === 'processing'
        ? row.lease_until.getTime()
        : row.status === 'failed'
          ? (row.retry_at?.getTime() ?? 0)
          : 0;
    if (waitUntil > now) {
      await client.query('COMMIT');
      return { kind: 'busy' as const, retryAfterMs: waitUntil - now };
    }
    if (row.attempts >= input.maxAttempts) {
      await client.query('COMMIT');
      return { kind: 'exhausted' as const };
    }
    const leaseToken = randomUUID();
    await client.query(
      "UPDATE zion_receptionist_requests SET status='processing',lease_token=$2,lease_until=$3,attempts=attempts+1,retry_at=NULL,updated_at=now() WHERE request_id=$1",
      [row.request_id, leaseToken, new Date(now + input.leaseMs)],
    );
    await client.query('COMMIT');
    return {
      kind: 'acquired' as const,
      leaseToken,
      attempt: row.attempts + 1,
      maxAttempts: input.maxAttempts,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function saveResult(
  input: ReceptionistBookingLedgerCompletion | ReceptionistBookingLedgerFailure,
  failed: boolean,
) {
  const parsed = receptionistBookingResultSchema.parse(input.result);
  const result = await receptionistPool.query(
    `UPDATE zion_receptionist_requests SET status=$4,encrypted_result=$5,retry_at=$6,updated_at=now()
    WHERE request_id=$1 AND fingerprint=$2 AND lease_token=$3 AND status='processing'`,
    [
      input.requestId,
      input.requestFingerprint,
      input.leaseToken,
      failed ? 'failed' : 'completed',
      sealConversation(parsed, `result:${input.requestId}`),
      'retryAt' in input ? input.retryAt : null,
    ],
  );
  if (result.rowCount !== 1) throw new Error('Request lease is no longer owned.');
}

export const bookingRequestLedger: ReceptionistBookingLedger = {
  acquire,
  complete: (input) => saveResult(input, false),
  fail: (input) => saveResult(input, true),
};
