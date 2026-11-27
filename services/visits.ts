import 'server-only';

import { z } from 'zod';
import { errorMetadata, getRequestContext } from '@/lib/audit';
import { greetingName } from '@/lib/automation/templates';
import { PHILIPPINE_MOBILE_ERROR, philippineMobile } from '@/lib/phone-number';
import { prisma } from '@/lib/prisma';
import { visitIdFromManageToken, visitManagePath } from '@/lib/visit-link';
import { manilaDateKey } from '@/lib/visit-rules';
import {
  VISIT_FIELD_LIMITS,
  type ScheduledVisit,
  type VisitManageView,
  type VisitStatus,
} from '@/lib/visit-types';
import {
  cancelVisit,
  createVisit,
  readVisitAvailability,
  rescheduleVisit,
  VisitError,
  type VisitAuditActor,
} from '@/lib/visits';

/**
 * The public side of ocular visits (docs/visits.md): the visit page schedules a visit at an open
 * time, and the private manage link (lib/visit-link.ts) moves or cancels it. Nothing here
 * exposes other visitors' details; the manage page shows only its own visit.
 */

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;
/** Abuse guards; real demand is far below these. */
const VISITS_PER_EMAIL_PER_DAY = 3;
const WEBSITE_VISITS_PER_HOUR = 30;
const MANAGE_CHANGES_PER_DAY = 5;
const EVENT_DATE_MAX_DAYS = 2 * 366;

const instant = z.iso.datetime({ offset: true, error: 'Choose a visit time.' });

const visitSchema = z
  .object({
    startsAt: instant,
    fullName: z
      .string()
      .trim()
      .min(2, 'Enter your full name.')
      .max(VISIT_FIELD_LIMITS.name, 'The name is too long.'),
    email: z.preprocess(
      (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
      z.email('Enter a valid email address.').max(VISIT_FIELD_LIMITS.email),
    ),
    phone: z
      .string()
      .refine((value) => philippineMobile(value) !== null, PHILIPPINE_MOBILE_ERROR)
      .transform((value) => philippineMobile(value) ?? value),
    eventType: z.string().trim().max(VISIT_FIELD_LIMITS.eventType).default(''),
    eventDate: z.union([z.literal(''), z.iso.date('Enter a valid event date.')]).default(''),
    guests: z
      .number('Enter the number of guests.')
      .int('Enter a whole number of guests.')
      .min(VISIT_FIELD_LIMITS.guests.min, 'Enter at least 1 guest.')
      .max(VISIT_FIELD_LIMITS.guests.max, 'Enter fewer guests.')
      .nullable()
      .default(null),
    message: z
      .string()
      .trim()
      .max(VISIT_FIELD_LIMITS.message, 'The message is too long.')
      .default(''),
    consent: z.literal(true, {
      error: 'Please agree to the privacy notice so we can arrange your visit.',
    }),
    fromZeni: z.boolean().default(false),
    /** Honeypot: real visitors never see or fill this field. */
    website: z.string().max(0, 'Please check the visit details.').default(''),
  })
  .strict();

export type WebsiteVisitInput = z.input<typeof visitSchema>;

const manageSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('reschedule'),
      token: z.string().min(10).max(200),
      revision: z.number().int().min(1),
      startsAt: instant,
    })
    .strict(),
  z
    .object({
      action: z.literal('cancel'),
      token: z.string().min(10).max(200),
      revision: z.number().int().min(1),
    })
    .strict(),
]);

function rejectCrossSite(request: Request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site')
    throw new VisitError('Use the Zion Events Place website to manage visits.', 403);
}

async function readJson(request: Request) {
  if (Number(request.headers.get('content-length') ?? 0) > 20_000)
    throw new VisitError('The request is too large.', 413);
  try {
    return await request.json();
  } catch {
    throw new VisitError('The request body is invalid.');
  }
}

/** The open visit days the website offers now. */
export function readPublicVisitDays() {
  return readVisitAvailability();
}

