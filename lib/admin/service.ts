import 'server-only';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Prisma, TestimonyStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { termsData } from '@/config/terms';
import { deleteTestimonyPhoto } from '@/lib/testimony-photo-storage';
import { parseRedFlagReasons } from '@/lib/testimony-service';
import type { AdminActor } from './access';
import { AdminError } from './errors';
import { getAdminPreferences, readBookingRules, saveAdminPreferences } from './preferences';
import { paymentDeadline, requiresPayment } from './booking-rules';
import { readCatalog, saveCatalog } from './catalog';
import {
  normalizeTransferReference,
  PAYMENT_METHOD_LABELS,
  transferReceiptNumber,
  type OnlinePaymentMethod,
} from './payment-accounts';
import { readBookingProofs } from './payment-proofs';
import { readDashboardInsights } from './dashboard';
import { readDashboardKpis } from './dashboard-kpis';
import { readAnalyticsReport } from './analytics';
import { readWebsiteActivity } from './website-activity';
import { AUTOMATION_ONLY_EVENTS, automationJobLabel } from '@/lib/automation/catalog';
import {
  enqueueBookingNotice,
  enqueueStaffCalendarUpdate,
  type StaffCalendarChange,
} from '@/lib/automation/bookings';
import { isMailConfigured } from '@/lib/automation/config';
import type { CalendarMethod } from '@/lib/automation/ics';
import { scheduleAutomationDelivery } from '@/lib/automation/trigger';
import { OCCUPYING_BOOKINGS } from '@/lib/booking-occupancy';
import { PAYMENT_REJECTION_REASONS, type PaymentRejectionReason } from '@/lib/payment-page-types';
import {
  bookingInput,
  confirmationError,
  eventDate,
  money,
  paidTotal,
  paymentRules,
} from './domain';

type Tx = Prisma.TransactionClient;
export const defaultTerms = termsData
  .map(
    (group) =>
      `${group.category}\n${group.sections.map((s) => `${s.title}\n${s.content.join('\n')}`).join('\n\n')}`,
  )
  .join('\n\n');
export async function policy(tx: Tx = prisma) {
  return (
    (await tx.adminPolicy.findUnique({ where: { id: 'venue' } })) ?? {
      id: 'venue',
      reviewed: false,
      paymentRule: 'DEPOSIT_REQUIRED',
      cashInstructions:
        'Pay cash at Zion Events Place after staff approval. Staff must confirm the amount and deadline and issue a receipt.',
      contractTerms: defaultTerms,
      version: 1,
      updatedBy: null,
      updatedAt: null,
    }
  );
}
async function audit(
  tx: Tx,
  actor: AdminActor,
  module: string,
  description: string,
  action:
    | 'CREATE'
    | 'UPDATE'
    | 'APPROVAL'
    | 'REJECTION'
    | 'SETTINGS_CHANGE'
    | 'PROFILE_UPDATE'
    | 'PASSWORD_CHANGE' = 'UPDATE',
  metadata?: Prisma.InputJsonObject,
) {
  await tx.auditLog.create({
    data: {
      userId: actor.id,
      userName: actor.fullName || actor.username,
      userRole: actor.role,
      action,
      module,
      description,
      status: 'SUCCESS',
      source: 'zion-admin',
      ...(metadata ? { metadata } : {}),
    },
  });
}
/**
 * How a booking decision changes its event in the staff calendars: pending from the request,
 * confirmed with the reservation, removed when declined or cancelled, and pending again when a
 * declined request is approved or reviewed again.
 */
function staffCalendarChange(
  action: string,
  before: { approval: string },
): StaffCalendarChange | undefined {
  if (action === 'CONFIRM') return 'CONFIRMED';
  if (action === 'REJECT') return 'DECLINED';
  if (action === 'CANCEL') return 'CANCELLED';
  if ((action === 'APPROVE' || action === 'REVIEW_POLICY') && before.approval === 'REJECTED')
    return 'PENDING';
  return undefined;
}
/** The client notice each booking decision sends; other decisions send a notice of their name. */
const DECISION_NOTICES: Record<string, string> = {
  APPROVE: 'REQUEST_APPROVED',
  CONFIRM: 'RESERVATION_CONFIRMED',
  EXTEND_HOLD: 'HOLD_EXTENDED',
};
/**
 * Why a requested booking cannot be confirmed now, or null when it can: the venue policy, the
 * confirmation rules and no confirmed event in the same slot. Takes the venue lock, so competing
 * confirmations are serialized without holding a network call.
 */
async function confirmationBlock(
  tx: Tx,
  b: Awaited<ReturnType<typeof findBooking>>,
  paid: number,
): Promise<{ message: string; status: number } | null> {
  const p = await policy(tx);
  if (b.policyVersion !== p.version)
    return {
      message:
        'The policy changed. Re-review this request under the current venue policy, then approve it again.',
      status: 400,
    };
  const error = confirmationError(b, paid, p.reviewed);
  if (error) return { message: error, status: 400 };
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${b.venue}))::text`;
  const conflict = await tx.adminBooking.findFirst({
    where: {
      id: { not: b.id },
      venue: b.venue,
      reservation: 'CONFIRMED',
      startsAt: { lt: b.endsAt },
      endsAt: { gt: b.startsAt },
    },
    select: { reference: true },
  });
  return conflict
    ? { message: `Schedule conflicts with ${conflict.reference}.`, status: 409 }
    : null;
}
/** Another booking that already occupies this slot: confirmed, or held while its client pays. */
async function occupyingConflict(tx: Tx, b: Awaited<ReturnType<typeof findBooking>>) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${b.venue}))::text`;
  return tx.adminBooking.findFirst({
    where: {
      id: { not: b.id },
      venue: b.venue,
      startsAt: { lt: b.endsAt },
      endsAt: { gt: b.startsAt },
      OR: OCCUPYING_BOOKINGS,
    },
    select: { reference: true },
  });
}
/** What a booking notice carries besides its event: invitations and a note for the client. */
type NoticeOptions = {
  calendar?: CalendarMethod;
  staffCalendar?: StaffCalendarChange;
  note?: string;
};
async function queue(
  tx: Tx,
  b: Awaited<ReturnType<typeof findBooking>>,
  event: string,
  { calendar, staffCalendar, note }: NoticeOptions = {},
) {
  const p = await policy(tx);
  // The client notice, plus the staff calendar email when the change affects staff calendars.
  const ids = await enqueueBookingNotice(tx, {
    booking: b,
    event,
    paid: paidTotal(b.payments),
    instructions: p.cashInstructions,
    calendar,
    staffCalendar,
    note,
  });
  // `after()` runs once the response is sent, i.e. after this transaction commits or rolls back;
  // delivery only claims committed rows, so a rollback leaves nothing to send.
  scheduleAutomationDelivery(ids);
}
async function findBooking(tx: Tx, id: string) {
  const b = await tx.adminBooking.findUnique({
    where: { id },
    include: { payments: true, contracts: { orderBy: { version: 'desc' } } },
  });
  if (!b) throw new AdminError('Booking not found.', 404);
  return b;
}
async function lockBooking(tx: Tx, id: string, revision: number) {
  await tx.$queryRaw`SELECT id FROM zion_admin_bookings WHERE id = ${id} FOR UPDATE`;
  const b = await findBooking(tx, id);
  if (b.revision !== revision)
    throw new AdminError('This booking changed. Reload it before acting.', 409);
  return b;
}
const identifier = z.string().min(1).max(100);
const decisionSchema = z
  .object({
    op: z.literal('booking-action'),
    id: identifier,
    revision: z.number().int(),
    action: z.enum([
      'VERIFY',
      'FLAG',
      'APPROVE',
      'REJECT',
      'REVIEW_POLICY',
      'CONFIRM',
      'CANCEL',
      'COMPLETE',
      'EXTEND_HOLD',
    ]),
    reason: z.string().trim().min(5).max(2000),
  })
  .strict();
