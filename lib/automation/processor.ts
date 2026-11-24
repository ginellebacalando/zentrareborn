import 'server-only';

import type { AdminOutbox } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { STAFF_EVENTS } from './catalog';
import {
  AUTOMATION_POLICY,
  isEmailAddress,
  readMailSettings,
  staffRecipients,
  type MailSettings,
} from './config';
import { retryDelayMs } from './outbox';
import {
  classifyDeliveryError,
  createSmtpTransport,
  type DeliveryFailure,
  type MailTransport,
  type OutgoingMail,
} from './transport';

export type DeliveryRunResult = {
  mailConfigured: boolean;
  /** Jobs this run took ownership of. */
  claimed: number;
  sent: number;
  /** Failed attempts that were rescheduled with backoff. */
  retrying: number;
  /** Jobs that stopped and now need a person (REVIEW_REQUIRED). */
  failed: number;
  /** Jobs marked EXPIRED because they were no longer timely or relevant. */
  skipped: number;
  /** Due jobs left QUEUED because delivery cannot happen right now. */
  waiting: number;
  /** PROCESSING jobs from a crashed run, moved to REVIEW_REQUIRED instead of being resent. */
  interrupted: number;
  stoppedEarly: boolean;
};

const INTERRUPTED_MESSAGE =
  'Sending was interrupted, so this message may or may not have been delivered. Check with the recipient before retrying.';
const EXPIRED_MESSAGE = 'Not sent: the message was no longer timely when delivery became possible.';
const DAILY_LIMIT_MESSAGE =
  'The daily sending limit for the mail account was reached. Delivery continues automatically later.';
const NO_STAFF_ADDRESS_MESSAGE =
  'No staff address is configured (STAFF_NOTIFICATION_EMAIL or SMTP_USER). This message is waiting.';
const REMINDER_EVENTS = new Set(['EVENT_REMINDER_7D', 'EVENT_REMINDER_1D']);

function emptyResult(mailConfigured: boolean): DeliveryRunResult {
  return {
    mailConfigured,
    claimed: 0,
    sent: 0,
    retrying: 0,
    failed: 0,
    skipped: 0,
    waiting: 0,
    interrupted: 0,
    stoppedEarly: false,
  };
}

/** A crash after the server accepted a message must not cause a silent second send. */
async function recoverInterruptedJobs(now: Date) {
  const cutoff = new Date(now.getTime() - AUTOMATION_POLICY.interruptedAfterMs);
  const result = await prisma.adminOutbox.updateMany({
    where: {
      status: 'PROCESSING',
      OR: [{ claimedAt: { lt: cutoff } }, { claimedAt: null, nextAttemptAt: { lt: cutoff } }],
    },
    data: { status: 'REVIEW_REQUIRED', lastError: INTERRUPTED_MESSAGE },
  });
  return result.count;
}

async function expireOverdueJobs(now: Date, ids?: string[]) {
  const result = await prisma.adminOutbox.updateMany({
    where: { status: 'QUEUED', expiresAt: { lte: now }, ...(ids ? { id: { in: ids } } : {}) },
    data: { status: 'EXPIRED', lastError: EXPIRED_MESSAGE },
  });
  return result.count;
}

/** Due jobs stay QUEUED with a visible reason; nothing is presented as sent. */
async function holdDueJobs(now: Date, message: string, ids?: string[]) {
  const due = {
    status: 'QUEUED',
    nextAttemptAt: { lte: now },
    ...(ids ? { id: { in: ids } } : {}),
  } as const;
  await prisma.adminOutbox.updateMany({
    where: { ...due, OR: [{ lastError: null }, { lastError: { not: message } }] },
    data: { lastError: message },
  });
  return prisma.adminOutbox.count({ where: due });
}

/** Atomic claim: only one worker can move a due QUEUED row to PROCESSING. */
async function claim(id: string, now: Date) {
  const [job] = await prisma.adminOutbox.updateManyAndReturn({
    where: { id, status: 'QUEUED', nextAttemptAt: { lte: now } },
    data: { status: 'PROCESSING', attempts: { increment: 1 }, claimedAt: now },
  });
  return job ?? null;
}

/** Returns the job to the queue without spending an attempt (nothing was sent). */
async function release(job: AdminOutbox, nextAttemptAt: Date, lastError: string) {
  await prisma.adminOutbox.updateMany({
    where: { id: job.id, status: 'PROCESSING' },
    data: {
      status: 'QUEUED',
      attempts: { decrement: 1 },
      nextAttemptAt,
      claimedAt: null,
      lastError,
    },
  });
}

async function finish(job: AdminOutbox, status: 'REVIEW_REQUIRED' | 'EXPIRED', lastError: string) {
  await prisma.adminOutbox.updateMany({
    where: { id: job.id, status: 'PROCESSING' },
    data: {
      status,
      lastError,
      ...(status === 'EXPIRED' ? { attempts: { decrement: 1 } } : {}),
    },
  });
}

/** Reminders are only sent while the reservation is still confirmed and upcoming. */
async function irrelevanceReason(job: AdminOutbox, now: Date) {
  if (!REMINDER_EVENTS.has(job.event)) return null;
  const booking = job.bookingId
    ? await prisma.adminBooking.findUnique({
        where: { id: job.bookingId },
        select: { reservation: true, startsAt: true },
      })
    : null;
  if (!booking || booking.reservation !== 'CONFIRMED' || booking.startsAt <= now)
    return 'Not sent: the reservation is no longer confirmed or the event has already started.';
  return null;
}

function recipientFor(job: AdminOutbox) {
  return STAFF_EVENTS.includes(job.event) ? staffRecipients() : job.recipient;
}

