import { assertDateKey, venueDateKey } from '@/lib/calendar-time';
import { zeniCopyFor } from '@/config/chatbot-receptionist';
import { zeniTopics, type ZeniHelpTopic } from '@/config/zeni-topics';
import { isAppreciation, receptionistIntent } from './intent';
import { captureSlots, type SlotChanges } from './slots';
import {
  candidateSources,
  rankSources,
  relevantPassage,
  sourceEvidence,
  titleCoversQuestion,
  titleMatchRatio,
} from './retrieval';
import { MAX_PROMPT_SOURCES } from './llm-prompt';
import { redactPersonalData } from './redaction';
import { detectLanguage } from './language';
import { detectTopic, type ZeniTopic } from './topics';
import { detailCardsFor, eventCardFor, formatStartsAt } from './cards';
import { buildBookingLink, buildVisitLink, type BookingLinkInput } from './links';
import type { ReceptionistConversation, ReceptionistIntent } from './conversation';
import type { ChatReply, ChatSource, ReceptionistAction, ZeniLink } from './types';

export type ReceptionistCommand = {
  question: string;
  turnId: string;
  action?: Pick<ReceptionistAction, 'type' | 'value'>;
};

/** Side effects the service layer runs. Zeni never creates or changes a booking. */
export type ReceptionistEffect =
  | { type: 'availability'; date: string; startTime?: string; endTime?: string }
  | { type: 'escalation' };

export type ZeniGapReason = 'no_source' | 'low_confidence' | 'handoff' | 'conflict';
export type ZeniGap = { reason: ZeniGapReason; question: string; topic: ZeniTopic };

/** A request to let the language model phrase the reply from these public sources. */
export type ComposeRequest = {
  mode: 'answer' | 'small_talk';
  question: string;
  sources: ChatSource[];
};

export type ReceptionistPlan = {
  intent: ReceptionistIntent;
  topic: ZeniTopic;
  reply: ChatReply;
  effect?: ReceptionistEffect;
  compose?: ComposeRequest;
  gap?: ZeniGap;
  /** Attach the availability calendar card; `selected` highlights a date. */
  calendar?: { selected?: string };
};

type Copy = ReturnType<typeof zeniCopyFor>;
type PlanContext = {
  state: ReceptionistConversation;
  copy: Copy;
  sources: ChatSource[];
  intent: ReceptionistIntent;
  topic: ZeniTopic;
  text: string;
  redacted: string;
  now: Date;
};

const yes = (text: string) =>
  /^(?:yes|yes please|yes,? please|please do|go ahead|proceed|i agree|agree|okay|ok|sure|opo|oo|sige|sige po|go|tama)[.!\s]*$/i.test(
    text,
  );
const no = (text: string) =>
  /^(?:no|no thanks|not now|maybe later|stop|no thank you|cancel that|hindi|hindi po|huwag|huwag muna|wag na|hindi na|next time)[.!\s]*$/i.test(
    text,
  );

const action = (
  type: ReceptionistAction['type'],
  label: string,
  value?: string,
): ReceptionistAction => ({ type, label, ...(value ? { value } : {}) });

function reply(
  kind: ChatReply['kind'],
  message: string,
  extra: Partial<Omit<ChatReply, 'kind' | 'message'>> = {},
): ChatReply {
  return { kind, message, sources: [], suggestions: [], actions: [], ...extra };
}

const PLACEHOLDER = /\[(?:name|email|phone|number|address|reference)\]/g;
const staff = (copy: Copy) => action('request_human', copy.labels.talkToStaff);
const contactLink = (copy: Copy): ZeniLink => ({
  kind: 'page',
  label: copy.labels.contactPage,
  href: '/contact#message-us',
});
const faqLink = (copy: Copy): ZeniLink => ({
  kind: 'page',
  label: copy.labels.faqPage,
  href: '/faq',
});

/** Each help topic's keywords as whole-word (or whole-phrase) patterns. */
const TOPIC_PATTERNS = zeniTopics.map((topic) => ({
  topic,
  patterns: topic.keywords.map(
    (keyword) =>
      new RegExp(
        `(?:^|[^\\p{L}\\p{N}])${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^\\p{L}\\p{N}])`,
        'iu',
      ),
  ),
}));

/** A tapped topic chip ("Payments & booking"). */
function topicFromLabel(text: string) {
  const label = text
    .trim()
    .replace(/[!.?\s]+$/, '')
    .toLowerCase();
  return zeniTopics.find((topic) => topic.label.toLowerCase() === label) ?? null;
}

