import 'server-only';

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { enqueueBookingNotice } from '@/lib/automation/bookings';
import { AUTOMATION_POLICY, applicationUrl } from '@/lib/automation/config';
import { enqueueJobs, type NewAutomationJob } from '@/lib/automation/outbox';
import { offeredPaymentMethods, paymentPageAction } from '@/lib/automation/payment-proofs';
import { howToPay, preferredPaymentMethod } from '@/lib/booking-payment-choice';
import { resolveStaffRecipients } from '@/lib/automation/recipients';
import {
  balanceAfterEventAlert,
  balanceReminder,
  holdReminder,
  paymentProofWaitingAlert,
} from '@/lib/automation/templates';
import { manilaDay, manilaDayStart, manilaHour, ONE_DAY_MS } from '@/lib/automation/time';
import { balanceDueDate } from './booking-rules';
import { eventDate, paidTotal } from './domain';
import { PAYMENT_METHOD_LABELS } from './payment-accounts';
import { readBookingRules } from './preferences';
import { policy } from './service';

/**
 * The scheduled half of the booking automation (docs/booking-automation.md). Each run releases
 * unpaid holds, reminds clients before their payment deadline and completes finished events, so
 * staff only record payments and decide unusual requests. Every change rechecks the booking under
 * its row lock, writes the audit trail as the automation and sends the usual notices.
 */

/** How the audit trail and the booking record name decisions this module makes on its own. */
const AUTOMATION_ACTOR = 'booking-automation';
const AUTOMATION_NAME = 'Booking automation';
/** Bookings changed per run and step; the next run continues with the rest. */
const BATCH = 50;
const REMINDER_LEAD_MS = ONE_DAY_MS;
/** No reminder when the client heard about the deadline this recently (a short hold). */
const QUIET_AFTER_NOTICE_MS = ONE_DAY_MS / 2;
const HOLD_NOTICES = ['REQUEST_RECEIVED', 'REQUEST_APPROVED', 'HOLD_EXTENDED'];
/** Balance reminders go out this long before the full-payment date, then again a day before. */
const BALANCE_REMINDER_LEAD_MS = 7 * ONE_DAY_MS;
/** No balance reminder right after the client heard from us about a payment. */
const BALANCE_NOTICES = [
  'RESERVATION_CONFIRMED',
  'CASH_RECEIPT',
  'PAYMENT_VERIFIED',
  'PAYMENT_REJECTED',
];
/** Finished events older than this are left to staff, so old balances never crowd the batch. */
const COMPLETION_WINDOW_DAYS = 30;

const bookingWithPayments = { payments: true, contracts: true } as const;

async function auditAutomation(db: Prisma.TransactionClient, description: string) {
  await db.auditLog.create({
    data: {
      userId: null,
      userName: AUTOMATION_NAME,
      userRole: 'SYSTEM',
      action: 'UPDATE',
      module: 'Bookings',
      description,
      status: 'SUCCESS',
      source: 'zion-admin',
    },
  });
}

/**
 * Releases held dates whose payment deadline passed without any payment: the request is
 * cancelled, the client and the staff calendars are told, and the date opens for other clients.
 * A booking with a partial payment, or with a payment screenshot waiting for staff, is left to
 * staff, who can verify it, extend the deadline or cancel the booking.
 */