/** Saves a visit from the public visit page; the emails are queued with it. */
export async function scheduleWebsiteVisit(request: Request) {
  rejectCrossSite(request);
  const parsed = visitSchema.safeParse(await readJson(request));
  if (!parsed.success)
    throw new VisitError(parsed.error.issues[0]?.message ?? 'Please check the visit details.');
  const input = parsed.data;
  const now = new Date();
  const today = manilaDateKey(now);
  if (input.eventDate) {
    const days =
      (Date.parse(`${input.eventDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS;
    if (days < 0 || days > EVENT_DATE_MAX_DAYS)
      throw new VisitError('Enter an event date within the next two years.');
  }
  const source = input.fromZeni ? 'ZENI' : 'WEBSITE';
  const context = getRequestContext(request);
  const actor: VisitAuditActor = {
    userId: null,
    userName: input.fullName,
    userRole: 'PUBLIC',
    ...context,
  };
  const { visit, notificationIds } = await createVisit(
    {
      clientName: input.fullName,
      email: input.email,
      phone: input.phone,
      startsAt: new Date(input.startsAt),
      source,
      eventType: input.eventType,
      eventDate: input.eventDate ? new Date(`${input.eventDate}T00:00:00Z`) : null,
      guests: input.guests,
      message: input.message,
      consentAt: now,
      createdBy: null,
    },
    {
      staff: false,
      actor,
      now,
      guard: async (tx) => {
        const website = { in: ['WEBSITE', 'ZENI'] };
        const [upcoming, fromEmail, lastHour] = await Promise.all([
          tx.adminVisit.count({
            where: { email: input.email, status: 'SCHEDULED', startsAt: { gt: now } },
          }),
          tx.adminVisit.count({
            where: {
              email: input.email,
              source: website,
              createdAt: { gte: new Date(now.getTime() - DAY_MS) },
            },
          }),
          tx.adminVisit.count({
            where: { source: website, createdAt: { gte: new Date(now.getTime() - HOUR_MS) } },
          }),
        ]);
        // The date stays out of the message, so an email address reveals no one's plans.
        if (upcoming)
          throw new VisitError(
            'This email already has an upcoming visit. Use the link in your confirmation email to change it, or contact us.',
            409,
          );
        if (fromEmail >= VISITS_PER_EMAIL_PER_DAY)
          throw new VisitError(
            'We already received several visits from this email today. Please contact us to arrange another.',
            429,
          );
        if (lastHour >= WEBSITE_VISITS_PER_HOUR)
          throw new VisitError(
            'We are receiving many visit requests right now. Please try again in a few minutes.',
            429,
          );
      },
    },
  );
  const result: ScheduledVisit = {
    reference: visit.reference,
    startsAt: visit.startsAt.toISOString(),
    endsAt: visit.endsAt.toISOString(),
    emailed: notificationIds.length > 0,
    managePath: visitManagePath(visit.id),
  };
  return { result, notificationIds };
}

/** What a manage link shows: its own visit and, while it can change, the open times. */
export async function readVisitManagePage(token: string): Promise<VisitManageView> {
  const visitId = visitIdFromManageToken(token);
  if (!visitId) return { state: 'invalid' };
  const visit = await prisma.adminVisit.findUnique({
    where: { id: visitId },
    select: {
      id: true,
      reference: true,
      clientName: true,
      startsAt: true,
      endsAt: true,
      status: true,
      revision: true,
    },
  });
  if (!visit) return { state: 'invalid' };
  const now = new Date();
  const status = visit.status as VisitStatus;
  if (status !== 'SCHEDULED' || visit.startsAt <= now)
    return {
      state: 'closed',
      reference: visit.reference,
      status,
      startsAt: visit.startsAt.toISOString(),
      endsAt: visit.endsAt.toISOString(),
    };
  const { days, slotMinutes } = await readVisitAvailability({ now, exceptVisitId: visit.id });
  return {
    state: 'open',
    reference: visit.reference,
    firstName: greetingName(visit.clientName).split(' ')[0] ?? '',
    startsAt: visit.startsAt.toISOString(),
    endsAt: visit.endsAt.toISOString(),
    revision: visit.revision,
    slotMinutes,
    days,
  };
}

/** Moves or cancels a visit from its manage link. */
export async function manageWebsiteVisit(request: Request) {
  rejectCrossSite(request);
  const parsed = manageSchema.safeParse(await readJson(request));
  if (!parsed.success)
    throw new VisitError(parsed.error.issues[0]?.message ?? 'Please check the visit details.');
  const input = parsed.data;
  const visitId = visitIdFromManageToken(input.token);
  if (!visitId) throw new VisitError('This visit link is not valid.', 404);
  const now = new Date();
  const changesToday = await prisma.auditLog.count({
    where: {
      module: 'Front desk',
      userRole: 'PUBLIC',
      action: 'UPDATE',
      timestamp: { gte: new Date(now.getTime() - DAY_MS) },
      metadata: { path: ['visitId'], equals: visitId },
    },
  });
  if (changesToday >= MANAGE_CHANGES_PER_DAY)
    throw new VisitError(
      'This visit was changed several times today. Please contact us to change it again.',
      429,
    );
  const actor: VisitAuditActor = {
    userId: null,
    userName: 'Visitor (manage link)',
    userRole: 'PUBLIC',
    ...getRequestContext(request),
  };
  const options = { by: 'VISITOR' as const, actor, expectedRevision: input.revision, now };
  const { visit, notificationIds } =
    input.action === 'reschedule'
      ? await rescheduleVisit(visitId, new Date(input.startsAt), options)
      : await cancelVisit(visitId, { ...options, reason: '' });
  return {
    result: {
      reference: visit.reference,
      startsAt: visit.startsAt.toISOString(),
      endsAt: visit.endsAt.toISOString(),
      cancelled: input.action === 'cancel',
    },
    notificationIds,
  };
}

export function visitErrorResponse(error: unknown) {
  if (error instanceof VisitError)
    return Response.json(
      { error: error.message, ...(error.code ? { code: error.code } : {}) },
      { status: error.status },
    );
  console.error('Unable to save a visit.', errorMetadata(error));
  return Response.json(
    { error: 'We could not save your visit right now. Please try again or contact us.' },
    { status: 500 },
  );
}