function messageFor(
  job: AdminOutbox,
  recipient: string,
  settings: Extract<MailSettings, { configured: true }>,
): OutgoingMail {
  const domain = settings.from.address.split('@')[1];
  return {
    messageId: `<automation.${job.id}@${domain}>`,
    from: settings.from,
    to: recipient,
    replyTo: job.replyTo,
    subject: job.subject,
    text: job.body,
    html: job.html,
    calendar:
      job.calendar && (job.calendarMethod === 'REQUEST' || job.calendarMethod === 'CANCEL')
        ? { method: job.calendarMethod, content: job.calendar }
        : null,
  };
}

/**
 * Delivers due outbox jobs. Safe to run concurrently from cron, `after()` and the admin panel:
 * every job is claimed atomically, a sent job is never sent again, and failures either back off
 * exponentially or stop in REVIEW_REQUIRED where staff can see and retry them.
 */
export async function processDueJobs(
  options: {
    now?: Date;
    ids?: string[];
    limit?: number;
    timeBudgetMs?: number;
    transport?: MailTransport;
  } = {},
): Promise<DeliveryRunResult> {
  const now = options.now ?? new Date();
  const ids = options.ids ? [...new Set(options.ids)] : undefined;
  if (ids && !ids.length) return emptyResult(readMailSettings().configured);
  const settings = readMailSettings();
  const result = emptyResult(settings.configured);
  result.interrupted = await recoverInterruptedJobs(now);
  result.skipped += await expireOverdueJobs(now, ids);
  if (!settings.configured) {
    result.waiting = await holdDueJobs(now, settings.reason, ids);
    return result;
  }
  const sentToday = await prisma.adminOutbox.count({
    where: { status: 'ACCEPTED', sentAt: { gt: new Date(now.getTime() - 86_400_000) } },
  });
  const allowance = AUTOMATION_POLICY.dailySendLimit - sentToday;
  if (allowance <= 0) {
    result.waiting = await holdDueJobs(now, DAILY_LIMIT_MESSAGE, ids);
    result.stoppedEarly = true;
    return result;
  }
  const candidates = await prisma.adminOutbox.findMany({
    where: { status: 'QUEUED', nextAttemptAt: { lte: now }, ...(ids ? { id: { in: ids } } : {}) },
    orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
    take: Math.min(options.limit ?? AUTOMATION_POLICY.scheduledBatch, allowance),
    select: { id: true },
  });
  if (!candidates.length) return result;
  const transport = options.transport ?? createSmtpTransport(settings);
  const started = Date.now();
  const budget = options.timeBudgetMs ?? AUTOMATION_POLICY.scheduledTimeBudgetMs;
  try {
    for (const candidate of candidates) {
      if (Date.now() - started > budget) {
        result.stoppedEarly = true;
        break;
      }
      const job = await claim(candidate.id, now);
      if (!job) continue;
      result.claimed++;
      if (job.expiresAt && job.expiresAt <= now) {
        await finish(job, 'EXPIRED', EXPIRED_MESSAGE);
        result.skipped++;
        continue;
      }
      const irrelevant = await irrelevanceReason(job, now);
      if (irrelevant) {
        await finish(job, 'EXPIRED', irrelevant);
        result.skipped++;
        continue;
      }
      const recipient = recipientFor(job);
      if (!recipient) {
        await release(
          job,
          new Date(now.getTime() + AUTOMATION_POLICY.quotaBackoffMs),
          NO_STAFF_ADDRESS_MESSAGE,
        );
        result.waiting++;
        continue;
      }
      if (!recipient.split(',').every((part) => isEmailAddress(part.trim()))) {
        await finish(
          job,
          'REVIEW_REQUIRED',
          'The recipient address is not a valid email address. Correct it before retrying.',
        );
        result.failed++;
        continue;
      }
      let failure: DeliveryFailure | null = null;
      try {
        const receipt = await transport.send(messageFor(job, recipient, settings));
        if (!receipt.accepted.length)
          throw Object.assign(new Error('Recipient refused'), { code: 'EENVELOPE' });
      } catch (error) {
        failure = classifyDeliveryError(error);
      }
      if (!failure) {
        // Outside the delivery try: if recording fails after the server accepted the message,
        // the job stays PROCESSING and is later held for review instead of being sent again.
        // Unconditional: even if a slow send was meanwhile flagged as interrupted, it was sent.
        await prisma.adminOutbox.update({
          where: { id: job.id },
          data: { status: 'ACCEPTED', sentAt: now, lastError: null, recipient },
        });
        result.sent++;
        continue;
      }
      if (failure.kind === 'quota') {
        await release(
          job,
          new Date(now.getTime() + AUTOMATION_POLICY.quotaBackoffMs),
          failure.message,
        );
        result.waiting++;
        result.stoppedEarly = true;
        break;
      }
      if (failure.kind === 'permanent' || job.attempts >= job.maxAttempts) {
        await finish(job, 'REVIEW_REQUIRED', failure.message);
        result.failed++;
      } else {
        await prisma.adminOutbox.updateMany({
          where: { id: job.id, status: 'PROCESSING' },
          data: {
            status: 'QUEUED',
            claimedAt: null,
            lastError: failure.message,
            nextAttemptAt: new Date(now.getTime() + retryDelayMs(job.attempts)),
          },
        });
        result.retrying++;
      }
      // A sign-in or settings problem affects every job; stop instead of repeating it.
      if (failure.kind === 'configuration') {
        result.stoppedEarly = true;
        break;
      }
    }
  } finally {
    if (!options.transport) transport.close();
  }
  return result;
}
