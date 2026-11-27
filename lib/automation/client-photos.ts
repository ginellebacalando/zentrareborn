import 'server-only';

import { BRAND } from '@/config/brand';
import { CLIENT_PHOTO_LIMITS, clientPhotoWhy } from '@/config/client-photos';
import { readClientPhotoRetentionDays } from '@/lib/admin/preferences';
import { photoPageUrl, type PhotoSubject } from '@/lib/client-photo-link';
import {
  clientPhotoKey,
  deleteExpiredClientPhotos,
  findClientPhoto,
  readPhotoSubject,
  type PhotoSubjectRecord,
} from '@/lib/client-photos';
import { isEmailAddress } from '@/lib/email-address';
import { prisma } from '@/lib/prisma';
import { AUTOMATION_POLICY } from './config';
import { enqueueJobs, type OutboxDb } from './outbox';
import { greetingName, manilaDate, manilaTime, renderEmail, type RenderedEmail } from './templates';
import { addDays, manilaDay, manilaDayStart, manilaHour } from './time';

/**
 * Client photo emails and housekeeping (docs/client-photos.md). Email only, because a text
 * message cannot carry the private link:
 *
 * - CLIENT_PHOTO_REQUEST: staff ask a client for a photo ("Request photo").
 * - CLIENT_PHOTO_RETAKE: staff ask for a new one, for example when the face is not clear.
 * - CLIENT_PHOTO_REMINDER: one reminder, three days before a confirmed event or a scheduled
 *   visit, while the client has no photo.
 *
 * Each email carries a seven-day photo link and goes out only while it still makes sense. The
 * scheduled run also deletes photos after the retention period (Settings).
 */
export const CLIENT_PHOTO_EVENTS = {
  request: 'CLIENT_PHOTO_REQUEST',
  retake: 'CLIENT_PHOTO_RETAKE',
  reminder: 'CLIENT_PHOTO_REMINDER',
} as const;
export type ClientPhotoEmailKind = keyof typeof CLIENT_PHOTO_EVENTS;

const JOB_KEY = /^client-photo:(request|retake|reminder):([bv])-([a-z0-9_-]{1,62})(?::|$)/i;

function subjectKey(subject: PhotoSubject) {
  return `${subject.kind === 'booking' ? 'b' : 'v'}-${subject.id}`;
}

/** The client's photo email: why Zion asks, that it is optional, and the private link. */
export function clientPhotoEmail(
  record: PhotoSubjectRecord,
  kind: ClientPhotoEmailKind,
  url: string,
  retentionDays: number,
): RenderedEmail {
  const name = greetingName(record.clientName);
  const visit = record.subject.kind === 'visit';
  const what = visit ? 'ocular visit' : 'event';
  const when = `${manilaDate(record.startsAt)} at ${manilaTime(record.startsAt)} (Manila time)`;
  const intro = {
    request: `Our team would like to welcome you by name when you arrive for your ${what} on ${when}. If you like, add a photo of yourself.`,
    retake:
      'Thank you for adding a photo. Our team could not see your face clearly in it, so they asked if you could send a new one.',
    reminder: `Your ${what} is on ${when}. If you like, add a photo before then so our team can welcome you by name when you arrive.`,
  }[kind];
  return renderEmail({
    subject: `${BRAND.legalName} | ${kind === 'retake' ? 'A clearer photo, if you can' : 'Add your photo (optional)'} | ${record.reference}`,
    preheader:
      kind === 'retake'
        ? 'Our team asked for a clearer photo. It stays optional.'
        : 'Optional: help our team recognize you when you arrive.',
    heading:
      kind === 'retake'
        ? 'Could you send a new photo?'
        : kind === 'reminder'
          ? 'Add your photo before you arrive'
          : 'Add your photo (optional)',
    sections: [
      {
        paragraphs: [
          name ? `Hello ${name},` : 'Hello,',
          intro,
          clientPhotoWhy(retentionDays),
          'For a good photo, face the camera in good light, without sunglasses, masks or filters, with only you in the photo.',
          `The photo is optional: your ${visit ? 'visit' : 'booking'} is the same without it. The link works for ${CLIENT_PHOTO_LIMITS.linkDays} days.`,
        ],
        details: [[visit ? 'Visit reference' : 'Booking reference', record.reference]],
      },
    ],
    action: { label: kind === 'retake' ? 'Send a new photo' : 'Add your photo', href: url },
  });
}

export type PhotoEmailOutcome =
  { queued: string[] } | { skipped: 'no-email' | 'no-link' | 'duplicate' };

