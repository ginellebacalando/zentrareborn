import 'server-only';
import { randomUUID } from 'node:crypto';
import { zeniCopyFor } from '@/config/chatbot-receptionist';
import { nextDateKey, venueDateKey } from '@/lib/calendar-time';
import {
  AVAILABILITY_RESULT_LIFETIME_MS,
  createConversation,
  type ReceptionistConversation,
} from '@/lib/chatbot/conversation';
import { buildBookingLink, buildVisitLink } from '@/lib/chatbot/links';
import { redactPersonalData } from '@/lib/chatbot/redaction';
import {
  planReceptionistTurn,
  type ReceptionistCommand,
  type ReceptionistPlan,
  type ZeniGap,
} from '@/lib/chatbot/receptionist';
import type { ChatReply, ChatSource, ZeniCalendarCard } from '@/lib/chatbot/types';
import type { ZeniPreviewResult } from '@/lib/chatbot/admin-types';
import type { PublicSystemSettings } from '@/lib/system-settings-types';
import {
  createReceptionistCalendarAvailability,
  type AvailabilityCheckResult,
  type ReceptionistCalendarAvailability,
} from '@/services/orchestration/receptionist-calendar';
import { escalationRequestId, submitReceptionistEscalation } from './escalation';
import { createGeminiComposer, type ZeniComposeResult, type ZeniComposer } from './gemini';
import { gapQuestionHash, recordZeniGap } from './gaps';

/** The calendar card shows about two months ahead. */
export const CALENDAR_CARD_DAYS = 60;

export type ZeniTurnDependencies = {
  now?: () => Date;
  calendar?: ReceptionistCalendarAvailability;
  submitEscalation?: typeof submitReceptionistEscalation;
  compose?: ZeniComposer;
  recordGap?: (
    gap: ZeniGap & { language: ReceptionistConversation['client']['language'] },
  ) => Promise<void>;
  /** Admin test console: nothing is stored and no inquiry is sent. */
  preview?: boolean;
};

type Copy = ReturnType<typeof zeniCopyFor>;
type LlmOutcome = { status: string; reason?: string; model?: string };

function addDays(key: string, days: number) {
  let result = key;
  for (let index = 0; index < days; index += 1) result = nextDateKey(result);
  return result;
}

