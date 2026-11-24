import 'server-only';

import { prisma } from '@/lib/prisma';
import { AUTOMATION_POLICY, applicationUrl, staffRecipients } from './config';
import { enqueueInquiryReceived, inquiryJobKey, inquiryNotificationSelect } from './inquiries';
import { enqueueJobs, type NewAutomationJob } from './outbox';
import { dailyDigest, eventReminder } from './templates';
import { addDays, daysBetween, manilaDay, manilaDayStart, manilaHour, ONE_DAY_MS } from './time';

const SWEEP_STATE_KEY = 'inquiry-sweep-since';

/**
 * Inquiries created outside the public inquiry route (for example the Zeni hand-off) are picked
 * up here. The start marker is written when the automation schema is installed, so inquiries
 * from before automation existed are never emailed retroactively.
 */
async function inquirySweepStart(now: Date) {
  const existing = await prisma.automationState.findUnique({ where: { key: SWEEP_STATE_KEY } });
  if (existing) return existing.at;
  await prisma.automationState.createMany({
    data: [{ key: SWEEP_STATE_KEY, at: now }],
    skipDuplicates: true,
  });
  return (await prisma.automationState.findUniqueOrThrow({ where: { key: SWEEP_STATE_KEY } })).at;
}

export async function sweepInquiryNotifications(now = new Date()) {
  const start = await inquirySweepStart(now);
  const from = new Date(
    Math.max(start.getTime(), now.getTime() - AUTOMATION_POLICY.inquirySweepLookbackMs),
  );
  const inquiries = await prisma.inquiry.findMany({
    where: { status: 'NEW', submittedAt: { gte: from, lte: now } },
    orderBy: { submittedAt: 'asc' },
    take: 100,
    select: inquiryNotificationSelect,
  });
  if (!inquiries.length) return 0;
  const handled = new Set(
    (
      await prisma.adminOutbox.findMany({
        where: { idempotencyKey: { in: inquiries.map((item) => inquiryJobKey(item.id, 'staff')) } },
        select: { idempotencyKey: true },
      })
    ).map((row) => row.idempotencyKey),
  );
  let created = 0;
  for (const inquiry of inquiries) {
    if (handled.has(inquiryJobKey(inquiry.id, 'staff'))) continue;
    created += (await enqueueInquiryReceived(prisma, inquiry, now)).length;
  }
  return created;
}

/** One reminder a week ahead and one the day before, for confirmed reservations only. */
export async function scheduleEventReminders(now = new Date()) {
  if (manilaHour(now) < AUTOMATION_POLICY.morningHourManila) return 0;
  const today = manilaDay(now);
  const bookings = await prisma.adminBooking.findMany({
    where: {
      reservation: 'CONFIRMED',
      startsAt: { gt: now, lt: manilaDayStart(addDays(today, 8)) },
    },
    orderBy: { startsAt: 'asc' },
    take: 200,
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
    },
  });
  if (!bookings.length) return 0;
  const confirmations = await prisma.adminOutbox.groupBy({
    by: ['bookingId'],
    where: { event: 'RESERVATION_CONFIRMED', bookingId: { in: bookings.map((b) => b.id) } },
    _max: { createdAt: true },
  });
  const confirmedAt = new Map(
    confirmations.map((row) => [row.bookingId, row._max.createdAt?.getTime() ?? 0]),
  );
  const jobs: NewAutomationJob[] = [];
  for (const booking of bookings) {
    const eventDay = manilaDay(booking.startsAt);
    const days = daysBetween(today, eventDay);
    // The confirmation email already covers a reservation confirmed within the last two days.
    const recentlyConfirmed = (confirmedAt.get(booking.id) ?? 0) > now.getTime() - 2 * ONE_DAY_MS;
    const lead = days === 1 ? 'day' : days >= 5 && days <= 7 && !recentlyConfirmed ? 'week' : null;
    if (!lead) continue;
    jobs.push({
      idempotencyKey: `reminder:${lead === 'day' ? '1d' : '7d'}:${booking.id}`,
      event: lead === 'day' ? 'EVENT_REMINDER_1D' : 'EVENT_REMINDER_7D',
      recipient: booking.email,
      bookingId: booking.id,
      ...eventReminder(booking, lead),
      expiresAt: lead === 'day' ? booking.startsAt : manilaDayStart(addDays(eventDay, -2)),
    });
  }
  return (await enqueueJobs(prisma, jobs, now)).length;
}

/** One staff digest per Manila day, prepared from the morning onward. */
export async function scheduleDailyDigest(now = new Date()) {
  if (manilaHour(now) < AUTOMATION_POLICY.morningHourManila) return 0;
  const day = manilaDay(now);
  const key = `digest:${day}`;
  if (await prisma.adminOutbox.findUnique({ where: { idempotencyKey: key }, select: { id: true } }))
    return 0;
  const todayStart = manilaDayStart(day);
  const tomorrowStart = manilaDayStart(addDays(day, 1));
  const dayAfterStart = manilaDayStart(addDays(day, 2));
  const since = new Date(now.getTime() - ONE_DAY_MS);
  const eventSelect = { reference: true, clientName: true, eventType: true, startsAt: true };
  const [today, tomorrow, newInquiries, inquiries, awaitingApproval, failedEmails] =
    await Promise.all([
      prisma.adminBooking.findMany({
        where: { reservation: 'CONFIRMED', startsAt: { gte: todayStart, lt: tomorrowStart } },
        orderBy: { startsAt: 'asc' },
        take: 20,
        select: eventSelect,
      }),
      prisma.adminBooking.findMany({
        where: { reservation: 'CONFIRMED', startsAt: { gte: tomorrowStart, lt: dayAfterStart } },
        orderBy: { startsAt: 'asc' },
        take: 20,
        select: eventSelect,
      }),
      prisma.inquiry.count({ where: { submittedAt: { gte: since, lte: now } } }),
      prisma.inquiry.findMany({
        where: { submittedAt: { gte: since, lte: now } },
        orderBy: { submittedAt: 'desc' },
        take: 10,
        select: { inquiryReference: true, fullName: true, eventInterest: true },
      }),
      prisma.adminBooking.count({ where: { approval: 'PENDING', reservation: 'REQUESTED' } }),
      prisma.adminOutbox.count({ where: { status: 'REVIEW_REQUIRED' } }),
    ]);
  const appUrl = applicationUrl();
  const digest = dailyDigest({
    day: todayStart,
    today,
    tomorrow,
    newInquiries,
    inquiries: inquiries.map((item) => ({
      reference: item.inquiryReference,
      fullName: item.fullName,
      eventInterest: item.eventInterest,
    })),
    awaitingApproval,
    failedEmails,
    adminUrl: appUrl ? `${appUrl}/admin/dashboard` : null,
  });
  return (
    await enqueueJobs(
      prisma,
      [
        {
          idempotencyKey: key,
          event: 'DAILY_DIGEST',
          recipient: staffRecipients(),
          ...digest,
          // A digest is only useful on its own day.
          expiresAt: tomorrowStart,
        },
      ],
      now,
    )
  ).length;
}
