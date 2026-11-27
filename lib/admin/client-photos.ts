import 'server-only';

import { z } from 'zod';
import { CLIENT_PHOTO_LIMITS } from '@/config/client-photos';
import { errorMetadata, getRequestContext } from '@/lib/audit';
import { enqueueClientPhotoEmail, type PhotoEmailOutcome } from '@/lib/automation/client-photos';
import { scheduleAutomationDelivery } from '@/lib/automation/trigger';
import { ClientPhotoFileError, prepareClientPhoto } from '@/lib/client-photo-file';
import type { PhotoSubject } from '@/lib/client-photo-link';
import {
  clientPhotoKey,
  deleteClientPhoto,
  findClientPhoto,
  readPhotoSubject,
  saveClientPhoto,
  staffPhotosFor,
  staffPhotoView,
  type PhotoSubjectRecord,
  type StaffClientPhoto,
} from '@/lib/client-photos';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import type { AdminActor } from './access';
import { AdminError } from './errors';
import { canDo } from './permissions';
import { readClientPhotoRetentionDays } from './preferences';

/**
 * Client photos in the admin (docs/client-photos.md). Only roles with the 'client-photos' action
 * (lib/admin/permissions.ts: staff who handle bookings, visits or the Front desk) receive photos
 * at all; for other roles the field is left out on the server. Staff review a photo ("Photo OK"
 * or "Ask for a new one"), email a client the photo link ("Request photo"), remove a photo, and
 * take one at the venue after asking the client. Everything is recorded in the Activity log.
 */
export const CLIENT_PHOTO_OPERATIONS = [
  'client-photo-review',
  'client-photo-request',
  'client-photo-remove',
] as const;

export type WithClientPhoto = { clientPhoto?: StaffClientPhoto | null };

/**
 * Adds each record's client photo (matched by email address) for roles that may see photos. It
 * never fails a page: when photos are unavailable the records come back unchanged.
 */
export async function withClientPhotos<T extends { email: string }>(
  rows: T[],
  actor: Pick<AdminActor, 'role'>,
  now = new Date(),
): Promise<(T & WithClientPhoto)[]> {
  if (!rows.length || !canDo(actor.role, 'client-photos')) return rows;
  try {
    const photos = await staffPhotosFor(
      rows.map((row) => row.email),
      now,
    );
    return rows.map((row) => ({
      ...row,
      clientPhoto: photos.get(clientPhotoKey(row.email)) ?? null,
    }));
  } catch (error) {
    console.error('Client photos are unavailable.', errorMetadata(error));
    return rows;
  }
}

const subjectSchema = z
  .object({
    kind: z.enum(['booking', 'visit']),
    id: z.string().regex(/^[a-z0-9_-]{1,62}$/i, 'Unknown booking or visit.'),
  })
  .strict();

const operationInput = z.discriminatedUnion('op', [
  z
    .object({
      op: z.literal('client-photo-review'),
      subject: subjectSchema,
      decision: z.enum(['OK', 'RETAKE']),
    })
    .strict(),
  z.object({ op: z.literal('client-photo-request'), subject: subjectSchema }).strict(),
  z.object({ op: z.literal('client-photo-remove'), subject: subjectSchema }).strict(),
]);

function subjectLabel(record: PhotoSubjectRecord) {
  return `${record.subject.kind === 'booking' ? 'booking' : 'visit'} ${record.reference}`;
}

async function subjectRecord(subject: PhotoSubject) {
  const record = await readPhotoSubject(subject);
  if (!record) throw new AdminError('Booking or visit not found.', 404);
  return record;
}

async function audit(
  tx: Prisma.TransactionClient,
  actor: AdminActor,
  action: 'UPDATE' | 'FILE_UPLOAD' | 'FILE_DELETE',
  description: string,
  record: PhotoSubjectRecord,
  context: { ipAddress?: string | null; userAgent?: string | null } = {},
) {
  await tx.auditLog.create({
    data: {
      userId: actor.id,
      userName: actor.fullName || actor.username,
      userRole: actor.role,
      action,
      module: 'Client photos',
      description,
      status: 'SUCCESS',
      source: 'zion-admin',
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
      metadata:
        record.subject.kind === 'booking'
          ? { bookingId: record.subject.id, reference: record.reference }
          : { visitId: record.subject.id, reference: record.reference },
    },
  });
}

/** Why a photo email could not be queued, in words for staff. */
function emailProblem(outcome: PhotoEmailOutcome) {
  if (!('skipped' in outcome) || outcome.skipped === 'duplicate') return null;
  return outcome.skipped === 'no-email'
    ? 'This client has no valid email address, so the photo link cannot be sent. Take the photo at the venue instead.'
    : 'Photo links need the website address and AUTH_SECRET to be set. Ask the developer to set them.';
}