function displayDate(date: string) {
  return new Intl.DateTimeFormat('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

function displayClock(time: string) {
  const [hour, minute] = time.split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function displayObserved(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

async function calendarCard(
  calendar: ReceptionistCalendarAvailability,
  now: Date,
  selected?: string,
): Promise<ZeniCalendarCard | null> {
  const today = venueDateKey(now);
  const to = addDays(today, CALENDAR_CARD_DAYS);
  try {
    const unavailable = await calendar.unavailableDates(today, to);
    return {
      type: 'calendar',
      today,
      from: today,
      to,
      unavailable,
      ...(selected ? { selected } : {}),
      observedAt: now.toISOString(),
    };
  } catch {
    console.error('[zeni] The calendar card could not read the admin calendar.');
    return null;
  }
}

function availabilityReply(
  state: ReceptionistConversation,
  result: AvailabilityCheckResult,
  copy: Copy,
  requestedDate: string,
): { reply: ChatReply; calendar?: { selected?: string } } {
  const staff = { type: 'request_human' as const, label: copy.labels.talkToStaff };
  const bookingInput = {
    eventType: state.booking.eventType,
    packageName: state.booking.packageName,
    date: requestedDate,
    startTime: state.booking.startTime,
    endTime: state.booking.endTime,
    guests: state.booking.guests,
  };
  if (result.status === 'INVALID') {
    state.booking.dates = result.reason === 'time' ? state.booking.dates : [];
    state.booking.status = 'collecting';
    state.awaiting = result.reason === 'time' ? 'timePreference' : 'dates';
    return {
      reply: {
        kind: 'availability',
        message: result.reason === 'time' ? copy.invalidTime : copy.invalidDate,
        sources: [],
        suggestions: [],
        actions: [staff],
      },
      calendar: result.reason === 'time' ? undefined : {},
    };
  }
  if (result.status === 'ERROR') {
    state.booking.status = 'failed';
    return {
      reply: {
        kind: 'handoff',
        message: copy.calendarError(displayDate(requestedDate)),
        sources: [],
        suggestions: [],
        actions: [staff],
        links: [
          {
            kind: 'book',
            label: copy.labels.openBookingForm,
            href: buildBookingLink(bookingInput),
            primary: true,
          },
        ],
      },
    };
  }
  state.booking.resultObservedAt = result.observedAt;
  state.booking.resultExpiresAt = new Date(
    new Date(result.observedAt).getTime() + AVAILABILITY_RESULT_LIFETIME_MS,
  ).toISOString();
  state.stage = 'S4';
  state.awaiting = null;
  const window =
    result.startTime && result.endTime
      ? `, ${displayClock(result.startTime)} to ${displayClock(result.endTime)}`
      : '';
  if (result.status === 'UNAVAILABLE') {
    state.booking.status = 'unavailable';
    state.awaiting = 'dates';
    return {
      reply: {
        kind: 'availability',
        message: copy.unavailable(displayDate(result.date)),
        sources: [],
        suggestions: [],
        actions: [staff],
      },
      calendar: { selected: result.date },
    };
  }
  state.booking.status = 'available';
  return {
    reply: {
      kind: 'availability',
      message: copy.available(displayDate(result.date), window, displayObserved(result.observedAt)),
      sources: [],
      suggestions: copy.suggestions.afterAvailability,
      actions: [{ type: 'check_availability', label: copy.labels.checkAnotherDate }, staff],
      links: [
        {
          kind: 'book',
          label: copy.labels.bookThisDate,
          href: buildBookingLink(bookingInput),
          primary: true,
        },
        { kind: 'visit', label: copy.labels.scheduleVisit, href: buildVisitLink(result.date) },
      ],
    },
  };
}

function rememberTurns(state: ReceptionistConversation, question: string, answer: string) {
  const names = [state.client.name].filter(Boolean);
  state.recentTurns = [
    ...state.recentTurns,
    { role: 'guest' as const, text: redactPersonalData(question, { names, maxLength: 300 }) },
    { role: 'zeni' as const, text: redactPersonalData(answer, { names, maxLength: 300 }) },
  ].slice(-6);
}

export type ZeniPipelineResult = {
  reply: ChatReply;
  plan: ReceptionistPlan;
  llm: LlmOutcome;
  gap?: ZeniGap;
};

let defaultComposer: ZeniComposer | undefined;

/** Plan, run read-only or consented effects, let the model phrase grounded answers, then log gaps. */
export async function runReceptionistPipeline(
  state: ReceptionistConversation,
  command: ReceptionistCommand,
  sources: ChatSource[],
  settings: PublicSystemSettings,
  dependencies: ZeniTurnDependencies = {},
): Promise<ZeniPipelineResult> {
  const now = dependencies.now ?? (() => new Date());
  const calendar =
    dependencies.calendar ?? createReceptionistCalendarAvailability({ now: () => now() });
  const plan = planReceptionistTurn(state, command, sources, now());
  const copy = zeniCopyFor(state.client.language);
  let reply: ChatReply = plan.reply;
  let calendarRequest = plan.calendar;
  let gap = plan.gap;
  let llm: LlmOutcome = { status: 'not_needed' };

  if (plan.effect?.type === 'escalation') {
    if (dependencies.preview) {
      reply = { ...reply, kind: 'escalation', message: copy.handoffPreview };
    } else {
      try {
        const reference = await (dependencies.submitEscalation ?? submitReceptionistEscalation)(
          state,
          escalationRequestId(state.id, command.turnId),
          settings,
        );
        state.escalationReference = reference;
        state.flags.needsHuman = false;
        state.stage = 'S7';
        reply = {
          kind: 'escalation',
          message: copy.handoffSent(reference),
          sources: [],
          suggestions: [],
          actions: [],
          links: [{ kind: 'page', label: copy.labels.contactPage, href: '/contact#message-us' }],
        };
      } catch {
        console.error('[zeni] The staff inquiry could not be verified.');
        state.awaiting = 'consent';
        reply = {
          kind: 'handoff',
          message: copy.handoffFailed,
          sources: [],
          suggestions: [],
          actions: [{ type: 'confirm_escalation', label: copy.labels.sendToStaff }],
          links: [{ kind: 'page', label: copy.labels.contactPage, href: '/contact#message-us' }],
        };
      }
    }
  }

  if (plan.effect?.type === 'availability') {
    const result = await calendar.check({
      date: plan.effect.date,
      ...(plan.effect.startTime && plan.effect.endTime
        ? { startTime: plan.effect.startTime, endTime: plan.effect.endTime }
        : {}),
    });
    const outcome = availabilityReply(state, result, copy, plan.effect.date);
    reply = outcome.reply;
    calendarRequest = outcome.calendar;
  }

  if (calendarRequest) {
    const card = await calendarCard(calendar, now(), calendarRequest.selected);
    if (card) reply = { ...reply, cards: [...(reply.cards ?? []), card] };
  }

  if (plan.compose && !settings.client.maintenanceMode) {
    const compose = dependencies.compose ?? (defaultComposer ??= createGeminiComposer());
    let result: ZeniComposeResult;
    try {
      result = await compose({
        mode: plan.compose.mode,
        question: plan.compose.question,
        language: state.client.language,
        sources: plan.compose.sources.map((source) => ({
          id: source.id,
          title: source.title,
          href: source.href,
          text: source.text,
        })),
        recentTurns: state.recentTurns,
        knownNames: [state.client.name].filter(Boolean),
      });
    } catch {
      result = { status: 'failed', reason: 'exception' };
    }
    llm =
      result.status === 'used'
        ? { status: 'used', model: result.model }
        : { status: result.status, reason: result.reason, model: result.model };
    if (result.status === 'used') {
      reply = { ...reply, message: result.text };
      if (!result.covered && plan.compose.mode === 'answer') {
        state.flags.offeredHandoff = true;
        gap ??= { reason: 'low_confidence', question: plan.compose.question, topic: plan.topic };
        if (!reply.actions?.some((item) => item.type === 'request_human'))
          reply = {
            ...reply,
            actions: [
              ...(reply.actions ?? []),
              { type: 'request_human', label: copy.labels.talkToStaff },
            ],
          };
      }
    }
  }

  if (gap && !dependencies.preview) {
    const key = redactPersonalData(gap.question, { maxLength: 300 }).trim();
    const hash = gapQuestionHash(key);
    if (key && !state.loggedGaps.includes(hash)) {
      try {
        await (dependencies.recordGap ?? recordZeniGap)({
          ...gap,
          language: state.client.language,
        });
        state.loggedGaps = [...state.loggedGaps, hash].slice(-20);
      } catch {
        console.error('[zeni] An unanswered question could not be logged.');
      }
    }
  }

  if (!dependencies.preview) rememberTurns(state, command.question, reply.message);
  return { reply: { ...reply, language: state.client.language }, plan, llm, gap };
}

export async function executeReceptionistTurn(
  state: ReceptionistConversation,
  command: ReceptionistCommand,
  sources: ChatSource[],
  settings: PublicSystemSettings,
  dependencies: ZeniTurnDependencies = {},
): Promise<ChatReply> {
  return (await runReceptionistPipeline(state, command, sources, settings, dependencies)).reply;
}

/** Admin "Ask Zeni" console: one question against a fresh in-memory conversation. */
export async function previewReceptionistTurn(
  question: string,
  sources: ChatSource[],
  settings: PublicSystemSettings,
  dependencies: Omit<ZeniTurnDependencies, 'preview'> = {},
): Promise<ZeniPreviewResult> {
  const state = createConversation(randomUUID(), (dependencies.now ?? (() => new Date()))());
  const result = await runReceptionistPipeline(
    state,
    { question, turnId: randomUUID() },
    sources,
    settings,
    { ...dependencies, preview: true },
  );
  return {
    reply: result.reply,
    diagnostics: {
      intent: result.plan.intent,
      topic: result.plan.topic,
      language: state.client.language,
      llm: result.llm,
      sources: result.reply.sources.map((source) => ({ title: source.title, href: source.href })),
      ...(result.gap ? { gap: { reason: result.gap.reason, question: result.gap.question } } : {}),
      ...(result.plan.effect ? { effect: result.plan.effect.type } : {}),
    },
  };
}
