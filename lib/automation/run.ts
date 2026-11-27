import 'server-only';

import {
  completeFinishedEvents,
  expireUnpaidHolds,
  remindWaitingProofs,
  scheduleBalanceReminders,
  scheduleHoldReminders,
} from '@/lib/admin/booking-automation';
import { prisma } from '@/lib/prisma';
import { AUTOMATION_POLICY, LAST_RUN_STATE_KEY } from './config';
import { processDueJobs, type DeliveryRunResult } from './processor';
import {
  scheduleDailyDigest,
  scheduleEventReminders,
  sweepInquiryNotifications,
} from './scheduler';
import type { MailTransport } from './transport';
import { scheduleVisitReminders } from './visits';

export type AutomationTrigger = 'cron' | 'cli' | 'admin';

/** Counts only; safe to return from the cron endpoint and to log. */
export type AutomationRunSummary = {
  scheduled: {
    inquiries: number;
    reminders: number;
    digest: number;
    /** Booking automation: holds released, payment reminders, finished events handled. */
    expiredHolds: number;
    holdReminders: number;
    /** Reminders to pay the rest of a confirmed booking before the full-payment date. */
    balanceReminders: number;
    /** Staff reminders for payment screenshots waiting more than a day. */
    proofReminders: number;
    completedEvents: number;
    /** Ocular visit reminders: the day before and on the morning (docs/visits.md). */
    visitReminders: number;
  };
  delivery: DeliveryRunResult;
  failedSteps: string[];
};

async function step(name: string, failed: string[], work: () => Promise<number>) {
  try {
    return await work();
  } catch (error) {
    // One failing step (for example a missing table) must not block delivery of other jobs.
    console.error(
      `Automation step "${name}" failed:`,
      error instanceof Error ? error.name : 'unknown',
    );
    failed.push(name);
    return 0;
  }
}

/** The scheduled job: prepare due notifications idempotently, then deliver due jobs. */
export async function runAutomation(options: {
  trigger: AutomationTrigger;
  now?: Date;
  transport?: MailTransport;
}): Promise<AutomationRunSummary> {
  const now = options.now ?? new Date();
  const failedSteps: string[] = [];
  const inquiries = await step('inquiries', failedSteps, () => sweepInquiryNotifications(now));
  // Booking automation first, so the reminders and the digest see the released dates.
  const expiredHolds = await step('holds', failedSteps, () => expireUnpaidHolds(now));
  const holdReminders = await step('hold-reminders', failedSteps, () => scheduleHoldReminders(now));
  const balanceReminders = await step('balance-reminders', failedSteps, () =>
    scheduleBalanceReminders(now),
  );
  const proofReminders = await step('proof-reminders', failedSteps, () => remindWaitingProofs(now));
  const completedEvents = await step('completion', failedSteps, () => completeFinishedEvents(now));
  const reminders = await step('reminders', failedSteps, () => scheduleEventReminders(now));
  const visitReminders = await step('visit-reminders', failedSteps, () =>
    scheduleVisitReminders(now),
  );
  const digest = await step('digest', failedSteps, () => scheduleDailyDigest(now));
  const delivery = await processDueJobs({
    now,
    transport: options.transport,
    limit: AUTOMATION_POLICY.scheduledBatch,
    timeBudgetMs: AUTOMATION_POLICY.scheduledTimeBudgetMs,
  });
  const summary = {
    scheduled: {
      inquiries,
      reminders,
      digest,
      expiredHolds,
      holdReminders,
      balanceReminders,
      proofReminders,
      completedEvents,
      visitReminders,
    },
    delivery,
    failedSteps,
  };
  await step('record', failedSteps, async () => {
    const detail = {
      trigger: options.trigger,
      sent: delivery.sent,
      failed: delivery.failed,
      retrying: delivery.retrying,
      waiting: delivery.waiting,
      scheduled:
        inquiries +
        reminders +
        digest +
        holdReminders +
        balanceReminders +
        proofReminders +
        visitReminders,
      bookingsChanged: expiredHolds + completedEvents,
    };
    await prisma.automationState.upsert({
      where: { key: LAST_RUN_STATE_KEY },
      create: { key: LAST_RUN_STATE_KEY, at: now, detail },
      update: { at: now, detail },
    });
    return 1;
  });
  return summary;
}
