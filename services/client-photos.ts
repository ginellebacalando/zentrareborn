import 'server-only';

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { CLIENT_PHOTO_LIMITS, type OwnClientPhoto } from '@/config/client-photos';
import { readClientPhotoRetentionDays } from '@/lib/admin/preferences';
import { errorMetadata, getRequestContext } from '@/lib/audit';
import { ClientPhotoFileError, prepareClientPhoto } from '@/lib/client-photo-file';
import { photoViewPath, subjectFromPhotoToken, type PhotoSubject } from '@/lib/client-photo-link';
import {
  deleteClientPhoto,
  ownClientPhoto,
  readPhotoSubject,
  saveClientPhoto,
  type PhotoSubjectRecord,
} from '@/lib/client-photos';
import { prisma } from '@/lib/prisma';

/**
 * The client's side of optional client photos (docs/client-photos.md): the step after a booking
 * request or visit, the photo section of their private pages, and the emailed photo link all add,
 * change or remove the photo through a signed, expiring link token (lib/client-photo-link.ts). The
 * token names a booking or visit; the photo itself belongs to that client's email address.
 */
export class ClientPhotoError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ClientPhotoError';
    this.status = status;
  }
}

const MAX_REQUEST_BYTES = CLIENT_PHOTO_LIMITS.maxUploadBytes + 64 * 1024;
/** Uploads and removals per booking or visit in 15 minutes. */
const ATTEMPTS_PER_WINDOW = 12;
const EXPIRED = 'This photo link has expired or is not valid. Ask our team for a new one.';

function subjectLabel(record: PhotoSubjectRecord) {
  return `${record.subject.kind === 'booking' ? 'booking' : 'visit'} ${record.reference}`;
}

function subjectMetadata(subject: PhotoSubject) {
  return subject.kind === 'booking' ? { bookingId: subject.id } : { visitId: subject.id };
}

/** One shared limit per booking or visit, in the table the staff sign-in limit uses. */
async function allowAttempt(subject: PhotoSubject) {
  const key = createHash('sha256')
    .update(`client-photo:${subject.kind}:${subject.id}`)
    .digest('hex');
  const rows = await prisma.$queryRaw<{ attempts: number }[]>`
    INSERT INTO zion_admin_rate_limits (key, attempts, "windowAt") VALUES (${key}, 1, NOW())
    ON CONFLICT (key) DO UPDATE SET attempts = CASE WHEN zion_admin_rate_limits."windowAt" < NOW() - INTERVAL '15 minutes' THEN 1 ELSE zion_admin_rate_limits.attempts + 1 END,
    "windowAt" = CASE WHEN zion_admin_rate_limits."windowAt" < NOW() - INTERVAL '15 minutes' THEN NOW() ELSE zion_admin_rate_limits."windowAt" END RETURNING attempts`;
  return (rows[0]?.attempts ?? 1) <= ATTEMPTS_PER_WINDOW;
}

/**
 * The client's photo for a booking's or visit's page, or null to leave the photo out. It never
 * throws: booking and visit scheduling work exactly the same when photos are unavailable (for
 * example before prisma/client-photos.sql is installed).
 */
export async function clientPhotoFor(subject: PhotoSubject, now = new Date()) {
  try {
    const record = await readPhotoSubject(subject);
    return record ? await ownClientPhoto(record, await readClientPhotoRetentionDays(), now) : null;
  } catch (error) {
    console.error('Client photos are unavailable.', errorMetadata(error));
    return null;
  }
}

export type PhotoPageView =
  | { state: 'invalid' }
  | {
      state: 'ready';
      firstName: string;
      reference: string;
      kind: PhotoSubject['kind'];
      startsAt: string;
      photo: OwnClientPhoto;
    };

/** The page behind an emailed photo link (/photo/<token>). */
export async function readPhotoPage(token: string, now = new Date()): Promise<PhotoPageView> {
  let subject: PhotoSubject | null = null;
  try {
    subject = subjectFromPhotoToken(token, now);
  } catch {
    return { state: 'invalid' };
  }
  const record = subject ? await readPhotoSubject(subject) : null;
  const photo = record
    ? await ownClientPhoto(record, await readClientPhotoRetentionDays(), now)
    : null;
  if (!record || !photo) return { state: 'invalid' };
  return {
    state: 'ready',
    firstName: record.clientName.trim().split(/\s+/)[0] ?? '',
    reference: record.reference,
    kind: record.subject.kind,
    startsAt: record.startsAt.toISOString(),
    photo,
  };
}

