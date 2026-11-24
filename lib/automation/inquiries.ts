import 'server-only';

import { AUTOMATION_POLICY, applicationUrl, staffRecipients } from './config';
import { enqueueJobs, type OutboxDb } from './outbox';
import { inquiryAcknowledgement, inquiryStaffAlert } from './templates';
import { ONE_DAY_MS } from './time';

/** The inquiry fields the notifications need; every inquiry path can provide them. */
export type InquiryNotificationSource = {
  id: string;
  inquiryReference: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  eventInterest: string | null;
  packageInterest: string | null;
  preferredContactTime: string | null;
  sourcePage: string;
  message: string;
  submittedAt: Date;
};

export const inquiryNotificationSelect = {
  id: true,
  inquiryReference: true,
  fullName: true,
  email: true,
  phoneNumber: true,
  eventInterest: true,
  packageInterest: true,
  preferredContactTime: true,
  sourcePage: true,
  message: true,
  submittedAt: true,
} as const;

export function inquiryJobKey(inquiryId: string, audience: 'staff' | 'client') {
  return `inquiry:${inquiryId}:${audience}`;
}

/**
 * Enqueues the staff alert and the client acknowledgement for one inquiry. Call it inside the
 * transaction that creates the inquiry; repeated calls are harmless (idempotency keys).
 * Returns the ids of jobs ready for immediate delivery.
 */
export async function enqueueInquiryReceived(
  db: OutboxDb,
  inquiry: InquiryNotificationSource,
  now = new Date(),
) {
  const email = inquiry.email.trim().toLowerCase();
  const since = new Date(now.getTime() - ONE_DAY_MS);
  const [alertsToday, acknowledgementsToRecipient] = await Promise.all([
    db.adminOutbox.count({
      where: {
        event: 'INQUIRY_STAFF_ALERT',
        status: { not: 'EXPIRED' },
        createdAt: { gte: since },
      },
    }),
    db.adminOutbox.count({
      where: {
        event: 'INQUIRY_ACKNOWLEDGEMENT',
        status: { not: 'EXPIRED' },
        recipient: email,
        createdAt: { gte: since },
      },
    }),
  ]);
  const appUrl = applicationUrl();
  const alert = inquiryStaffAlert({
    reference: inquiry.inquiryReference,
    fullName: inquiry.fullName,
    email,
    phoneNumber: inquiry.phoneNumber,
    eventInterest: inquiry.eventInterest,
    packageInterest: inquiry.packageInterest,
    preferredContactTime: inquiry.preferredContactTime,
    sourcePage: inquiry.sourcePage,
    message: inquiry.message,
    submittedAt: inquiry.submittedAt,
    inboxUrl: appUrl ? `${appUrl}/admin/inquiries` : null,
  });
  const acknowledgement = inquiryAcknowledgement({
    reference: inquiry.inquiryReference,
    fullName: inquiry.fullName,
  });
  const acknowledgementExpiresAt = new Date(
    inquiry.submittedAt.getTime() + AUTOMATION_POLICY.acknowledgementTtlMs,
  );
  return enqueueJobs(
    db,
    [
      {
        idempotencyKey: inquiryJobKey(inquiry.id, 'staff'),
        event: 'INQUIRY_STAFF_ALERT',
        recipient: staffRecipients(),
        replyTo: email,
        ...alert,
        skipReason:
          alertsToday >= AUTOMATION_POLICY.staffAlertsPerDay
            ? 'Not sent individually: the daily limit for inquiry alerts was reached. The inquiry is in the admin inbox and the daily digest.'
            : undefined,
      },
      {
        idempotencyKey: inquiryJobKey(inquiry.id, 'client'),
        event: 'INQUIRY_ACKNOWLEDGEMENT',
        recipient: email,
        ...acknowledgement,
        expiresAt: acknowledgementExpiresAt,
        skipReason:
          acknowledgementsToRecipient >= AUTOMATION_POLICY.acknowledgementsPerRecipientPerDay
            ? 'Not sent: this address already received the maximum number of acknowledgements today.'
            : acknowledgementExpiresAt <= now
              ? 'Not sent: the inquiry is too old for an automatic acknowledgement.'
              : undefined,
      },
    ],
    now,
  );
}