/** The help topic whose keywords appear most often in the message, if any. */
function topicFromKeywords(text: string) {
  let best: { topic: ZeniHelpTopic; hits: number } | null = null;
  for (const { topic, patterns } of TOPIC_PATTERNS) {
    const hits = patterns.filter((pattern) => pattern.test(text)).length;
    if (hits && (!best || hits > best.hits)) best = { topic, hits };
  }
  return best?.topic ?? null;
}

/** "Can we reschedule?" asks about the rule; "please move my booking" asks staff to act. */
const QUESTION =
  /\?|^\s*(?:can|could|may|might|what|how|is|are|do|does|will|when|why|pwede|puwede|paano|ano|kailan|magkano|gaano|bakit)\b/i;

/** Which payment methods are accepted: the published lists disagree, so staff confirm them. */
const PAYMENT_METHODS =
  /\b(?:modes?|methods?)\s+of\s+payment|\bpayment\s+(?:modes?|methods?|options?)\b|\bpay\s+(?:by|with|via|using|through)\b|\b(?:accepts?|accepting|tumatanggap)\b.{0,30}\b(?:cards?|credit|debit|gcash|maya|cash|checks?|cheques?|bank)\b|\bhow\s+(?:do|can|should)\s+(?:i|we)\s+pay\b|\bpaano\s+(?:mag-?)?(?:bayad|magbayad)\b|\b(?:gcash|paymaya|maya|credit cards?|debit cards?|bank transfer|cheques?)\b/i;

/** The older FAQ listing card and check payments, which other published information contradicts. */
const unverifiedPaymentMethods = (source: ChatSource) =>
  source.kind === 'faq' &&
  /payment/i.test(source.title) &&
  /\b(card|check|cheque)\b/i.test(source.text);

/** Payments and booking changes always keep a way to reach a person. */
const needsStaffOption = (topic?: ZeniHelpTopic | null) =>
  topic?.id === 'payments' || topic?.id === 'changes';

/** Chips for related questions in the same topic, without any that would repeat this answer. */
function topicFollowUps(topic: ZeniHelpTopic, answered: ChatSource, sources: ChatSource[]) {
  return topic.followUps.filter((question) => {
    const leadsTo = preferTitled(
      question,
      rankSources(question, sources).map((match) => match.source),
    )[0];
    return leadsTo?.id !== answered.id;
  });
}

/**
 * Breaks ties within the best-scoring group: a source whose own title covers the question first,
 * then a direct FAQ answer before a long policy section, then the most specific title.
 */
function preferTitled(question: string, sources: ChatSource[]) {
  const rank = (source: ChatSource) => [
    Number(titleCoversQuestion(question, source)),
    Number(source.kind === 'faq'),
    titleMatchRatio(question, source),
  ];
  return [...sources].sort((a, b) => {
    const [x, y] = [rank(a), rank(b)];
    return y[0] - x[0] || y[1] - x[1] || y[2] - x[2];
  });
}

/** A message that is only a topic's umbrella word ("payment", "food", "corkage"). */
function topicFromSummaryWord(text: string) {
  const word = text
    .trim()
    .replace(/[!.?\s]+$/, '')
    .toLowerCase();
  return zeniTopics.find((topic) => topic.summaryWords.includes(word)) ?? null;
}

export function sourceReference(source: ChatSource) {
  return `${source.id}@${source.revision ?? 'public'}`;
}

function rememberSources(state: ReceptionistConversation, sources: ChatSource[]) {
  state.kbItemsUsed = [...new Set([...state.kbItemsUsed, ...sources.map(sourceReference)])].slice(
    -40,
  );
}

function bookingInput(state: ReceptionistConversation): BookingLinkInput {
  return {
    eventType: state.booking.eventType,
    packageName: state.booking.packageName,
    date: state.booking.dates[0],
    startTime: state.booking.startTime,
    endTime: state.booking.endTime,
    guests: state.booking.guests,
  };
}

function bookingLink(state: ReceptionistConversation, copy: Copy, primary = true): ZeniLink {
  return {
    kind: 'book',
    label: copy.labels.openBookingForm,
    href: buildBookingLink(bookingInput(state)),
    primary,
  };
}

function visitLink(state: ReceptionistConversation, copy: Copy, primary = false): ZeniLink {
  return {
    kind: 'visit',
    label: copy.labels.scheduleVisit,
    href: buildVisitLink(state.booking.dates[0]),
    primary,
  };
}

