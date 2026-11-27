import { money, paidTotal } from '@/lib/admin/domain';
import { displayStatus, type DisplayStatus } from '@/lib/admin/dashboard-status';
import type { Booking, Policy } from './types';

/**
 * What the booking page shows and offers (docs/admin-design.md, "Booking page"). Pure functions:
 * the booking rules themselves stay in lib/admin/service.ts, which re-checks every action; these
 * only decide which actions to offer and how to word the booking's state in one line.
 */
export type BookingAction =
  | 'VERIFY'
  | 'FLAG'
  | 'APPROVE'
  | 'REJECT'
  | 'REVIEW_POLICY'
  | 'CONFIRM'
  | 'CANCEL'
  | 'COMPLETE'
  | 'EXTEND_HOLD';

/** An action that changes the booking; every one asks for a decision note in a dialog. */
export type DecisionAction = {
  action: BookingAction;
  label: string;
  /** The dialog's one sentence on what happens next. */
  summary: string;
  destructive?: boolean;
  /** Why the server would refuse it right now; shown in the menu, never as a disabled button. */
  unavailable?: string | null;
};

/** The main action of the page header: a decision, or a step on the Payments tab. */
export type MainAction =
  | { kind: 'decision'; decision: DecisionAction }
  | { kind: 'payments'; label: 'Verify payment' | 'Record payment' };

export type BookingOffer = {
  main: MainAction | null;
  /** A second button beside the main one (Decline, Extend deadline). */
  secondary: DecisionAction | null;
  /** Decisions for the "More" menu, in order; destructive ones last. */
  more: DecisionAction[];
};

const DECISIONS: Record<BookingAction, Omit<DecisionAction, 'action' | 'unavailable'>> = {
  APPROVE: {
    label: 'Approve',
    summary:
      'Approving holds the date until the payment deadline and emails the client how to pay.',
  },
  REJECT: {
    label: 'Decline',
    summary: 'The request is closed and the client is told by email.',
    destructive: true,
  },
  EXTEND_HOLD: {
    label: 'Extend deadline',
    summary: 'The client gets a new payment deadline, never after the event starts.',
  },
  CONFIRM: {
    label: 'Confirm',
    summary: 'The date is secured and the client gets the confirmation.',
  },
  COMPLETE: {
    label: 'Complete event',
    summary: 'The booking is closed as completed.',
  },
  CANCEL: {
    label: 'Cancel booking',
    summary: 'The record and its history are kept, and the date is released.',
    destructive: true,
  },
  VERIFY: {
    label: 'Clear flag',
    summary: 'The contact is marked as verified and the flag is removed.',
  },
  FLAG: {
    label: 'Flag as suspicious',
    summary: 'A flagged request cannot be approved or confirmed until the flag is cleared.',
    destructive: true,
  },
  REVIEW_POLICY: {
    label: 'Re-review under current policy',
    summary: 'The request is checked again under the current venue policy.',
  },
};

function decision(action: BookingAction, unavailable?: string | null): DecisionAction {
  return { action, ...DECISIONS[action], unavailable: unavailable ?? null };
}

export function hasPassed(moment: string | Date) {
  return new Date(moment).getTime() <= Date.now();
}

/** What the client still owes to confirm the booking under its payment rule. */
function confirmationDue(b: Booking) {
  const required = b.paymentRule === 'FULL_PAYMENT_REQUIRED' ? b.totalCents : b.depositCents;
  return Math.max(0, required - paidTotal(b.payments));
}

/**
 * The actions for the booking's current status (the same rules as before the redesign):
 * under review → Approve and Decline; waiting for payment → record or verify the payment and
 * extend the deadline; confirmed → complete the event once it has ended and is paid. Editing,
 * flags, the policy re-review and cancelling go in "More".
 */
export function bookingOffer(
  b: Booking,
  policy: Policy | undefined,
  confirmHint: string | null,
): BookingOffer {
  const offer: BookingOffer = { main: null, secondary: null, more: [] };
  if (['CANCELLED', 'COMPLETED'].includes(b.reservation)) return offer;
  const requested = b.reservation === 'REQUESTED';
  const approved = b.approval === 'APPROVED';
  const flagged = b.verification === 'FLAGGED';
  const paid = paidTotal(b.payments);
  const waitingProof = (b.paymentProofs ?? []).some((proof) => proof.status === 'SUBMITTED');
  if (requested && !approved) {
    offer.main = {
      kind: 'decision',
      decision: decision(
        'APPROVE',
        flagged
          ? 'Clear the suspicious flag first.'
          : b.totalCents < 1
            ? 'Set the price with Edit details first.'
            : null,
      ),
    };
    if (b.approval === 'PENDING') offer.secondary = decision('REJECT');
  } else if (requested && approved) {
    if (!confirmHint) offer.main = { kind: 'decision', decision: decision('CONFIRM') };
    else
      offer.main = {
        kind: 'payments',
        label: waitingProof ? 'Verify payment' : 'Record payment',
      };
    if (b.holdExpiresAt) offer.secondary = decision('EXTEND_HOLD');
  } else if (b.reservation === 'CONFIRMED') {
    const ended = hasPassed(b.endsAt);
    if (paid < b.totalCents)
      offer.main = { kind: 'payments', label: waitingProof ? 'Verify payment' : 'Record payment' };
    else if (ended) offer.main = { kind: 'decision', decision: decision('COMPLETE') };
  }
  if (requested && policy && b.policyVersion !== policy.version)
    offer.more.push(
      decision(
        'REVIEW_POLICY',
        !policy.reviewed ? 'Review the venue policy in Settings first.' : null,
      ),
    );
  if (b.reservation !== 'CONFIRMED') offer.more.push(decision(flagged ? 'VERIFY' : 'FLAG'));
  offer.more.push(decision('CANCEL'));
  return offer;
}

