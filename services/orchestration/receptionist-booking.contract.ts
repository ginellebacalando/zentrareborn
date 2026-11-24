import 'server-only';

import { z } from 'zod';

export const RECEPTIONIST_BOOKING_CONTRACT_VERSION = 'zion.booking-orchestration.v1' as const;

const isoDateTime = z.string().datetime({ offset: true });
const shortIdentifier = z.string().trim().min(1).max(160);
const kbReference = z.string().trim().min(1).max(160);
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeOnly = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const correlationShape = {
  schemaVersion: z.literal(RECEPTIONIST_BOOKING_CONTRACT_VERSION),
  requestId: z.uuid(),
  conversationId: z.uuid(),
  turnId: z.uuid(),
  stateRevision: z.number().int().nonnegative(),
};

const requestedSlotSchema = z
  .object({
    date: dateOnly,
    startTime: timeOnly.optional(),
    endTime: timeOnly.optional(),
  })
  .strict()
  .refine(
    (slot) => !slot.startTime || !slot.endTime || slot.startTime < slot.endTime,
    'End time must be after start time.',
  );

const bookingFactsSchema = z
  .object({
    serviceId: shortIdentifier,
    packageId: shortIdentifier.optional(),
    venueId: shortIdentifier.optional(),
    preferredSlots: z.array(requestedSlotSchema).min(1).max(5),
    timePreference: z.string().trim().max(120).optional(),
    timeZone: z.literal('Asia/Manila'),
    partySize: z.number().int().positive().max(10000).optional(),
    specialRequests: z.string().trim().max(1000).optional(),
  })
  .strict();

const clientContactSchema = z
  .object({
    phone: z.string().trim().min(5).max(40).optional(),
    email: z.string().trim().email().max(255).optional(),
    preferredChannel: z.enum(['PHONE', 'EMAIL']).optional(),
  })
  .strict()
  .refine((contact) => Boolean(contact.phone || contact.email), 'A contact method is required.');

const clientSchema = z
  .object({
    name: z.string().trim().min(1).max(180),
    contact: clientContactSchema,
    language: z.string().trim().min(2).max(35).optional(),
  })
  .strict();

const acknowledgementSchema = z
  .object({
    kbReference,
    acknowledgedAt: isoDateTime,
  })
  .strict();

const promiseSchema = z
  .object({
    statement: z.string().trim().min(1).max(300),
    kbReference,
  })
  .strict();

const minimizedContextSchema = z
  .object({
    clientGoalSummary: z.string().trim().max(500).optional(),
    keyConcernsRaised: z.array(z.string().trim().min(1).max(160)).max(10).default([]),
    objectionsResolved: z.array(z.string().trim().min(1).max(160)).max(10).default([]),
    promisesMade: z.array(promiseSchema).max(10).default([]),
    toneNotes: z.string().trim().max(160).optional(),
  })
  .strict();

const requestCommon = {
  ...correlationShape,
  sentAt: isoDateTime,
  kbReferences: z.array(kbReference).max(40).default([]),
};

const availabilityRequestSchema = z
  .object({
    ...requestCommon,
    intent: z.literal('availability_check'),
    booking: bookingFactsSchema.omit({ specialRequests: true }),
  })
  .strict();

const newBookingRequestSchema = z
  .object({
    ...requestCommon,
    intent: z.literal('new_booking'),
    client: clientSchema,
    booking: bookingFactsSchema,
    termsAcknowledgements: z.array(acknowledgementSchema).min(1).max(40),
    context: minimizedContextSchema,
  })
  .strict();

const existingBookingRequest = {
  ...requestCommon,
  client: clientSchema,
  bookingReference: shortIdentifier,
  context: minimizedContextSchema,
};

const rescheduleRequestSchema = z
  .object({
    ...existingBookingRequest,
    intent: z.literal('reschedule'),
    booking: bookingFactsSchema,
    termsAcknowledgements: z.array(acknowledgementSchema).max(40).default([]),
  })
  .strict();

const cancelRequestSchema = z
  .object({
    ...existingBookingRequest,
    intent: z.literal('cancel'),
    cancellationReason: z.string().trim().min(1).max(500),
    policyAcknowledgement: acknowledgementSchema.optional(),
  })
  .strict();

export const receptionistBookingRequestSchema = z.discriminatedUnion('intent', [
  availabilityRequestSchema,
  newBookingRequestSchema,
  rescheduleRequestSchema,
  cancelRequestSchema,
]);

export type ReceptionistBookingRequest = z.infer<typeof receptionistBookingRequestSchema>;

const resultCommon = {
  ...correlationShape,
  respondedAt: isoDateTime,
  provenance: z
    .object({
      source: z.enum([
        'orchestration_adapter',
        'request_validation',
        'calendar_system',
        'booking_system',
        'payment_provider',
        'staff_review',
      ]),
      authoritative: z.boolean(),
      observedAt: isoDateTime,
      externalExecutionId: shortIdentifier.optional(),
      recordRevision: z.number().int().nonnegative().optional(),
    })
    .strict(),
  messageHint: z.string().trim().max(500).optional(),
};