function resetAvailability(state: ReceptionistConversation) {
  state.booking.status = 'collecting';
  state.booking.resultObservedAt = null;
  state.booking.resultExpiresAt = null;
}

/** New explicit details replace older ones: nothing is submitted, so no confirmation is needed. */
function applyChanges(
  state: ReceptionistConversation,
  changes: SlotChanges,
  sources: ChatSource[],
) {
  if (changes.date && changes.date !== state.booking.dates[0]) {
    state.booking.dates = [changes.date];
    resetAvailability(state);
  }
  if (changes.timeWindow) {
    const [start, end] = changes.timeWindow.split('/');
    if (start !== state.booking.startTime || end !== state.booking.endTime)
      resetAvailability(state);
    state.booking.startTime = start;
    state.booking.endTime = end;
    state.booking.timePreference = `${start}–${end} (Manila)`;
  }
  if (changes.guests) state.booking.guests = changes.guests;
  if (changes.venue) state.booking.venue = changes.venue;
  if (changes.packageId) {
    const source = sources.find((item) => item.id === changes.packageId && item.offering);
    if (source?.offering) {
      state.booking.packageId = source.id;
      state.booking.packageName = source.offering.packageName;
      rememberSources(state, [source]);
    }
  }
}

function plan(
  context: PlanContext,
  value: ChatReply,
  rest: Partial<Omit<ReceptionistPlan, 'intent' | 'topic' | 'reply'>> = {},
): ReceptionistPlan {
  return { intent: context.intent, topic: context.topic, reply: value, ...rest };
}

function collectEscalation(context: PlanContext): ReceptionistPlan {
  const { state, copy } = context;
  state.stage = 'S1';
  if (!state.client.name) {
    state.awaiting = 'name';
    return plan(context, reply('escalation', copy.handoffName, { links: [contactLink(copy)] }));
  }
  if (!state.client.email) {
    state.awaiting = 'contact';
    return plan(context, reply('escalation', copy.handoffEmail, { links: [contactLink(copy)] }));
  }
  state.awaiting = 'consent';
  return plan(
    context,
    reply('escalation', copy.handoffConsent, {
      actions: [
        action('confirm_escalation', copy.labels.sendToStaff),
        action('decline', copy.labels.notNow),
      ],
    }),
  );
}

function offerStaff(
  context: PlanContext,
  message: string,
  reason: string,
  gap?: ZeniGap,
): ReceptionistPlan {
  const { state, copy } = context;
  state.flags.reason = reason;
  state.flags.offeredHandoff = true;
  state.needs.goal ||= context.redacted;
  return plan(
    context,
    reply('handoff', message, {
      actions: [staff(copy)],
      suggestions: copy.suggestions.afterAnswer.filter((item) => !/staff/i.test(item)),
    }),
    gap ? { gap } : {},
  );
}

/**
 * One help topic's official summary, for a tapped topic chip or a short message that only names
 * the topic ("payment", "corkage"). `note` replaces the closing contact line.
 */
function topicPlan(
  context: PlanContext,
  topic: ZeniHelpTopic,
  options: { note?: string; gap?: ZeniGap } = {},
): ReceptionistPlan {
  const { state, copy } = context;
  state.lastAnswerTurn = state.turn;
  state.stage = state.stage === 'S7' ? 'S7' : 'S2';
  const message = [
    topic.intro,
    ...topic.points.map((point) => `• ${point}`),
    options.note ?? topic.contact,
  ].join('\n');
  return plan(
    context,
    reply('answer', message, {
      links: [faqLink(copy)],
      suggestions: [...topic.followUps],
      actions: needsStaffOption(topic) ? [staff(copy)] : [],
    }),
    options.gap ? { gap: options.gap } : {},
  );
}

function isPastDate(date: string, now: Date) {
  return date < venueDateKey(now);
}

function availabilityPlan(context: PlanContext): ReceptionistPlan {
  const { state, copy, now } = context;
  if (state.booking.intent !== 'new_booking') state.booking.intent = 'availability_check';
  const date = state.booking.dates[0];
  if (!date || isPastDate(date, now)) {
    state.booking.dates = [];
    state.awaiting = 'dates';
    state.stage = 'S1';
    resetAvailability(state);
    return plan(
      context,
      reply('availability', date ? copy.invalidDate : copy.askDate, {
        actions: [staff(copy)],
        ...(state.booking.intent === 'new_booking' ? { links: [bookingLink(state, copy)] } : {}),
      }),
      { calendar: {} },
    );
  }
  state.awaiting = null;
  state.stage = 'S4';
  state.booking.status = 'checking';
  return plan(context, reply('availability', copy.checking), {
    effect: {
      type: 'availability',
      date,
      ...(state.booking.startTime && state.booking.endTime
        ? { startTime: state.booking.startTime, endTime: state.booking.endTime }
        : {}),
    },
  });
}

