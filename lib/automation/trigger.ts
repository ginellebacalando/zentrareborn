import 'server-only';

import { after } from 'next/server';
import { AUTOMATION_POLICY } from './config';
import { processDueJobs } from './processor';

/**
 * Attempts delivery of freshly enqueued jobs once the current response has been sent, which is
 * after the business transaction committed (or rolled back). Delivery only claims committed rows,
 * so calling this from inside a transaction is safe. Outside a request (CLI, tests) it does
 * nothing and the next scheduled run delivers the jobs.
 */
export function scheduleAutomationDelivery(ids: readonly string[]) {
  const jobIds = [...new Set(ids)].filter(Boolean);
  if (!jobIds.length) return false;
  try {
    after(async () => {
      try {
        await processDueJobs({
          ids: jobIds,
          limit: AUTOMATION_POLICY.immediateBatch,
          timeBudgetMs: AUTOMATION_POLICY.immediateTimeBudgetMs,
        });
      } catch (error) {
        console.error(
          'Immediate email delivery failed; the scheduled run will retry.',
          error instanceof Error ? error.name : 'unknown',
        );
      }
    });
    return true;
  } catch {
    return false;
  }
}
