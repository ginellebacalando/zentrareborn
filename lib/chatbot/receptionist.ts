import { receptionistIntent } from './intent';
import { captureSlots, redactSensitiveText, type SlotChanges } from './slots';
import { answerVisitor } from './retrieval';
import { chatbotGreeting, chatbotReceptionist } from '@/config/chatbot-receptionist';
import {
  operationalSnapshot,
  type BookingField,
  type ReceptionistConversation,
} from './conversation';
import type { ChatReply, ChatSource, ReceptionistAction } from './types';

export type ReceptionistCommand = {
  question: string;
  turnId: string;
  action?: Pick<ReceptionistAction, 'type' | 'value'>;
};
export type ReceptionistEffect =
  | {
      type: 'booking';
      intent: NonNullable<ReceptionistConversation['booking']['intent']>;
      requestId: string;
    }
  | { type: 'escalation'; requestId: string };
export type ReceptionistPlan = { reply: ChatReply; effect?: ReceptionistEffect };
const defaultSuggestions = [
  'Wedding packages',
  'Where are you located?',
  'What are your visiting hours?',
];
const action = (
  type: ReceptionistAction['type'],
  label: string,
  value?: string,
): ReceptionistAction => ({ type, label, ...(value ? { value } : {}) });
const reply = (
  kind: ChatReply['kind'],
  message: string,
  actions: ReceptionistAction[] = [],
  sources: ChatReply['sources'] = [],
): ReceptionistPlan => ({ reply: { kind, message, sources, suggestions: [], actions } });
const yes = (text: string) =>
  /^(yes|yes please|yes,? please|please do|go ahead|proceed|i agree|agree|okay|ok|sure|opo|oo)[.!\s]*$/i.test(
    text,
  );
const no = (text: string) =>
  /^(no|no thanks|not now|maybe later|stop|no thank you|cancel that)[.!\s]*$/i.test(text);

export function sourceReference(source: ChatSource) {
  return `${source.id}@${source.revision ?? 'public'}`;
}

function rememberSources(state: ReceptionistConversation, sources: ChatSource[]) {
  state.kbItemsUsed = [...new Set([...state.kbItemsUsed, ...sources.map(sourceReference)])].slice(
    -40,
  );
}

function offeringOptions(state: ReceptionistConversation, sources: ChatSource[]) {
  return sources
    .filter(
      (source) =>
        source.offering &&
        (!state.booking.eventType ||
          `${source.offering.category} ${source.title}`
            .toLowerCase()
            .includes(state.booking.eventType)),
    )
    .filter(
      (source) => !state.booking.guests || (source.offering?.guests ?? 0) >= state.booking.guests,
    )
    .filter(
      (source) =>
        state.needs.budget === null || (source.offering?.price ?? Infinity) <= state.needs.budget,
    )
    .sort((a, b) => (a.offering?.price ?? 0) - (b.offering?.price ?? 0));
}

function selectedPackage(state: ReceptionistConversation, sources: ChatSource[]) {
  return sources.find((source) => source.id === state.booking.packageId && source.offering);
}

function invalidateOperationalResult(state: ReceptionistConversation) {
  state.booking.status = 'collecting';
  state.booking.requestId = '';
  state.booking.consentToShare = false;
  state.booking.termsAccepted = false;
  state.booking.termsAcknowledgedAt = null;
  state.booking.termsReferences = [];
  state.booking.resultExpiresAt = null;
  state.booking.resultObservedAt = null;
}

