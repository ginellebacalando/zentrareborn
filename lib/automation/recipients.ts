import 'server-only';

import { readStaffNotificationEmails } from '@/lib/admin/preferences';
import { prisma } from '@/lib/prisma';
import type { StaffRecipientSource } from './catalog';
import { serverStaffRecipients } from './config';
import type { OutboxDb } from './outbox';

export type StaffRecipients = {
  /** Comma-separated, as stored in the outbox `recipient` column; empty when none resolves. */
  list: string;
  emails: string[];
  source: StaffRecipientSource;
};

/**
 * The inboxes for staff alerts, the daily digest and staff calendar invitations: the list saved
 * in Settings > Communications when it has addresses, else STAFF_NOTIFICATION_EMAIL, else the
 * sending account. Inside a transaction pass its client (see readStaffNotificationEmails).
 */
export async function resolveStaffRecipients(db: OutboxDb = prisma): Promise<StaffRecipients> {
  const saved = await readStaffNotificationEmails(db);
  const { emails, source } = saved.length
    ? { emails: saved, source: 'settings' as const }
    : serverStaffRecipients();
  return { list: emails.join(', '), emails, source };
}
