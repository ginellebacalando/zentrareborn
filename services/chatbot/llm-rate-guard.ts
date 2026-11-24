/**
 * In-memory request budget for the free model tier. It protects one server process from a burst;
 * it is not a distributed quota, so several instances each keep their own counters.
 */
export type LlmRateDecision = { ok: true } | { ok: false; reason: 'minute' | 'day' | 'cooldown' };

export type LlmRateGuard = {
  tryAcquire(): LlmRateDecision;
  /** Stop calling the model for a while, for example after HTTP 429. */
  cooldown(ms: number): void;
  snapshot(): {
    perMinute: number;
    perDay: number;
    lastMinute: number;
    today: number;
    coolingDownUntil: string | null;
  };
};

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export function createLlmRateGuard(options: {
  perMinute: number;
  perDay: number;
  now?: () => number;
}): LlmRateGuard {
  const now = options.now ?? Date.now;
  let recent: number[] = [];
  let dayStartedAt = 0;
  let dayCount = 0;
  let coolingDownUntil = 0;

  function refresh(at: number) {
    recent = recent.filter((stamp) => at - stamp < MINUTE);
    if (at - dayStartedAt >= DAY) {
      dayStartedAt = at;
      dayCount = 0;
    }
  }

  return {
    tryAcquire() {
      const at = now();
      refresh(at);
      if (at < coolingDownUntil) return { ok: false, reason: 'cooldown' };
      if (dayCount >= options.perDay) return { ok: false, reason: 'day' };
      if (recent.length >= options.perMinute) return { ok: false, reason: 'minute' };
      recent.push(at);
      dayCount += 1;
      return { ok: true };
    },
    cooldown(ms) {
      coolingDownUntil = Math.max(coolingDownUntil, now() + Math.max(0, ms));
    },
    snapshot() {
      const at = now();
      refresh(at);
      return {
        perMinute: options.perMinute,
        perDay: options.perDay,
        lastMinute: recent.length,
        today: dayCount,
        coolingDownUntil: at < coolingDownUntil ? new Date(coolingDownUntil).toISOString() : null,
      };
    },
  };
}