/**
 * Queues a photo email for a booking or visit. Staff requests can be sent again (one per minute,
 * so a double click sends one); the reminder goes out once per booking or visit, ever.
 */
export async function enqueueClientPhotoEmail(
  db: OutboxDb,
  record: PhotoSubjectRecord,
  kind: ClientPhotoEmailKind,
  now: Date,
  retentionDays: number,
): Promise<PhotoEmailOutcome> {
  const recipient = clientPhotoKey(record.email);
  if (!isEmailAddress(recipient)) return { skipped: 'no-email' };
  const url = photoPageUrl(record.subject, now);
  if (!url) return { skipped: 'no-link' };
  const key =
    kind === 'reminder'
      ? `client-photo:reminder:${subjectKey(record.subject)}`
      : `client-photo:${kind}:${subjectKey(record.subject)}:${Math.floor(now.getTime() / 60_000)}`;
  const queued = await enqueueJobs(
    db,
    [
      {
        idempotencyKey: key,
        event: CLIENT_PHOTO_EVENTS[kind],
        recipient,
        bookingId: record.subject.kind === 'booking' ? record.subject.id : null,
        ...clientPhotoEmail(record, kind, url, retentionDays),
        // A photo helps only until the client arrives.
        expiresAt: record.startsAt,
      },
    ],
    now,
  );
  return queued.length ? { queued } : { skipped: 'duplicate' };
}

/**
 * From the morning on, one reminder for confirmed events and scheduled visits three days ahead
 * whose client has no photo yet. Returns how many were queued.
 */
export async function scheduleClientPhotoReminders(now = new Date()) {
  if (manilaHour(now) < AUTOMATION_POLICY.morningHourManila) return 0;
  const day = addDays(manilaDay(now), CLIENT_PHOTO_LIMITS.reminderDaysBefore);
  const startsAt = { gte: manilaDayStart(day), lt: manilaDayStart(addDays(day, 1)) };
  const [bookings, visits] = await Promise.all([
    prisma.adminBooking.findMany({
      where: { reservation: 'CONFIRMED', startsAt },
      select: { id: true },
      take: 200,
    }),
    prisma.adminVisit.findMany({
      where: { status: 'SCHEDULED', startsAt },
      select: { id: true },
      take: 200,
    }),
  ]);
  const subjects: PhotoSubject[] = [
    ...bookings.map((booking) => ({ kind: 'booking' as const, id: booking.id })),
    ...visits.map((visit) => ({ kind: 'visit' as const, id: visit.id })),
  ];
  if (!subjects.length) return 0;
  const retentionDays = await readClientPhotoRetentionDays();
  let queued = 0;
  for (const subject of subjects) {
    const record = await readPhotoSubject(subject);
    if (!record?.open || (await findClientPhoto(record.email))) continue;
    const outcome = await enqueueClientPhotoEmail(prisma, record, 'reminder', now, retentionDays);
    if ('queued' in outcome) queued += outcome.queued.length;
  }
  return queued;
}

/**
 * Why a photo email should not go out at delivery time, or null when it still makes sense: the
 * booking or visit ended or was cancelled, or (for a request or reminder) the client has already
 * added a photo staff have not asked to replace.
 */
export async function clientPhotoJobIrrelevance(job: { idempotencyKey: string | null }) {
  const match = JOB_KEY.exec(job.idempotencyKey ?? '');
  if (!match) return null;
  const record = await readPhotoSubject({
    kind: match[2].toLowerCase() === 'b' ? 'booking' : 'visit',
    id: match[3],
  });
  if (!record?.open) return 'Not sent: the booking or visit has ended or was cancelled.';
  if (match[1] === 'retake') return null;
  const photo = await findClientPhoto(record.email);
  return photo && photo.review !== 'RETAKE'
    ? 'Not sent: the client has already added a photo.'
    : null;
}

/**
 * Deletes photos past the retention period (Settings, to confirm with Zion) and records how many
 * in the Activity log, without names. Runs with every scheduled run.
 */
export async function deleteExpiredPhotos(now = new Date()) {
  const days = await readClientPhotoRetentionDays();
  const deleted = await deleteExpiredClientPhotos(now, days);
  if (deleted)
    await prisma.auditLog.create({
      data: {
        userName: 'Automation',
        userRole: 'SYSTEM',
        action: 'FILE_DELETE',
        module: 'Client photos',
        description: `Deleted ${deleted} client photo${deleted === 1 ? '' : 's'} ${days} days after the client's last event or visit ended (retention).`,
        status: 'SUCCESS',
        source: 'zion-automation',
        metadata: { deleted, retentionDays: days },
      },
    });
  return deleted;
}