/** Photo OK, ask for a new one, request a photo, or remove one. */
export async function clientPhotoMutate(raw: unknown, actor: AdminActor) {
  const input = operationInput.parse(raw);
  const record = await subjectRecord(input.subject);
  const now = new Date();
  const name = record.clientName;
  if (input.op === 'client-photo-remove') {
    const removed = await prisma.$transaction(async (tx) => {
      const done = await deleteClientPhoto(tx, record.email);
      if (done)
        await audit(
          tx,
          actor,
          'FILE_DELETE',
          `Removed ${name}'s arrival photo (${subjectLabel(record)}); it was deleted at once.`,
          record,
        );
      return done;
    });
    if (!removed) throw new AdminError('This client has no photo.', 404);
    return { removed: true };
  }
  const retentionDays = await readClientPhotoRetentionDays();
  if (input.op === 'client-photo-request') {
    if (!record.open)
      throw new AdminError('This booking or visit has ended, so a photo is no longer needed.', 409);
    const outcome = await prisma.$transaction(async (tx) => {
      const result = await enqueueClientPhotoEmail(tx, record, 'request', now, retentionDays);
      if ('queued' in result)
        await audit(
          tx,
          actor,
          'UPDATE',
          `Asked ${name} for an arrival photo (${subjectLabel(record)}) and emailed the photo link.`,
          record,
        );
      return result;
    });
    const problem = emailProblem(outcome);
    if (problem) throw new AdminError(problem, 409);
    if ('queued' in outcome) scheduleAutomationDelivery(outcome.queued);
    return { requested: true };
  }
  const photo = await findClientPhoto(record.email);
  if (!photo) throw new AdminError('This client has no photo to review.', 404);
  if (input.decision === 'RETAKE' && !record.open)
    throw new AdminError('This booking or visit has ended, so a new photo is not needed.', 409);
  const outcome = await prisma.$transaction(async (tx) => {
    await tx.adminClientPhoto.update({
      where: { id: photo.id },
      data: { review: input.decision, reviewedBy: actor.username, reviewedAt: now },
    });
    const result =
      input.decision === 'RETAKE'
        ? await enqueueClientPhotoEmail(tx, record, 'retake', now, retentionDays)
        : null;
    const problem = result ? emailProblem(result) : null;
    if (problem) throw new AdminError(problem, 409);
    await audit(
      tx,
      actor,
      'UPDATE',
      input.decision === 'OK'
        ? `Marked ${name}'s arrival photo OK (${subjectLabel(record)}).`
        : `Asked ${name} for a new arrival photo (${subjectLabel(record)}) and emailed the photo link.`,
      record,
    );
    return result;
  });
  if (outcome && 'queued' in outcome) scheduleAutomationDelivery(outcome.queued);
  return { review: input.decision };
}

/**
 * A photo staff take or upload at the venue (for example of a walk-in client), only after asking
 * the client and ticking the consent box. Multipart form: kind, id, consent, photo.
 */
export async function saveStaffClientPhoto(request: Request, actor: AdminActor) {
  if (
    Number(request.headers.get('content-length') ?? 0) >
    CLIENT_PHOTO_LIMITS.maxUploadBytes + 64 * 1024
  )
    throw new AdminError('That photo is too large. Choose one under 10 MB.', 413);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new AdminError('The photo could not be read. Please try again.');
  }
  const text = (key: string) => {
    const value = form.get(key);
    return typeof value === 'string' ? value : undefined;
  };
  const subject = subjectSchema.safeParse({ kind: text('kind'), id: text('id') });
  if (!subject.success) throw new AdminError('Unknown booking or visit.', 404);
  if (text('consent') !== 'yes')
    throw new AdminError('Ask the client first, then tick the consent box.');
  const record = await subjectRecord(subject.data);
  if (!record.open)
    throw new AdminError('This booking or visit has ended, so a photo is no longer needed.', 409);
  const file = form.get('photo');
  if (!(file instanceof Blob)) throw new AdminError('Choose a photo first.');
  let prepared: Awaited<ReturnType<typeof prepareClientPhoto>>;
  try {
    prepared = await prepareClientPhoto(file);
  } catch (error) {
    if (error instanceof ClientPhotoFileError) throw new AdminError(error.message);
    throw error;
  }
  const now = new Date();
  const context = getRequestContext(request);
  const saved = await prisma.$transaction(async (tx) => {
    const result = await saveClientPhoto(tx, {
      email: record.email,
      clientName: record.clientName,
      photo: prepared,
      source: 'STAFF',
      now,
    });
    await audit(
      tx,
      actor,
      'FILE_UPLOAD',
      `${result.replaced ? 'Replaced' : 'Took'} ${record.clientName}'s arrival photo at the venue with their consent (${subjectLabel(record)}).`,
      record,
      context,
    );
    return result.photo;
  });
  return { clientPhoto: staffPhotoView(saved, now) };
}