function bookingDetails(state: ReceptionistConversation) {
  return [
    state.booking.eventType,
    state.booking.packageName,
    state.booking.guests && `${state.booking.guests} guests`,
  ]
    .filter(Boolean)
    .join(' · ');
}

function bookingPlan(context: PlanContext): ReceptionistPlan {
  const { state, copy } = context;
  state.booking.intent = 'new_booking';
  if (state.booking.dates[0]) return availabilityPlan(context);
  state.awaiting = 'dates';
  state.stage = 'S3';
  resetAvailability(state);
  const details = bookingDetails(state);
  const card = state.booking.eventType ? eventCardFor(state.booking.eventType, copy.labels) : null;
  return plan(
    context,
    reply('booking', details ? copy.bookingWithDetails(details) : copy.bookingIntro, {
      links: [bookingLink(state, copy), visitLink(state, copy)],
      actions: [staff(copy)],
      cards: card ? [card] : [],
    }),
    { calendar: {} },
  );
}

function visitPlan(context: PlanContext): ReceptionistPlan {
  const { state, copy, sources } = context;
  const visits = sources.find((source) => source.id === 'visits');
  const facts = visits ? `${visits.text.replaceAll('\n', '; ').replace(/\.;/g, ';')} ` : '';
  if (visits) rememberSources(state, [visits]);
  state.stage = 'S2';
  return plan(
    context,
    reply('answer', `${facts}${copy.visit}`.trim(), {
      sources: visits ? [sourceEvidence(visits)] : [],
      links: [visitLink(state, copy, true)],
      actions: [staff(copy)],
      suggestions: copy.suggestions.afterAnswer.filter((item) => !/visit/i.test(item)),
    }),
    visits ? { compose: { mode: 'answer', question: context.redacted, sources: [visits] } } : {},
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

function recommendPublishedOption(context: PlanContext): ReceptionistPlan {
  const { state, copy, sources } = context;
  const choice = offeringOptions(state, sources)[0];
  if (!choice?.offering)
    return offerStaff(context, copy.noRecommendation, 'unpublished_or_unmatched_package');
  if (!state.booking.guests) {
    if (!state.needs.preferences.includes('recommendation_requested'))
      state.needs.preferences.push('recommendation_requested');
    state.awaiting = 'guests';
    state.stage = 'S1';
    return plan(context, reply('discovery', copy.askGuests));
  }
  state.needs.preferences = state.needs.preferences.filter(
    (item) => item !== 'recommendation_requested',
  );
  state.awaiting = null;
  state.stage = 'S3';
  state.booking.packageId = choice.id;
  state.booking.packageName = choice.offering.packageName;
  state.booking.eventType ||= choice.offering.category.toLowerCase();
  rememberSources(state, [choice]);
  return plan(
    context,
    reply(
      'answer',
      copy.recommendation(
        choice.title,
        formatStartsAt(choice.offering),
        choice.offering.guests,
        state.booking.guests,
      ),
      {
        sources: [sourceEvidence(choice)],
        cards: detailCardsFor([choice], copy.labels),
        links: [bookingLink(state, copy), visitLink(state, copy)],
        actions: [staff(copy)],
      },
    ),
  );
}

function reconciliationPlan(context: PlanContext): ReceptionistPlan | null {
  const { copy, sources, text: question, redacted, topic } = context;
  if (
    /\bdeposit\b/i.test(question) &&
    !/\b(security|damage|reservation|booking|book|payment)\b/i.test(question)
  )
    return plan(
      context,
      reply('discovery', copy.depositClarify, {
        suggestions: ['What is the reservation fee?', 'What is the security deposit?'],
      }),
    );
  const conflict = { reason: 'conflict' as const, question: redacted, topic };
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
    context.state.flags.needsHuman = true;
    return offerStaff(context, copy.paymentReview, 'payment_policy_conflict', conflict);
  }
  if (PAYMENT_METHODS.test(question) && sources.some(unverifiedPaymentMethods)) {
    // The published lists of payment methods disagree, so Zeni gives the official payment
    // schedule and leaves the accepted methods to Sir Tim or staff (and logs the question).
    const payments = zeniTopics.find((item) => item.id === 'payments');
    context.state.flags.reason = 'payment_methods_review';
    return payments
      ? topicPlan(context, payments, { note: copy.paymentMethods, gap: conflict })
      : offerStaff(context, copy.paymentReview, 'payment_methods_review', conflict);
  }
  if (/\b(capacity|accommodate|maximum guests|max pax|kasya)\b/i.test(question)) {
    const faq = sources.find((source) => source.kind === 'faq' && /capacity/i.test(source.title));
    const policy = sources.find(
      (source) => source.kind === 'policy' && /maximum capacity/i.test(source.text),
    );
    if (faq && policy) {
      const maximum = (value: string) =>
        Math.max(...(value.match(/\b\d{2,4}\b/g) ?? []).map(Number));
      if (maximum(faq.text) !== maximum(policy.text.split('\n')[0])) {
        context.state.flags.needsHuman = true;
        return offerStaff(context, copy.capacityReview, 'capacity_scope_review', conflict);
      }
    }
  }
  return null;
}

function groundedAnswer(context: PlanContext): ReceptionistPlan {
  const { state, copy, sources, redacted, topic, text } = context;
  const reconciliation = reconciliationPlan(context);
  if (reconciliation) return reconciliation;
  // Names, emails or references in the question are not search terms.
  const searchText = redacted.replace(PLACEHOLDER, ' ');
  const previous = state.lastKnowledgeQuestion.replace(PLACEHOLDER, ' ');
  const selected = preferTitled(
    searchText,
    rankSources(searchText, sources, previous)
      .map((match) => match.source)
      // The published payment-methods list disagrees with other information; staff confirm it.
      .filter((source) => !unverifiedPaymentMethods(source)),
  );
  const helpTopic = topicFromKeywords(text);
  const bare = text.split(/\s+/).length <= 3;
  // Related published facts the language model may combine into an answer.
  const related = candidateSources(searchText, sources, previous, MAX_PROMPT_SOURCES).filter(
    (source) => !unverifiedPaymentMethods(source),
  );
  if (!selected.length) {
    const gap: ZeniGap = { reason: 'no_source', question: redacted, topic };
    // A message that only names a topic ("lechon?", "corkage") gets that topic's official
    // summary. A specific question nothing covers is never guessed by the rules: the honest
    // "not published yet" reply stands in backup mode, while the language model may still answer
    // from related facts or, for a general planning question, give general advice.
    if (helpTopic && bare) return topicPlan(context, helpTopic, { gap });
    const result = offerStaff(context, copy.knowledgeGap, 'knowledge_gap', gap);
    result.reply.suggestions = copy.suggestions.welcome;
    result.compose = { mode: 'answer', question: redacted, sources: related };
    return result;
  }
  const faqGroups = new Map<string, Set<string>>();
  for (const source of selected.filter((item) => item.kind === 'faq')) {
    const key = source.title.toLowerCase().replace(/\W/g, '');
    const values = faqGroups.get(key) ?? new Set<string>();
    values.add(source.text.trim());
    faqGroups.set(key, values);
  }
  if ([...faqGroups.values()].some((values) => values.size > 1)) {
    state.flags.needsHuman = true;
    return offerStaff(context, copy.knowledgeConflict, 'knowledge_conflict', {
      reason: 'conflict',
      question: redacted,
      topic,
    });
  }
  // A bare word several official answers share ("payment", "corkage") gets the topic summary.
  // A staff-managed answer ranked first is always given as it is.
  if (
    helpTopic &&
    bare &&
    selected[0].topic &&
    selected.filter((source) => source.topic && titleCoversQuestion(searchText, source)).length > 1
  )
    return topicPlan(context, helpTopic);
  return answerFromSources(context, selected, related);
}

/**
 * The reply for ranked sources; the first one is the answer. The language model also sees the
 * related sources, so it can add a fact the first source leaves out.
 */
function answerFromSources(
  context: PlanContext,
  selected: ChatSource[],
  related: ChatSource[] = [],
): ReceptionistPlan {
  const { state, copy, redacted, topic } = context;
  const primary = selected[0];
  const reference = sourceReference(primary);
  // The same answer asked for again is acknowledged rather than pasted as if new.
  const repeated = state.answeredRefs.includes(reference);
  state.answeredRefs = [
    ...state.answeredRefs.filter((item) => item !== reference),
    reference,
  ].slice(-12);
  rememberSources(state, selected);
  state.lastKnowledgeQuestion = redacted;
  state.lastAnswerTurn = state.turn;
  state.stage = state.stage === 'S7' ? 'S7' : 'S2';
  // Visiting hours are one short fact set; the appointment condition qualifies every day. Other
  // long sources (a policy, a booklet section) give the lines that match the question.
  const paragraph =
    primary.id === 'visits'
      ? primary.text.replaceAll('\n', '; ')
      : relevantPassage(redacted.replace(PLACEHOLDER, ' '), primary);
  // Official FAQ answers are short reviewed paragraphs, so they are never cut.
  // A list passage is already trimmed to the lines that answer the question.
  const excerpt =
    primary.id === 'visits' ||
    primary.kind === 'faq' ||
    paragraph.length <= 420 ||
    paragraph.includes('\n')
      ? paragraph
      : paragraph.match(/^.{1,420}[.!?](?:\s|$)/)?.[0];
  if (excerpt && excerpt.trim().length <= 300)
    state.statementsShared = [
      ...state.statementsShared.slice(-9),
      { statement: excerpt.trim(), kbReference: sourceReference(primary) },
    ];
  const cards = detailCardsFor(selected, copy.labels);
  const aboutEvents =
    topic === 'packages' || cards.some((card) => card.kind !== 'facility') || primary.offering;
  const links: ZeniLink[] = aboutEvents
    ? [bookingLink(state, copy)]
    : cards.some((card) => card.kind === 'facility')
      ? [visitLink(state, copy, true)]
      : [];
  const helpTopic = primary.topic ? zeniTopics.find((item) => item.id === primary.topic) : null;
  const followUp = copy.answerFollowUps[state.turn % copy.answerFollowUps.length];
  const body = excerpt ? excerpt.trim() : `${primary.title}.`;
  const message = `${repeated ? `${copy.repeatPrefix} ` : ''}${body}${body.includes('\n') ? '\n' : ' '}${followUp}`;
  return plan(
    context,
    reply('answer', message, {
      sources: selected.map(sourceEvidence),
      cards,
      links,
      suggestions: helpTopic
        ? topicFollowUps(helpTopic, primary, context.sources)
        : copy.suggestions.afterAnswer,
      actions: needsStaffOption(helpTopic) ? [staff(copy)] : [],
    }),
    {
      compose: {
        mode: 'answer',
        question: redacted,
        sources: [...selected, ...related.filter((source) => !selected.includes(source))].slice(
          0,
          MAX_PROMPT_SOURCES,
        ),
      },
    },
  );
}

function objectionPlan(context: PlanContext): ReceptionistPlan {
  const { state, copy, text } = context;
  state.stage = 'S3';
  state.lastSoftCloseTurn = state.turn;
  if (/not now|maybe later|think about|pag-?iisipan/i.test(text)) {
    state.stage = 'S7';
    return plan(context, reply('objection', copy.objectionTime));
  }
  if (/discount/i.test(text))
    return plan(context, reply('objection', copy.objectionDiscount, { actions: [staff(copy)] }));
  const concern = /expensive|afford|budget|too much|mahal/i.test(text)
    ? 'price'
    : /trust|legit/i.test(text)
      ? 'trust'
      : /ask my|check with my/i.test(text)
        ? 'decision_maker'
        : 'fit';
  if (!state.objections.includes(concern)) state.objections.push(concern);
  const message =
    concern === 'price'
      ? copy.objectionPrice
      : concern === 'trust'
        ? copy.objectionTrust
        : concern === 'decision_maker'
          ? copy.objectionDecision
          : copy.comparison;
  return plan(
    context,
    reply(
      'objection',
      message,
      concern === 'trust' ? { links: [visitLink(state, copy, true)] } : {},
    ),
  );
}

function safetyPlan(context: PlanContext): ReceptionistPlan | null {
  const { state, copy, intent } = context;
  if (intent === 'sensitive')
    return plan(context, reply('handoff', copy.privacy, { actions: [staff(copy)] }));
  if (intent === 'manipulation' || intent === 'abuse') {
    state.flags.offTopicCount += 1;
    if (state.flags.offTopicCount >= 3) {
      state.flags.needsHuman = true;
      state.flags.reason = 'repeated_boundary_attempts';
      state.stage = 'S7';
      return plan(context, reply('scope', copy.leave));
    }
    return plan(context, reply('scope', intent === 'abuse' ? copy.abuse : copy.scope));
  }
  if (intent === 'identity')
    return plan(
      context,
      reply('greeting', copy.identity, {
        actions: [staff(copy)],
        suggestions: copy.suggestions.welcome,
      }),
    );
  if (intent === 'off_topic') {
    state.flags.offTopicCount += 1;
    if (state.flags.offTopicCount >= 3) state.stage = 'S7';
    return plan(
      context,
      reply('scope', state.flags.offTopicCount >= 3 ? copy.leave : copy.scope, {
        suggestions: copy.suggestions.welcome,
      }),
    );
  }
  return null;
}

function handoffPlan(context: PlanContext, requested: boolean): ReceptionistPlan {
  const { state, copy, intent, redacted } = context;
  // Only a staff request right after a grounded answer says that answer did not help.
  const askedFirst = state.lastAnswerTurn === state.turn - 1 ? state.lastKnowledgeQuestion : '';
  state.flags.needsHuman = true;
  state.flags.complaint ||= intent === 'complaint';
  state.flags.reason =
    intent === 'complaint'
      ? 'complaint'
      : intent === 'reschedule'
        ? 'reschedule_request'
        : intent === 'cancel'
          ? 'cancellation_request'
          : state.flags.reason && state.flags.reason !== 'requested_human'
            ? state.flags.reason
            : 'requested_human';
  if (intent === 'reschedule' || intent === 'cancel') state.booking.intent = intent;
  if (
    ['complaint', 'reschedule', 'cancel'].includes(intent) ||
    /special|custom/i.test(context.text)
  )
    state.needs.goal = redacted;
  const result = collectEscalation(context);
  if (intent === 'complaint')
    result.reply.message = `${copy.complaintPrefix} ${result.reply.message}`;
  if (intent === 'reschedule' || intent === 'cancel')
    result.reply.message = `${copy.existingBooking} ${result.reply.message}`;
  // Asking for a person right after an information question signals an unanswered question.
  if (requested && askedFirst)
    result.gap = { reason: 'handoff', question: askedFirst, topic: detectTopic(askedFirst) };
  return result;
}

/** Deterministic, grounded pipeline. Side effects are explicit plans, never model text. */
export function planReceptionistTurn(
  state: ReceptionistConversation,
  command: ReceptionistCommand,
  sources: ChatSource[],
  now = new Date(),
): ReceptionistPlan {
  const text = command.question.trim();
  const type = command.action?.type;
  // A button label is Zeni's own wording; only typed text changes the reply language.
  if (!type) state.client.language = detectLanguage(text, state.client.language);
  const copy = zeniCopyFor(state.client.language);
  const offeredHandoff = state.flags.offeredHandoff;
  state.flags.offeredHandoff = false;
  const intent: ReceptionistIntent =
    type === 'check_availability'
      ? 'availability'
      : type === 'request_human' || type === 'confirm_escalation'
        ? 'human'
        : type
          ? 'unclear'
          : receptionistIntent(text);
  const context: PlanContext = {
    state,
    copy,
    sources,
    intent,
    topic: detectTopic(text),
    text,
    redacted: redactPersonalData(text, { names: [state.client.name], maxLength: 300 }),
    now,
  };

  if (!type) {
    const safety = safetyPlan(context);
    if (safety) return safety;
    // A tapped topic chip, or a message that is only a topic's umbrella word ("payment").
    const chip = topicFromLabel(text) ?? topicFromSummaryWord(text);
    if (chip) return topicPlan(context, chip);
  }

  if (type === 'decline' || (!type && no(text))) {
    state.stage = 'S7';
    state.awaiting = null;
    state.flags.needsHuman = false;
    state.lastSoftCloseTurn = state.turn;
    return plan(
      context,
      reply('greeting', copy.decline, { suggestions: copy.suggestions.welcome }),
    );
  }

  const confirming = type === 'confirm_escalation' || (!type && yes(text));
  if (confirming && state.flags.needsHuman && state.awaiting === 'consent') {
    if (!state.client.name || !state.client.email) return collectEscalation(context);
    state.awaiting = null;
    return plan(context, reply('escalation', copy.handoffSending), {
      effect: { type: 'escalation' },
    });
  }
  // "Yes" to "Would you like me to ask our staff?" starts the hand-off.
  if (!type && yes(text) && offeredHandoff)
    return handoffPlan({ ...context, intent: 'human' }, false);

  const before = [state.client.name, state.client.email, state.client.phone].join('\n');
  const changes = type ? {} : captureSlots(state, text, sources, now);
  const providedContact =
    before !== [state.client.name, state.client.email, state.client.phone].join('\n');

  // "Can we reschedule?" is a question about the rule, answered from the official FAQ with a
  // staff option; "please move my booking" asks staff to act and starts the hand-off.
  if (!type && (intent === 'reschedule' || intent === 'cancel') && QUESTION.test(text)) {
    applyChanges(state, changes, sources);
    return groundedAnswer(context);
  }
  if (type === 'request_human' || ['human', 'complaint', 'reschedule', 'cancel'].includes(intent)) {
    applyChanges(state, changes, sources);
    return handoffPlan(context, type === 'request_human' || intent === 'human');
  }

  if (type === 'check_availability') {
    const value = command.action?.value;
    let valid = false;
    if (value) {
      try {
        assertDateKey(value);
        valid = !isPastDate(value, now);
      } catch {
        valid = false;
      }
    }
    if (valid && value) applyChanges(state, { date: value }, sources);
    else state.booking.dates = [];
    return availabilityPlan(context);
  }

  if (changes.invalidDate) {
    state.awaiting = 'dates';
    return plan(context, reply('availability', copy.invalidDate, { actions: [staff(copy)] }), {
      calendar: {},
    });
  }
  if (changes.invalidTime)
    return plan(context, reply('availability', copy.invalidTime, { actions: [staff(copy)] }));
  applyChanges(state, changes, sources);

  const directQuestion =
    /\?|\b(?:what|where|why|how|do you|are you|can you|is there|ano|saan|paano|bakit|magkano)\b/i.test(
      text,
    );
  const escalationStep = state.awaiting === 'name' || state.awaiting === 'contact';
  if (
    state.flags.needsHuman &&
    (type === 'resume' ||
      (escalationStep && (providedContact || (!directQuestion && intent === 'unclear'))))
  )
    return collectEscalation(context);

  if (intent === 'availability') return availabilityPlan(context);
  if (intent === 'new_booking') return bookingPlan(context);
  if (intent === 'visit') return visitPlan(context);
  // A bare date, or an event with a date, is a request to check that date.
  if (changes.date && ['unclear', 'offerings'].includes(intent)) return availabilityPlan(context);
  if (state.awaiting === 'dates' && changes.date) return availabilityPlan(context);
  if (
    state.needs.preferences.includes('recommendation_requested') &&
    changes.guests &&
    !directQuestion
  )
    return recommendPublishedOption(context);
  if (type === 'resume')
    return state.awaiting === 'dates'
      ? availabilityPlan(context)
      : plan(context, reply('discovery', copy.unclear, { suggestions: copy.suggestions.welcome }));

  if (intent === 'greeting')
    return plan(
      context,
      reply('greeting', isAppreciation(text) ? copy.appreciation : copy.greeting, {
        suggestions: copy.suggestions.welcome,
        actions:
          state.flags.needsHuman && state.awaiting ? [action('resume', copy.labels.continue)] : [],
      }),
    );
  if (intent === 'small_talk')
    return plan(
      context,
      reply('greeting', copy.smallTalk, { suggestions: copy.suggestions.welcome }),
      text.split(/\s+/).length >= 2
        ? { compose: { mode: 'small_talk', question: context.redacted, sources: [] } }
        : {},
    );
  if (intent === 'objection') return objectionPlan(context);
  if (
    intent === 'offerings' &&
    /\b(recommend|suggest|best fit|which package|anong package)\b/i.test(text)
  )
    return recommendPublishedOption(context);
  if (intent === 'comparison') return plan(context, reply('discovery', copy.comparison));
  if (intent === 'unclear' && text.split(/\s+/).length < 5) {
    // Short questions such as "lechon" or "do kids eat free?" are answered when the official
    // information covers them; otherwise Zeni asks what the guest is looking for.
    const searchText = context.redacted.replace(PLACEHOLDER, ' ');
    if (
      rankSources(searchText, sources).some((match) => !unverifiedPaymentMethods(match.source)) ||
      topicFromKeywords(text) ||
      PAYMENT_METHODS.test(text)
    )
      return groundedAnswer(context);
    state.stage = 'S1';
    return plan(
      context,
      reply('discovery', copy.unclear, { suggestions: copy.suggestions.welcome }),
    );
  }
  return groundedAnswer(context);
}
