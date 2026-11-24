import 'server-only';
import type { ReceptionistConversation, BookingField } from '@/lib/chatbot/conversation';
import type { ChatReply, ChatSource, ReceptionistAction } from '@/lib/chatbot/types';
import {
  isReceptionistBookingResultCompatible,
  receptionistBookingResultSchema,
  type ReceptionistBookingResult,
  type ReceptionistBookingRequest,
} from '@/services/orchestration/receptionist-booking.contract';

const staff = [{ type: 'request_human' as const, label: 'Ask the Zion team' }];
const message = (
  kind: ChatReply['kind'],
  text: string,
  actions: ReceptionistAction[] = staff,
): ChatReply => ({ kind, message: text, sources: [], suggestions: [], actions });
const localTime = (value: string) =>
  new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

function requireStaff(state: ReceptionistConversation, reason: string, text: string) {
  state.booking.status = 'manual_review';
  state.flags.needsHuman = true;
  state.flags.reason = reason;
  state.awaiting = null;
  return message('handoff', text);
}

function missingQuestion(
  state: ReceptionistConversation,
  fields: Extract<ReceptionistBookingResult, { status: 'NEEDS_INFO' }>['missingFields'],
) {
  const available: Record<string, { field: BookingField; present: boolean; question: string }> = {
    client_name: {
      field: 'name',
      present: Boolean(state.client.name),
      question: 'What name should the booking team use for this request?',
    },
    contact: {
      field: 'contact',
      present: Boolean(state.client.email || state.client.phone),
      question: 'What email address or Philippine mobile number may the booking team use?',
    },
    service_id: {
      field: 'packageId',
      present: Boolean(state.booking.packageId),
      question: 'Which currently published package would you like to request?',
    },
    preferred_slots: {
      field: 'dates',
      present: Boolean(state.booking.dates.length),
      question: 'What full date would you prefer, including the year in YYYY-MM-DD format?',
    },
    time_preference: {
      field: 'timePreference',
      present: Boolean(state.booking.startTime && state.booking.endTime),
      question:
        'What exact start and end time would you prefer, for example 14:00 to 19:00 in Manila time?',
    },
    venue_id: {
      field: 'venue',
      present: Boolean(state.booking.venue),
      question: 'Which venue should I check: Selah Hall, Pavilion Garden, or the pool and grounds?',
    },
    party_size: {
      field: 'guests',
      present: Boolean(state.booking.guests),
      question: 'How many guests are you planning for?',
    },
    terms_acknowledgement: {
      field: 'terms',
      present: state.booking.termsAccepted,
      question:
        'Would you like to review and acknowledge the current published terms before continuing?',
    },
    booking_reference: {
      field: 'reference',
      present: Boolean(state.booking.reference),
      question: 'What is your existing booking reference?',
    },
  };
  for (const field of fields) {
    if (field === 'identity_verification')
      return requireStaff(
        state,
        'identity_review',
        'The booking team needs to verify ownership of the existing booking through its approved process. Would you like me to prepare a staff inquiry?',
      );
    const item = available[field];
    if (item && !item.present) {
      state.awaiting = item.field;
      state.booking.status = 'collecting';
      state.stage = 'S1';
      return message('discovery', item.question, []);
    }
  }
  return requireStaff(
    state,
    'workflow_information_mismatch',
    'The booking service could not validate details you have already provided, so I will keep them for staff review rather than ask you to repeat them. Shall I help prepare an inquiry?',
  );
}

