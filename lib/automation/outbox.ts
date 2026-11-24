import 'server-only';

import type { Prisma } from '@prisma/client';
import { AUTOMATION_POLICY } from './config';
import type { CalendarMethod } from './ics';

/** Works with the shared client or an interactive transaction, so jobs commit with the change. */
export type OutboxDb = Prisma.TransactionClient;

export type NewAutomationJob = {
  /** Unique per notification, for example `reminder:7d:<bookingId>`; duplicates are ignored. */
  idempotencyKey: string;
  event: string;
  /** Empty for staff jobs until a staff address is configured; resolved again at delivery. */
  recipient: string;
  replyTo?: string | null;
  bookingId?: string | null;
  subject: string;
  text: string;
  html: string;
  calendar?: { method: CalendarMethod; content: string } | null;
  nextAttemptAt?: Date;
  expiresAt?: Date | null;
  /** Records a deliberate decision not to send (for example an abuse guard) instead of a job. */
  skipReason?: string;
};

/**
 * Writes outbox rows idempotently (`ON CONFLICT DO NOTHING` on the idempotency key) and returns
 * the ids that were newly created. Call it inside the transaction of the business change.
 */
export async function enqueueJobs(db: OutboxDb, jobs: NewAutomationJob[], now = new Date()) {
  if (!jobs.length) return [];
  const created = await db.adminOutbox.createManyAndReturn({
    data: jobs.map((job) => ({
      idempotencyKey: job.idempotencyKey,
      event: job.event,
      recipient: job.recipient.trim().toLowerCase().slice(0, 255),
      replyTo: job.replyTo?.trim().toLowerCase().slice(0, 255) || null,
      bookingId: job.bookingId ?? null,
      subject: job.subject,
      body: job.text,
      html: job.html,
      calendar: job.calendar?.content ?? null,
      calendarMethod: job.calendar?.method ?? null,
      status: job.skipReason ? 'EXPIRED' : 'QUEUED',
      lastError: job.skipReason ?? null,
      maxAttempts: AUTOMATION_POLICY.maxAttempts,
      nextAttemptAt: job.nextAttemptAt ?? now,
      expiresAt: job.expiresAt ?? null,
      createdAt: now,
    })),
    skipDuplicates: true,
    select: { id: true, status: true },
  });
  return created.filter((row) => row.status === 'QUEUED').map((row) => row.id);
}

/** Exponential backoff for the attempt that just failed (1-based). */
export function retryDelayMs(attempt: number) {
  const exponent = Math.max(0, attempt - 1);
  return Math.min(
    AUTOMATION_POLICY.retryBaseMs * AUTOMATION_POLICY.retryFactor ** exponent,
    AUTOMATION_POLICY.retryMaxMs,
  );
}
