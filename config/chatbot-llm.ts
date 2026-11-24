/**
 * Zeni's optional language-model settings. The key, model and switch come from server-only
 * environment variables (see docs/chatbot.md); these are the code defaults.
 *
 * Default model: gemini-3.5-flash-lite. On 25 November 2026 Google's model list showed it as a
 * stable free-tier model recommended for new projects, and the deprecated gemini-2.5-flash routes
 * to it from 1 December 2026. Override it with GEMINI_MODEL (for example gemini-3.6-flash).
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

export const ZENI_LLM_LIMITS = {
  /** Per server process. A burst cannot exhaust the free quota; deployments share nothing. */
  perMinute: 8,
  perDay: 200,
  /** One attempt may take this long before Zeni falls back to its deterministic answer. */
  timeoutMs: 8000,
  /** Total budget for the first attempt plus at most one retry. */
  deadlineMs: 12000,
  maxRetries: 1,
  /** Pause after Google reports a quota limit (HTTP 429) without a Retry-After header. */
  cooldownMs: 60000,
  maxCooldownMs: 15 * 60000,
  maxOutputTokens: 512,
} as const;

export const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
