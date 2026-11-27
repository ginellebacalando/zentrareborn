import 'server-only';

import type { Prisma } from '@prisma/client';
import {
  CLIENT_PHOTO_CONSENT,
  CLIENT_PHOTO_RETENTION_DAYS,
  type ClientPhotoReview,
  type OwnClientPhoto,
  type StaffClientPhoto,
} from '@/config/client-photos';
import type { PreparedClientPhoto } from '@/lib/client-photo-file';
import { photoLinkToken, photoViewPath, type PhotoSubject } from '@/lib/client-photo-link';
import { prisma } from '@/lib/prisma';

/**
 * Optional client photos (docs/client-photos.md): one private photo per client email address,
 * reused for all of that client's bookings and visits, so staff recognize them when they arrive.
 * This module stores, finds, removes and expires photos; the client's pages
 * (services/client-photos.ts), the admin (lib/admin/client-photos.ts) and the scheduled run
 * (lib/automation/client-photos.ts) build on it. Photos are never sent to an AI service, never
 * included in printouts or staff exports, and leave the server only through short-lived signed
 * addresses (lib/client-photo-link.ts).
 */
type Db = Prisma.TransactionClient;
const DAY_MS = 24 * 60 * 60_000;

/** A client is their email address, trimmed and lower-case. */
export function clientPhotoKey(email: string) {
  return email.trim().toLowerCase();
}

/** A photo's details for lists and pages; never the picture's bytes. */
export const clientPhotoSelect = {
  id: true,
  email: true,
  clientName: true,
  review: true,
  source: true,
  consentAt: true,
  updatedAt: true,
} as const;
export type ClientPhotoRow = Prisma.AdminClientPhotoGetPayload<{
  select: typeof clientPhotoSelect;
}>;

/** The booking or visit an upload link or a staff action is about. */
export type PhotoSubjectRecord = {
  subject: PhotoSubject;
  reference: string;
  clientName: string;
  email: string;
  eventType: string;
  startsAt: Date;
  endsAt: Date;
  /** Still ahead or under way, so a photo is still useful. */
  open: boolean;
};

/** Requested, held or confirmed, and not declined: the client is still expected. */
export function isOpenBooking(booking: { reservation: string; approval: string }) {
  return (
    (booking.reservation === 'REQUESTED' || booking.reservation === 'CONFIRMED') &&
    booking.approval !== 'REJECTED'
  );
}

export async function readPhotoSubject(
  subject: PhotoSubject,
  db: Db = prisma,
): Promise<PhotoSubjectRecord | null> {
  if (subject.kind === 'booking') {
    const booking = await db.adminBooking.findUnique({
      where: { id: subject.id },
      select: {
        reference: true,
        clientName: true,
        email: true,
        eventType: true,
        startsAt: true,
        endsAt: true,
        reservation: true,
        approval: true,
      },
    });
    if (!booking) return null;
    return {
      subject,
      reference: booking.reference,
      clientName: booking.clientName,
      email: clientPhotoKey(booking.email),
      eventType: booking.eventType,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      open: isOpenBooking(booking),
    };
  }
  const visit = await db.adminVisit.findUnique({
    where: { id: subject.id },
    select: {
      reference: true,
      clientName: true,
      email: true,
      startsAt: true,
      endsAt: true,
      status: true,
    },
  });
  if (!visit) return null;
  return {
    subject,
    reference: visit.reference,
    clientName: visit.clientName,
    email: clientPhotoKey(visit.email),
    eventType: 'Ocular visit',
    startsAt: visit.startsAt,
    endsAt: visit.endsAt,
    open: visit.status === 'SCHEDULED' || visit.status === 'CHECKED_IN',
  };
}

export async function findClientPhoto(email: string, db: Db = prisma) {
  const key = clientPhotoKey(email);
  return key
    ? db.adminClientPhoto.findUnique({ where: { email: key }, select: clientPhotoSelect })
    : null;
}

/**
 * Saves a cleaned photo as the client's photo, replacing any earlier one. Consent is recorded with
 * the photo; a new photo starts unreviewed.
 */
export async function saveClientPhoto(
  db: Db,
  input: {
    email: string;
    clientName: string;
    photo: PreparedClientPhoto;
    source: 'WEBSITE' | 'STAFF';
    now: Date;
  },
) {
  const email = clientPhotoKey(input.email);
  const existing = await db.adminClientPhoto.findUnique({ where: { email }, select: { id: true } });
  const values = {
    clientName: input.clientName.trim().slice(0, 180),
    data: new Uint8Array(input.photo.data),
    contentType: input.photo.contentType,
    width: input.photo.width,
    height: input.photo.height,
    sizeBytes: input.photo.sizeBytes,
    sha256: input.photo.sha256,
    consentAt: input.now,
    consentVersion: CLIENT_PHOTO_CONSENT.version,
    source: input.source,
    review: 'UNREVIEWED',
    reviewedBy: null,
    reviewedAt: null,
  };
  const photo = await db.adminClientPhoto.upsert({
    where: { email },
    create: { email, ...values },
    update: values,
    select: clientPhotoSelect,
  });
  return { photo, replaced: Boolean(existing) };
}