/** The package name without its guest count: "Zion Essential (100 guests)" → "Zion Essential". */
export function packageShortName(packageName: string) {
  return packageName.replace(/\s*\(\d+\s+guests?\)\s*$/i, '').trim() || packageName;
}

/** "312 guests (package includes 100, 212 extra)", from the package's published guest count. */
export function guestsLabel(b: Booking) {
  const included = Number(/\((\d+)\s+guests?\)\s*$/i.exec(b.packageName)?.[1]);
  const total = `${b.guests} ${b.guests === 1 ? 'guest' : 'guests'}`;
  if (!included || b.guests <= included) return total;
  return `${total} (package includes ${included}, ${b.guests - included} extra)`;
}

/** The status shown once, in the page header. */
export function bookingStatus(b: Booking): DisplayStatus {
  return displayStatus(b);
}

/**
 * The booking's next step in one line, with the longer explanation for the help tooltip.
 * `when` formats a moment in the admin's date format.
 */
export function nextStep(
  b: Booking,
  when: (value: string | Date) => string,
  balanceDue: Date | null,
): { line: string; help: string } {
  const paid = paidTotal(b.payments);
  const waitingProof = (b.paymentProofs ?? []).some((proof) => proof.status === 'SUBMITTED');
  if (b.reservation === 'CANCELLED' || b.approval === 'REJECTED')
    return {
      line: `${b.approval === 'REJECTED' && b.reservation !== 'CANCELLED' ? 'Declined' : 'Cancelled'}${b.decisionReason ? `: ${b.decisionReason}` : '.'}`,
      help: 'Closed bookings keep their record and history. To book this date again, create a new request.',
    };
  if (b.reservation === 'COMPLETED')
    return { line: 'Completed.', help: 'The event took place and the booking is closed.' };
  if (b.reservation === 'CONFIRMED') {
    if (paid >= b.totalCents)
      return hasPassed(b.endsAt)
        ? {
            line: 'The event has ended. Complete it to close the booking.',
            help: 'Completing a fully paid event closes the booking; the automation also does this the morning after.',
          }
        : {
            line: 'Confirmed and paid in full.',
            help: 'Nothing is due. The client gets reminders before the event.',
          };
    const overdue = balanceDue !== null && hasPassed(balanceDue);
    return {
      line: `Confirmed. Balance of ${money(b.totalCents - paid)} due ${balanceDue ? when(balanceDue) : 'before the event'}${overdue ? ' (overdue)' : ''}.`,
      help: "Zion's terms ask for full payment before the event. Record cash in Payments, or verify the client's GCash or bank screenshot there.",
    };
  }
  if (b.approval !== 'APPROVED')
    return {
      line: 'Waiting for your decision.',
      help: 'Approving holds the date until the payment deadline and emails the client how to pay. Declining closes the request.',
    };
  if (waitingProof)
    return {
      line: 'A payment screenshot is waiting. Check it against your records, then verify or reject it.',
      help: 'The date stays held while a screenshot waits, even past the deadline. Verifying records the payment and confirms the booking when it meets the rule.',
    };
  if (!b.holdExpiresAt)
    return {
      line: 'Approved. Waiting for the payment that confirms it.',
      help: 'Recording the payment confirms the booking automatically.',
    };
  if (hasPassed(b.holdExpiresAt))
    return paid > 0
      ? {
          line: 'The payment deadline passed with a partial payment. Extend the deadline or cancel the booking.',
          help: 'A partly paid hold is never released automatically.',
        }
      : {
          line: 'The payment deadline passed. The date is released within minutes unless you extend it.',
          help: 'Unpaid holds are released by the next scheduled run.',
        };
  return {
    line: `Waiting for payment until ${when(b.holdExpiresAt)}. The date is released automatically if unpaid.`,
    help: `Recording ${money(confirmationDue(b))} (cash, or a verified GCash or bank screenshot) confirms the booking.`,
  };
}