function applyChanges(
  state: ReceptionistConversation,
  changes: SlotChanges,
  sources: ChatSource[],
  confirm = false,
) {
  const values = [
    ['dates', changes.date],
    ['venue', changes.venue],
    ['guests', changes.guests?.toString()],
    ['packageId', changes.packageId],
    ['timeWindow', changes.timeWindow],
  ] as const;
  const conflicts: ReceptionistConversation['pendingChanges'] = [];
  for (const [field, value] of values) {
    if (!value) continue;
    const old =
      field === 'dates'
        ? state.booking.dates[0]
        : field === 'timeWindow'
          ? state.booking.startTime && `${state.booking.startTime}/${state.booking.endTime}`
          : state.booking[field]?.toString();
    if (old && old !== value && !confirm) {
      conflicts.push({ field, value });
      continue;
    }
    if (old !== value && old) {
      const submitted = ['held', 'pending_payment', 'confirmed'].includes(state.booking.status);
      invalidateOperationalResult(state);
      if (submitted) {
        state.flags.needsHuman = true;
        state.flags.reason = 'existing_request_change';
        state.booking.status = 'manual_review';
      }
    }
    if (field === 'dates') state.booking.dates = [value];
    else if (field === 'timeWindow') {
      const [start, end] = value.split('/');
      state.booking.startTime = start;
      state.booking.endTime = end;
      state.booking.timePreference = `${start}–${end} (Manila)`;
    } else if (field === 'guests') state.booking.guests = Number(value);
    else if (field === 'packageId') {
      const source = sources.find((item) => item.id === value && item.offering);
      if (source) {
        state.booking.packageId = source.id;
        state.booking.packageName = source.offering!.packageName;
        rememberSources(state, [source]);
      }
    } else state.booking.venue = value;
  }
  state.pendingChanges = conflicts;
}

function fieldQuestion(
  state: ReceptionistConversation,
  field: BookingField,
  sources: ChatSource[],
): ReceptionistPlan {
  state.awaiting = field;
  state.stage = 'S1';
  state.booking.status = 'collecting';
  const questions: Record<BookingField, string> = {
    eventType: 'What type of event are you planning?',
    packageId: 'Which published package would you like to discuss for your event?',
    dates: 'What full date do you prefer, including the year, in YYYY-MM-DD format?',
    venue: 'Which venue do you prefer: Selah Hall, Pavilion Garden, or the pool and grounds?',
    timePreference: `What exact start and end time should I check${state.booking.timePreference ? `, keeping your ${state.booking.timePreference} preference in mind` : ''}, for example 14:00 to 19:00 in Manila time?`,
    guests: 'How many guests are you planning for?',
    name: 'May I have the name you would like the Zion team to use for your request?',
    contact:
      'What email address or Philippine mobile number may the booking team use for this request?',
    reference: 'What is your existing booking reference?',
    terms:
      'Please review the published package price and terms below; agreeing here acknowledges them but does not confirm a booking. Do you acknowledge these details for your request?',
    consent: 'May I send these details to the booking service to continue your request?',
  };
  if (field === 'packageId') {
    const options = offeringOptions(state, sources).slice(0, 3);
    if (!options.length) {
      state.flags.needsHuman = true;
      state.flags.reason = 'unpublished_or_unmatched_package';
      return reply(
        'handoff',
        'I do not have a verified package that matches these details, so I will not suggest a price or inclusion. Would you like help asking the Zion team about your options?',
        [action('request_human', 'Ask the team')],
      );
    }
    return reply(
      'discovery',
      questions[field],
      options.map((source) => action('select_package', source.title, source.id)),
    );
  }
  if (field === 'terms') {
    const approved = [
      selectedPackage(state, sources),
      ...sources.filter((source) => source.kind === 'policy'),
    ].filter((source): source is ChatSource => Boolean(source));
    rememberSources(state, approved);
    return reply(
      'booking',
      questions[field],
      [action('accept_terms', 'I acknowledge the published terms'), action('decline', 'Not now')],
      [
        selectedPackage(state, sources),
        sources.find((source) => source.kind === 'policy' && source.href === '/policies'),
        sources.find((source) => source.kind === 'policy' && source.href === '/terms'),
        sources.find((source) => source.id === 'reviewed-payment-rule'),
      ]
        .filter((source): source is ChatSource => Boolean(source))
        .map((source) => ({ title: source.title, href: source.href, excerpt: source.text })),
    );
  }
  return reply('discovery', questions[field]);
}

