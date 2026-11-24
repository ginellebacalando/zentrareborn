import { z } from 'zod';
import type { ChatReply, ConversationSummary } from './types';

export const bookingFields = [
  'eventType',
  'packageId',
  'dates',
  'venue',
  'timePreference',
  'guests',
  'name',
  'contact',
  'reference',
  'terms',
  'consent',
] as const;
export type BookingField = (typeof bookingFields)[number];
export type ReceptionistIntent =
  | 'greeting'
  | 'identity'
  | 'information'
  | 'offerings'
  | 'pricing'
  | 'availability'
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
export const conversationSchema = z.object({
  version: z.literal(1),
  id: z.uuid(),
  revision: z.number().int().nonnegative(),
  turn: z.number().int().nonnegative(),
  stage: z.enum(['S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7']),
  client: z.object({
    name: z.string().max(100),
    email: z.string().max(254),
    phone: z.string().max(30),
    language: z.literal('en'),
  }),
  needs: z.object({
    goal: shortText,
    preferences: z.array(shortText).max(10),
    budget: z.number().nonnegative().nullable(),
  }),
  booking: z.object({
    intent: z.enum(['new_booking', 'availability_check', 'reschedule', 'cancel']).nullable(),
    eventType: z.string().max(100),
    packageId: z.string().max(100),
    packageName: z.string().max(180),
    dates: z.array(z.string().max(10)).max(3),
    venue: z.string().max(100),
    timePreference: z.string().max(100),
    startTime: z.string().max(5),
    endTime: z.string().max(5),
    resultExpiresAt: z.iso.datetime().nullable(),
    resultObservedAt: z.iso.datetime().nullable().default(null),
    guests: z.number().int().positive().max(10000).nullable(),
    specialRequests: shortText,
    reference: z.string().max(80),
    termsAccepted: z.boolean(),
    termsAcknowledgedAt: z.iso.datetime().nullable(),
    consentToShare: z.boolean(),
    termsReferences: z.array(z.string().max(180)).max(40),
    status: z.enum([
      'none',
      'collecting',
      'ready',
      'checking',
      'available',
      'unavailable',
      'held',
      'pending_payment',
      'confirmed',
      'failed',
      'manual_review',
    ]),
    requestId: z.string().max(150),
    bookingReference: z.string().max(100),
  }),
  awaiting: z.enum(bookingFields).nullable(),
  pendingChanges: z
    .array(
      z.object({
        field: z.enum(['dates', 'venue', 'guests', 'packageId', 'timeWindow']),
        value: z.string().max(180),
      }),
    )
    .max(5),
  objections: z
    .array(z.enum(['price', 'timing', 'comparison', 'fit', 'trust', 'decision_maker', 'discount']))
    .max(10),
  lastSoftCloseTurn: z.number().int(),
  lastKnowledgeQuestion: shortText,
  kbItemsUsed: z.array(z.string().max(180)).max(40),
  statementsShared: z
    .array(z.object({ statement: z.string().max(300), kbReference: z.string().max(180) }))
    .max(10),
  flags: z.object({
    needsHuman: z.boolean(),
    complaint: z.boolean(),
    offTopicCount: z.number().int().nonnegative(),
    reason: z.string().max(80),
  }),
  escalationReference: z.string().max(100),
  expiresAt: z.iso.datetime(),
});

export type ReceptionistConversation = z.infer<typeof conversationSchema>;
export const CONVERSATION_LIFETIME_SECONDS = 24 * 60 * 60;

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
      specialRequests: '',
      reference: '',
      termsAccepted: false,
      termsAcknowledgedAt: null,
      consentToShare: false,
      termsReferences: [],
      status: 'none',
      requestId: '',
      bookingReference: '',
    },
    awaiting: null,
    pendingChanges: [],
    objections: [],
    lastSoftCloseTurn: -10,
    lastKnowledgeQuestion: '',
    kbItemsUsed: [],
    statementsShared: [],
    flags: { needsHuman: false, complaint: false, offTopicCount: 0, reason: '' },
    escalationReference: '',
    expiresAt: new Date(now.getTime() + CONVERSATION_LIFETIME_SECONDS * 1000).toISOString(),
  };
}

export function operationalSnapshot(state: ReceptionistConversation, now = new Date()) {
  const operational = ['available', 'unavailable', 'held', 'pending_payment', 'confirmed'].includes(
    state.booking.status,
  );
  const observed = state.booking.resultObservedAt;
  const expiry = state.booking.resultExpiresAt;
  const effectiveExpiry =
    operational && observed && expiry
      ? new Date(
          Math.min(new Date(expiry).getTime(), new Date(observed).getTime() + 5 * 60000),
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
    name: state.client.name || undefined,
    eventType: state.booking.eventType || undefined,
    contact: state.client.email || state.client.phone || undefined,
    packageName: state.booking.packageName || undefined,
    bookingReference: state.booking.bookingReference || undefined,
    date: state.booking.dates.join(', ') || undefined,
    venue: state.booking.venue || undefined,
    guests: state.booking.guests ?? undefined,
    timePreference: state.booking.timePreference || undefined,
    awaiting: state.awaiting ?? undefined,
    expiresAt: state.expiresAt,
  };
}

export function contextualReply(state: ReceptionistConversation, reply: ChatReply): ChatReply {
  return { ...reply, context: conversationSummary(state) };
}