const receiptSchema = z
  .object({
    op: z.literal('cash-receipt'),
    id: identifier,
    revision: z.number().int(),
    amountCents: z.number().int().positive().max(2000000000),
    receiptNumber: z.string().trim().min(3).max(80),
    receivedAt: z.iso.datetime(),
    note: z.string().trim().max(1000),
  })
  .strict();
const verifyProofSchema = z
  .object({
    op: z.literal('verify-proof'),
    id: identifier,
    revision: z.number().int(),
    proofId: identifier,
    amountCents: z.number().int().positive().max(2000000000),
    referenceNumber: z
      .string()
      .trim()
      .min(4)
      .max(40)
      .regex(/^[A-Za-z0-9 -]+$/, 'Use only letters, numbers, spaces and dashes.'),
    receivedAt: z.iso.datetime(),
    note: z.string().trim().max(1000),
    // Staff confirm they found the money in Zion's own GCash or bank records.
    checkedRecords: z.literal(true),
  })
  .strict();
const rejectionReasons = Object.keys(PAYMENT_REJECTION_REASONS) as [
  PaymentRejectionReason,
  ...PaymentRejectionReason[],
];
const rejectProofSchema = z
  .object({
    op: z.literal('reject-proof'),
    id: identifier,
    revision: z.number().int(),
    proofId: identifier,
    reason: z.enum(rejectionReasons),
    note: z.string().trim().max(500),
  })
  .strict()
  .refine((input) => input.reason !== 'OTHER' || input.note.length >= 5, {
    message: 'Explain the reason in the note to the client.',
    path: ['note'],
  });
const HOUR_MS = 60 * 60 * 1000;
/** The screenshot staff are deciding on; it must still be the client's latest, unreviewed one. */
async function submittedProof(tx: Tx, bookingId: string, proofId: string) {
  const proof = await tx.adminPaymentProof.findFirst({
    where: { id: proofId, bookingId },
    select: { id: true, method: true, status: true, amountCents: true },
  });
  if (!proof) throw new AdminError('Payment screenshot not found.', 404);
  if (proof.status === 'REPLACED')
    throw new AdminError(
      'The client sent a newer screenshot. Reload the booking and review that one.',
      409,
    );
  if (proof.status !== 'SUBMITTED')
    throw new AdminError('This screenshot was already reviewed.', 409);
  return { ...proof, method: proof.method as OnlinePaymentMethod };
}