export function collectBookingDetails(
  state: ReceptionistConversation,
  sources: ChatSource[],
): ReceptionistPlan {
  const booking = state.booking;
  if (
    operationalSnapshot(state).stale &&
    ['held', 'pending_payment', 'confirmed'].includes(booking.status)
  )
    return reply(
      'handoff',
      'I have retained the previous result and any booking reference, but it is no longer a fresh status check. This does not cancel a booking; would you like the Zion team to verify its current status?',
      [action('request_human', 'Ask the team to verify')],
    );
  if (
    ['held', 'pending_payment', 'confirmed', 'manual_review'].includes(booking.status) ||
    (booking.status === 'failed' &&
      booking.intent !== 'availability_check' &&
      Boolean(booking.requestId))
  )
    return reply(
      'booking',
      `The saved request is already marked ${booking.status.replaceAll('_', ' ')}${booking.bookingReference ? ` under reference ${booking.bookingReference}` : ''}. I will not submit it again; would you like help asking the Zion team about the next step?`,
      [action('request_human', 'Ask the team')],
    );
  const fields: Array<[BookingField, boolean]> =
    booking.intent === 'availability_check'
      ? [
          ['dates', Boolean(booking.dates.length)],
          ['venue', Boolean(booking.venue)],
          ['timePreference', Boolean(booking.startTime && booking.endTime)],
        ]
      : booking.intent === 'reschedule' || booking.intent === 'cancel'
        ? [
            ['reference', Boolean(booking.reference)],
            ['name', Boolean(state.client.name)],
            ['contact', Boolean(state.client.email || state.client.phone)],
            ...(booking.intent === 'reschedule'
              ? ([
                  ['dates', Boolean(booking.dates.length)],
                  ['timePreference', Boolean(booking.startTime && booking.endTime)],
                ] as Array<[BookingField, boolean]>)
              : []),
          ]
        : [
            ['eventType', Boolean(booking.eventType)],
            ['packageId', Boolean(selectedPackage(state, sources))],
            ['dates', Boolean(booking.dates.length)],
            ['venue', Boolean(booking.venue)],
            ['timePreference', Boolean(booking.startTime && booking.endTime)],
            ['guests', Boolean(booking.guests)],
            ['name', Boolean(state.client.name)],
            ['contact', Boolean(state.client.email || state.client.phone)],
          ];
  const missing = fields.find(([, present]) => !present);
  if (missing) return fieldQuestion(state, missing[0], sources);
  const selected = selectedPackage(state, sources);
  if (
    booking.intent === 'new_booking' &&
    selected?.offering &&
    booking.guests &&
    booking.guests > selected.offering.guests
  ) {
    booking.packageId = '';
    booking.packageName = '';
    booking.termsAccepted = false;
    return fieldQuestion(state, 'packageId', sources);
  }
  if (booking.intent === 'new_booking' && !booking.termsAccepted)
    return fieldQuestion(state, 'terms', sources);
  state.stage = 'S4';
  state.awaiting = 'consent';
  booking.status = 'ready';
  if (booking.intent === 'availability_check')
    return reply(
      'booking',
      `I have ${booking.dates.join(', ')} at ${booking.venue}, with ${booking.timePreference} as your preferred time. Shall I ask the booking service to check this schedule?`,
      [action('confirm_handoff', 'Check this schedule'), action('decline', 'Not now')],
    );
  return reply(
    'booking',
    `I have your ${booking.intent === 'new_booking' ? `${booking.eventType} request${booking.packageName ? ` for ${booking.packageName}` : ''}` : `${booking.intent} request for reference ${booking.reference}`}${booking.dates.length ? ` on ${booking.dates.join(', ')}` : ''}. Nothing is reserved or changed yet. May I send the details you shared to the booking service?`,
    [action('confirm_handoff', 'Send my request'), action('decline', 'Not now')],
  );
}

function collectEscalation(state: ReceptionistConversation): ReceptionistPlan {
  state.stage = 'S1';
  if (!state.client.name) {
    state.awaiting = 'name';
    return reply(
      'escalation',
      'I can prepare a message for the Zion team, or you can contact them directly below. What name should I put on your inquiry?',
    );
  }
  if (!state.client.email) {
    state.awaiting = 'contact';
    return reply(
      'escalation',
      'The staff inquiry inbox needs an email address for a reply; you may also contact the team directly below. What email address may I include?',
    );
  }
  state.awaiting = 'consent';
  return reply(
    'escalation',
    'I can send your name, email and a short summary of this request to the Zion staff inquiry inbox. May I submit that inquiry?',
    [action('confirm_escalation', 'Send inquiry to the team'), action('decline', 'Keep it here')],
  );
}

