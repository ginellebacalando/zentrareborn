import 'server-only';

import { CLIENT_PHOTO_LIMITS } from '@/config/client-photos';
import { applicationUrl } from '@/lib/automation/config';
import { idFromSignedExpiringToken, signedExpiringToken } from '@/lib/signed-link';

/**
 * Links for optional client photos (docs/client-photos.md), signed with AUTH_SECRET
 * (lib/signed-link.ts) and expiring:
 *
 * - The upload link, /photo/<token>, names a booking or visit (never the email address) and works
 *   for seven days. The client adds, changes or removes their photo through it; the photo is kept
 *   once per email address, so every booking and visit with that address shares it.
 * - Photos are shown only through /api/client-photos/<token>, signed for 15 to 30 minutes.
 *   Addresses are made in 15-minute steps, so a page that refreshes its data keeps the same
 *   address (and the browser keeps the image) within a step. A changed photo gets a new address.
 */
const UPLOAD_PURPOSE = 'zentra-client-photo-upload:v1';
const VIEW_PURPOSE = 'zentra-client-photo-view:v1';
const DAY_MS = 24 * 60 * 60_000;
const VIEW_STEP_MS = 15 * 60_000;

export type PhotoSubject = { kind: 'booking' | 'visit'; id: string };

// Record ids follow lib/signed-link.ts: letters, digits, dashes and underscores.
const SUBJECT = /^([bv])-([a-z0-9_-]{1,62})$/i;
const VIEW_ID = /^([a-z0-9_-]{1,50})-([0-9a-z]{1,12})$/i;

function subjectId(subject: PhotoSubject) {
  return `${subject.kind === 'booking' ? 'b' : 'v'}-${subject.id}`;
}

export function photoLinkToken(subject: PhotoSubject, now = new Date()) {
  return signedExpiringToken(
    UPLOAD_PURPOSE,
    subjectId(subject),
    new Date(now.getTime() + CLIENT_PHOTO_LIMITS.linkDays * DAY_MS),
  );
}

/** The booking or visit an upload link stands for, or null when it is not genuine or expired. */
export function subjectFromPhotoToken(token: string, now = new Date()): PhotoSubject | null {
  const found = idFromSignedExpiringToken(UPLOAD_PURPOSE, token, now);
  const match = found ? SUBJECT.exec(found.id) : null;
  return match
    ? { kind: match[1].toLowerCase() === 'b' ? 'booking' : 'visit', id: match[2] }
    : null;
}

/** The upload page's path, or null when AUTH_SECRET is missing, so nothing else fails on it. */
export function photoPagePath(subject: PhotoSubject, now = new Date()) {
  try {
    return `/photo/${photoLinkToken(subject, now)}`;
  } catch {
    return null;
  }
}

/** The absolute upload link for emails, or null without the site's address or AUTH_SECRET. */
export function photoPageUrl(subject: PhotoSubject, now = new Date()) {
  const origin = applicationUrl();
  const path = photoPagePath(subject, now);
  return origin && path ? `${origin}${path}` : null;
}

/** A short-lived signed address of a stored photo, or null when AUTH_SECRET is missing. */
export function photoViewPath(photo: { id: string; updatedAt: Date }, now = new Date()) {
  const expiresAt = new Date((Math.floor(now.getTime() / VIEW_STEP_MS) + 2) * VIEW_STEP_MS);
  const version = photo.updatedAt.getTime().toString(36);
  try {
    return `/api/client-photos/${signedExpiringToken(VIEW_PURPOSE, `${photo.id}-${version}`, expiresAt)}`;
  } catch {
    return null;
  }
}

/** The photo a view address stands for, or null when it is not genuine or has expired. */
export function photoFromViewToken(token: string, now = new Date()) {
  const found = idFromSignedExpiringToken(VIEW_PURPOSE, token, now);
  const match = found ? VIEW_ID.exec(found.id) : null;
  return match ? { id: match[1], version: match[2] } : null;
}
