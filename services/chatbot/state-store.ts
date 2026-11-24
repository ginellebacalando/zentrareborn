import 'server-only';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import {
  conversationSchema,
  createConversation,
  contextualReply,
  type ReceptionistConversation,
} from '@/lib/chatbot/conversation';
import {
  ConversationError,
  hashSession,
  newSessionToken,
  openConversation,
  sealConversation,
  sessionToken,
} from '@/lib/chatbot/session-security';
import type { ChatReply } from '@/lib/chatbot/types';

const globalStore = globalThis as unknown as { receptionistPool?: pg.Pool };
// Never route encrypted conversation writes through Prisma's development query logger.
function createReceptionistPool() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    statement_timeout: 18000,
  });
  pool.on('error', () => console.error('[receptionist] Conversation storage is unavailable.'));
  return pool;
}
export const receptionistPool = globalStore.receptionistPool ?? createReceptionistPool();
if (process.env.NODE_ENV !== 'production') globalStore.receptionistPool = receptionistPool;

type Receipt = { turnId: string; fingerprint: string; reply: ChatReply; validUntil?: string };
type Envelope = { state: ReceptionistConversation; receipts: Receipt[] };
type RecordRow = {
  id: string;
  encrypted_state: string;
  revision: number;
  expires_at: Date;
  processing_turn_id: string | null;
  processing_token: string | null;
  processing_until: Date | null;
  processing_fingerprint: string | null;
  encrypted_pending: string | null;
};
export type PendingReceptionistCommand = {
  question: string;
  turnId: string;
  action?: { type: string; value?: string };
};
export type ConversationSession = { id: string; token: string; created: boolean };

function decode(row: RecordRow): Envelope {
  const envelope = openConversation(row.encrypted_state, `conversation:${row.id}`) as Envelope;
  const state = conversationSchema.parse(envelope.state);
  if (state.id !== row.id || state.revision !== row.revision || !Array.isArray(envelope.receipts))
    throw new ConversationError('Conversation memory needs to be reset.', 409);
  return { state, receipts: envelope.receipts.slice(-10) };
}

function encode(envelope: Envelope) {
  let encrypted = sealConversation(envelope, `conversation:${envelope.state.id}`);
  while (encrypted.length > 160000 && envelope.receipts.length > 1) {
    envelope.receipts.shift();
    encrypted = sealConversation(envelope, `conversation:${envelope.state.id}`);
  }
  if (encrypted.length > 160000)
    throw new ConversationError(
      'This conversation has reached its memory limit. Please start a new chat.',
      429,
    );
  return encrypted;
}

export async function findConversation(request: Request) {
  const token = sessionToken(request);
  if (!token) return null;
  const result = await receptionistPool.query<RecordRow>(
    'SELECT * FROM zion_receptionist_conversations WHERE token_hash=$1 AND expires_at>now()',
    [hashSession(token)],
  );
  const row = result.rows[0];
  return row
    ? {
        session: { id: row.id, token, created: false },
        ...decode(row),
        pending: row.encrypted_pending
          ? (openConversation(
              row.encrypted_pending,
              `pending:${row.id}`,
            ) as PendingReceptionistCommand)
          : null,
      }
    : null;
}

export async function ensureConversation(request: Request): Promise<ConversationSession> {
  const existing = await findConversation(request);
  if (existing) return existing.session;
  const token = newSessionToken();
  const id = randomUUID();
  const state = createConversation(id);
  const encrypted = sealConversation({ state, receipts: [] }, `conversation:${id}`);
  await receptionistPool.query(
    'DELETE FROM zion_receptionist_conversations WHERE expires_at<=now()',
  );
  await receptionistPool.query(
    'INSERT INTO zion_receptionist_conversations (id,token_hash,encrypted_state,expires_at) VALUES ($1,$2,$3,$4)',
    [id, hashSession(token), encrypted, state.expiresAt],
  );
  return { id, token, created: true };
}