function groundedAnswer(
  state: ReceptionistConversation,
  question: string,
  sources: ChatSource[],
): ReceptionistPlan {
  if (
    /\bdeposit\b/i.test(question) &&
    !/\b(security|damage|reservation|booking|book|payment)\b/i.test(question)
  ) {
    const clarification = reply(
      'discovery',
      'Do you mean the reservation payment or the separate security deposit?',
    );
    clarification.reply.suggestions = [
      'What is the reservation fee?',
      'What is the security deposit?',
    ];
    return clarification;
  }
  const reviewedPayment = sources.find((source) => source.id === 'reviewed-payment-rule');
  if (
    /\b(deposit|payment|reservation fee)\b/i.test(question) &&
    reviewedPayment &&
    !/requires a deposit/i.test(reviewedPayment.text) &&
    sources.some(
      (source) =>
        source.kind === 'policy' &&
        source.id !== 'reviewed-payment-rule' &&
        /(?:deposit|reservation fee).{0,60}(?:required|non.refundable|30%|50%)/i.test(source.text),
    )
  ) {
    state.flags.needsHuman = true;
    state.flags.reason = 'payment_policy_conflict';
    return reply(
      'handoff',
      'The reviewed payment requirement and published policy wording need to be reconciled before I can give you the applicable rule. Would you like help asking the Zion team to confirm it?',
      [action('request_human', 'Ask the team')],
    );
  }
  if (
    /\b(payment|pay|card|cheque|checks?|cash|gcash|bank transfer)\b/i.test(question) &&
    sources.some(
      (source) =>
        source.kind === 'faq' &&
        /payment/i.test(source.title) &&
        /\b(card|check|cheque)\b/i.test(source.text),
    )
  ) {
    state.flags.reason = 'payment_methods_review';
    return reply(
      'handoff',
      'The published payment information still needs to be reconciled with the approved booking process, so I will not give you an unverified payment instruction. Would you like help asking the team to confirm it?',
      [action('request_human', 'Ask the team')],
    );
  }
  if (/\b(capacity|accommodate|maximum guests|max pax)\b/i.test(question)) {
    const faq = sources.find((source) => source.kind === 'faq' && /capacity/i.test(source.title));
    const policy = sources.find(
      (source) => source.kind === 'policy' && /maximum capacity/i.test(source.text),
    );
    if (faq && policy) {
      const maximum = (text: string) => Math.max(...(text.match(/\b\d{2,4}\b/g) ?? []).map(Number));
      if (maximum(faq.text) !== maximum(policy.text.split('\n')[0])) {
        state.flags.needsHuman = true;
        state.flags.reason = 'capacity_scope_review';
        return reply(
          'handoff',
          'The published capacity figures need to be reconciled for the specific event and setup, so I will not choose a number for you. Would you like help asking the Zion team to confirm the right capacity?',
          [action('request_human', 'Ask the team')],
        );
      }
    }
  }
  const found = answerVisitor(question, sources, state.lastKnowledgeQuestion);
  if (found.kind !== 'answer' || !found.sources.length) {
    state.flags.reason = 'knowledge_gap';
    state.needs.goal ||= redactSensitiveText(question);
    return reply(
      'handoff',
      'I do not have enough approved information to answer that accurately. Would you like me to help you ask the Zion team?',
      [action('request_human', 'Ask the team')],
    );
  }
  const selected = found.sources
    .map((item) =>
      sources.find((source) => source.title === item.title && source.href === item.href),
    )
    .filter((source): source is ChatSource => Boolean(source));
  const faqGroups = new Map<string, Set<string>>();
  for (const source of selected.filter((item) => item.kind === 'faq')) {
    const key = source.title.toLowerCase().replace(/\W/g, '');
    const values = faqGroups.get(key) ?? new Set<string>();
    values.add(source.text.trim());
    faqGroups.set(key, values);
  }
  if ([...faqGroups.values()].some((values) => values.size > 1)) {
    state.flags.needsHuman = true;
    state.flags.reason = 'knowledge_conflict';
    return reply(
      'handoff',
      'The published information I found is inconsistent, so I would like the Zion team to confirm the correct details. Shall I help you ask them?',
      [action('request_human', 'Ask the team')],
    );
  }
  rememberSources(state, selected);
  state.lastKnowledgeQuestion = redactSensitiveText(question);
  state.stage = state.stage === 'S7' ? 'S7' : 'S2';
  const primary = selected[0];
  // Visiting hours are one short fact set; the appointment condition qualifies every day.
  const paragraph =
    primary.id === 'visits'
      ? primary.text.replaceAll('\n', '; ')
      : (primary.text.split('\n').find((line) => line.trim()) ?? '');
  const excerpt =
    primary.id === 'visits' || paragraph.length <= 420
      ? paragraph
      : paragraph.match(/^.{1,420}[.!?](?:\s|$)/)?.[0];
  if (excerpt && excerpt.trim().length <= 300)
    state.statementsShared = [
      ...state.statementsShared.slice(-9),
      { statement: excerpt.trim(), kbReference: sourceReference(primary) },
    ];
  let message = excerpt
    ? `${excerpt.trim()} `
    : `I found the published information about ${primary.title.toLowerCase()}; the full wording is linked below. `;
  const actions: ReceptionistAction[] = [];
  if (
    state.booking.intent &&
    state.stage !== 'S7' &&
    !['held', 'pending_payment', 'confirmed', 'manual_review', 'failed'].includes(
      state.booking.status,
    )
  ) {
    message += 'Would you like to continue the request we were preparing?';
    actions.push(action('resume', 'Continue my request'));
  } else if (
    state.stage !== 'S7' &&
    !['held', 'pending_payment', 'confirmed', 'manual_review', 'failed'].includes(
      state.booking.status,
    ) &&
    state.turn > 1 &&
    state.turn - state.lastSoftCloseTurn >= 3 &&
    /package|price|rate|cost|inclusion/i.test(question)
  ) {
    message += 'Would you like help preparing a booking request?';
    state.stage = 'S4';
    state.lastSoftCloseTurn = state.turn;
    actions.push(
      action('start_booking', 'Prepare a booking request'),
      action('decline', 'Not now'),
    );
  } else message += 'What else would you like to know for your event?';
  return reply('answer', message, actions, found.sources);
}

