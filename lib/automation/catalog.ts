import type { AutomationSummary } from './automations';
/**
 * Browser-safe automation vocabulary shared by the outbox, the admin panel and the developer
 * status view. Status values match the existing `zion_admin_outbox` contract, so the admin
 * dashboard, notification bell and analytics keep reading the same rows.
 */
export const AUTOMATION_STATUSES = [
  'QUEUED',
  'PROCESSING',
  'ACCEPTED',
  'REVIEW_REQUIRED',
  'EXPIRED',
] as const;
export type AutomationStatus = (typeof AUTOMATION_STATUSES)[number];

/** ACCEPTED means the mail server accepted the message; it is never sent again. */
export const AUTOMATION_STATUS_LABELS: Record<AutomationStatus, string> = {
  QUEUED: 'Waiting',
  PROCESSING: 'Sending',
  ACCEPTED: 'Sent',
  REVIEW_REQUIRED: 'Failed',
  EXPIRED: 'Skipped',
};

export const AUTOMATION_STATUS_DESCRIPTIONS: Record<AutomationStatus, string> = {
  QUEUED: 'Saved and waiting for its next delivery attempt.',
  PROCESSING: 'A delivery attempt is in progress.',
  ACCEPTED: 'Accepted by the mail server. It will not be sent again.',
  REVIEW_REQUIRED: 'Delivery stopped. Check the error, then retry if appropriate.',
  EXPIRED: 'Not sent because it was no longer timely or relevant.',
};

/**
 * Job types created only by the automation module, not the booking decision notices. The staff
 * calendar jobs accompany a request or decision but stay out of the REQUEST_RECEIVED,
 * RESERVATION_CONFIRMED and CANCEL rows that analytics, the dashboard and the notification bell
 * count.
 */
export const AUTOMATION_ONLY_EVENTS = [
  'INQUIRY_STAFF_ALERT',
  'INQUIRY_ACKNOWLEDGEMENT',
  'BOOKING_REQUEST_STAFF_ALERT',
  'EVENT_REMINDER_7D',
  'EVENT_REMINDER_1D',
  'DAILY_DIGEST',
  'HOLD_REMINDER',
  'BALANCE_REMINDER',
  'BALANCE_AFTER_EVENT',
  'PAYMENT_PROOF_RECEIVED',
  'PAYMENT_PROOF_STAFF_ALERT',
  'PAYMENT_PROOF_WAITING',
  'STAFF_CALENDAR_PENDING',
  'STAFF_CALENDAR_REQUEST',
  'STAFF_CALENDAR_CANCEL',
  // Ocular visits (docs/visits.md); they belong to no booking.
  'VISIT_SCHEDULED',
  'VISIT_RESCHEDULED',
  'VISIT_CANCELLED',
  'VISIT_REMINDER_1D',
  'VISIT_REMINDER_TODAY',
  'VISIT_STAFF_CALENDAR',
  'VISIT_STAFF_CANCEL',
] as const;
export type AutomationOnlyEvent = (typeof AUTOMATION_ONLY_EVENTS)[number];

/**
 * Staff-addressed jobs resolve their recipient again at delivery time, so a changed staff list
 * applies to waiting jobs. Staff calendar jobs are not listed: their ATTENDEE lines name the
 * inboxes chosen when the invitation was created.
 */
export const STAFF_EVENTS: readonly string[] = [
  'INQUIRY_STAFF_ALERT',
  'BOOKING_REQUEST_STAFF_ALERT',
  'DAILY_DIGEST',
  'BALANCE_AFTER_EVENT',
  'PAYMENT_PROOF_STAFF_ALERT',
  'PAYMENT_PROOF_WAITING',
];

/** Staff inboxes: the outbox keeps the comma-joined list in a 255-character recipient column. */
export const STAFF_RECIPIENT_LIMITS = { emails: 5, listLength: 255 } as const;

/** Where the staff inboxes come from, in order of precedence. */
export type StaffRecipientSource = 'settings' | 'environment' | 'sending-account' | 'none';