const confirmedSlotSchema = z
  .object({
    date: dateOnly,
    startTime: timeOnly,
    endTime: timeOnly,
    timeZone: z.literal('Asia/Manila'),
  })
  .strict()
  .refine((slot) => slot.startTime < slot.endTime, 'End time must be after start time.');

const availableResultSchema = z
  .object({
    ...resultCommon,
    status: z.literal('AVAILABLE'),
    serviceId: shortIdentifier,
    slots: z.array(confirmedSlotSchema).min(1).max(10),
  })
  .strict();

const unavailableResultSchema = z
  .object({
    ...resultCommon,
    status: z.literal('SLOT_UNAVAILABLE'),
    serviceId: shortIdentifier,
    alternatives: z.array(confirmedSlotSchema).max(3),
  })
  .strict();

const holdResultSchema = z
  .object({
    ...resultCommon,
    status: z.literal('HOLD_CREATED'),
    serviceId: shortIdentifier,
    holdReference: shortIdentifier,
    expiresAt: isoDateTime,
    slot: confirmedSlotSchema,
  })
  .strict();

const pendingPaymentResultSchema = z
  .object({
    ...resultCommon,
    status: z.literal('PENDING_PAYMENT'),
    serviceId: shortIdentifier,
    bookingReference: shortIdentifier,
    amountDueCents: z.number().int().nonnegative().max(2000000000),
    currency: z.literal('PHP'),
    acceptedChannels: z
      .array(z.enum(['CASH', 'BANK_TRANSFER']))
      .min(1)
      .max(2),
    paymentDeadline: isoDateTime,
    paymentInstructionsReference: kbReference,
    holdExpiresAt: isoDateTime.optional(),
  })
  .strict();

const confirmedResultSchema = z
  .object({
    ...resultCommon,
    status: z.literal('CONFIRMED'),
    bookingReference: shortIdentifier,
    serviceId: shortIdentifier,
    slot: confirmedSlotSchema,
    settlementStatus: z.enum(['NOT_REQUIRED', 'VERIFIED', 'STAFF_CONFIRMED']),
  })
  .strict();

export const receptionistBookingMissingFieldSchema = z.enum([
  'client_name',
  'contact',
  'service_id',
  'venue_id',
  'preferred_slots',
  'time_preference',
  'party_size',
  'terms_acknowledgement',
  'booking_reference',
  'identity_verification',
]);

const needsInfoResultSchema = z
  .object({
    ...resultCommon,
    status: z.literal('NEEDS_INFO'),
    missingFields: z.array(receptionistBookingMissingFieldSchema).min(1).max(9),
  })
  .strict();

const manualReviewResultSchema = z
  .object({
    ...resultCommon,
    status: z.literal('MANUAL_REVIEW'),
    reason: z.enum([
      'IDENTITY_REVIEW',
      'POLICY_EXCEPTION',
      'SPECIAL_REQUEST',
      'PAYMENT_REVIEW',
      'SCHEDULE_CONFLICT',
      'SYSTEM_UNAVAILABLE',
    ]),
    caseReference: shortIdentifier.optional(),
  })
  .strict();

export const receptionistBookingErrorCodeSchema = z.enum([
  'NOT_CONFIGURED',
  'PERSISTENCE_UNAVAILABLE',
  'TEMPORARY_UNAVAILABLE',
  'TIMEOUT',
  'RATE_LIMITED',
  'TRANSPORT_ERROR',
  'DESTINATION_REJECTED',
  'AUTHENTICATION_FAILED',
  'INVALID_RESPONSE',
  'CONFLICT',
  'ATTEMPTS_EXHAUSTED',
]);

const errorResultSchema = z
  .object({
    ...resultCommon,
    status: z.literal('ERROR'),
    errorCode: receptionistBookingErrorCodeSchema,
    retryable: z.boolean(),
    retryAfterSeconds: z.number().int().positive().max(3600).optional(),
  })
  .strict();

