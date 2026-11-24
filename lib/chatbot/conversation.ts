import { z } from 'zod';
import { zeniLanguages } from './language';
import type { ChatReply, ConversationSummary } from './types';

/** Fields Zeni may wait for. Only the staff hand-off asks for a name or contact address. */
export const awaitingFields = [
  'dates',
  'timePreference',
  'guests',
  'name',
  'contact',
  'consent',
] as const;
export type AwaitingField = (typeof awaitingFields)[number];

export type ReceptionistIntent =
  | 'greeting'
  | 'small_talk'
  | 'identity'
  | 'information'
  | 'offerings'
  | 'pricing'
  | 'availability'
  | 'visit'
  | 'new_booking'
  | 'reschedule'
  | 'cancel'
  | 'policy'
  | 'comparison'
  | 'objection'
  | 'complaint'
  | 'human'
  | 'off_topic'
  | 'manipulation'
  | 'abuse'
  | 'sensitive'
  | 'unclear';

const shortText = z.string().max(600);
// Saved conversations live for 24 hours. Removed or renamed values fall back to a neutral value
// instead of failing, so a deployment never strands a visitor with an unreadable conversation.
export const conversationSchema = z.object({
  version: z.literal(1),
  id: z.uuid(),
  revision: z.number().int().nonnegative(),
  turn: z.number().int().nonnegative(),
  stage: z.enum(['S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7']).catch('S0'),
  client: z.object({
    name: z.string().max(100),
    email: z.string().max(254),
    phone: z.string().max(30),
    language: z.enum(zeniLanguages).catch('en'),
  }),
  needs: z.object({
    goal: shortText,
    preferences: z.array(shortText).max(10),
    budget: z.number().nonnegative().nullable(),
  }),
  booking: z.object({
    intent: z
      .enum(['new_booking', 'availability_check', 'reschedule', 'cancel'])
      .nullable()
      .catch(null),
    eventType: z.string().max(100),
    packageId: z.string().max(100),
    packageName: z.string().max(180),
    dates: z.array(z.string().max(10)).max(3),
    venue: z.string().max(100),
    timePreference: z.string().max(100),
    startTime: z.string().max(5),
    endTime: z.string().max(5),
    resultExpiresAt: z.iso.datetime().nullable().catch(null),
    resultObservedAt: z.iso.datetime().nullable().catch(null),
    guests: z.number().int().positive().max(10000).nullable(),
    reference: z.string().max(80),
    status: z
      .enum(['none', 'collecting', 'checking', 'available', 'unavailable', 'failed'])
      .catch('none'),
  }),
  awaiting: z.enum(awaitingFields).nullable().catch(null),
  objections: z
    .array(z.enum(['price', 'timing', 'comparison', 'fit', 'trust', 'decision_maker', 'discount']))
    .max(10),
  lastSoftCloseTurn: z.number().int(),
  lastKnowledgeQuestion: shortText,
  /** Turn number of the last grounded answer, to tell whether a staff request followed one. */
  lastAnswerTurn: z.number().int().default(-1),
  kbItemsUsed: z.array(z.string().max(180)).max(40),
  statementsShared: z
    .array(z.object({ statement: z.string().max(300), kbReference: z.string().max(180) }))
    .max(10),
  /** At most three redacted exchanges, the only conversation context a model may receive. */
  recentTurns: z
    .array(z.object({ role: z.enum(['guest', 'zeni']), text: z.string().max(300) }))
    .max(6)
    .default([]),
  /** Hashes of questions already logged as unanswered, so repeats are counted once. */
  loggedGaps: z.array(z.string().max(64)).max(20).default([]),
  flags: z.object({
    needsHuman: z.boolean(),
    complaint: z.boolean(),
    offTopicCount: z.number().int().nonnegative(),
    reason: z.string().max(80),
    /** The previous reply asked "Would you like me to ask our staff?". */
    offeredHandoff: z.boolean().default(false),
  }),
  escalationReference: z.string().max(100),
  expiresAt: z.iso.datetime(),
});

export type ReceptionistConversation = z.infer<typeof conversationSchema>;
export const CONVERSATION_LIFETIME_SECONDS = 24 * 60 * 60;
/** An availability snapshot is replayed for five minutes at most. */
export const AVAILABILITY_RESULT_LIFETIME_MS = 5 * 60 * 1000;

export function createConversation(id: string, now = new Date()): ReceptionistConversation {
  return {
    version: 1,
    id,
    revision: 0,
    turn: 0,
    stage: 'S0',
    client: { name: '', email: '', phone: '', language: 'en' },
    needs: { goal: '', preferences: [], budget: null },
    booking: {
      intent: null,
      eventType: '',
      packageId: '',
      packageName: '',
      dates: [],
      venue: '',
      timePreference: '',
      startTime: '',
      endTime: '',
      resultExpiresAt: null,
      resultObservedAt: null,
      guests: null,
      reference: '',
      status: 'none',
    },
    awaiting: null,
    objections: [],
    lastSoftCloseTurn: -10,
    lastKnowledgeQuestion: '',
    lastAnswerTurn: -1,
    kbItemsUsed: [],
    statementsShared: [],
    recentTurns: [],
    loggedGaps: [],
    flags: {
      needsHuman: false,
      complaint: false,
      offTopicCount: 0,
      reason: '',
      offeredHandoff: false,
    },
    escalationReference: '',
    expiresAt: new Date(now.getTime() + CONVERSATION_LIFETIME_SECONDS * 1000).toISOString(),
  };
}

export function operationalSnapshot(state: ReceptionistConversation, now = new Date()) {
  const operational = ['available', 'unavailable'].includes(state.booking.status);
  const observed = state.booking.resultObservedAt;
  const expiry = state.booking.resultExpiresAt;
  const effectiveExpiry =
    operational && observed && expiry
      ? new Date(
          Math.min(
            new Date(expiry).getTime(),
            new Date(observed).getTime() + AVAILABILITY_RESULT_LIFETIME_MS,
          ),
        ).toISOString()
      : null;
  return {
    operational,
    observedAt: operational ? observed : null,
    expiresAt: effectiveExpiry,
    stale:
      operational && (!effectiveExpiry || new Date(effectiveExpiry).getTime() <= now.getTime()),
  };
}

export function conversationSummary(state: ReceptionistConversation): ConversationSummary {
  const snapshot = operationalSnapshot(state);
  return {
    stage: state.stage,
    revision: state.revision,
    status: snapshot.stale ? 'stale' : state.booking.status,
    previousStatus: snapshot.stale ? state.booking.status : undefined,
    statusObservedAt: snapshot.observedAt ?? undefined,
    statusExpiresAt: snapshot.expiresAt ?? undefined,
    language: state.client.language,
    name: state.client.name || undefined,
    eventType: state.booking.eventType || undefined,
    contact: state.client.email || state.client.phone || undefined,
    date: state.booking.dates.join(', ') || undefined,
    venue: state.booking.venue || undefined,
    guests: state.booking.guests ?? undefined,
    timePreference: state.booking.timePreference || undefined,
    awaiting: state.awaiting ?? undefined,
    expiresAt: state.expiresAt,
  };
}

export function contextualReply(state: ReceptionistConversation, reply: ChatReply): ChatReply {
  return {
    ...reply,
    language: reply.language ?? state.client.language,
    context: conversationSummary(state),
  };
}