/** Deletes the client's photo at once; true when there was one. */
export async function deleteClientPhoto(db: Db, email: string) {
  const key = clientPhotoKey(email);
  if (!key) return false;
  const { count } = await db.adminClientPhoto.deleteMany({ where: { email: key } });
  return count > 0;
}

export type { StaffClientPhoto };

export function staffPhotoView(row: ClientPhotoRow, now = new Date()): StaffClientPhoto | null {
  const url = photoViewPath(row, now);
  return url
    ? {
        url,
        review: row.review as ClientPhotoReview,
        source: row.source === 'STAFF' ? 'STAFF' : 'WEBSITE',
        updatedAt: row.updatedAt.toISOString(),
      }
    : null;
}

/** The photos of many clients at once, by email address: one query, never the bytes. */
export async function staffPhotosFor(emails: Iterable<string>, now = new Date(), db: Db = prisma) {
  const keys = [...new Set([...emails].map(clientPhotoKey).filter(Boolean))];
  const photos = new Map<string, StaffClientPhoto>();
  if (!keys.length) return photos;
  const rows = await db.adminClientPhoto.findMany({
    where: { email: { in: keys } },
    select: clientPhotoSelect,
  });
  for (const row of rows) {
    const view = staffPhotoView(row, now);
    if (view) photos.set(row.email, view);
  }
  return photos;
}

/**
 * What a client sees of their own photo on a private page for one booking or visit, or null when
 * links cannot be signed (AUTH_SECRET missing), so the page simply leaves the photo out.
 */
export async function ownClientPhoto(
  record: PhotoSubjectRecord,
  retentionDays: number,
  now = new Date(),
  db: Db = prisma,
): Promise<OwnClientPhoto | null> {
  let token: string;
  try {
    token = photoLinkToken(record.subject, now);
  } catch {
    return null;
  }
  const photo = await findClientPhoto(record.email, db);
  return {
    token,
    photoUrl: photo ? photoViewPath(photo, now) : null,
    retakeRequested: photo?.review === 'RETAKE',
    canAdd: record.open,
    retentionDays,
  };
}

/**
 * Deletes every photo whose client has nothing open (no requested, held or confirmed booking, and
 * no scheduled or checked-in visit) and whose last event or visit was completed or cancelled
 * before the retention period, counted from the later of that moment and when the current photo
 * was added. Returns how many were deleted. Timestamps are stored as UTC without a zone.
 */
export async function deleteExpiredClientPhotos(now: Date, retentionDays: number, db: Db = prisma) {
  const days = Math.min(
    CLIENT_PHOTO_RETENTION_DAYS.max,
    Math.max(CLIENT_PHOTO_RETENTION_DAYS.min, Math.round(retentionDays)),
  );
  const cutoff = new Date(now.getTime() - days * DAY_MS).toISOString();
  const deleted = await db.$queryRaw<{ id: string }[]>`
    WITH activity AS (
      SELECT lower(btrim(email)) AS email,
        (reservation IN ('REQUESTED', 'CONFIRMED') AND approval <> 'REJECTED') AS open,
        CASE WHEN reservation = 'COMPLETED' THEN "endsAt" ELSE "updatedAt" END AS closed_at
      FROM zion_admin_bookings
      UNION ALL
      SELECT lower(btrim(email)),
        status IN ('SCHEDULED', 'CHECKED_IN'),
        CASE status
          WHEN 'COMPLETED' THEN COALESCE("completedAt", "endsAt")
          WHEN 'CANCELLED' THEN COALESCE("cancelledAt", "updatedAt")
          ELSE "endsAt"
        END
      FROM zion_visits
    ),
    clients AS (
      SELECT email, bool_or(open) AS open, max(closed_at) FILTER (WHERE NOT open) AS last_closed
      FROM activity GROUP BY email
    )
    DELETE FROM zion_client_photos p
    WHERE NOT COALESCE((SELECT c.open FROM clients c WHERE c.email = p.email), false)
      AND (GREATEST(
        COALESCE((SELECT c.last_closed FROM clients c WHERE c.email = p.email), p."consentAt"),
        p."consentAt"
      ) AT TIME ZONE 'UTC') < ${cutoff}::timestamptz
    RETURNING p.id`;
  return deleted.length;
}
