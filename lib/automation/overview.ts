import 'server-only';

import { prisma } from '@/lib/prisma';
import {
  AUTOMATION_STATUSES,
  STAFF_EVENTS,
  automationJobLabel,
  isAutomationStatus,
  type AutomationOverview,
  type AutomationStatus,
} from './catalog';
import {
  AUTOMATION_POLICY,
  isCronConfigured,
  isMailConfigured,
  LAST_RUN_STATE_KEY,
} from './config';
import { maskEmail, maskRecipients, sanitizeErrorMessage } from './privacy';
import { processDueJobs } from './processor';
import { resolveStaffRecipients } from './recipients';
import type { MailTransport } from './transport';

async function statusCounts() {
  const rows = await prisma.adminOutbox.groupBy({ by: ['status'], _count: { _all: true } });
  const counts = Object.fromEntries(AUTOMATION_STATUSES.map((status) => [status, 0])) as Record<
    AutomationStatus,
    number
  >;
  for (const row of rows) if (isAutomationStatus(row.status)) counts[row.status] = row._count._all;
  return counts;
}

function lastRunView(state: { at: Date; detail: unknown } | null) {
  if (!state) return null;
  const detail = (state.detail && typeof state.detail === 'object' ? state.detail : {}) as Record<
    string,
    unknown
  >;
  const number = (value: unknown) => (typeof value === 'number' ? value : 0);
  return {
    at: state.at.toISOString(),
    trigger: typeof detail.trigger === 'string' ? detail.trigger : 'unknown',
    sent: number(detail.sent),
    failed: number(detail.failed),
  };
}

/** Admin panel data. Recipients are masked and errors sanitized before leaving the server. */
export async function readAutomationOverview(
  filter: AutomationStatus | null,
  now = new Date(),
): Promise<AutomationOverview> {
  const [counts, dueNow, lastRun, jobs, staff] = await Promise.all([
    statusCounts(),
    prisma.adminOutbox.count({ where: { status: 'QUEUED', nextAttemptAt: { lte: now } } }),
    prisma.automationState.findUnique({ where: { key: LAST_RUN_STATE_KEY } }),
    prisma.adminOutbox.findMany({
      where: filter ? { status: filter } : {},
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 50,
      select: {
        id: true,
        event: true,
        recipient: true,
        status: true,
        attempts: true,
        maxAttempts: true,
        nextAttemptAt: true,
        lastError: true,
        createdAt: true,
        sentAt: true,
        calendarMethod: true,
      },
    }),
    resolveStaffRecipients(),
  ]);
  return {
    emailConfigured: isMailConfigured(),
    cronConfigured: isCronConfigured(),
    staffRecipients: { source: staff.source, masked: staff.emails.map(maskEmail) },
    counts,
    dueNow,
    lastRun: lastRunView(lastRun),
    filter,
    jobs: jobs.map((job) => ({
      id: job.id,
      event: job.event,
      label: automationJobLabel(job.event),
      recipient:
        maskRecipients(job.recipient) || (STAFF_EVENTS.includes(job.event) ? 'Staff inbox' : ''),
      status: job.status,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      nextAttemptAt: job.status === 'QUEUED' ? job.nextAttemptAt.toISOString() : null,
      lastError: sanitizeErrorMessage(job.lastError),
      createdAt: job.createdAt.toISOString(),
      sentAt: job.sentAt?.toISOString() ?? null,
      calendar:
        job.calendarMethod === 'REQUEST' || job.calendarMethod === 'CANCEL'
          ? job.calendarMethod
          : null,
      retryable: job.status === 'REVIEW_REQUIRED',
    })),
  };
}

export type RetryOutcome = {
  status: 'sent' | 'queued' | 'failed' | 'skipped';
  message: string;
};

/**
 * Returns a failed job to the queue with a small fresh attempt budget and tries it once now.
 * Only REVIEW_REQUIRED jobs qualify, so a sent (ACCEPTED) job can never be sent again.
 */
export async function retryAutomationJob(
  id: string,
  options: { now?: Date; transport?: MailTransport } = {},
): Promise<RetryOutcome | null> {
  const now = options.now ?? new Date();
  const job = await prisma.adminOutbox.findUnique({
    where: { id },
    select: { status: true, attempts: true },
  });
  if (!job || job.status !== 'REVIEW_REQUIRED') return null;
  const requeued = await prisma.adminOutbox.updateMany({
    where: { id, status: 'REVIEW_REQUIRED', attempts: job.attempts },
    data: {
      status: 'QUEUED',
      maxAttempts: job.attempts + AUTOMATION_POLICY.retryExtraAttempts,
      nextAttemptAt: now,
      claimedAt: null,
      lastError: null,
    },
  });
  if (!requeued.count) return null;
  const delivery = await processDueJobs({ ids: [id], now, limit: 1, transport: options.transport });
  if (delivery.sent)
    return { status: 'sent', message: 'The email was accepted by the mail server.' };
  if (delivery.failed)
    return {
      status: 'failed',
      message: 'The retry failed again. Check the error before retrying.',
    };
  if (delivery.skipped)
    return { status: 'skipped', message: 'The email is no longer relevant and was not sent.' };
  return {
    status: 'queued',
    message: delivery.mailConfigured
      ? 'The email is queued again and will be retried automatically.'
      : 'The email is queued again, but email is not configured, so it has not been sent.',
  };
}

/** Public-safe counters for /api/health and the developer status view: no personal data. */
export async function readAutomationHealth() {
  const [queued, failed] = await Promise.all([
    prisma.adminOutbox.count({ where: { status: { in: ['QUEUED', 'PROCESSING'] } } }),
    prisma.adminOutbox.count({ where: { status: 'REVIEW_REQUIRED' } }),
  ]);
  return {
    emailConfigured: isMailConfigured(),
    cronConfigured: isCronConfigured(),
    queued,
    failed,
  };
}
