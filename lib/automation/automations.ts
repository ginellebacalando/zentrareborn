/**
 * The automations a super administrator sees on the Automation page, each as "When [trigger] → Do
 * [action]" (docs/automation.md). Every one is a group of outbox events (lib/automation/catalog.ts
 * AUTOMATION_JOB_LABELS). Reminders, staff alerts and the digest can be switched off: their emails
 * are then skipped at delivery (lib/automation/switches.ts). The steps of the booking flow itself
 * always run, because clients and staff depend on them. Pure data, safe in browser code.
 */
export type AutomationDefinition = {
  key: string;
  when: string;
  action: string;
  timing: 'instant' | 'scheduled';
  /** Outbox events this automation sends. */
  events: readonly string[];
  /** False for steps the booking flow depends on; `essential` says why. */
  canSwitchOff: boolean;
  essential?: string;
  /** Shown when the automation is opened. */
  details: string;
};

export const AUTOMATIONS: readonly AutomationDefinition[] = [
  {
    key: 'booking-decision',
    when: 'A booking request arrives or is decided',
    action: 'Email the client the outcome and the next step',
    timing: 'instant',
    events: ['REQUEST_RECEIVED', 'REQUEST_APPROVED', 'HOLD_EXTENDED', 'REJECT', 'REVIEW_POLICY'],
    canSwitchOff: false,
    essential: 'Clients learn whether their date is held and how to pay from this email.',
    details:
      'Sent when a website request is received, approved automatically or by staff, given more time to pay, declined, or re-reviewed under a new policy. Approved requests include the payment deadline and the private payment page link.',
  },
  {
    key: 'booking-staff-alert',
    when: 'A booking request arrives',
    action: 'Alert staff and add a [Pending] event to their calendars',
    timing: 'instant',
    events: ['BOOKING_REQUEST_STAFF_ALERT', 'STAFF_CALENDAR_PENDING'],
    canSwitchOff: true,
    details:
      'Goes to the staff notification inboxes in Settings. The [Pending] calendar event becomes the reservation once payment is confirmed, and is removed if the request is declined or cancelled.',
  },
  {
    key: 'payment-proof-received',
    when: 'A client uploads a payment screenshot',
    action: 'Confirm receipt to the client',
    timing: 'instant',
    events: ['PAYMENT_PROOF_RECEIVED'],
    canSwitchOff: false,
    essential: 'Tells the client the screenshot arrived and is waiting for verification.',
    details:
      'Sent right after a GCash or bank transfer screenshot is uploaded on the private payment page.',
  },
  {
    key: 'payment-proof-staff-alert',
    when: 'A client uploads a payment screenshot',
    action: 'Ask staff to verify it',
    timing: 'instant',
    events: ['PAYMENT_PROOF_STAFF_ALERT'],
    canSwitchOff: true,
    details:
      'Staff open Payments or the booking to compare the screenshot with the venue’s records, then verify or reject it.',
  },
  {
    key: 'payment-proof-waiting',
    when: 'A payment screenshot has waited more than a day',
    action: 'Remind staff to verify or reject it',
    timing: 'scheduled',
    events: ['PAYMENT_PROOF_WAITING'],
    canSwitchOff: true,
    details:
      'Sent once for each screenshot. While a screenshot waits, its date stays held, so an unanswered one keeps the date from other clients.',
  },
  {
    key: 'payment-outcome',
    when: 'A payment is verified, rejected or recorded',
    action: 'Email the client the receipt, confirmation and calendar invite',
    timing: 'instant',
    events: [
      'PAYMENT_VERIFIED',
      'PAYMENT_REJECTED',
      'RESERVATION_CONFIRMED',
      'CASH_RECEIPT',
      'RECEIPT_VOIDED',
      'STAFF_CALENDAR_REQUEST',
    ],
    canSwitchOff: false,
    essential: 'Confirms the reservation and gives the client their receipt.',
    details:
      'Covers verified and rejected screenshots, cash recorded at the venue, voided receipts and the confirmed reservation with its calendar invitation for the client and staff.',
  },
  {
    key: 'booking-cancelled',
    when: 'A reservation is cancelled',
    action: 'Tell the client and remove the calendar events',
    timing: 'instant',
    events: ['CANCEL', 'STAFF_CALENDAR_CANCEL'],
    canSwitchOff: false,
    essential: 'Keeps the client and every calendar in step with the cancellation.',
    details: 'Sends the cancellation notice and a calendar update that removes the event.',
  },
  {
    key: 'visit-change',
    when: 'An ocular visit is scheduled, moved or cancelled',
    action: 'Email the visitor and update staff calendars',
    timing: 'instant',
    events: [
      'VISIT_SCHEDULED',
      'VISIT_RESCHEDULED',
      'VISIT_CANCELLED',
      'VISIT_STAFF_CALENDAR',
      'VISIT_STAFF_CANCEL',
    ],
    canSwitchOff: false,
    essential: 'Visitors need the time, directions and their link to reschedule or cancel.',
    details:
      'The visitor receives a confirmation with a calendar invitation and a private link to move or cancel the visit; staff calendars follow every change.',
  },
  {
    key: 'inquiry-acknowledgement',
    when: 'Someone sends an inquiry',
    action: 'Email them an acknowledgement',
    timing: 'instant',
    events: ['INQUIRY_ACKNOWLEDGEMENT'],
    canSwitchOff: true,
    details:
      'Confirms that the message from the Contact page or Zeni arrived and says when to expect a reply.',
  },
  {
    key: 'inquiry-staff-alert',
    when: 'Someone sends an inquiry',
    action: 'Alert staff',
    timing: 'instant',
    events: ['INQUIRY_STAFF_ALERT'],
    canSwitchOff: true,
    details: 'Sends the inquiry to the staff notification inboxes so someone can answer it.',
  },
  {
    key: 'team-invitation',
    when: 'A super administrator invites a team member',
    action: 'Email the invitation link',
    timing: 'instant',
    events: ['TEAM_INVITATION'],
    canSwitchOff: false,
    essential: 'The invited person needs the link to set a password.',
    details: 'The link works once, for three days, and only for the invited address.',
  },
  {
    key: 'payment-reminder',
    when: 'A payment deadline is a day away',
    action: 'Remind the client to pay',
    timing: 'scheduled',
    events: ['HOLD_REMINDER'],
    canSwitchOff: true,
    details: 'Checked every 10 minutes. Sent once per held booking that is still unpaid.',
  },
  {
    key: 'hold-expired',
    when: 'A payment deadline passes',
    action: 'Release the date and tell the client',
    timing: 'scheduled',
    events: ['HOLD_EXPIRED'],
    canSwitchOff: false,
    essential: 'The date opens for other clients, so the client must know their hold ended.',
    details: 'Checked every 10 minutes. Unpaid holds are released and the client is told.',
  },
  {
    key: 'balance-reminder',
    when: 'The full payment is due in a week or a day',
    action: 'Remind the client of the balance',
    timing: 'scheduled',
    events: ['BALANCE_REMINDER'],
    canSwitchOff: true,
    details: 'Checked every 10 minutes for confirmed reservations with a balance.',
  },
  {
    key: 'event-reminder',
    when: 'An event is a week or a day away',
    action: 'Remind the client',
    timing: 'scheduled',
    events: ['EVENT_REMINDER_7D', 'EVENT_REMINDER_1D'],
    canSwitchOff: true,
    details: 'Checked every 10 minutes for confirmed reservations.',
  },
  {
    key: 'visit-reminder',
    when: 'An ocular visit is tomorrow or today',
    action: 'Remind the visitor',
    timing: 'scheduled',
    events: ['VISIT_REMINDER_1D', 'VISIT_REMINDER_TODAY'],
    canSwitchOff: true,
    details: 'Sent the day before and on the morning of the visit.',
  },
  {
    key: 'event-completed',
    when: 'A fully paid event has passed',
    action: 'Mark it completed and thank the client',
    timing: 'scheduled',
    events: ['COMPLETE'],
    canSwitchOff: false,
    essential: 'Completes the booking record; the thank-you goes with it.',
    details: 'Checked every 10 minutes after the event ends.',
  },
  {
    key: 'balance-after-event',
    when: 'An event has passed with a balance still due',
    action: 'Alert staff',
    timing: 'scheduled',
    events: ['BALANCE_AFTER_EVENT'],
    canSwitchOff: true,
    details: 'Lets staff follow up on unpaid balances after the event.',
  },
  {
    key: 'daily-digest',
    when: 'Every morning at 7',
    action: 'Send staff the daily digest',
    timing: 'scheduled',
    events: ['DAILY_DIGEST'],
    canSwitchOff: true,
    details:
      'Today’s and tomorrow’s events, today’s visits, new inquiries, requests under review, payments waiting and any failed emails.',
  },
];

export const AUTOMATION_KEYS = AUTOMATIONS.map((automation) => automation.key);

/** The automation an outbox event belongs to. */
export function automationForEvent(event: string) {
  return AUTOMATIONS.find((automation) => automation.events.includes(event)) ?? null;
}

export type AutomationSummary = AutomationDefinition & {
  enabled: boolean;
  lastRanAt: string | null;
  sent: number;
  failed: number;
  waiting: number;
};
