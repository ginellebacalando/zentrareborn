import 'server-only';

import { prisma } from '@/lib/prisma';
import { AUTOMATION_POLICY } from './config';
import { processDueJobs, type DeliveryRunResult } from './processor';
import {
  scheduleDailyDigest,
  scheduleEventReminders,
  sweepInquiryNotifications,
} from './scheduler';
import type { MailTransport } from './transport';

export type AutomationTrigger = 'cron' | 'cli' | 'admin';

/** Counts only; safe to return from the cron endpoint and to log. */
export type AutomationRunSummary = {
  scheduled: { inquiries: number; reminders: number; digest: number };
  delivery: DeliveryRunResult;
  failedSteps: string[];
};

export const LAST_RUN_STATE_KEY = 'last-run';

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
  const reminders = await step('reminders', failedSteps, () => scheduleEventReminders(now));
  const digest = await step('digest', failedSteps, () => scheduleDailyDigest(now));
  const delivery = await processDueJobs({
    now,
    transport: options.transport,
    limit: AUTOMATION_POLICY.scheduledBatch,
    timeBudgetMs: AUTOMATION_POLICY.scheduledTimeBudgetMs,
  });
  const summary = { scheduled: { inquiries, reminders, digest }, delivery, failedSteps };
  await step('record', failedSteps, async () => {
    const detail = {
      trigger: options.trigger,
      sent: delivery.sent,
      failed: delivery.failed,
      retrying: delivery.retrying,
      waiting: delivery.waiting,
      scheduled: inquiries + reminders + digest,
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
