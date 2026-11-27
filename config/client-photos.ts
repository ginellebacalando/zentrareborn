/**
 * Optional client photos (docs/client-photos.md): the words clients and staff see, and the
 * limits both the browser and the server apply. The only purpose is to let staff recognize a
 * client when they arrive; it is not an identity check, and photos never go to an AI service.
 */
export const CLIENT_PHOTO_LIMITS = {
  /** The largest file a client or staff member may choose. */
  maxUploadBytes: 10 * 1024 * 1024,
  /** The browser scales a photo to this longest side before sending it. */
  browserLongestSide: 1600,
  /** The server re-saves every photo at this longest side or smaller. */
  storedLongestSide: 800,
  /** A photo smaller than this on its shorter side cannot show a face clearly. */
  minShortestSide: 120,
  /** How long an emailed upload link works. */
  linkDays: 7,
  /** The single reminder goes out this many days before a visit or event. */
  reminderDaysBefore: 3,
} as const;

/** Retention after the client's last event or visit ends (Settings; to confirm with Zion). */
export const CLIENT_PHOTO_RETENTION_DAYS = { default: 30, min: 7, max: 365 } as const;

/** The consent wording; the version is stored with each photo, so a change can be traced. */
export const CLIENT_PHOTO_CONSENT = {
  version: 'arrival-photo-consent:v1',
  text: 'I agree that Zion staff may use this photo to recognize me when I arrive.',
} as const;

/** Why Zion asks, shown right where the client adds the photo. */
export function clientPhotoWhy(retentionDays: number) {
  return `Add a photo so our team can recognize you and welcome you by name when you arrive. Only Zion staff can see it. We delete it ${retentionDays} days after your event, and you can remove it anytime.`;
}

export const CLIENT_PHOTO_TIPS = [
  'Face the camera in good light.',
  'No sunglasses, masks or filters.',
  'Only you in the photo.',
] as const;

/** Staff's review of a photo: OK, or a new one asked for (for example, the face is unclear). */
export type ClientPhotoReview = 'UNREVIEWED' | 'OK' | 'RETAKE';

export const CLIENT_PHOTO_REVIEW_LABELS: Record<ClientPhotoReview, string> = {
  UNREVIEWED: 'Not checked yet',
  OK: 'Photo OK',
  RETAKE: 'New photo asked for',
};

/** What staff receive for a client's photo (only roles allowed to see photos). */
export type StaffClientPhoto = {
  /** A short-lived signed address of the photo. */
  url: string;
  review: ClientPhotoReview;
  /** WEBSITE: the client added it; STAFF: taken at the venue with the client's consent. */
  source: 'WEBSITE' | 'STAFF';
  updatedAt: string;
};

/** What a client sees of their own photo on their private pages. */
export type OwnClientPhoto = {
  /** The upload link's token; the photo itself is never addressed by the client's email. */
  token: string;
  /** A short-lived signed address of the current photo, or null when there is none. */
  photoUrl: string | null;
  /** Staff asked for a clearer photo. */
  retakeRequested: boolean;
  /** Whether a new photo can still be added (an upcoming event or visit exists). */
  canAdd: boolean;
  retentionDays: number;
};