function checkOrigin(request: Request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site')
    throw new ClientPhotoError('Add your photo from your Zion Events Place page.', 403);
}

async function subjectFor(token: string | undefined) {
  let subject: PhotoSubject | null = null;
  try {
    subject = token ? subjectFromPhotoToken(token) : null;
  } catch {
    subject = null;
  }
  const record = subject ? await readPhotoSubject(subject) : null;
  if (!subject || !record) throw new ClientPhotoError(EXPIRED, 404);
  if (!(await allowAttempt(subject)))
    throw new ClientPhotoError('Too many tries. Please wait a few minutes and try again.', 429);
  return record;
}

/** Saves the client's photo from a multipart form: token, consent, photo (and a honeypot). */
export async function submitClientPhoto(request: Request) {
  checkOrigin(request);
  if (Number(request.headers.get('content-length') ?? 0) > MAX_REQUEST_BYTES)
    throw new ClientPhotoError('That photo is too large. Choose one under 10 MB.', 413);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ClientPhotoError('Your photo could not be read. Please try again.');
  }
  const text = (key: string) => {
    const value = form.get(key);
    return typeof value === 'string' ? value : undefined;
  };
  // Filled in only by bots, which never see the hidden field's label.
  if (text('website')) throw new ClientPhotoError('Your photo could not be saved.');
  const record = await subjectFor(text('token'));
  if (text('consent') !== 'yes')
    throw new ClientPhotoError('Tick the box to agree before you save your photo.');
  if (!record.open)
    throw new ClientPhotoError(
      'This booking or visit has ended, so a photo is no longer needed.',
      409,
    );
  const file = form.get('photo');
  if (!(file instanceof Blob)) throw new ClientPhotoError('Choose a photo first.');
  let prepared: Awaited<ReturnType<typeof prepareClientPhoto>>;
  try {
    prepared = await prepareClientPhoto(file);
  } catch (error) {
    if (error instanceof ClientPhotoFileError) throw new ClientPhotoError(error.message);
    throw error;
  }
  const now = new Date();
  const context = getRequestContext(request);
  const saved = await prisma.$transaction(async (tx) => {
    const result = await saveClientPhoto(tx, {
      email: record.email,
      clientName: record.clientName,
      photo: prepared,
      source: 'WEBSITE',
      now,
    });
    await tx.auditLog.create({
      data: {
        userId: null,
        userName: record.clientName,
        userRole: 'PUBLIC',
        action: 'FILE_UPLOAD',
        module: 'Client photos',
        description: `${result.replaced ? 'Changed' : 'Added'} the arrival photo for ${subjectLabel(record)} (from the client's photo link).`,
        status: 'SUCCESS',
        source: 'zion-client',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: { photoId: result.photo.id, ...subjectMetadata(record.subject) },
      },
    });
    return result.photo;
  });
  return { photoUrl: photoViewPath(saved, now) };
}

const removal = z.object({ token: z.string().min(10).max(200) }).strict();

/** Deletes the client's photo at once (they removed it or withdrew consent). */
export async function removeClientPhoto(request: Request) {
  checkOrigin(request);
  const parsed = removal.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new ClientPhotoError(EXPIRED, 404);
  const record = await subjectFor(parsed.data.token);
  const context = getRequestContext(request);
  await prisma.$transaction(async (tx) => {
    if (!(await deleteClientPhoto(tx, record.email))) return;
    await tx.auditLog.create({
      data: {
        userId: null,
        userName: record.clientName,
        userRole: 'PUBLIC',
        action: 'FILE_DELETE',
        module: 'Client photos',
        description: `Removed the arrival photo for ${subjectLabel(record)}; it was deleted at once (consent withdrawn by the client).`,
        status: 'SUCCESS',
        source: 'zion-client',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: subjectMetadata(record.subject),
      },
    });
  });
}

export function clientPhotoErrorResponse(error: unknown) {
  if (error instanceof ClientPhotoError)
    return Response.json({ error: error.message }, { status: error.status });
  console.error('Unable to save a client photo.', errorMetadata(error));
  return Response.json(
    { error: 'We could not save your photo right now. Please try again or skip this step.' },
    { status: 500 },
  );
}
