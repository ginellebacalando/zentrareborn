import 'server-only';
import { isMailConfigured } from '@/lib/automation/config';
import { processDueJobs } from '@/lib/automation/processor';
import type { MailTransport } from '@/lib/automation/transport';
import { AdminError } from './errors';

/** Manual "Process queued notices" from the Activity log: delivers due outbox jobs through SMTP. */
export async function processAdminNotifications(options: { transport?: MailTransport } = {}) {
  if (!isMailConfigured())
    throw new AdminError(
      'Email delivery is not configured. Notifications remain queued; none have been sent.',
      503,
    );
  const result = await processDueJobs({ transport: options.transport });
  return {
    processed: result.claimed,
    accepted: result.sent,
    retrying: result.retrying,
    failed: result.failed,
    skipped: result.skipped,
  };
}