/** Only validated, correlated operational fields become client-facing claims. */
export function bookingResultReply(
  state: ReceptionistConversation,
  request: ReceptionistBookingRequest,
  raw: unknown,
  sources: ChatSource[],
  now = new Date(),
): ChatReply {
  const parsed = receptionistBookingResultSchema.safeParse(raw);
  if (
    !parsed.success ||
    parsed.data.requestId !== request.requestId ||
    parsed.data.conversationId !== state.id ||
    parsed.data.turnId !== request.turnId ||
    parsed.data.stateRevision !== request.stateRevision ||
    !isReceptionistBookingResultCompatible(request, parsed.data)
  ) {
    return requireStaff(
      state,
      'invalid_workflow_result',
      'I could not verify the booking service’s response. No availability or confirmation can be relied on from that response; would you like help contacting the Zion team?',
    );
  }
  const result = parsed.data;
  if (
    result.status !== 'ERROR' &&
    (Math.abs(now.getTime() - new Date(result.provenance.observedAt).getTime()) > 5 * 60000 ||
      result.provenance.source === 'orchestration_adapter')
  ) {
    return requireStaff(
      state,
      'stale_workflow_result',
      'I need a fresh, verified result before giving availability or booking details. Would you like me to help ask the Zion team?',
    );
  }
  if (
    ['AVAILABLE', 'SLOT_UNAVAILABLE', 'HOLD_CREATED', 'PENDING_PAYMENT', 'CONFIRMED'].includes(
      result.status,
    )
  )
    state.booking.resultObservedAt = result.provenance.observedAt;
  switch (result.status) {
    case 'AVAILABLE':
      if (request.intent !== 'availability_check')
        return requireStaff(
          state,
          'unexpected_workflow_result',
          'The service returned a schedule result rather than completing your request. Would you like help asking the Zion team to review it?',
        );
      state.stage = 'S4';
      state.booking.status = 'available';
      state.awaiting = null;
      state.booking.resultExpiresAt = new Date(
        new Date(result.provenance.observedAt).getTime() + 5 * 60000,
      ).toISOString();
      return message(
        'booking',
        `As checked at ${localTime(result.provenance.observedAt)}, the admin calendar has no confirmed conflict for Zion as a whole during ${result.slots
          .slice(0, 3)
          .map((slot) => `${slot.date}, ${slot.startTime}–${slot.endTime} (Manila)`)
          .join(
            '; ',
          )}. This is a schedule check, not a reservation. Would you like help preparing a booking request?`,
        [
          { type: 'start_booking', label: 'Prepare a booking request' },
          { type: 'decline', label: 'Not now' },
        ],
      );
    case 'SLOT_UNAVAILABLE':
      state.booking.status = 'unavailable';
      state.stage = 'S4';
      state.awaiting = 'dates';
      state.booking.resultExpiresAt = new Date(
        new Date(result.provenance.observedAt).getTime() + 5 * 60000,
      ).toISOString();
      return message(
        'booking',
        result.alternatives.length
          ? `The booking service reports that the requested schedule is unavailable. It returned these alternatives: ${result.alternatives
              .slice(0, 3)
              .map((slot) => `${slot.date}, ${slot.startTime}–${slot.endTime} (Manila)`)
              .join('; ')}. Which date would you prefer?`
          : 'The booking service reports that the requested schedule is unavailable, and it has not supplied an alternative. What other full date would you like to consider?',
        [],
      );
    case 'HOLD_CREATED':
      if (request.intent !== 'new_booking' || new Date(result.expiresAt).getTime() <= now.getTime())
        return requireStaff(
          state,
          'invalid_hold_result',
          'I could not verify a current hold for this request. Would you like help asking the Zion team?',
        );
      state.booking.status = 'held';
      state.stage = 'S5';
      state.awaiting = null;
      state.booking.resultExpiresAt = result.expiresAt;
      return message(
        'booking',
        `The booking service created temporary hold ${result.holdReference} for ${result.slot.date}, ${result.slot.startTime}–${result.slot.endTime} (Manila). It expires ${localTime(result.expiresAt)}. This is not a confirmed booking; please contact the team for the next approved step.`,
      );
    case 'PENDING_PAYMENT': {
      if (
        request.intent !== 'new_booking' ||
        new Date(result.paymentDeadline).getTime() <= now.getTime()
      )
        return requireStaff(
          state,
          'invalid_payment_result',
          'I need the booking team to verify the current payment instructions and deadline. Would you like me to prepare an inquiry?',
        );
      state.booking.status = 'pending_payment';
      state.booking.bookingReference = result.bookingReference;
      state.stage = 'S5';
      state.awaiting = null;
      state.booking.resultExpiresAt = result.holdExpiresAt ?? result.paymentDeadline;
      const amount = new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: result.currency,
      }).format(result.amountDueCents / 100);
      const instructions = sources.find(
        (source) =>
          `${source.id}@${source.revision ?? 'public'}` === result.paymentInstructionsReference ||
          source.id === result.paymentInstructionsReference,
      );
      const response = message(
        'booking',
        `Request ${result.bookingReference} is awaiting ${amount}, with a deadline of ${localTime(result.paymentDeadline)}. ${result.holdExpiresAt && new Date(result.holdExpiresAt).getTime() > now.getTime() ? `The service reports a hold until ${localTime(result.holdExpiresAt)}.` : 'This response does not establish a current slot hold.'} Please use only verified instructions from the team; an uploaded proof alone does not confirm settled funds.`,
      );
      if (instructions)
        response.sources = [
          { title: instructions.title, href: instructions.href, excerpt: instructions.text },
        ];
      return response;
    }
    case 'CONFIRMED':
      if (request.intent !== 'new_booking' || result.provenance.recordRevision === undefined)
        return requireStaff(
          state,
          'unverified_confirmation',
          'The booking team needs to verify the outcome of this request before I describe it as confirmed. Would you like help preparing an inquiry?',
        );
      state.booking.status = 'confirmed';
      state.booking.bookingReference = result.bookingReference;
      state.stage = 'S6';
      state.awaiting = null;
      state.booking.resultExpiresAt = new Date(
        new Date(result.provenance.observedAt).getTime() + 5 * 60000,
      ).toISOString();
      return message(
        'booking',
        `Your booking is confirmed by the booking system for ${result.slot.date}, ${result.slot.startTime}–${result.slot.endTime} (Manila). Your reference is ${result.bookingReference}. Thank you for choosing Zion; is there anything else I can help you with?`,
        [],
      );
    case 'NEEDS_INFO':
      return missingQuestion(state, result.missingFields);
    case 'MANUAL_REVIEW':
      return requireStaff(
        state,
        result.reason.toLowerCase(),
        `The booking service requires staff review${result.caseReference ? ` under reference ${result.caseReference}` : ''}. No new booking confirmation is established by that status; would you like help preparing a staff inquiry?`,
      );
    case 'ERROR':
      state.booking.status = 'failed';
      state.flags.needsHuman = true;
      state.flags.reason = `workflow_${result.errorCode.toLowerCase()}`;
      state.awaiting = null;
      return message(
        'handoff',
        result.errorCode === 'NOT_CONFIGURED'
          ? 'The booking request service is not connected, so I cannot reserve a slot or confirm a booking here yet. I have kept the details in this short-lived conversation; would you like me to prepare an inquiry for the Zion team?'
          : 'I could not obtain a verified booking result after the permitted check. I have kept your details, and will not claim that a date or payment is confirmed; would you like help asking the Zion team?',
      );
  }
}