export const AUTOMATION_JOB_LABELS: Record<string, string> = {
  INQUIRY_STAFF_ALERT: 'New inquiry alert (staff)',
  INQUIRY_ACKNOWLEDGEMENT: 'Inquiry acknowledgement',
  BOOKING_REQUEST_STAFF_ALERT: 'New booking request alert (staff)',
  EVENT_REMINDER_7D: 'Event reminder, one week',
  EVENT_REMINDER_1D: 'Event reminder, one day',
  DAILY_DIGEST: 'Daily staff digest',
  HOLD_REMINDER: 'Payment deadline reminder',
  BALANCE_REMINDER: 'Balance payment reminder',
  BALANCE_AFTER_EVENT: 'Balance still due after the event (staff)',
  PAYMENT_PROOF_RECEIVED: 'Payment screenshot received',
  PAYMENT_PROOF_STAFF_ALERT: 'Payment screenshot to verify (staff)',
  PAYMENT_PROOF_WAITING: 'Payment screenshot still waiting (staff)',
  CLIENT_PHOTO_REQUEST: 'Photo requested by staff',
  CLIENT_PHOTO_RETAKE: 'New photo asked for',
  CLIENT_PHOTO_REMINDER: 'Photo reminder, three days before',
  STAFF_CALENDAR_PENDING: 'Calendar event, pending request (staff)',
  STAFF_CALENDAR_REQUEST: 'Calendar invitation (staff)',
  STAFF_CALENDAR_CANCEL: 'Calendar cancellation (staff)',
  VISIT_SCHEDULED: 'Ocular visit scheduled',
  VISIT_RESCHEDULED: 'Ocular visit moved',
  VISIT_CANCELLED: 'Ocular visit cancelled',
  VISIT_REMINDER_1D: 'Visit reminder, one day',
  VISIT_REMINDER_TODAY: 'Visit reminder, same day',
  VISIT_STAFF_CALENDAR: 'Visit calendar event (staff)',
  VISIT_STAFF_CANCEL: 'Visit calendar cancellation (staff)',
  REQUEST_RECEIVED: 'Booking request received',
  REQUEST_APPROVED: 'Booking request approved',
  HOLD_EXTENDED: 'Payment deadline extended',
  HOLD_EXPIRED: 'Payment deadline passed',
  PAYMENT_VERIFIED: 'Payment verified',
  PAYMENT_REJECTED: 'Payment screenshot not accepted',
  REJECT: 'Booking request declined',
  REVIEW_POLICY: 'Booking re-reviewed under policy',
  RESERVATION_CONFIRMED: 'Reservation confirmed',
  CANCEL: 'Reservation cancelled',
  COMPLETE: 'Event completed',
  CASH_RECEIPT: 'Cash receipt recorded',
  RECEIPT_VOIDED: 'Cash receipt voided',
  TEAM_INVITATION: 'Admin panel invitation',
};

export function automationJobLabel(event: string) {
  return AUTOMATION_JOB_LABELS[event] ?? event.replaceAll('_', ' ').toLowerCase();
}

export function isAutomationStatus(value: string): value is AutomationStatus {
  return (AUTOMATION_STATUSES as readonly string[]).includes(value);
}

/** Admin panel payload; recipients and errors are already masked and sanitized by the server. */
export type AutomationJobView = {
  id: string;
  event: string;
  label: string;
  recipient: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
  calendar: 'REQUEST' | 'CANCEL' | null;
  retryable: boolean;
};

export type AutomationOverview = {
  /** Each automation as "When … → Do …", with its switch and results (lib/automation/automations.ts). */
  automations: AutomationSummary[];
  emailConfigured: boolean;
  cronConfigured: boolean;
  /** The current staff inboxes, masked, and where they come from. */
  staffRecipients: { source: StaffRecipientSource; masked: string[] };
  counts: Record<AutomationStatus, number>;
  dueNow: number;
  lastRun: { at: string; trigger: string; sent: number; failed: number } | null;
  jobs: AutomationJobView[];
  filter: AutomationStatus | null;
};
