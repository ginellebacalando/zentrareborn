import 'server-only';

import type { Prisma } from '@prisma/client';
import { paymentPageUrl } from '@/lib/payment-link';
import { prisma } from '@/lib/prisma';
import { enqueueBookingNotice } from '@/lib/automation/bookings';
import { AUTOMATION_POLICY, applicationUrl } from '@/lib/automation/config';
import { enqueueJobs, type NewAutomationJob } from '@/lib/automation/outbox';
import { resolveStaffRecipients } from '@/lib/automation/recipients';
import { balanceAfterEventAlert, holdReminder } from '@/lib/automation/templates';
import { manilaDay, manilaDayStart, manilaHour, ONE_DAY_MS } from '@/lib/automation/time';
import { eventDate, paidTotal } from './domain';
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
        instructions: cashInstructions,
        paymentUrl: paymentPageUrl(b.id),
      }),
      expiresAt: b.holdExpiresAt,
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