export async function expireUnpaidHolds(now = new Date()) {
  const due = await prisma.adminBooking.findMany({
    where: {
      reservation: 'REQUESTED',
      approval: 'APPROVED',
      holdExpiresAt: { lte: now },
      payments: { none: { voidedAt: null } },
      paymentProofs: { none: { status: 'SUBMITTED' } },
    },
    orderBy: { holdExpiresAt: 'asc' },
    take: BATCH,
    select: { id: true },
  });
  let released = 0;
  for (const { id } of due) {
    const ids = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM zion_admin_bookings WHERE id = ${id} FOR UPDATE`;
      const b = await tx.adminBooking.findUniqueOrThrow({
        where: { id },
        include: bookingWithPayments,
      });
      const waitingProofs = await tx.adminPaymentProof.count({
        where: { bookingId: id, status: 'SUBMITTED' },
      });
      // Rechecked under the lock: a payment, a new deadline or a decision may have just landed.
      if (
        waitingProofs > 0 ||
        b.reservation !== 'REQUESTED' ||
        b.approval !== 'APPROVED' ||
        !b.holdExpiresAt ||
        b.holdExpiresAt > now ||
        paidTotal(b.payments) > 0
      )
        return null;
      const updated = await tx.adminBooking.update({
        where: { id },
        data: {
          reservation: 'CANCELLED',
          decisionReason:
            'The payment deadline passed without a payment, so the date was released.',
          revision: { increment: 1 },
          updatedBy: AUTOMATION_ACTOR,
        },
        include: bookingWithPayments,
      });
      await auditAutomation(
        tx,
        `Released ${b.reference}: its payment deadline (${eventDate(b.holdExpiresAt)}) passed without a payment.`,
      );
      const p = await policy(tx);
      return enqueueBookingNotice(tx, {
        booking: updated,
        event: 'HOLD_EXPIRED',
        paid: 0,
        instructions: p.cashInstructions,
        staffCalendar: 'EXPIRED',
        now,
      });
    });
    if (ids) released += 1;
  }
  return released;
}

/**
 * One reminder to pay, a day before each deadline. It is skipped when the client heard about the
 * deadline within the last twelve hours (a short hold), and its key includes the deadline, so an
 * extended deadline gets its own reminder.
 */
export async function scheduleHoldReminders(now = new Date()) {
  const held = await prisma.adminBooking.findMany({
    where: {
      reservation: 'REQUESTED',
      approval: 'APPROVED',
      holdExpiresAt: { gt: now, lte: new Date(now.getTime() + REMINDER_LEAD_MS) },
      // A client who sent a payment screenshot is waiting for staff, not for a reminder.
      paymentProofs: { none: { status: 'SUBMITTED' } },
    },
    orderBy: { holdExpiresAt: 'asc' },
    take: 100,
    select: {
      id: true,
      reference: true,
      clientName: true,
      email: true,
      eventType: true,
      packageName: true,
      guests: true,
      startsAt: true,
      endsAt: true,
      holdExpiresAt: true,
      totalCents: true,
      depositCents: true,
      paymentRule: true,
      notes: true,
      payments: { select: { amountCents: true, voidedAt: true } },
    },
  });
  if (!held.length) return 0;
  const notices = await prisma.adminOutbox.groupBy({
    by: ['bookingId'],
    where: { bookingId: { in: held.map((b) => b.id) }, event: { in: HOLD_NOTICES } },
    _max: { createdAt: true },
  });
  const lastNotice = new Map(
    notices.map((row) => [row.bookingId, row._max.createdAt?.getTime() ?? 0]),
  );
  const { cashInstructions } = await policy();
  const online = await offeredPaymentMethods(prisma);
  const jobs: NewAutomationJob[] = [];
  for (const b of held) {
    if (!b.holdExpiresAt) continue;
    if ((lastNotice.get(b.id) ?? 0) > now.getTime() - QUIET_AFTER_NOTICE_MS) continue;
    const paid = paidTotal(b.payments);
    const due = (b.paymentRule === 'FULL_PAYMENT_REQUIRED' ? b.totalCents : b.depositCents) - paid;
    if (due <= 0) continue;
    jobs.push({
      idempotencyKey: `hold-reminder:${b.id}:${b.holdExpiresAt.toISOString()}`,
      event: 'HOLD_REMINDER',
      recipient: b.email,
      bookingId: b.id,
      ...holdReminder({
        ...b,
        holdExpiresAt: b.holdExpiresAt,
        amountDueCents: due,
        instructions: howToPay(cashInstructions, preferredPaymentMethod(b.notes), online),
        paymentAction: paymentPageAction(b.id, online.length > 0),
      }),
      expiresAt: b.holdExpiresAt,
    });
  }
  return (await enqueueJobs(prisma, jobs, now)).length;
}

/**
 * One reminder to staff for each payment screenshot that has waited more than a day for a
 * decision. While a screenshot waits, its date stays held (expireUnpaidHolds skips it), so an
 * unanswered screenshot would keep the date from other clients indefinitely. The key holds the
 * screenshot's id, so each one is reminded once; a newer screenshot gets its own reminder.
 */
export async function remindWaitingProofs(now = new Date()) {
  const waiting = await prisma.adminPaymentProof.findMany({
    where: {
      status: 'SUBMITTED',
      createdAt: { lte: new Date(now.getTime() - ONE_DAY_MS) },
      booking: { reservation: { in: ['REQUESTED', 'CONFIRMED'] } },
    },
    orderBy: { createdAt: 'asc' },
    take: 50,
    select: {
      id: true,
      method: true,
      amountCents: true,
      referenceNumber: true,
      paidOn: true,
      createdAt: true,
      booking: {
        select: {
          id: true,
          reference: true,
          clientName: true,
          email: true,
          phone: true,
          eventType: true,
          startsAt: true,
          holdExpiresAt: true,
          reservation: true,
        },
      },
    },
  });
  if (!waiting.length) return 0;
  const staff = await resolveStaffRecipients();
  const appUrl = applicationUrl();
  const jobs: NewAutomationJob[] = waiting.map(({ booking, ...proof }) => ({
    idempotencyKey: `payment-proof:${proof.id}:waiting`,
    event: 'PAYMENT_PROOF_WAITING',
    recipient: staff.list,
    replyTo: booking.email,
    bookingId: booking.id,
    ...paymentProofWaitingAlert({
      reference: booking.reference,
      clientName: booking.clientName,
      email: booking.email,
      phone: booking.phone,
      eventType: booking.eventType,
      startsAt: booking.startsAt,
      methodLabel:
        PAYMENT_METHOD_LABELS[proof.method as keyof typeof PAYMENT_METHOD_LABELS] ?? proof.method,
      amountCents: proof.amountCents,
      referenceNumber: proof.referenceNumber,
      paidOn: proof.paidOn.toISOString().slice(0, 10),
      deadline: booking.holdExpiresAt,
      stage: booking.reservation === 'CONFIRMED' ? 'balance' : 'fee',
      sentAt: proof.createdAt,
      bookingUrl: appUrl
        ? `${appUrl}/admin/bookings/${encodeURIComponent(booking.reference)}?tab=payments`
        : null,
    }),
  }));
  return (await enqueueJobs(prisma, jobs, now)).length;
}

/**
 * Reminders to pay the rest of a confirmed booking (phase 3): a week before the full-payment date
 * in Zion's terms and again the day before. A client who sent a screenshot is waiting for staff,
 * and one who heard from us about a payment in the last twelve hours is not reminded yet; the key
 * includes the due date, so a changed rule or event date gets its own reminders.
 */
export async function scheduleBalanceReminders(now = new Date()) {
  const rules = await readBookingRules();
  // The due date is `balanceDueDays` before the event, so only events up to that many days after
  // the reminder window can have a reminder due now.
  const latestStart = new Date(
    now.getTime() + BALANCE_REMINDER_LEAD_MS + (rules.balanceDueDays + 1) * ONE_DAY_MS,
  );
  const confirmed = await prisma.adminBooking.findMany({
    where: {
      reservation: 'CONFIRMED',
      startsAt: { gt: now, lte: latestStart },
      paymentProofs: { none: { status: 'SUBMITTED' } },
    },
    orderBy: { startsAt: 'asc' },
    take: 100,
    select: {
      id: true,
      reference: true,
      clientName: true,
      email: true,
      eventType: true,
      packageName: true,
      guests: true,
      startsAt: true,
      endsAt: true,
      totalCents: true,
      notes: true,
      payments: { select: { amountCents: true, voidedAt: true } },
    },
  });
  const owing = confirmed
    .map((b) => ({
      ...b,
      balance: b.totalCents - paidTotal(b.payments),
      dueAt: balanceDueDate(b.startsAt, rules.balanceDueDays),
    }))
    .filter(
      (b) =>
        b.balance > 0 &&
        b.dueAt > now &&
        b.dueAt.getTime() - now.getTime() <= BALANCE_REMINDER_LEAD_MS,
    );
  if (!owing.length) return 0;
  const notices = await prisma.adminOutbox.groupBy({
    by: ['bookingId'],
    where: { bookingId: { in: owing.map((b) => b.id) }, event: { in: BALANCE_NOTICES } },
    _max: { createdAt: true },
  });
  const lastNotice = new Map(
    notices.map((row) => [row.bookingId, row._max.createdAt?.getTime() ?? 0]),
  );
  const { cashInstructions } = await policy();
  const online = await offeredPaymentMethods(prisma);
  const jobs: NewAutomationJob[] = [];
  for (const b of owing) {
    if ((lastNotice.get(b.id) ?? 0) > now.getTime() - QUIET_AFTER_NOTICE_MS) continue;
    const stage = b.dueAt.getTime() - now.getTime() <= ONE_DAY_MS ? 'day' : 'week';
    jobs.push({
      idempotencyKey: `balance-reminder:${b.id}:${b.dueAt.toISOString()}:${stage}`,
      event: 'BALANCE_REMINDER',
      recipient: b.email,
      bookingId: b.id,
      ...balanceReminder({
        ...b,
        dueAt: b.dueAt,
        balanceCents: b.balance,
        instructions: howToPay(cashInstructions, preferredPaymentMethod(b.notes), online),
        paymentAction: paymentPageAction(b.id, online.length > 0),
      }),
      expiresAt: b.dueAt,
    });
  }
  return (await enqueueJobs(prisma, jobs, now)).length;
}

/**
 * From the morning after an event (Manila time), a fully paid reservation becomes Completed and
 * the client gets the completion notice; one with a balance stays confirmed and staff get one
 * alert to collect it.
 */
export async function completeFinishedEvents(now = new Date()) {
  if (manilaHour(now) < AUTOMATION_POLICY.morningHourManila) return 0;
  const todayStart = manilaDayStart(manilaDay(now));
  const finished = await prisma.adminBooking.findMany({
    where: {
      reservation: 'CONFIRMED',
      endsAt: {
        lte: todayStart,
        gt: new Date(todayStart.getTime() - COMPLETION_WINDOW_DAYS * ONE_DAY_MS),
      },
    },
    orderBy: { endsAt: 'asc' },
    take: BATCH,
    include: bookingWithPayments,
  });
  if (!finished.length) return 0;
  const { cashInstructions } = await policy();
  let handled = 0;
  const balanceAlerts: NewAutomationJob[] = [];
  const appUrl = applicationUrl();
  const staff = await resolveStaffRecipients();
  for (const booking of finished) {
    const paid = paidTotal(booking.payments);
    if (paid < booking.totalCents) {
      balanceAlerts.push({
        idempotencyKey: `balance-after-event:${booking.id}`,
        event: 'BALANCE_AFTER_EVENT',
        recipient: staff.list,
        replyTo: booking.email,
        bookingId: booking.id,
        ...balanceAfterEventAlert({
          ...booking,
          balanceCents: booking.totalCents - paid,
          bookingsUrl: appUrl ? `${appUrl}/admin/bookings?status=confirmed` : null,
        }),
      });
      continue;
    }
    const ids = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM zion_admin_bookings WHERE id = ${booking.id} FOR UPDATE`;
      const b = await tx.adminBooking.findUniqueOrThrow({
        where: { id: booking.id },
        include: bookingWithPayments,
      });
      if (
        b.reservation !== 'CONFIRMED' ||
        b.endsAt > todayStart ||
        paidTotal(b.payments) < b.totalCents
      )
        return null;
      const updated = await tx.adminBooking.update({
        where: { id: b.id },
        data: {
          reservation: 'COMPLETED',
          revision: { increment: 1 },
          updatedBy: AUTOMATION_ACTOR,
        },
        include: bookingWithPayments,
      });
      await auditAutomation(
        tx,
        `Completed ${b.reference} automatically: the event ended and it is fully paid.`,
      );
      return enqueueBookingNotice(tx, {
        booking: updated,
        event: 'COMPLETE',
        paid: paidTotal(updated.payments),
        instructions: cashInstructions,
        now,
      });
    });
    if (ids) handled += 1;
  }
  if (balanceAlerts.length) handled += (await enqueueJobs(prisma, balanceAlerts, now)).length;
  return handled;
}