export async function adminRead(section: string, params: URLSearchParams, actor: AdminActor) {
  if (section === 'services') return readCatalog(params, actor);
  if (section === 'preferences')
    return { ...(await getAdminPreferences()), canEdit: actor.role === 'SUPERADMIN' };
  // Polled by the dashboard's Website activity panel; read-only, so it has no POST operations.
  if (section === 'website-activity') return readWebsiteActivity();
  if (section === 'notifications') {
    const [pending, flagged, inquiries, deliveryIssues, screenshots, p] = await Promise.all([
      prisma.adminBooking.count({
        where: { approval: 'PENDING', reservation: 'REQUESTED', verification: { not: 'FLAGGED' } },
      }),
      prisma.adminBooking.count({ where: { verification: 'FLAGGED', reservation: 'REQUESTED' } }),
      prisma.inquiry.count({ where: { status: { in: ['NEW', 'PENDING_RESPONSE'] } } }),
      prisma.adminOutbox.count({ where: { status: 'REVIEW_REQUIRED' } }),
      prisma.adminPaymentProof.count({ where: { status: 'SUBMITTED' } }),
      policy(),
    ]);
    const { settings } = await getAdminPreferences();
    const preferences = settings.admin.notifications;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [recentEvents, contractUpdates] = await Promise.all([
      prisma.adminOutbox.groupBy({
        by: ['event'],
        _count: { _all: true },
        where: {
          createdAt: { gte: since },
          event: {
            in: [
              'RESERVATION_CONFIRMED',
              'CANCEL',
              'CASH_RECEIPT',
              'PAYMENT_VERIFIED',
              'RECEIPT_VOIDED',
            ],
          },
        },
      }),
      preferences.contractUpdates
        ? prisma.auditLog.count({
            where: { module: 'Contracts', timestamp: { gte: since }, source: 'zion-admin' },
          })
        : 0,
    ]);
    const countEvents = (...events: string[]) =>
      recentEvents
        .filter((row) => events.includes(row.event))
        .reduce((sum, row) => sum + row._count._all, 0);
    const confirmations = countEvents('RESERVATION_CONFIRMED'),
      cancellations = countEvents('CANCEL');
    const paymentUpdates = countEvents('CASH_RECEIPT', 'PAYMENT_VERIFIED', 'RECEIPT_VOIDED');
    const enabled: Record<string, boolean> = {
      'pending-bookings': preferences.newBookingRequests,
      'new-inquiries': preferences.customerInquiries,
      'flagged-bookings': preferences.systemAlerts,
      'delivery-issues': preferences.systemAlerts,
      'policy-review': preferences.systemAlerts,
      'booking-confirmations': preferences.bookingConfirmations,
      'booking-cancellations': preferences.bookingCancellations,
      'payment-screenshots': preferences.paymentUpdates,
      'payment-updates': preferences.paymentUpdates,
      'contract-updates': preferences.contractUpdates,
    };
    return {
      notifications: [
        ...(pending
          ? [
              {
                id: 'pending-bookings',
                kind: 'booking' as const,
                title: `${pending} booking ${pending === 1 ? 'request awaits' : 'requests await'} review`,
                message: 'Verify the contact and review the event details.',
                href: '/admin/bookings',
              },
            ]
          : []),
        ...(screenshots
          ? [
              {
                id: 'payment-screenshots',
                kind: 'payment' as const,
                title: `${screenshots} payment ${screenshots === 1 ? 'screenshot' : 'screenshots'} to verify`,
                message:
                  'Check each one against your GCash or bank records, then verify or reject it.',
                href: '/admin/bookings?status=pending',
              },
            ]
          : []),
        ...(inquiries
          ? [
              {
                id: 'new-inquiries',
                kind: 'inquiry' as const,
                title: `${inquiries} ${inquiries === 1 ? 'inquiry needs' : 'inquiries need'} a response`,
                message: 'Review the latest event inquiries in your inbox.',
                href: '/admin/inquiries',
              },
            ]
          : []),
        ...(flagged
          ? [
              {
                id: 'flagged-bookings',
                kind: 'warning' as const,
                title: `${flagged} flagged ${flagged === 1 ? 'request needs' : 'requests need'} attention`,
                message: 'Resolve verification concerns before approval.',
                href: '/admin/bookings',
              },
            ]
          : []),
        ...(deliveryIssues
          ? [
              {
                id: 'delivery-issues',
                kind: 'warning' as const,
                title: 'Email delivery needs review',
                message: `${deliveryIssues} ${deliveryIssues === 1 ? 'message needs' : 'messages need'} a delivery check in the Activity log.`,
                href: '/admin/logs',
              },
            ]
          : []),
        ...(!p.reviewed && actor.role === 'SUPERADMIN'
          ? [
              {
                id: 'policy-review',
                kind: 'policy' as const,
                title: 'Review your venue policy',
                message: 'Review cash instructions and terms to enable confirmations.',
                href: '/admin/settings',
              },
            ]
          : []),
        ...(confirmations
          ? [
              {
                id: 'booking-confirmations',
                kind: 'booking' as const,
                title: `${confirmations} reservation ${confirmations === 1 ? 'confirmation' : 'confirmations'}`,
                message: 'Booking confirmations recorded in the last 24 hours.',
                href: '/admin/bookings',
              },
            ]
          : []),
        ...(cancellations
          ? [
              {
                id: 'booking-cancellations',
                kind: 'booking' as const,
                title: `${cancellations} booking ${cancellations === 1 ? 'cancellation' : 'cancellations'}`,
                message: 'Booking cancellations recorded in the last 24 hours.',
                href: '/admin/bookings',
              },
            ]
          : []),
        ...(paymentUpdates
          ? [
              {
                id: 'payment-updates',
                kind: 'payment' as const,
                title: `${paymentUpdates} payment ${paymentUpdates === 1 ? 'update' : 'updates'}`,
                message: 'Payments and corrections recorded in the last 24 hours.',
                href: '/admin/payments',
              },
            ]
          : []),
        ...(contractUpdates
          ? [
              {
                id: 'contract-updates',
                kind: 'contract' as const,
                title: `${contractUpdates} contract ${contractUpdates === 1 ? 'update' : 'updates'}`,
                message: 'Contract activity recorded in the last 24 hours.',
                href: '/admin/contracts',
              },
            ]
          : []),
      ].filter((notice) => enabled[notice.id] ?? true),
    };
  }
  if (section === 'profile') return { user: actor };
  if (section === 'inquiries') {
    const page = Math.max(1, Math.min(10000, Math.trunc(Number(params.get('page'))) || 1));
    const [inquiries, total] = await Promise.all([
      prisma.inquiry.findMany({
        orderBy: [{ submittedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * 50,
        take: 50,
        select: {
          id: true,
          inquiryReference: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          eventInterest: true,
          packageInterest: true,
          requestedEventDate: true,
          message: true,
          status: true,
          submittedAt: true,
        },
      }),
      prisma.inquiry.count(),
    ]);
    return { inquiries, total, page };
  }
  if (section === 'analytics') {
    const [totalBookings, reservations, eventTypes, receipts, inquiryCount, analyticsReport] =
      await Promise.all([
        prisma.adminBooking.count(),
        prisma.adminBooking.groupBy({
          by: ['reservation'],
          _count: { _all: true },
          orderBy: { reservation: 'asc' },
        }),
        prisma.adminBooking.groupBy({
          by: ['eventType'],
          _count: { _all: true },
          orderBy: { _count: { eventType: 'desc' } },
          take: 10,
        }),
        prisma.adminCashPayment.aggregate({
          _sum: { amountCents: true },
          where: { voidedAt: null },
        }),
        prisma.inquiry.count(),
        readAnalyticsReport(params),
      ]);
    return {
      analyticsReport,
      analytics: {
        totalBookings,
        inquiryCount,
        cashCents: receipts._sum.amountCents ?? 0,
        reservations: reservations.map((row) => ({
          label: row.reservation,
          count: row._count._all,
        })),
        eventTypes: eventTypes.map((row) => ({ label: row.eventType, count: row._count._all })),
      },
    };
  }
  if (section === 'team') {
    const page = Math.max(1, Math.min(10000, Math.trunc(Number(params.get('page'))) || 1));
    const where: Prisma.UserWhereInput = { role: { in: ['ADMIN', 'SUPERADMIN'] } };
    const [team, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { username: 'asc' },
        skip: (page - 1) * 50,
        take: 50,
        select: { id: true, fullName: true, username: true, email: true, role: true, status: true },
      }),
      prisma.user.count({ where }),
    ]);
    return { team, total, page };
  }
  if (section === 'settings')
    return {
      policy: await policy(),
      canEdit: actor.role === 'SUPERADMIN',
      notificationConfigured: isMailConfigured(),
      timezone: 'Asia/Manila',
    };
  if (section === 'dashboard') {
    const [
      pending,
      confirmed,
      flagged,
      receipts,
      upcoming,
      outbox,
      inquiries,
      heldTestimonies,
      p,
      dashboardInsights,
      dashboardKpis,
    ] = await Promise.all([
      prisma.adminBooking.count({
        where: { approval: 'PENDING', reservation: 'REQUESTED' },
      }),
      prisma.adminBooking.count({
        where: { reservation: 'CONFIRMED', endsAt: { gte: new Date() } },
      }),
      prisma.adminBooking.count({
        where: { verification: 'FLAGGED', reservation: 'REQUESTED' },
      }),
      prisma.adminCashPayment.aggregate({
        _sum: { amountCents: true },
        where: { voidedAt: null },
      }),
      prisma.adminBooking.findMany({
        where: { reservation: 'CONFIRMED', endsAt: { gte: new Date() } },
        orderBy: { startsAt: 'asc' },
        take: 5,
      }),
      prisma.adminOutbox.groupBy({ by: ['status'], _count: true }),
      prisma.inquiry.findMany({
        where: { status: { in: ['NEW', 'PENDING_RESPONSE'] } },
        orderBy: { submittedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          inquiryReference: true,
          fullName: true,
          eventInterest: true,
          requestedEventDate: true,
        },
      }),
      prisma.testimony.findMany({
        where: {
          status: { in: [TestimonyStatus.FLAGGED, TestimonyStatus.PENDING_REVIEW] },
          deletedAt: null,
        },
        orderBy: { submittedAt: 'desc' },
        take: 25,
        select: {
          id: true,
          clientName: true,
          nickname: true,
          eventType: true,
          eventDate: true,
          overallRating: true,
          comment: true,
          photoUrl: true,
          status: true,
          hiddenBy: true,
          submittedAt: true,
        },
      }),
      policy(),
      readDashboardInsights(),
      readDashboardKpis(),
    ]);
    return {
      pending,
      confirmed,
      flagged,
      cashCents: receipts._sum.amountCents ?? 0,
      upcoming,
      outbox,
      inquiries,
      heldTestimonies: heldTestimonies.map((item) => ({
        id: item.id,
        clientName: item.nickname || item.clientName,
        eventType: item.eventType,
        eventDate: item.eventDate.toISOString(),
        overallRating: item.overallRating,
        comment: item.comment,
        photoUrl: item.photoUrl,
        status: item.status,
        flagReasons: parseRedFlagReasons(item.hiddenBy),
        submittedAt: item.submittedAt.toISOString(),
      })),
      policyReviewed: p.reviewed,
      dashboardInsights,
      dashboardKpis,
      notificationConfigured: isMailConfigured(),
    };
  }
  if (section === 'logs') {
    const q = (params.get('q') ?? '').slice(0, 100);
    const moduleFilter = params.get('module');
    const where: Prisma.AuditLogWhereInput = {
      ...(moduleFilter ? { module: moduleFilter } : {}),
      ...(q ? { description: { contains: q, mode: 'insensitive' } } : {}),
    };
    const page = Math.max(1, Math.min(10000, Number(params.get('page')) || 1));
    const automationEvents = [...AUTOMATION_ONLY_EVENTS];
    const [logs, total, outbox, automationJobs] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * 50,
        take: 50,
        select: {
          id: true,
          timestamp: true,
          userName: true,
          userRole: true,
          action: true,
          module: true,
          description: true,
          status: true,
        },
      }),
      prisma.auditLog.count({ where }),
      // Booking decision notices, as before; automation jobs are listed separately below.
      prisma.adminOutbox.findMany({
        where: { event: { notIn: automationEvents } },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          id: true,
          event: true,
          subject: true,
          body: true,
          status: true,
          attempts: true,
          lastError: true,
          createdAt: true,
          sentAt: true,
        },
      }),
      // Built-in automation job log (inquiry alerts, reminders, daily digest).
      prisma.adminOutbox.findMany({
        where: { event: { in: automationEvents } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, event: true, status: true, createdAt: true, sentAt: true },
      }),
    ]);
    // `workflows` keeps the shape the Activity log page already renders.
    const workflows = automationJobs.map((job) => ({
      id: job.id,
      workflowName: automationJobLabel(job.event),
      status: job.status,
      createdAt: job.createdAt,
      completedAt: job.sentAt,
    }));
    return { logs, total, page, outbox, workflows };
  }
  if (['bookings', 'calendar', 'payments', 'contracts'].includes(section)) {
    if (params.get('id')) {
      const booking = await findBooking(prisma, params.get('id')!);
      return {
        booking: { ...booking, paymentProofs: await readBookingProofs(prisma, booking.id) },
      };
    }
    if (params.get('inquiry')) {
      const inquiry = await prisma.inquiry.findUnique({
        where: { id: params.get('inquiry')! },
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          eventInterest: true,
          packageInterest: true,
          requestedEventDate: true,
          message: true,
          inquiryReference: true,
        },
      });
      if (!inquiry) throw new AdminError('Inquiry not found.', 404);
      return { inquiry };
    }
    const q = (params.get('q') ?? '').slice(0, 100);
    const where: Prisma.AdminBookingWhereInput = {};
    if (q)
      where.OR = ['reference', 'clientName', 'email', 'eventType', 'packageName'].map((key) => ({
        [key]: { contains: q, mode: 'insensitive' },
      }));
    for (const key of ['approval', 'reservation', 'verification', 'eventType'] as const) {
      const v = params.get(key);
      if (v) where[key] = v;
    }
    const from = params.get('from'),
      to = params.get('to');
    if (from || to) {
      if (
        (from && !z.iso.date().safeParse(from).success) ||
        (to && !z.iso.date().safeParse(to).success)
      )
        throw new AdminError('Invalid date filter.');
      if (from && to && from > to)
        throw new AdminError('The start date must be on or before the end date.');
      where.AND = [
        ...(from ? [{ endsAt: { gte: new Date(`${from}T00:00:00+08:00`) } }] : []),
        ...(to ? [{ startsAt: { lte: new Date(`${to}T23:59:59+08:00`) } }] : []),
      ];
    }
    const page = Math.max(1, Math.min(10000, Number(params.get('page')) || 1));
    const [rows, total] = await Promise.all([
      prisma.adminBooking.findMany({
        where,
        include: {
          payments: true,
          contracts: { orderBy: { version: 'desc' } },
          _count: { select: { paymentProofs: { where: { status: 'SUBMITTED' } } } },
        },
        orderBy: section === 'calendar' ? { startsAt: 'asc' } : { createdAt: 'desc' },
        take: 50,
        skip: (page - 1) * 50,
      }),
      prisma.adminBooking.count({ where }),
    ]);
    // The list only says whether a payment screenshot waits for review; details load on open.
    const bookings = rows.map(({ _count, ...booking }) => ({
      ...booking,
      proofsToVerify: _count.paymentProofs,
    }));
    return { bookings, total, page, policy: await policy() };
  }
  throw new AdminError('Unknown admin module.', 404);
}

