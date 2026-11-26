import 'server-only';
import { z } from 'zod';
import { DEFAULT_GEMINI_MODEL, GEMINI_ENDPOINT, ZENI_LLM_LIMITS } from '@/config/chatbot-llm';
import {
  buildZeniPrompt,
  prepareComposeInput,
  type ZeniComposeInput,
} from '@/lib/chatbot/llm-prompt';
import { validateGeneralAdvice, validateZeniAnswer } from '@/lib/chatbot/llm-validation';
import { templateLanguage } from '@/lib/chatbot/language';
import { createLlmRateGuard, type LlmRateGuard } from './llm-rate-guard';

type Environment = Record<string, string | undefined>;

export type ZeniLlmSettings = {
  enabled: boolean;
  keyConfigured: boolean;
  model: string;
  /** ZENI_LLM_ENABLED: unset means "on when a key exists". */
  switchValue: 'default' | 'on' | 'off';
  reason?: 'no_key' | 'switched_off';
};

export type ZeniComposeResult =
  | {
      status: 'used';
      text: string;
      /** The sources answer what the guest asked about Zion. */
      covered: boolean;
      model: string;
      /** The reply includes general event-planning advice ("In general, …"). */
      general?: boolean;
      /** The guest asked about Zion itself, not a general planning question. */
      aboutZion?: boolean;
      /** Positions (0-based) of the supplied sources the Zion part relies on. */
      used?: number[];
    }
  | {
      status: 'disabled' | 'rate_limited' | 'failed' | 'timeout' | 'rejected' | 'blocked';
      reason: string;
      model?: string;
    };

export type ZeniComposer = (input: ZeniComposeInput) => Promise<ZeniComposeResult>;

const MODEL_NAME = /^[a-z0-9][a-z0-9.-]{1,62}$/i;
const OFF_VALUES = new Set(['false', '0', 'off', 'no', 'disabled']);
const ON_VALUES = new Set(['true', '1', 'on', 'yes', 'enabled']);

/** Server-only configuration. The key value is never returned, logged or sent to the browser. */
export function zeniLlmSettings(env: Environment = process.env): ZeniLlmSettings {
  const keyConfigured = Boolean(env.GEMINI_API_KEY?.trim());
  const requestedModel = env.GEMINI_MODEL?.trim();
  const model =
    requestedModel && MODEL_NAME.test(requestedModel) ? requestedModel : DEFAULT_GEMINI_MODEL;
  const raw = env.ZENI_LLM_ENABLED?.trim().toLowerCase() ?? '';
  const switchValue = OFF_VALUES.has(raw) ? 'off' : ON_VALUES.has(raw) ? 'on' : 'default';
  if (switchValue === 'off')
    return { enabled: false, keyConfigured, model, switchValue, reason: 'switched_off' };
  if (!keyConfigured)
    return { enabled: false, keyConfigured, model, switchValue, reason: 'no_key' };
  return { enabled: true, keyConfigured, model, switchValue };
}

const globalGuard = globalThis as unknown as { zeniLlmGuard?: LlmRateGuard };
/** One budget per server process, kept across development reloads. */
export function sharedZeniLlmGuard() {
  globalGuard.zeniLlmGuard ??= createLlmRateGuard(ZENI_LLM_LIMITS);
  return globalGuard.zeniLlmGuard;
}

const geminiResponse = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({ parts: z.array(z.object({ text: z.string().optional() })).optional() })
          .optional(),
        finishReason: z.string().optional(),
      }),
    )
    .optional(),
  promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
});
/** The reply format: Zion's facts and general advice kept apart (instructions of 27 Nov 2026). */
const twoPartAnswer = z.object({
  zion: z.string().max(4000).default(''),
  general: z.string().max(4000).default(''),
  covered: z.boolean(),
  aboutZion: z.boolean().default(true),
  used: z.array(z.number().int()).max(12).default([]),
});
/** The earlier single-answer format, still accepted. */
const singleAnswer = z.object({ answer: z.string().max(4000), covered: z.boolean() });
// The single-answer format needs "answer", so it is tried first; extra keys are ignored.
const modelAnswer = z
  .union([singleAnswer, twoPartAnswer])
  .transform((value) =>
    'answer' in value
      ? { zion: value.answer, general: '', covered: value.covered, aboutZion: true, used: [] }
      : value,
  );

