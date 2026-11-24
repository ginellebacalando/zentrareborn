import 'server-only';
import { planReceptionistTurn, type ReceptionistCommand } from '@/lib/chatbot/receptionist';
import type { ReceptionistConversation } from '@/lib/chatbot/conversation';
import type { ChatReply, ChatSource } from '@/lib/chatbot/types';
import type { PublicSystemSettings } from '@/lib/system-settings-types';
import { ConversationError } from '@/lib/chatbot/session-security';
import { createReceptionistBookingAdapter } from '@/services/orchestration/receptionist-booking.adapter';
import { createReceptionistOrchestrationDispatch } from '@/services/orchestration/receptionist-dispatch';
import {
  RECEPTIONIST_BOOKING_CONTRACT_VERSION,
  receptionistBookingRequestSchema,
  type ReceptionistBookingRequest,
  type ReceptionistBookingResult,
} from '@/services/orchestration/receptionist-booking.contract';
import { bookingRequestLedger, canonicalBookingRequest, operationId } from './request-ledger';
import { bookingResultReply } from './booking-results';
import { submitReceptionistEscalation } from './escalation';

const venueIds: Record<string, string> = {
  'Selah Hall': 'selah-hall',
  'Pavilion Garden': 'pavilion-garden',
  'Pool and grounds': 'pool',
};

export function makeBookingRequest(
  state: ReceptionistConversation,
  command: ReceptionistCommand,
  sources: ChatSource[],
  now = new Date(),
): ReceptionistBookingRequest {
  const intent = state.booking.intent;
  if (!intent || !state.booking.consentToShare)
    throw new ConversationError('Please review and confirm the request first.', 422);
  const selected = sources.find(
    (source) => source.id === state.booking.packageId && source.offering,
  );
  const venueId = venueIds[state.booking.venue];
  const common = {
    schemaVersion: RECEPTIONIST_BOOKING_CONTRACT_VERSION,
    requestId: operationId(state.id, command.turnId),
    conversationId: state.id,
    turnId: command.turnId,
    stateRevision: state.revision,
    sentAt: now.toISOString(),
    kbReferences: state.kbItemsUsed.slice(-40),
  };
  const booking = {
    serviceId: selected?.offering?.serviceId ?? `venue:${venueId ?? 'unresolved'}`,
    ...(selected ? { packageId: selected.id } : {}),
    ...(venueId ? { venueId } : {}),
    preferredSlots: state.booking.dates.map((date) => ({
      date,
      ...(state.booking.startTime && state.booking.endTime
        ? { startTime: state.booking.startTime, endTime: state.booking.endTime }
        : {}),
    })),
    timePreference: state.booking.timePreference,
    timeZone: 'Asia/Manila' as const,
    ...(state.booking.guests ? { partySize: state.booking.guests } : {}),
  };
  if (intent === 'availability_check') {
    if (!venueId)
      throw new ConversationError(
        'Please choose a supported venue before checking availability.',
        422,
      );
    return receptionistBookingRequestSchema.parse({ ...common, intent, booking });
  }
  const client = {
    name: state.client.name,
    contact: {
      ...(state.client.email
        ? { email: state.client.email, preferredChannel: 'EMAIL' as const }
        : {}),
      ...(state.client.phone
        ? {
            phone: state.client.phone,
            ...(!state.client.email ? { preferredChannel: 'PHONE' as const } : {}),
          }
        : {}),
    },
    language: 'en',
  };
  const context = {
    clientGoalSummary: state.needs.goal.slice(0, 500),
    keyConcernsRaised: state.objections.slice(0, 10),
    objectionsResolved: [],
    promisesMade: state.statementsShared
      .filter((item) => state.kbItemsUsed.includes(item.kbReference))
      .slice(-10),
  };
  if (intent === 'cancel')
    return receptionistBookingRequestSchema.parse({
      ...common,
      intent,
      client,
      bookingReference: state.booking.reference,
      cancellationReason:
        'Client requested cancellation through the receptionist; ownership and applicable policy require backend verification.',
      context,
    });
  if (!selected)
    throw new ConversationError(
      'This request needs the Zion team to verify the service details. Please use the staff inquiry option.',
      422,
    );
  const termsAcknowledgements = state.booking.termsReferences.map((kbReference) => ({
    kbReference,
    acknowledgedAt: state.booking.termsAcknowledgedAt ?? now.toISOString(),
  }));
  return receptionistBookingRequestSchema.parse({
    ...common,
    intent,
    client,
    booking: {
      ...booking,
      ...(state.booking.specialRequests ? { specialRequests: state.booking.specialRequests } : {}),
    },
    termsAcknowledgements,
    context,
    ...(intent === 'reschedule' ? { bookingReference: state.booking.reference } : {}),
  });
}

type WorkflowDependencies = {
  executeBooking?: (request: ReceptionistBookingRequest) => Promise<ReceptionistBookingResult>;
  submitEscalation?: typeof submitReceptionistEscalation;
  now?: () => Date;
};

export async function executeReceptionistTurn(
  state: ReceptionistConversation,
  command: ReceptionistCommand,
  sources: ChatSource[],
  settings: PublicSystemSettings,
  dependencies: WorkflowDependencies = {},
): Promise<ChatReply> {
  const now = dependencies.now ?? (() => new Date());
  const plan = planReceptionistTurn(state, command, sources, now());
  if (!plan.effect) return plan.reply;
  if (plan.effect.type === 'escalation') {
    try {
      const reference = await (dependencies.submitEscalation ?? submitReceptionistEscalation)(
        state,
        operationId(state.id, command.turnId),
        settings,
      );
      state.escalationReference = reference;
      state.flags.needsHuman = false;
      state.stage = 'S7';
      return {
        kind: 'escalation',
        message: `Your inquiry has been saved in the Zion staff inbox as ${reference}. This does not create a reservation or confirm email delivery; please use the Contact page if you need another way to reach the team.`,
        sources: [],
        suggestions: [],
        actions: [],
      };
    } catch {
      console.error('[receptionist] Staff inquiry submission could not be verified.');
      return {
        kind: 'handoff',
        message:
          'I could not verify that your inquiry reached the staff inbox, so I will not say it has been sent. Your details remain in this short-lived conversation; please contact the team directly below.',
        sources: [],
        suggestions: [],
        actions: [],
      };
    }
  }
  let request: ReceptionistBookingRequest;
  try {
    request = makeBookingRequest(state, command, sources, now());
  } catch {
    state.booking.status = 'manual_review';
    state.flags.needsHuman = true;
    state.flags.reason = 'service_details_review';
    return {
      kind: 'handoff',
      message:
        'The booking team needs to verify the service or ownership details before this request can proceed. Would you like help preparing an inquiry?',
      sources: [],
      suggestions: [],
      actions: [{ type: 'request_human', label: 'Ask the Zion team' }],
    };
  }
  request = await canonicalBookingRequest(request);
  state.booking.requestId = request.requestId;
  const adapter = createReceptionistBookingAdapter({ ledger: bookingRequestLedger });
  const dispatch = createReceptionistOrchestrationDispatch({ booking: adapter });
  const execute = dependencies.executeBooking ?? dispatch.execute;
  let result = await execute(request);
  // One bounded retry; the durable ledger and immutable canonical body keep the key stable.
  if (result.status === 'ERROR' && result.retryable && (result.retryAfterSeconds ?? 1) <= 2) {
    const delayMs = (result.retryAfterSeconds ?? 1) * 1000;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    result = await execute(request);
  }
  return bookingResultReply(state, request, result, sources, now());
}