export async function adminMutate(raw: unknown, actor: AdminActor) {
  const op = z.object({ op: z.string() }).parse(raw).op;
  if (op === 'preferences') return saveAdminPreferences(raw, actor);
  if (op === 'catalog-category' || op === 'catalog-package') return saveCatalog(raw, actor);
  if (op === 'create-booking') {
    const input = z
      .object({
        op: z.literal('create-booking'),
        booking: bookingInput,
        sourceInquiryId: identifier.optional(),
      })
      .strict()
      .parse(raw);
    const p = await policy();
    if (input.booking.paymentRule !== p.paymentRule)
      throw new AdminError(
        'Use the reviewed venue payment policy. Change it in Settings if needed.',
      );
    return prisma.$transaction(async (tx) => {
      const sourceInquiry = input.sourceInquiryId
        ? await tx.inquiry.findUnique({
            where: { id: input.sourceInquiryId },
            select: { id: true, submittedAt: true },
          })
        : null;
      if (input.sourceInquiryId && !sourceInquiry)
        throw new AdminError('Source inquiry not found.', 404);
      if (sourceInquiry && sourceInquiry.submittedAt > new Date())
        throw new AdminError('A future-dated inquiry cannot be linked to this request.');
      const { startsAt, endsAt, ...fields } = input.booking;
      const b = await tx.adminBooking.create({
        data: {
          ...fields,
          startsAt: new Date(startsAt),
          endsAt: new Date(endsAt),
          reference: `ZION-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
          policyVersion: p.version,
          createdBy: actor.id,
          updatedBy: actor.id,
        },
        include: { payments: true, contracts: true },
      });
      await audit(
        tx,
        actor,
        'Bookings',
        `Created staff-entered request ${b.reference}. No date or payment confirmed.`,
        'CREATE',
        { bookingId: b.id, sourceInquiryId: sourceInquiry?.id ?? null },
      );
      // Like a website request, it appears in the staff calendars as a pending event.
      await queue(tx, b, 'REQUEST_RECEIVED', { staffCalendar: 'PENDING' });
      return { id: b.id };
    });
  }
  if (op === 'edit-booking') {
    const input = z
      .object({
        op: z.literal('edit-booking'),
        id: identifier,
        revision: z.number().int().positive(),
        booking: bookingInput,
        reason: z.string().trim().min(3).max(1000),
      })
      .strict()
      .parse(raw);
    return prisma.$transaction(async (tx) => {
      const b = await lockBooking(tx, input.id, input.revision);
      if (b.reservation !== 'REQUESTED')
        throw new AdminError(
          'Confirmed, cancelled or completed bookings cannot be edited; cancel and create a new request.',
        );
      if (b.contracts.some((c) => c.status === 'ISSUED' || c.status === 'SIGNED'))
        throw new AdminError(
          'This booking has an issued or signed agreement, so its details cannot be edited.',
        );
      const p = await policy(tx);
      if (input.booking.paymentRule !== p.paymentRule)
        throw new AdminError(
          'Use the reviewed venue payment policy. Change it in Settings if needed.',
        );
      const paid = paidTotal(b.payments);
      if (input.booking.totalCents < paid)
        throw new AdminError(
          `The contract price cannot be less than the ${money(paid)} cash already received.`,
        );
      if (input.booking.depositCents > input.booking.totalCents)
        throw new AdminError('Specify a valid reservation fee, not more than the total.');
      const { startsAt, endsAt, ...fields } = input.booking;
      const next = { ...fields, startsAt: new Date(startsAt), endsAt: new Date(endsAt) };
      // Conservative resets: new contact details need re-verification (a flagged request stays
      // flagged until staff verify it explicitly), and an approved request whose terms or contact
      // change goes back to staff review. Notes alone change nothing.
      const contactChanged = next.email !== b.email || next.phone !== b.phone;
      const termsChanged =
        contactChanged ||
        next.clientName !== b.clientName ||
        next.startsAt.getTime() !== b.startsAt.getTime() ||
        next.endsAt.getTime() !== b.endsAt.getTime() ||
        next.packageName !== b.packageName ||
        next.guests !== b.guests ||
        next.totalCents !== b.totalCents ||
        next.depositCents !== b.depositCents ||
        next.eventType !== b.eventType ||
        next.paymentRule !== b.paymentRule;
      const data: Prisma.AdminBookingUpdateInput = {
        ...next,
        revision: { increment: 1 },
        updatedBy: actor.id,
      };
      if (contactChanged && b.verification !== 'FLAGGED')
        Object.assign(data, {
          verification: 'UNREVIEWED',
          verificationNote: '',
          verifiedBy: null,
          verifiedAt: null,
        });
      // Back to review: the date is no longer held, so its payment deadline no longer applies.
      if (termsChanged && b.approval === 'APPROVED')
        Object.assign(data, {
          approval: 'PENDING',
          decisionReason: input.reason,
          holdExpiresAt: null,
        });
      const edited = await tx.adminBooking.update({ where: { id: b.id }, data });
      await audit(tx, actor, 'Bookings', `Edited ${b.reference}: ${input.reason}`, 'UPDATE', {
        bookingId: b.id,
      });
      // Edits never queue client email; any later decision sends its own standard notice. The
      // pending event in the staff calendars follows a changed date or detail it shows, unless
      // the request was declined.
      const calendarChanged =
        contactChanged ||
        next.clientName !== b.clientName ||
        next.startsAt.getTime() !== b.startsAt.getTime() ||
        next.endsAt.getTime() !== b.endsAt.getTime() ||
        next.eventType !== b.eventType ||
        next.packageName !== b.packageName ||
        next.guests !== b.guests;
      if (calendarChanged && b.approval !== 'REJECTED')
        scheduleAutomationDelivery(await enqueueStaffCalendarUpdate(tx, edited, 'PENDING'));
      return { id: b.id };
    });
  }
  if (op === 'booking-action') {
    const input = decisionSchema.parse(raw);
    return prisma.$transaction(async (tx) => {
      const b = await lockBooking(tx, input.id, input.revision);
      const data: Prisma.AdminBookingUpdateInput = {
        revision: { increment: 1 },
        updatedBy: actor.id,
      };
      if (['CANCELLED', 'COMPLETED'].includes(b.reservation))
        throw new AdminError('This booking is closed. Its history is retained.');
      if (input.action === 'VERIFY' || input.action === 'FLAG') {
        if (b.reservation === 'CONFIRMED')
          throw new AdminError('Cancel the confirmed reservation before changing verification.');
        Object.assign(data, {
          verification: input.action === 'VERIFY' ? 'VERIFIED' : 'FLAGGED',
          verificationNote: input.reason,
          verifiedBy: actor.id,
          verifiedAt: new Date(),
        });
      }
      if (input.action === 'APPROVE' || input.action === 'REJECT') {
        if (b.reservation !== 'REQUESTED')
          throw new AdminError('Only a requested reservation can be reviewed.');
        Object.assign(data, {
          approval: input.action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          decisionReason: input.reason,
        });
      }
      if (input.action === 'APPROVE') {
        if (b.approval === 'APPROVED') throw new AdminError('This request is already approved.');
        if (b.verification === 'FLAGGED')
          throw new AdminError(
            'This request is flagged as suspicious. Verify the client contact to clear the flag before approving.',
          );
        if (b.totalCents < 1)
          throw new AdminError('Set the price with Edit details before approving this request.');
        const taken = await occupyingConflict(tx, b);
        if (taken)
          throw new AdminError(
            `This slot is already held or confirmed for ${taken.reference}.`,
            409,
          );
        // Approval holds the date until the payment deadline (docs/booking-automation.md).
        const rules = await readBookingRules(tx);
        data.holdExpiresAt = requiresPayment(b)
          ? paymentDeadline(new Date(), b.startsAt, rules.paymentDeadlineDays)
          : null;
      }
      if (input.action === 'EXTEND_HOLD') {
        if (b.reservation !== 'REQUESTED' || b.approval !== 'APPROVED' || !b.holdExpiresAt)
          throw new AdminError('Only a booking waiting for payment has a deadline to extend.');
        const rules = await readBookingRules(tx);
        const extended = paymentDeadline(new Date(), b.startsAt, rules.paymentDeadlineDays);
        if (extended <= b.holdExpiresAt)
          throw new AdminError('The deadline cannot move later because the event starts too soon.');
        Object.assign(data, { holdExpiresAt: extended, decisionReason: input.reason });
      }
      if (input.action === 'CONFIRM') {
        const block = await confirmationBlock(tx, b, paidTotal(b.payments));
        if (block) throw new AdminError(block.message, block.status);
        Object.assign(data, { reservation: 'CONFIRMED', holdExpiresAt: null });
      }
      if (input.action === 'REVIEW_POLICY') {
        const p = await policy(tx);
        if (!p.reviewed || b.reservation !== 'REQUESTED' || b.verification === 'FLAGGED')
          throw new AdminError(
            'Review the venue policy in Settings first, and clear any suspicious flag on this request.',
          );
        if (p.paymentRule === 'DEPOSIT_REQUIRED' && b.depositCents < 1)
          throw new AdminError(
            'A cash reservation fee must be agreed for a deposit-required booking.',
          );
        Object.assign(data, {
          policyVersion: p.version,
          paymentRule: p.paymentRule,
          decisionReason: input.reason,
          approval: 'PENDING',
          // Back to review: the date is no longer held, so no deadline applies until approval.
          holdExpiresAt: null,
        });
      }
      if (input.action === 'CANCEL')
        Object.assign(data, {
          reservation: 'CANCELLED',
          decisionReason: input.reason,
        });
      if (input.action === 'COMPLETE') {
        if (b.reservation !== 'CONFIRMED' || b.endsAt > new Date())
          throw new AdminError(
            'Only a confirmed event whose end time has passed can be completed.',
          );
        if (paidTotal(b.payments) < b.totalCents)
          throw new AdminError('Settle the cash balance before completing the event.');
        data.reservation = 'COMPLETED';
      }
      const updated = await tx.adminBooking.update({
        where: { id: b.id },
        data,
        include: { payments: true, contracts: true },
      });
      await audit(
        tx,
        actor,
        'Bookings',
        `${input.action} ${b.reference}: ${input.reason}`,
        input.action === 'APPROVE'
          ? 'APPROVAL'
          : input.action === 'REJECT'
            ? 'REJECTION'
            : 'UPDATE',
      );
      if (!['VERIFY', 'FLAG'].includes(input.action))
        await queue(tx, updated, DECISION_NOTICES[input.action] ?? input.action, {
          // Calendar invite on confirmation; a cancel update only if an invite was ever sent.
          calendar:
            input.action === 'CONFIRM'
              ? 'REQUEST'
              : input.action === 'CANCEL' && b.reservation === 'CONFIRMED'
                ? 'CANCEL'
                : undefined,
          staffCalendar: staffCalendarChange(input.action, b),
        });
      return { id: b.id };
    });
  }
  if (op === 'cash-receipt') {
    const input = receiptSchema.parse(raw);
    if (Date.parse(input.receivedAt) > Date.now())
      throw new AdminError('Cash receipt time cannot be in the future.');
    return prisma.$transaction(async (tx) => {
      const b = await lockBooking(tx, input.id, input.revision);
      if (b.approval !== 'APPROVED' || ['CANCELLED', 'COMPLETED'].includes(b.reservation))
        throw new AdminError('Cash can only be recorded for an approved, open booking.');
      if (paidTotal(b.payments) + input.amountCents > b.totalCents)
        throw new AdminError('Receipt exceeds the outstanding contract balance.');
      await tx.adminCashPayment.create({
        data: {
          bookingId: b.id,
          amountCents: input.amountCents,
          receiptNumber: input.receiptNumber,
          receivedAt: new Date(input.receivedAt),
          recordedBy: actor.id,
          note: input.note,
        },
      });
      // The booking automation: the payment that meets the confirmation rule confirms the
      // reservation in the same step, so staff never press a separate Confirm button for it.
      const confirmsNow =
        b.reservation === 'REQUESTED' &&
        !(await confirmationBlock(tx, b, paidTotal(b.payments) + input.amountCents));
      const updated = await tx.adminBooking.update({
        where: { id: b.id },
        data: {
          revision: { increment: 1 },
          updatedBy: actor.id,
          ...(confirmsNow ? { reservation: 'CONFIRMED', holdExpiresAt: null } : {}),
        },
        include: { payments: true, contracts: true },
      });
      await audit(
        tx,
        actor,
        'Payments',
        `Recorded CASH ${money(input.amountCents)} for ${b.reference}; receipt ${input.receiptNumber}.`,
        'CREATE',
      );
      await queue(tx, updated, 'CASH_RECEIPT');
      if (confirmsNow) {
        await audit(
          tx,
          actor,
          'Bookings',
          `Confirmed ${b.reference} automatically: the required payment was received.`,
        );
        await queue(tx, updated, 'RESERVATION_CONFIRMED', {
          calendar: 'REQUEST',
          staffCalendar: 'CONFIRMED',
        });
      }
      return { id: b.id, confirmed: confirmsNow };
    });
  }
  if (op === 'void-receipt') {
    if (actor.role !== 'SUPERADMIN')
      throw new AdminError('Only a super administrator may void cash receipts.', 403);
    const input = z
      .object({
        op: z.literal('void-receipt'),
        id: identifier,
        paymentId: identifier,
        revision: z.number().int(),
        reason: z.string().trim().min(5).max(1000),
      })
      .strict()
      .parse(raw);
    return prisma.$transaction(async (tx) => {
      const b = await lockBooking(tx, input.id, input.revision);
      const payment = b.payments.find((p) => p.id === input.paymentId && !p.voidedAt);
      if (!payment) throw new AdminError('Receipt not found or already voided.', 404);
      if (b.reservation === 'COMPLETED')
        throw new AdminError('Completed event receipts cannot be voided here.');
      const error = confirmationError(
        { ...b, reservation: 'REQUESTED' },
        paidTotal(b.payments) - payment.amountCents,
        true,
      );
      if (b.reservation === 'CONFIRMED' && error)
        throw new AdminError('Cancel the reservation before voiding cash needed to secure it.');
      await tx.adminCashPayment.update({
        where: { id: payment.id },
        data: {
          voidedAt: new Date(),
          voidedBy: actor.id,
          voidReason: input.reason,
        },
      });
      const updated = await tx.adminBooking.update({
        where: { id: b.id },
        data: { revision: { increment: 1 }, updatedBy: actor.id },
        include: { payments: true, contracts: true },
      });
      await audit(
        tx,
        actor,
        'Payments',
        `Voided receipt ${payment.receiptNumber} for ${b.reference}: ${input.reason}. History retained.`,
      );
      await queue(tx, updated, 'RECEIPT_VOIDED');
      return { id: b.id };
    });
  }
  if (op === 'verify-proof') {
    // Booking automation phase 2: staff found the transfer in Zion's own records. It is recorded
    // like a cash receipt and, when it meets the confirmation rule, confirms the booking.
    const input = verifyProofSchema.parse(raw);
    if (Date.parse(input.receivedAt) > Date.now())
      throw new AdminError('The payment time cannot be in the future.');
    return prisma.$transaction(async (tx) => {
      const b = await lockBooking(tx, input.id, input.revision);
      const proof = await submittedProof(tx, b.id, input.proofId);
      if (b.approval !== 'APPROVED' || ['CANCELLED', 'COMPLETED'].includes(b.reservation))
        throw new AdminError(
          'A payment can only be verified for an approved, open booking. Reject the screenshot instead.',
        );
      const paid = paidTotal(b.payments) + input.amountCents;
      if (paid > b.totalCents)
        throw new AdminError('The amount exceeds the outstanding contract balance.');
      const reference = normalizeTransferReference(input.referenceNumber);
      const receiptNumber = transferReceiptNumber(proof.method, reference);
      const recorded = await tx.adminCashPayment.findUnique({
        where: { receiptNumber },
        select: { booking: { select: { reference: true } } },
      });
      if (recorded)
        throw new AdminError(
          `This transfer is already recorded for ${recorded.booking.reference}. Do not record it twice.`,
          409,
        );
      const payment = await tx.adminCashPayment.create({
        data: {
          bookingId: b.id,
          amountCents: input.amountCents,
          receiptNumber,
          receivedAt: new Date(input.receivedAt),
          recordedBy: actor.id,
          note: input.note,
          method: proof.method,
        },
        select: { id: true },
      });
      await tx.adminPaymentProof.update({
        where: { id: proof.id },
        data: {
          status: 'VERIFIED',
          reviewedBy: actor.id,
          reviewedAt: new Date(),
          paymentId: payment.id,
        },
      });
      const confirmsNow = b.reservation === 'REQUESTED' && !(await confirmationBlock(tx, b, paid));
      const updated = await tx.adminBooking.update({
        where: { id: b.id },
        data: {
          revision: { increment: 1 },
          updatedBy: actor.id,
          ...(confirmsNow ? { reservation: 'CONFIRMED', holdExpiresAt: null } : {}),
        },
        include: { payments: true, contracts: true },
      });
      await audit(
        tx,
        actor,
        'Payments',
        `Verified ${PAYMENT_METHOD_LABELS[proof.method]} ${money(input.amountCents)} for ${b.reference} against our records; reference ${reference}.`,
        'APPROVAL',
        { proofId: proof.id, paymentId: payment.id },
      );
      await queue(tx, updated, 'PAYMENT_VERIFIED');
      if (confirmsNow) {
        await audit(
          tx,
          actor,
          'Bookings',
          `Confirmed ${b.reference} automatically: the required payment was verified.`,
        );
        await queue(tx, updated, 'RESERVATION_CONFIRMED', {
          calendar: 'REQUEST',
          staffCalendar: 'CONFIRMED',
        });
      }
      return { id: b.id, confirmed: confirmsNow };
    });
  }
  if (op === 'reject-proof') {
    const input = rejectProofSchema.parse(raw);
    return prisma.$transaction(async (tx) => {
      const b = await lockBooking(tx, input.id, input.revision);
      const proof = await submittedProof(tx, b.id, input.proofId);
      const now = new Date();
      // The client reads this on their payment page and in the email.
      const clientReason = [PAYMENT_REJECTION_REASONS[input.reason], input.note]
        .filter(Boolean)
        .join(' ');
      await tx.adminPaymentProof.update({
        where: { id: proof.id },
        data: {
          status: 'REJECTED',
          reviewReason: clientReason,
          reviewedBy: actor.id,
          reviewedAt: now,
        },
      });
      const waiting = b.reservation === 'REQUESTED' && b.approval === 'APPROVED';
      // The hold could not expire while staff checked the screenshot, so the client gets at least
      // a day to send another one, never past the start of the event.
      const retryUntil = new Date(Math.min(now.getTime() + 24 * HOUR_MS, b.startsAt.getTime()));
      const holdExpiresAt =
        waiting && b.holdExpiresAt && b.holdExpiresAt < retryUntil ? retryUntil : undefined;
      const updated = await tx.adminBooking.update({
        where: { id: b.id },
        data: {
          revision: { increment: 1 },
          updatedBy: actor.id,
          ...(holdExpiresAt ? { holdExpiresAt } : {}),
        },
        include: { payments: true, contracts: true },
      });
      await audit(
        tx,
        actor,
        'Payments',
        `Rejected the payment screenshot for ${b.reference}: ${clientReason}${holdExpiresAt ? ` Payment deadline moved to ${eventDate(holdExpiresAt)}.` : ''}`,
        'REJECTION',
        { proofId: proof.id },
      );
      // A closed or confirmed booking needs no new screenshot, so its client is not asked for one.
      if (waiting) await queue(tx, updated, 'PAYMENT_REJECTED', { note: clientReason });
      return { id: b.id };
    });
  }
  if (op === 'create-contract') {
    const input = z
      .object({
        op: z.literal('create-contract'),
        id: identifier,
        revision: z.number().int(),
      })
      .strict()
      .parse(raw);
    return prisma.$transaction(async (tx) => {
      const b = await lockBooking(tx, input.id, input.revision),
        p = await policy(tx);
      if (
        !p.reviewed ||
        b.approval !== 'APPROVED' ||
        b.verification === 'FLAGGED' ||
        ['CANCELLED', 'COMPLETED'].includes(b.reservation)
      )
        throw new AdminError(
          'Review the venue policy and approve an open booking that is not flagged as suspicious before preparing a contract.',
        );
      if (b.policyVersion !== p.version)
        throw new AdminError(
          b.reservation === 'REQUESTED'
            ? 'Re-review and approve this request under the current venue policy before preparing its agreement.'
            : 'This confirmed booking uses an older policy. Existing agreements remain unchanged; ask the venue owner to review an amendment.',
          409,
        );
      const version = (b.contracts[0]?.version ?? 0) + 1;
      const body = `ZION EVENTS PLACE\nEVENT SERVICE AGREEMENT — REVIEW COPY\n${b.reference} | Version ${version}\n\nClient: ${b.clientName}\nEmail: ${b.email}\nContact: ${b.phone}\nEvent: ${b.eventType}\nPackage: ${b.packageName}\nVenue: ${b.venue}\nStart: ${eventDate(b.startsAt)}\nEnd: ${eventDate(b.endsAt)}\nGuests: ${b.guests}\nTotal contract price: ${money(b.totalCents)}\nReservation fee: ${money(b.depositCents)}\nPayment policy: ${b.paymentRule}\nCash received at preparation: ${money(paidTotal(b.payments))}\nApproval: ${b.approval}\nReservation: ${b.reservation}\n\n${p.cashInstructions}\n\nTERMS (venue policy version ${p.version})\n${p.contractTerms}\n\nCLIENT AND VENUE SIGNATURES\nClient name/signature: ____________________\nVenue representative: ____________________\nDate: ____________________\n\nThis draft is prepared from the reviewed booking, not an automatic approval, signature, or payment confirmation.`;
      await tx.adminContract.create({
        data: {
          bookingId: b.id,
          version,
          bookingRevision: b.revision,
          body,
          createdBy: actor.id,
        },
      });
      await audit(
        tx,
        actor,
        'Contracts',
        `Prepared contract ${b.reference} v${version} from verified booking revision ${b.revision}.`,
        'CREATE',
      );
      return { id: b.id };
    });
  }
  if (op === 'contract-action') {
    const input = z
      .object({
        op: z.literal('contract-action'),
        id: identifier,
        contractId: identifier,
        revision: z.number().int(),
        action: z.enum(['ISSUE', 'SIGN']),
        signer: z.string().trim().max(180).default(''),
        reference: z.string().trim().max(180).default(''),
      })
      .strict()
      .parse(raw);
    return prisma.$transaction(async (tx) => {
      const b = await lockBooking(tx, input.id, input.revision),
        c = b.contracts.find((c) => c.id === input.contractId);
      if (!c) throw new AdminError('Contract not found.', 404);
      if (['CANCELLED', 'COMPLETED'].includes(b.reservation))
        throw new AdminError('This booking is closed.');
      if (c.bookingRevision !== b.revision)
        throw new AdminError(
          'This contract snapshot is outdated. Prepare a new version before issuing or recording signature.',
          409,
        );
      if (input.action === 'ISSUE' && c.status !== 'DRAFT')
        throw new AdminError('Only a draft may be issued.');
      if (
        input.action === 'SIGN' &&
        (c.status !== 'ISSUED' || input.signer.length < 2 || input.reference.length < 3)
      )
        throw new AdminError(
          'An issued contract, signer name, and signed-document reference are required.',
        );
      await tx.adminContract.update({
        where: { id: c.id },
        data:
          input.action === 'ISSUE'
            ? { status: 'ISSUED', finalizedBy: actor.id }
            : {
                status: 'SIGNED',
                signedBy: input.signer,
                signedAt: new Date(),
                signedReference: input.reference,
              },
      });
      await audit(
        tx,
        actor,
        'Contracts',
        `${input.action === 'ISSUE' ? 'Issued' : 'Recorded physical signature for'} ${b.reference} v${c.version}.`,
      );
      return { id: b.id };
    });
  }
  if (op === 'settings') {
    if (actor.role !== 'SUPERADMIN')
      throw new AdminError('Only a super administrator may update venue policy.', 403);
    const input = z
      .object({
        op: z.literal('settings'),
        version: z.number().int(),
        reviewed: z.boolean(),
        paymentRule: z.enum(paymentRules),
        cashInstructions: z.string().trim().min(20).max(3000),
        contractTerms: z.string().trim().min(100).max(30000),
      })
      .strict()
      .parse(raw);
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('zion-admin-policy'))::text`;
      const p = await policy(tx);
      if (p.version !== input.version)
        throw new AdminError('Policy changed. Reload Settings.', 409);
      const { op: _, version, ...data } = input;
      void _;
      await tx.adminPolicy.upsert({
        where: { id: 'venue' },
        create: {
          id: 'venue',
          ...data,
          version: version + 1,
          updatedBy: actor.id,
        },
        update: { ...data, version: version + 1, updatedBy: actor.id },
      });
      await audit(
        tx,
        actor,
        'Settings',
        `Reviewed venue policy v${version + 1}; cash only; ${input.paymentRule}. Public client settings were not modified.`,
        'SETTINGS_CHANGE',
      );
      return { saved: true };
    });
  }
  if (op === 'profile') {
    const input = z
      .object({
        op: z.literal('profile'),
        fullName: z.string().trim().min(2).max(180),
        contactNumber: z.string().trim().max(20),
        currentPassword: z.string().max(128).default(''),
        newPassword: z.string().max(128).default(''),
      })
      .strict()
      .parse(raw);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: actor.id },
    });
    if (actor.mustChangePassword && !input.newPassword)
      throw new AdminError('A new password is required.');
    if (input.newPassword) {
      if (
        input.newPassword.length < 12 ||
        input.newPassword === input.currentPassword ||
        bcrypt.truncates(input.newPassword)
      )
        throw new AdminError(
          'Use a different password with at least 12 characters and no more than 72 UTF-8 bytes.',
        );
      if (!user.passwordHash || !(await bcrypt.compare(input.currentPassword, user.passwordHash)))
        throw new AdminError('Current password is incorrect.');
    }
    const passwordHash = input.newPassword ? await bcrypt.hash(input.newPassword, 12) : undefined;
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: actor.id },
        data: {
          fullName: input.fullName,
          contactNumber: input.contactNumber,
          ...(passwordHash
            ? {
                passwordHash,
                lastPasswordChangedAt: new Date(),
                mustChangePassword: false,
                status: 'ACTIVE',
              }
            : {}),
        },
      });
      if (passwordHash)
        await tx.accountSession.updateMany({
          where: { userId: actor.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      await audit(
        tx,
        actor,
        'Profile',
        passwordHash ? 'Changed own password; prior sessions invalidated.' : 'Updated own profile.',
        passwordHash ? 'PASSWORD_CHANGE' : 'PROFILE_UPDATE',
      );
    });
    return { saved: true, signInAgain: Boolean(passwordHash) };
  }
  if (op === 'testimony-action') {
    const input = z
      .object({
        op: z.literal('testimony-action'),
        id: identifier,
        action: z.enum(['ALLOW', 'DELETE']),
      })
      .strict()
      .parse(raw);

    const existing = await prisma.testimony.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        clientName: true,
        nickname: true,
        eventType: true,
        photoPath: true,
        deletedAt: true,
      },
    });
    if (!existing || existing.deletedAt) {
      throw new AdminError('Held testimony not found.', 404);
    }

    const actorName = actor.fullName || actor.username;
    const now = new Date();
    const displayName = existing.nickname || existing.clientName;

    if (input.action === 'ALLOW') {
      await prisma.$transaction(async (tx) => {
        await tx.testimony.update({
          where: { id: existing.id },
          data: {
            status: TestimonyStatus.APPROVED,
            isPublic: true,
            approvedBy: actorName,
            approvedAt: now,
            hiddenBy: null,
            hiddenAt: null,
          },
        });
        await audit(
          tx,
          actor,
          'Testimonies',
          `Allowed and published held testimony from ${displayName} (${existing.eventType}).`,
          'APPROVAL',
          { testimonyId: existing.id, action: 'ALLOW' },
        );
      });
      return { id: existing.id, status: 'approved' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.testimony.update({
        where: { id: existing.id },
        data: {
          status: TestimonyStatus.DELETED,
          isPublic: false,
          deletedBy: actorName,
          deletedAt: now,
        },
      });
      await audit(
        tx,
        actor,
        'Testimonies',
        `Deleted red-flagged testimony from ${displayName} (${existing.eventType}).`,
        'REJECTION',
        { testimonyId: existing.id, action: 'DELETE' },
      );
    });
    if (existing.photoPath) {
      await deleteTestimonyPhoto(existing.photoPath);
    }
    return { id: existing.id, status: 'deleted' };
  }
  throw new AdminError('Unknown operation.', 400);
}