function recommendPublishedOption(
  state: ReceptionistConversation,
  sources: ChatSource[],
): ReceptionistPlan {
  const choice = offeringOptions(state, sources)[0];
  if (!choice?.offering)
    return reply(
      'handoff',
      'I do not have a published option that I can verify against your requirements. Would you like help asking the team about a suitable package?',
      [action('request_human', 'Ask the team')],
    );
  if (!state.booking.guests) {
    if (!state.needs.preferences.includes('recommendation_requested'))
      state.needs.preferences.push('recommendation_requested');
    return fieldQuestion(state, 'guests', sources);
  }
  state.needs.preferences = state.needs.preferences.filter(
    (item) => item !== 'recommendation_requested',
  );
  state.awaiting = null;
  state.stage = 'S3';
  rememberSources(state, [choice]);
  const amount = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: choice.offering.currency,
  }).format(choice.offering.price);
  return reply(
    'answer',
    `${choice.title} is published at ${amount} and includes ${choice.offering.guests} guests, which covers the ${state.booking.guests} guests you mentioned. Would you like to use this option while preparing your request?`,
    [action('select_package', 'Choose this published option', choice.id)],
    [{ title: choice.title, href: choice.href, excerpt: choice.text }],
  );
}

/** Deterministic, grounded W1 pipeline. Side effects are explicit plans, never model text. */
export function planReceptionistTurn(
  state: ReceptionistConversation,
  command: ReceptionistCommand,
  sources: ChatSource[],
  now = new Date(),
): ReceptionistPlan {
  const text = command.question.trim();
  const intent = receptionistIntent(text);
  const type = command.action?.type;
  if (intent === 'sensitive')
    return reply(
      'handoff',
      'For your privacy, please do not share passwords, verification codes, card details or identity documents here. I can help with event questions or direct you to the Zion team.',
      [action('request_human', 'Contact the team')],
    );
  if (intent === 'manipulation' || intent === 'abuse') {
    state.flags.offTopicCount += 1;
    if (state.flags.offTopicCount >= 3) {
      state.flags.needsHuman = true;
      state.flags.reason = 'repeated_boundary_attempts';
      state.stage = 'S7';
      return reply(
        'scope',
        'I will leave the conversation here for now, and the Zion team can help if you wish to continue respectfully.',
      );
    }
    return reply(
      'scope',
      intent === 'abuse'
        ? 'I’m here to help with your event, and we can continue respectfully. What would you like to know about Zion?'
        : 'I am here to help with Zion’s venue, packages and event requests. What would you like to know about your event?',
    );
  }
  if (intent === 'identity')
    return reply(
      'greeting',
      'I’m Zeni, Zion’s virtual receptionist. I can help with published information and prepare a request for the booking team; would you like help with your event?',
    );
  if (intent === 'off_topic') {
    state.flags.offTopicCount += 1;
    if (state.flags.offTopicCount >= 3) state.stage = 'S7';
    return reply(
      'scope',
      state.flags.offTopicCount >= 3
        ? 'I will leave the conversation here for now, and you are welcome back whenever you need help with a Zion event.'
        : 'That is outside what I can help with as Zion’s receptionist. Would you like information about the venue, packages or an event request?',
    );
  }
  if (type === 'decline' || no(text)) {
    if (state.pendingChanges.length) {
      state.pendingChanges = [];
      return state.flags.needsHuman
        ? collectEscalation(state)
        : collectBookingDetails(state, sources);
    }
    state.stage = 'S7';
    state.awaiting = null;
    state.pendingChanges = [];
    state.booking.consentToShare = false;
    state.lastSoftCloseTurn = state.turn;
    return reply(
      'greeting',
      'Of course; there is no need to decide now. I have kept the details for this short-lived conversation, and you can return to your questions whenever you are ready.',
    );
  }
  if (type === 'request_human' || intent === 'human' || intent === 'complaint') {
    state.flags.needsHuman = true;
    state.flags.complaint ||= intent === 'complaint';
    state.flags.reason =
      intent === 'complaint' ? 'complaint' : state.flags.reason || 'requested_human';
    if (intent === 'complaint' || /special|custom|legal|medical|investment/i.test(text))
      state.needs.goal = redactSensitiveText(text);
    const plan = collectEscalation(state);
    if (intent === 'complaint')
      plan.reply.message = `I’m sorry to hear this has been upsetting. ${plan.reply.message}`;
    return plan;
  }
  if (state.pendingChanges.length && (type === 'confirm_change' || yes(text))) {
    const changes: SlotChanges = {};
    for (const item of state.pendingChanges) {
      if (item.field === 'dates') changes.date = item.value;
      else if (item.field === 'guests') changes.guests = Number(item.value);
      else if (item.field === 'timeWindow') changes.timeWindow = item.value;
      else changes[item.field] = item.value;
    }
    applyChanges(state, changes, sources, true);
    return state.flags.needsHuman
      ? collectEscalation(state)
      : collectBookingDetails(state, sources);
  }
  if (
    (type === 'confirm_escalation' || yes(text)) &&
    state.flags.needsHuman &&
    state.awaiting === 'consent'
  ) {
    if (!state.client.name || !state.client.email) return collectEscalation(state);
    state.awaiting = null;
    return {
      ...reply('escalation', 'I’m submitting your inquiry to the Zion team.'),
      effect: { type: 'escalation', requestId: `ESC-${state.id}-${command.turnId}` },
    };
  }
  if (
    (type === 'confirm_handoff' || yes(text)) &&
    state.awaiting === 'consent' &&
    state.booking.intent
  ) {
    // The consent step is reached only after required, server-validated fields are complete.
    const readiness = collectBookingDetails(state, sources);
    if (state.awaiting !== 'consent') return readiness;
    if (state.booking.intent === 'new_booking') {
      const current = [
        selectedPackage(state, sources),
        ...sources.filter((source) => source.kind === 'policy'),
      ]
        .filter((source): source is ChatSource => Boolean(source))
        .map(sourceReference);
      if (JSON.stringify(current) !== JSON.stringify(state.booking.termsReferences)) {
        state.booking.termsAccepted = false;
        return fieldQuestion(state, 'terms', sources);
      }
    }
    state.booking.consentToShare = true;
    state.stage = 'S5';
    state.awaiting = null;
    state.booking.status = 'checking';
    state.booking.requestId = `REQ-${state.id}-${command.turnId}`;
    return {
      ...reply('booking', 'One moment, please; I’m checking the request with the booking service.'),
      effect: { type: 'booking', intent: state.booking.intent, requestId: state.booking.requestId },
    };
  }
  if ((type === 'accept_terms' || yes(text)) && state.awaiting === 'terms') {
    state.booking.termsAccepted = true;
    state.booking.termsAcknowledgedAt = now.toISOString();
    state.booking.termsReferences = [
      selectedPackage(state, sources),
      ...sources.filter((source) => source.kind === 'policy'),
    ]
      .filter((source): source is ChatSource => Boolean(source))
      .map(sourceReference);
    return collectBookingDetails(state, sources);
  }
  if (type === 'select_package') {
    const source = sources.find((item) => item.id === command.action?.value && item.offering);
    if (!source)
      return reply(
        'handoff',
        'That package is no longer published. Would you like me to ask the team about the current options?',
        [action('request_human', 'Ask the team')],
      );
    if (!state.booking.intent) state.booking.intent = 'new_booking';
    state.booking.eventType ||= source.offering!.category.toLowerCase();
  }
  const previousAwaiting = state.awaiting;
  const previousEventType = state.booking.eventType;
  const priorChanges = state.pendingChanges;
  const changes = captureSlots(state, text, sources, now);
  if (type === 'select_package') changes.packageId = command.action?.value;
  if (changes.invalidDate)
    return reply(
      'discovery',
      'I need a valid date that has not already passed. What full date would you prefer, including the year in YYYY-MM-DD format?',
    );
  if (changes.invalidTime)
    return reply(
      'discovery',
      'I need an explicit same-day start and end time, and I will not assume a duration. What window should I check, such as 14:00 to 19:00 in Manila time?',
    );
  applyChanges(state, changes, sources);
  if (!state.pendingChanges.length && priorChanges.length) state.pendingChanges = priorChanges;
  if (state.pendingChanges.length)
    return reply(
      'discovery',
      `You have already given different details for ${state.pendingChanges.map((item) => (item.field === 'packageId' ? 'the package' : item.field)).join(', ')}. Should I replace them with the new details you just shared?`,
      [
        action('confirm_change', 'Use the new details'),
        action('decline', 'Keep the previous details'),
      ],
    );
  if (
    type === 'start_booking' ||
    intent === 'new_booking' ||
    intent === 'availability' ||
    type === 'check_availability' ||
    intent === 'reschedule' ||
    intent === 'cancel'
  ) {
    if (
      (type === 'start_booking' || intent === 'new_booking') &&
      (state.booking.bookingReference ||
        (state.booking.status === 'failed' &&
          state.booking.intent !== 'availability_check' &&
          state.booking.requestId) ||
        ['held', 'pending_payment', 'confirmed', 'manual_review'].includes(state.booking.status))
    )
      return reply(
        'handoff',
        'This conversation already contains a submitted request. I can help the Zion team review it; please start a new chat if you wish to prepare a separate event request.',
        [action('request_human', 'Ask the team')],
      );
    state.flags.needsHuman = false;
    if (type === 'check_availability' || intent === 'availability') {
      state.booking.status = 'collecting';
      state.booking.consentToShare = false;
      const date = state.booking.dates[0];
      if (date && new Date(`${date}T23:59:59+08:00`).getTime() < now.getTime())
        state.booking.dates = [];
      if (
        date &&
        state.booking.startTime &&
        new Date(`${date}T${state.booking.startTime}:00+08:00`).getTime() <= now.getTime()
      ) {
        state.booking.startTime = '';
        state.booking.endTime = '';
        state.booking.timePreference = '';
      }
    }
    if (intent === 'reschedule' || intent === 'cancel') {
      state.booking.reference ||= state.booking.bookingReference;
      state.booking.status = 'collecting';
    }
    state.booking.intent =
      type === 'check_availability' || intent === 'availability'
        ? 'availability_check'
        : intent === 'reschedule'
          ? 'reschedule'
          : intent === 'cancel'
            ? 'cancel'
            : 'new_booking';
    state.needs.goal ||= state.booking.eventType
      ? `Planning a ${state.booking.eventType} event.`
      : 'Help with an event request.';
    return collectBookingDetails(state, sources);
  }
  const directQuestion = /\?|\b(?:what|where|why|how|do you|are you|can you|is there)\b/i.test(
    text,
  );
  if (
    state.needs.preferences.includes('recommendation_requested') &&
    changes.guests &&
    !directQuestion
  )
    return recommendPublishedOption(state, sources);
  const filling =
    Boolean(previousAwaiting) &&
    !directQuestion &&
    ((previousAwaiting === 'eventType' && previousEventType !== state.booking.eventType) ||
      intent === 'unclear' ||
      Boolean(
        changes.date || changes.venue || changes.guests || changes.packageId || changes.timeWindow,
      ) ||
      /^(?:my name|name:|i am |i'm |[\w.+-]+@|\+?\d)/i.test(text));
  if (filling || type === 'resume')
    return state.flags.needsHuman
      ? collectEscalation(state)
      : state.booking.intent
        ? collectBookingDetails(state, sources)
        : reply('discovery', 'What type of event can I help you with?');
  if (intent === 'greeting') {
    const appreciation = /salamat|thank/i.test(text);
    return reply(
      'greeting',
      appreciation ? chatbotReceptionist.appreciation : chatbotGreeting,
      state.booking.intent ? [action('resume', 'Continue my request')] : [],
    );
  }
  if (intent === 'objection') {
    state.stage = 'S3';
    state.lastSoftCloseTurn = state.turn;
    if (/not now|maybe later|think about/i.test(text)) {
      state.stage = 'S7';
      return reply(
        'objection',
        'Of course; please take the time you need. Is there one detail I can clarify for you?',
      );
    }
    if (/discount/i.test(text))
      return reply(
        'objection',
        'I can share only approved published offers, and I will not promise an unlisted discount. Would you like me to help ask the Zion team about your options?',
        [action('request_human', 'Ask the team')],
      );
    const concern = /expensive|afford|budget|too much/i.test(text)
      ? 'price'
      : /trust|legit/i.test(text)
        ? 'trust'
        : /ask my|check with my/i.test(text)
          ? 'decision_maker'
          : 'fit';
    if (!state.objections.includes(concern)) state.objections.push(concern);
    return reply(
      'objection',
      concern === 'price'
        ? 'I understand that the cost needs to fit your plans. What matters most to you when choosing the package?'
        : concern === 'decision_maker'
          ? 'Of course; it is sensible to discuss the decision together. Would a summary of the published option help?'
          : 'I would be glad to help you compare Zion’s published details without making claims about other venues. What matters most for your event?',
    );
  }
  if (intent === 'offerings' && /\b(recommend|suggest|best fit|which package)\b/i.test(text)) {
    return recommendPublishedOption(state, sources);
  }
  if (intent === 'comparison')
    return reply(
      'discovery',
      'I can explain Zion’s published features and policies, but I will not make claims about another business. What matters most to you in choosing a venue?',
    );
  if (intent === 'unclear' && text.split(/\s+/).length < 5) {
    state.stage = 'S1';
    const result = reply(
      'discovery',
      'I’d be happy to help. Are you looking for venue information, package details, or help with an event request?',
    );
    result.reply.suggestions = defaultSuggestions;
    return result;
  }
  return groundedAnswer(state, text, sources);
}