export const receptionistBookingResultSchema = z
  .discriminatedUnion('status', [
    availableResultSchema,
    unavailableResultSchema,
    holdResultSchema,
    pendingPaymentResultSchema,
    confirmedResultSchema,
    needsInfoResultSchema,
    manualReviewResultSchema,
    errorResultSchema,
  ])
  .superRefine((result, context) => {
    if (result.status !== 'ERROR' && !result.provenance.authoritative) {
      context.addIssue({
        code: 'custom',
        path: ['provenance', 'authoritative'],
        message: 'Operational results require authoritative provenance.',
      });
    }
    if (result.status !== 'ERROR' && result.provenance.source === 'orchestration_adapter') {
      context.addIssue({
        code: 'custom',
        path: ['provenance', 'source'],
        message: 'Operational results require an external authoritative source.',
      });
    }
    if (result.status === 'CONFIRMED' && result.provenance.source !== 'booking_system') {
      context.addIssue({
        code: 'custom',
        path: ['provenance', 'source'],
        message: 'Confirmation must come from the booking system.',
      });
    }
    if (Date.parse(result.provenance.observedAt) > Date.parse(result.respondedAt)) {
      context.addIssue({
        code: 'custom',
        path: ['provenance', 'observedAt'],
        message: 'Observed facts cannot be newer than the response.',
      });
    }
    if (
      result.status === 'HOLD_CREATED' &&
      Date.parse(result.expiresAt) <= Date.parse(result.respondedAt)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['expiresAt'],
        message: 'A hold must expire after the response was issued.',
      });
    }
    if (
      result.status === 'PENDING_PAYMENT' &&
      Date.parse(result.paymentDeadline) <= Date.parse(result.respondedAt)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['paymentDeadline'],
        message: 'The payment deadline must be after the response was issued.',
      });
    }
    if (
      result.status === 'PENDING_PAYMENT' &&
      result.holdExpiresAt &&
      Date.parse(result.holdExpiresAt) <= Date.parse(result.respondedAt)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['holdExpiresAt'],
        message: 'A payment hold must expire after the response was issued.',
      });
    }
  });

export type ReceptionistBookingResult = z.infer<typeof receptionistBookingResultSchema>;

const statusesByIntent = {
  availability_check: new Set<ReceptionistBookingResult['status']>([
    'AVAILABLE',
    'SLOT_UNAVAILABLE',
    'NEEDS_INFO',
    'MANUAL_REVIEW',
    'ERROR',
  ]),
  new_booking: new Set<ReceptionistBookingResult['status']>([
    'HOLD_CREATED',
    'PENDING_PAYMENT',
    'CONFIRMED',
    'SLOT_UNAVAILABLE',
    'NEEDS_INFO',
    'MANUAL_REVIEW',
    'ERROR',
  ]),
  reschedule: new Set<ReceptionistBookingResult['status']>([
    'SLOT_UNAVAILABLE',
    'NEEDS_INFO',
    'MANUAL_REVIEW',
    'ERROR',
  ]),
  cancel: new Set<ReceptionistBookingResult['status']>(['NEEDS_INFO', 'MANUAL_REVIEW', 'ERROR']),
} satisfies Record<ReceptionistBookingRequest['intent'], Set<ReceptionistBookingResult['status']>>;

function slotMatchesRequest(
  slot: z.infer<typeof confirmedSlotSchema>,
  request: ReceptionistBookingRequest,
) {
  if (!('booking' in request)) return false;
  return request.booking.preferredSlots.some(
    (preferred) =>
      preferred.date === slot.date &&
      (!preferred.startTime || preferred.startTime === slot.startTime) &&
      (!preferred.endTime || preferred.endTime === slot.endTime),
  );
}

export function isReceptionistBookingResultCompatible(
  request: ReceptionistBookingRequest,
  result: ReceptionistBookingResult,
) {
  if (!statusesByIntent[request.intent].has(result.status)) return false;
  if (
    result.status === 'AVAILABLE' ||
    result.status === 'SLOT_UNAVAILABLE' ||
    result.status === 'HOLD_CREATED' ||
    result.status === 'PENDING_PAYMENT' ||
    result.status === 'CONFIRMED'
  ) {
    if (!('booking' in request) || result.serviceId !== request.booking.serviceId) return false;
  }
  if (result.status === 'AVAILABLE') {
    return result.slots.every((slot) => slotMatchesRequest(slot, request));
  }
  if (result.status === 'HOLD_CREATED' || result.status === 'CONFIRMED') {
    return slotMatchesRequest(result.slot, request);
  }
  return true;
}

export type ReceptionistBookingLedgerAcquireInput = {
  request: ReceptionistBookingRequest;
  requestFingerprint: string;
  leaseMs: number;
  maxAttempts: number;
};

export type ReceptionistBookingLedgerClaim =
  | { kind: 'acquired'; leaseToken: string; attempt: number; maxAttempts: number }
  | { kind: 'replay'; result: ReceptionistBookingResult }
  | { kind: 'busy'; retryAfterMs?: number }
  | { kind: 'conflict' }
  | { kind: 'exhausted' };

export type ReceptionistBookingLedgerCompletion = {
  requestId: string;
  requestFingerprint: string;
  leaseToken: string;
  result: ReceptionistBookingResult;
};

export type ReceptionistBookingLedgerFailure = ReceptionistBookingLedgerCompletion & {
  retryAt: Date | null;
};

export interface ReceptionistBookingLedger {
  acquire(input: ReceptionistBookingLedgerAcquireInput): Promise<ReceptionistBookingLedgerClaim>;
  complete(input: ReceptionistBookingLedgerCompletion): Promise<void>;
  fail(input: ReceptionistBookingLedgerFailure): Promise<void>;
}