type Attempt =
  | { kind: 'ok'; text: string; finishReason?: string }
  | { kind: 'blocked'; reason: string }
  | { kind: 'quota'; retryAfterMs: number }
  | { kind: 'error'; reason: string; retryable: boolean };

function retryAfterMs(response: Response) {
  const header = Number(response.headers.get('retry-after'));
  const fallback = ZENI_LLM_LIMITS.cooldownMs;
  return Number.isFinite(header) && header > 0
    ? Math.min(header * 1000, ZENI_LLM_LIMITS.maxCooldownMs)
    : fallback;
}

function parseModelJson(text: string) {
  const unfenced = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    return modelAnswer.safeParse(JSON.parse(unfenced));
  } catch {
    return modelAnswer.safeParse(null);
  }
}

export type GeminiComposerOptions = {
  env?: Environment;
  fetch?: typeof fetch;
  guard?: LlmRateGuard;
  now?: () => number;
  timeoutMs?: number;
  deadlineMs?: number;
};

/**
 * Asks Gemini to phrase Zeni's reply from public sources (generateContent REST API, no SDK).
 * At most one retry within a short deadline; every failure returns a status so the caller can
 * keep the deterministic answer.
 */
export function createGeminiComposer(options: GeminiComposerOptions = {}): ZeniComposer {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const now = options.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? ZENI_LLM_LIMITS.timeoutMs;
  const deadlineMs = options.deadlineMs ?? ZENI_LLM_LIMITS.deadlineMs;

  async function attempt(
    model: string,
    apiKey: string,
    body: string,
    limitMs: number,
  ): Promise<Attempt> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), limitMs);
    try {
      const response = await fetchImpl(
        `${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body,
          signal: controller.signal,
          cache: 'no-store',
        },
      );
      if (response.status === 429) return { kind: 'quota', retryAfterMs: retryAfterMs(response) };
      if (!response.ok)
        return {
          kind: 'error',
          reason: `http_${response.status}`,
          retryable: response.status >= 500,
        };
      const parsed = geminiResponse.safeParse(await response.json());
      if (!parsed.success) return { kind: 'error', reason: 'invalid_response', retryable: false };
      if (parsed.data.promptFeedback?.blockReason)
        return { kind: 'blocked', reason: parsed.data.promptFeedback.blockReason.toLowerCase() };
      const candidate = parsed.data.candidates?.[0];
      const text = (candidate?.content?.parts ?? []).map((part) => part.text ?? '').join('');
      if (!text.trim()) return { kind: 'error', reason: 'empty_response', retryable: false };
      return { kind: 'ok', text, finishReason: candidate?.finishReason };
    } catch {
      return controller.signal.aborted
        ? { kind: 'error', reason: 'timeout', retryable: true }
        : { kind: 'error', reason: 'network', retryable: true };
    } finally {
      clearTimeout(timer);
    }
  }

  return async (input) => {
    const settings = zeniLlmSettings(options.env ?? process.env);
    const model = settings.model;
    if (!settings.enabled) return { status: 'disabled', reason: settings.reason ?? 'disabled' };
    const apiKey = (options.env ?? process.env).GEMINI_API_KEY?.trim() ?? '';
    const guard = options.guard ?? sharedZeniLlmGuard();
    const prepared = prepareComposeInput(input);
    const prompt = buildZeniPrompt(prepared);
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: prompt.system }] },
      contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: ZENI_LLM_LIMITS.maxOutputTokens,
        responseMimeType: 'application/json',
      },
      safetySettings: [
        'HARM_CATEGORY_HARASSMENT',
        'HARM_CATEGORY_HATE_SPEECH',
        'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        'HARM_CATEGORY_DANGEROUS_CONTENT',
      ].map((category) => ({ category, threshold: 'BLOCK_MEDIUM_AND_ABOVE' })),
    });
    const started = now();
    let failure: ZeniComposeResult = { status: 'failed', reason: 'deadline', model };
    for (let index = 0; index <= ZENI_LLM_LIMITS.maxRetries; index += 1) {
      const remaining = deadlineMs - (now() - started);
      if (remaining < 1000) break;
      const permit = guard.tryAcquire();
      if (!permit.ok) return { status: 'rate_limited', reason: permit.reason, model };
      const result = await attempt(model, apiKey, body, Math.min(timeoutMs, remaining));
      if (result.kind === 'quota') {
        guard.cooldown(result.retryAfterMs);
        return { status: 'rate_limited', reason: 'quota', model };
      }
      if (result.kind === 'blocked') return { status: 'blocked', reason: result.reason, model };
      if (result.kind === 'error') {
        failure = {
          status: result.reason === 'timeout' ? 'timeout' : 'failed',
          reason: result.reason,
          model,
        };
        if (!result.retryable) return failure;
        continue;
      }
      if (result.finishReason && result.finishReason !== 'STOP')
        return { status: 'rejected', reason: `finish_${result.finishReason.toLowerCase()}`, model };
      const answer = parseModelJson(result.text);
      if (!answer.success) return { status: 'rejected', reason: 'format', model };
      return checkedAnswer(answer.data, prepared, model);
    }
    return failure;
  };
}

/**
 * Checks each part on its own terms: the Zion part strictly against the sources (any failure
 * keeps Zeni's backup answer), the general advice for money, links, contacts and Zion claims (a
 * failure drops only the advice). A general question reads advice first, then Zion's part.
 */
function checkedAnswer(
  answer: { zion: string; general: string; covered: boolean; aboutZion: boolean; used: number[] },
  prepared: ZeniComposeInput,
  model: string,
): ZeniComposeResult {
  let zion = '';
  if (answer.zion.trim()) {
    const validation = validateZeniAnswer(answer.zion, {
      sources: prepared.sources,
      question: prepared.question,
      recentTurns: prepared.recentTurns,
    });
    if (!validation.ok) return { status: 'rejected', reason: validation.reason, model };
    zion = validation.text;
  }
  const covered = answer.covered && Boolean(zion);
  // General advice answers a general planning question. For a question about Zion that the facts
  // do not answer, advice about venues in general would only blur what Zion actually does.
  const adviceWanted = prepared.mode === 'answer' && (!answer.aboutZion || covered);
  const advice = adviceWanted
    ? validateGeneralAdvice(answer.general, templateLanguage(prepared.language))
    : ({ ok: true, text: '' } as const);
  const general = advice.ok ? advice.text : '';
  // Nothing to say is an honest "not covered": Zeni keeps its backup reply and offers staff.
  if (!zion && !general && !answer.covered && advice.ok)
    return {
      status: 'used',
      text: '',
      covered: false,
      model,
      general: false,
      aboutZion: answer.aboutZion,
      used: [],
    };
  if (!zion && !general)
    return { status: 'rejected', reason: advice.ok ? 'empty' : advice.reason, model };
  const parts = answer.aboutZion ? [zion, general] : [general, zion];
  return {
    status: 'used',
    text: parts.filter(Boolean).join('\n\n'),
    covered,
    model,
    general: Boolean(general),
    aboutZion: answer.aboutZion,
    used: [...new Set(answer.used)]
      .filter((position) => position >= 1 && position <= prepared.sources.length)
      .map((position) => position - 1),
  };
}
