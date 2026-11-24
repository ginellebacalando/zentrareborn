import 'server-only';
import { z } from 'zod';
import { developerDb } from '@/lib/developer/db';
import type { OrchestrationSettings } from '@/lib/developer/types';

export const orchestrationSchema = z
  .object({
    inquiryEnabled: z.boolean(),
    timeoutMs: z.number().int().min(1000).max(30000),
    maxAttempts: z.number().int().min(1).max(10),
    retryBaseMs: z.number().int().min(1000).max(1800000),
  })
  .strict();

function bounded(value: string | undefined, fallback: number, min: number, max: number) {
  const n = Number(value);
  return value && Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : fallback;
}
export async function readOrchestrationSettings(): Promise<{
  value: OrchestrationSettings;
  revision: number;
}> {
  const defaults = {
    inquiryEnabled: process.env.N8N_WEBHOOK_ENABLED === 'true',
    timeoutMs: bounded(process.env.N8N_WEBHOOK_TIMEOUT_MS, 8000, 1000, 30000),
    maxAttempts: bounded(process.env.N8N_WEBHOOK_MAX_ATTEMPTS, 5, 1, 10),
    retryBaseMs: bounded(process.env.N8N_WEBHOOK_RETRY_BASE_MS, 30000, 1000, 1800000),
  };
  try {
    const { rows } = await developerDb.query<{
      value: unknown;
      revision: number;
    }>("SELECT value,revision FROM zion_developer_configuration WHERE id='orchestration'");
    if (!rows[0]) return { value: defaults, revision: 0 };
    return {
      value: orchestrationSchema.parse(rows[0].value),
      revision: rows[0].revision,
    };
  } catch (error) {
    // Existing installations need no developer schema until an operator installs it.
    if ((error as { code?: string }).code === '42P01') return { value: defaults, revision: 0 };
    throw error;
  }
}