export async function runConversationTurn(
  session: ConversationSession,
  command: {
    turnId: string;
    fingerprint: string;
    expectedRevision?: number;
    recovery?: PendingReceptionistCommand;
  },
  execute: (state: ReceptionistConversation) => Promise<ChatReply>,
) {
  const leaseToken = randomUUID();
  try {
    const result = await receptionistPool.query<RecordRow>(
      'SELECT * FROM zion_receptionist_conversations WHERE id=$1 AND token_hash=$2 AND expires_at>now()',
      [session.id, hashSession(session.token)],
    );
    if (!result.rows[0])
      throw new ConversationError('Your conversation expired. Start a new chat to continue.', 409);
    const envelope = decode(result.rows[0]);
    const receipt = envelope.receipts.find((item) => item.turnId === command.turnId);
    if (receipt) {
      if (receipt.fingerprint !== command.fingerprint)
        throw new ConversationError(
          'This message was already used. Please send the corrected message again.',
          409,
        );
      if (receipt.validUntil && new Date(receipt.validUntil).getTime() <= Date.now())
        return contextualReply(envelope.state, {
          kind: 'handoff',
          message:
            'That previous operational result has expired. Please request a fresh schedule check or ask the Zion team before relying on it.',
          sources: [],
          suggestions: [],
          actions: [
            envelope.state.booking.intent === 'availability_check'
              ? { type: 'check_availability', label: 'Check the schedule again' }
              : { type: 'request_human', label: 'Ask the team to verify' },
          ],
        });
      return contextualReply(envelope.state, {
        ...receipt.reply,
        ...(receipt.reply.context?.revision !== envelope.state.revision ? { actions: [] } : {}),
      });
    }
    if (
      command.expectedRevision !== undefined &&
      command.expectedRevision !== envelope.state.revision
    )
      throw new ConversationError(
        'This conversation changed in another tab. Your message is retained; refresh its details and send again.',
        409,
      );
    if (envelope.state.turn >= 200)
      throw new ConversationError('Please start a new chat to continue this conversation.', 429);
    const row = result.rows[0];
    if (row.processing_until && row.processing_until.getTime() > Date.now())
      throw new ConversationError(
        'Your previous message is still being processed. Please try again shortly.',
        409,
      );
    if (
      row.processing_turn_id &&
      (row.processing_turn_id !== command.turnId ||
        row.processing_fingerprint !== command.fingerprint)
    )
      throw new ConversationError(
        'Your previous message was interrupted. Use Retry previous message to recover it, or start a new chat.',
        409,
      );
    const claimed = await receptionistPool.query(
      `UPDATE zion_receptionist_conversations SET processing_turn_id=$3,processing_token=$4,processing_until=now()+interval '60 seconds',processing_fingerprint=$5,encrypted_pending=$6
      WHERE id=$1 AND token_hash=$2 AND revision=$7 AND (processing_turn_id IS NULL OR (processing_turn_id=$3 AND processing_fingerprint=$5 AND processing_until<=now()))`,
      [
        session.id,
        hashSession(session.token),
        command.turnId,
        leaseToken,
        command.fingerprint,
        command.recovery ? sealConversation(command.recovery, `pending:${session.id}`) : null,
        envelope.state.revision,
      ],
    );
    if (claimed.rowCount !== 1)
      throw new ConversationError(
        'Your previous message is still being processed. Please try again shortly.',
        409,
      );
    envelope.state.turn += 1;
    envelope.state.revision += 1;
    const reply = contextualReply(envelope.state, await execute(envelope.state));
    const validUntil =
      reply.kind === 'booking' && envelope.state.booking.resultExpiresAt
        ? new Date(
            Math.min(
              new Date(envelope.state.booking.resultExpiresAt).getTime(),
              Date.now() + 5 * 60000,
            ),
          ).toISOString()
        : undefined;
    envelope.receipts = [
      ...envelope.receipts.slice(-9),
      {
        turnId: command.turnId,
        fingerprint: command.fingerprint,
        reply,
        ...(validUntil ? { validUntil } : {}),
      },
    ];
    const saved = await receptionistPool.query(
      `UPDATE zion_receptionist_conversations SET encrypted_state=$2,revision=$3,updated_at=now(),processing_turn_id=NULL,processing_token=NULL,processing_until=NULL,processing_fingerprint=NULL,encrypted_pending=NULL
      WHERE id=$1 AND processing_token=$4 AND revision=$5`,
      [session.id, encode(envelope), envelope.state.revision, leaseToken, result.rows[0].revision],
    );
    if (saved.rowCount !== 1)
      throw new ConversationError(
        'Your conversation changed while the message was being processed. Please restore its details before continuing.',
        409,
      );
    return reply;
  } catch (error) {
    // Keep a failed command recoverable, but release its lease for a retry using the same ID.
    try {
      await receptionistPool.query(
        'UPDATE zion_receptionist_conversations SET processing_until=now() WHERE id=$1 AND processing_token=$2',
        [session.id, leaseToken],
      );
    } catch {
      console.error('[receptionist] The interrupted turn could not release its lease.');
    }
    throw error;
  }
}

export async function eraseConversation(request: Request) {
  const token = sessionToken(request);
  if (token)
    await receptionistPool.query(
      'DELETE FROM zion_receptionist_conversations WHERE token_hash=$1',
      [hashSession(token)],
    );
}
