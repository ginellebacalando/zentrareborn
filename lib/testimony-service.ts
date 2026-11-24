import 'server-only';

import { randomUUID } from 'node:crypto';
import {
  AuditAction,
  AuditStatus,
  NotificationPriority,
  NotificationType,
  Prisma,
  TestimonyStatus,
} from '@prisma/client';
import { createAuditLog, getRequestContext } from '@/lib/audit';
import { prisma } from '@/lib/prisma';
import {
  deleteTestimonyPhoto,
  TestimonyPhotoError,
  uploadTestimonyPhoto,
} from '@/lib/testimony-photo-storage';
const REQUIRED_RATINGS = [
  'overallRating',
  'approachRating',
  'foodRating',
  'serviceRating',
] as const;
const OPTIONAL_RATINGS = ['venueRating', 'communicationRating'] as const;
export const RED_FLAG_PREFIX = 'RED_FLAG:';

type SafetyRule = {
  label: string;
  pattern: RegExp;
};

const TEXT_SAFETY_RULES: readonly SafetyRule[] = [
  {
    label: 'Profanity or curses',
    pattern:
      /\b(fuck\w*|f\*+k|fck|fvck|shit\w*|sh1t|bitch\w*|b1tch|asshole\w*|cunt\w*|slut\w*|whore\w*|dick\w*|cock\w*|pussy|bastard\w*|motherfucker\w*|faggot\w*|twat\w*|wank\w*|puta\w*|p\*+ta|putang\s*ina|tangina\w*|gago\w*|tarantado\w*|bobo|engot|tanga|ulol|punyeta\w*|leche|puke|burat|tite|pekpek|kantot\w*|iyot\w*|hindot\w*|kupal\w*|supot|bayag|titi|pokpok|malandi|pukingina\w*|pakyu\w*|bilat|oten|giatay|yawa\w*|piste\w*|pisting|yati|inatay|kayata|kagwang|jakol\w*|salsal\w*|jerjer|chupa\w*)\b/i,
  },
  {
    label: 'Nudity or sexually explicit content',
    pattern:
      /\b(nude\w*|naked|nudity|porn\w*|nsfw|xxx|hentai|onlyfans|erotic\w*|explicit\s+content|sex\s+video|sext\w*|topless|genital\w*|cum\b|stripper\w*|escort\s+service|hubad|bastos|libog|malaswa|bold\s+star|bold\s+video)\b/i,
  },
  {
    label: 'Propaganda, hate speech, or spam',
    pattern:
      /\b(propaganda|disinformation|fake\s+news|terroris[mt]\w*|extremis[mt]\w*|nazi\w*|fascis[mt]\w*|white\s+supremac\w*|hate\s+speech|genocide|ethnic\s+cleansing|racist\w*|coup\s+d['’]?etat|insurgen\w*|vote\s+for\s+\w+|political\s+campaign|boycott\s+zion|ponzi|crypto\s+giveaway|free\s+bitcoin|casino\s+bonus|online\s+sabong|scam\s+link|click\s+here\s+to\s+win)\b|(https?:\/\/|www\.|bit\.ly\/|t\.me\/)/i,
  },
  {
    label: 'Violence, harassment, or unethical content',
    pattern:
      /\b(kill\s+yourself|kys\b|commit\s+suicide|murder\w*|bomb\s+threat|mass\s+shooting|shoot\s+up|stab\s+you|rape\w*|sexual\s+assault|death\s+threat|blackmail\w*|extort\w*|doxx\w*|human\s+traffick\w*|child\s+abuse|mamatay\s+ka|patayin|barilin|saksakin)\b/i,
  },
];

const IMAGE_SAFETY_RULES: readonly SafetyRule[] = [
  {
    label: 'Flagged image (nudity or explicit)',
    pattern:
      /(^|[\s._/-])(nude\w*|naked|nudity|porn\w*|nsfw|xxx|hentai|onlyfans|erotic\w*|explicit|topless|boobs|breasts|genital\w*|hubad|bastos|malaswa)([\s._/-]|$)/i,
  },
  {
    label: 'Flagged image (profanity or abuse)',
    pattern:
      /(^|[\s._/-])(fuck\w*|shit\w*|bitch\w*|asshole|cunt|puta\w*|tangina\w*|gago\w*|pakyu\w*|yawa\w*)([\s._/-]|$)/i,
  },
  {
    label: 'Flagged image (propaganda or unethical)',
    pattern:
      /(^|[\s._/-])(propaganda|terroris[mt]\w*|nazi\w*|swastika|hate|gore|behead\w*|suicide|murder|violence|scam|spam|casino|sabong)([\s._/-]|$)/i,
  },
];

function extractPrintableMetadata(bytes: Uint8Array): string {
  // Inspect up to 64 KB of image header/metadata chunks (EXIF, XMP, IPTC, PNG tEXt)
  // for textual labels or keywords without decoding full pixel buffers.
  const limit = Math.min(bytes.length, 65536);
  const chunks: string[] = [];
  let current = '';
  for (let i = 0; i < limit; i += 1) {
    const code = bytes[i];
    if (code >= 32 && code <= 126) {
      current += String.fromCharCode(code);
    } else {
      if (current.length >= 4) chunks.push(current);
      current = '';
    }
  }
  if (current.length >= 4) chunks.push(current);
  return chunks.join(' ');
}

export async function evaluateTestimonySafety(input: {
  clientName: string;
  nickname: string | null;
  packageName: string | null;
  comment: string;
  photo: File | null;
}): Promise<{ flagged: boolean; reasons: string[] }> {
  const reasons = new Set<string>();
  const combinedText = [
    input.clientName,
    input.nickname ?? '',
    input.packageName ?? '',
    input.comment,
  ]
    .join(' ')
    .trim();

  for (const rule of TEXT_SAFETY_RULES) {
    if (rule.pattern.test(combinedText)) {
      reasons.add(rule.label);
    }
  }

  if (input.photo && input.photo.size > 0) {
    const fileName = input.photo.name || '';
    let metadataText = '';
    try {
      const slice = new Uint8Array(await input.photo.slice(0, 65536).arrayBuffer());
      metadataText = extractPrintableMetadata(slice);
    } catch {
      // Ignore metadata read errors; file validation still runs during upload.
    }

    const imageSignals = `${fileName} ${metadataText}`;
    for (const rule of IMAGE_SAFETY_RULES) {
      if (rule.pattern.test(imageSignals)) {
        reasons.add(rule.label);
      }
    }
  }

  return {
    flagged: reasons.size > 0,
    reasons: Array.from(reasons),
  };
}

export function parseRedFlagReasons(hiddenBy: string | null): string[] {
  if (!hiddenBy) return ['Flagged for safety review'];
  if (hiddenBy.startsWith(RED_FLAG_PREFIX)) {
    const raw = hiddenBy.slice(RED_FLAG_PREFIX.length).trim();
    const parts = raw
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean);
    return parts.length ? parts : ['Flagged for safety review'];
  }
  return [hiddenBy];
}
export class TestimonyError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'TestimonyError';
    this.status = status;
  }
}
type PublicSort = 'recent' | 'highest';
type TestimonyRecord = {
  id: string;
  clientName: string;
  nickname: string | null;
  email: string | null;
  eventType: string;
  eventDate: Date;
  packageName: string | null;
  overallRating: number;
  approachRating: number;
  foodRating: number;
  serviceRating: number;
  venueRating: number | null;
  communicationRating: number | null;
  comment: string;
  photoUrl: string | null;
  status: TestimonyStatus;
  isPublic: boolean;
  isFeatured: boolean;
  submittedAt: Date;
  approvedBy: string | null;
  approvedAt: Date | null;
  hiddenBy: string | null;
  hiddenAt: Date | null;
  deletedBy: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
function text(value: unknown, maxLength = 255) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}
function optionalText(value: unknown, maxLength = 255) {
  const normalized = text(value, maxLength);
  return normalized || null;
}
function parseRating(value: unknown, label: string, required: boolean) {
  if ((value === null || value === undefined || value === '') && !required) {
    return null;
  }
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new TestimonyError(`${label} must be between 1 and 5 stars.`);
  }
  return rating;
}
function parseDate(value: unknown, label: string) {
  const raw = text(value, 40);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T12:00:00.000Z`) : new Date(raw);
  if (!raw || Number.isNaN(date.getTime())) {
    throw new TestimonyError(`${label} is required.`);
  }
  return date;
}
function booleanValue(value: unknown) {
  return value === true || value === 'true' || value === 'on' || value === '1';
}
function testimonyToDto(testimony: TestimonyRecord, includePrivate = false) {
  return {
    id: testimony.id,
    clientName: testimony.nickname || testimony.clientName,
    fullName: includePrivate ? testimony.clientName : undefined,
    nickname: includePrivate ? testimony.nickname : undefined,
    email: includePrivate ? testimony.email : undefined,
    eventType: testimony.eventType,
    eventDate: testimony.eventDate.toISOString(),
    packageName: testimony.packageName,
    overallRating: testimony.overallRating,
    approachRating: testimony.approachRating,
    foodRating: testimony.foodRating,
    serviceRating: testimony.serviceRating,
    venueRating: testimony.venueRating,
    communicationRating: testimony.communicationRating,
    comment: testimony.comment,
    photoUrl: testimony.photoUrl,
    status: includePrivate ? testimony.status.toLowerCase() : undefined,
    isPublic: includePrivate ? testimony.isPublic : undefined,
    isFeatured: testimony.isFeatured,
    submittedAt: testimony.submittedAt.toISOString(),
    approvedBy: includePrivate ? testimony.approvedBy : undefined,
    approvedAt: includePrivate ? (testimony.approvedAt?.toISOString() ?? null) : undefined,
    hiddenBy: includePrivate ? testimony.hiddenBy : undefined,
    hiddenAt: includePrivate ? (testimony.hiddenAt?.toISOString() ?? null) : undefined,
    deletedBy: includePrivate ? testimony.deletedBy : undefined,
    deletedAt: includePrivate ? (testimony.deletedAt?.toISOString() ?? null) : undefined,
    createdAt: testimony.createdAt.toISOString(),
    updatedAt: testimony.updatedAt.toISOString(),
  };
}
async function requestPayload(request: Request) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const payload: Record<string, FormDataEntryValue> = {};
    formData.forEach((value, key) => {
      payload[key] = value;
    });
    return {
      payload,
      photo: formData.get('photo') instanceof File ? (formData.get('photo') as File) : null,
    };
  }
  return {
    payload: (await request.json()) as Record<string, unknown>,
    photo: null,
  };
}
async function publicFilterOptions() {
  const [eventCategories, packages] = await Promise.all([
    prisma.eventCategory.findMany({
      where: { status: 'ACTIVE', clientVisible: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      select: { name: true },
    }),
    prisma.testimony.findMany({
      where: {
        status: TestimonyStatus.APPROVED,
        isPublic: true,
        packageName: { not: null },
      },
      distinct: ['packageName'],
      orderBy: { packageName: 'asc' },
      select: { packageName: true },
    }),
  ]);
  return {
    eventTypes: eventCategories.map((category) => category.name),
    packages: packages.flatMap((item) => (item.packageName ? [item.packageName] : [])),
  };
}
export async function getPublicTestimonies(url: URL) {
  const eventType = text(url.searchParams.get('eventType'), 160);
  const packageName = text(url.searchParams.get('package'), 255);
  const rating = Number(url.searchParams.get('rating'));
  const withPhotos = url.searchParams.get('withPhotos') === 'true';
  const sort =
    url.searchParams.get('sort') === 'highest' ? 'highest' : ('recent' satisfies PublicSort);
  const where: Prisma.TestimonyWhereInput = {
    status: TestimonyStatus.APPROVED,
    isPublic: true,
    deletedAt: null,
  };
  if (eventType) where.eventType = eventType;
  if (packageName) where.packageName = packageName;
  if (Number.isInteger(rating) && rating >= 1 && rating <= 5) where.overallRating = rating;
  if (withPhotos) where.photoUrl = { not: null };
  const [testimonies, filterOptions] = await Promise.all([
    prisma.testimony.findMany({
      where,
      orderBy:
        sort === 'highest'
          ? [{ overallRating: 'desc' }, { submittedAt: 'desc' }]
          : [{ submittedAt: 'desc' }],
    }),
    publicFilterOptions(),
  ]);
  return {
    testimonies: testimonies.map((item) => testimonyToDto(item)),
    filterOptions,
  };
}
export async function getFeaturedTestimonies(limit = 6) {
  const testimonies = await prisma.testimony.findMany({
    where: {
      status: TestimonyStatus.APPROVED,
      isPublic: true,
      deletedAt: null,
    },
    orderBy: [{ isFeatured: 'desc' }, { submittedAt: 'desc' }],
    take: Math.min(Math.max(limit, 1), 12),
  });
  return testimonies.map((item) => testimonyToDto(item));
}
export async function submitTestimony(request: Request) {
  const { payload, photo } = await requestPayload(request);
  const clientName = text(payload.clientName ?? payload.name ?? payload.nickname, 160);
  const nickname = optionalText(payload.nickname, 120);
  const email = optionalText(payload.email, 255)?.toLowerCase() ?? null;
  const eventType = text(payload.eventType, 160);
  const eventDate = parseDate(payload.eventDate, 'Event date');
  const packageName = optionalText(payload.packageName, 255);
  const comment = text(payload.comment, 1001);
  const consent = booleanValue(payload.consent);
  if (!clientName) throw new TestimonyError('Name or nickname is required.');
  if (!eventType) throw new TestimonyError('Event type is required.');
  if (eventDate.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
    throw new TestimonyError('Event date cannot be in the future.');
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new TestimonyError('Please enter a valid email address.');
  }
  if (comment.length > 0 && comment.length < 8) {
    throw new TestimonyError(
      'Written testimony must be at least 8 characters, or you may leave it blank.',
    );
  }
  if (comment.length > 1000) {
    throw new TestimonyError('Testimony must not exceed 1,000 characters.');
  }
  if (!consent) {
    throw new TestimonyError(
      'Consent is required before your experience can be published publicly.',
    );
  }
  const ratings = Object.fromEntries([
    ...REQUIRED_RATINGS.map((key) => [
      key,
      parseRating(payload[key], key.replace('Rating', ''), true),
    ]),
    ...OPTIONAL_RATINGS.map((key) => [
      key,
      parseRating(payload[key], key.replace('Rating', ''), false),
    ]),
  ]) as {
    overallRating: number;
    approachRating: number;
    foodRating: number;
    serviceRating: number;
    venueRating: number | null;
    communicationRating: number | null;
  };
  const safety = await evaluateTestimonySafety({
    clientName,
    nickname,
    packageName,
    comment,
    photo,
  });
  const id = randomUUID();
  let storedPhoto: Awaited<ReturnType<typeof uploadTestimonyPhoto>> | null = null;
  try {
    if (photo && photo.size > 0) {
      storedPhoto = await uploadTestimonyPhoto({ file: photo, testimonyId: id });
    }
    const now = new Date();
    const flagSummary = safety.flagged
      ? `${RED_FLAG_PREFIX} ${safety.reasons.join(' | ')}`.slice(0, 250)
      : null;
    const testimony = await prisma.$transaction(async (tx) => {
      const created = await tx.testimony.create({
        data: {
          id,
          clientName,
          nickname,
          email,
          eventType,
          eventDate,
          packageName,
          ...ratings,
          comment,
          photoUrl: storedPhoto?.publicUrl ?? null,
          photoPath: storedPhoto?.path ?? null,
          status: safety.flagged ? TestimonyStatus.FLAGGED : TestimonyStatus.APPROVED,
          isPublic: !safety.flagged,
          approvedBy: safety.flagged ? null : 'SYSTEM_AUTO_PUBLISH',
          approvedAt: safety.flagged ? null : now,
          hiddenBy: flagSummary,
          hiddenAt: safety.flagged ? now : null,
        },
      });
      await tx.notification.create({
        data: safety.flagged
          ? {
              title: 'Red-flagged testimony placed on hold',
              message: `Testimony by ${nickname || clientName} (${eventType}) was flagged and placed on hold: ${safety.reasons.join(', ')}.`,
              type: NotificationType.TESTIMONY,
              priority: NotificationPriority.HIGH,
              relatedModule: 'testimonies',
              relatedRecordId: created.id,
              source: 'client_testimony_form',
            }
          : {
              title: 'New testimony automatically published',
              message: `New testimony published by ${nickname || clientName} for ${eventType}.`,
              type: NotificationType.TESTIMONY,
              priority: NotificationPriority.LOW,
              relatedModule: 'testimonies',
              relatedRecordId: created.id,
              source: 'client_testimony_form',
            },
      });
      return created;
    });
    await createAuditLog({
      userId: null,
      userName: nickname || clientName,
      userRole: 'PUBLIC',
      action: AuditAction.SUBMISSION,
      module: 'Testimonies',
      description: safety.flagged
        ? `${nickname || clientName} submitted a testimony for ${eventType} that was red-flagged and placed on hold (${safety.reasons.join(', ')}).`
        : `${nickname || clientName} submitted and auto-published a testimony for ${eventType}.`,
      status: safety.flagged ? AuditStatus.WARNING : AuditStatus.SUCCESS,
      ...getRequestContext(request),
      newValues: {
        testimonyId: testimony.id,
        eventType,
        eventDate,
        ratings,
        status: testimony.status,
        flagged: safety.flagged,
        flagReasons: safety.reasons,
        hasPhoto: Boolean(storedPhoto),
      },
    });
    if (safety.flagged) {
      return {
        id: testimony.id,
        status: testimony.status.toLowerCase(),
        isPublic: false,
        flagged: true,
        flagReasons: safety.reasons,
        testimony: null,
        message: 'Your testimony was automatically tagged for safety review and placed on hold.',
      };
    }
    return {
      id: testimony.id,
      status: testimony.status.toLowerCase(),
      isPublic: true,
      flagged: false,
      flagReasons: [] as string[],
      testimony: testimonyToDto(testimony),
      message: 'Thank you for sharing your experience! Your testimony is now live.',
    };
  } catch (error) {
    if (storedPhoto) await deleteTestimonyPhoto(storedPhoto.path);
    throw error;
  }
}
export function testimonyErrorResponse(error: unknown, fallback = 'Unable to process testimony.') {
  if (error instanceof TestimonyError || error instanceof TestimonyPhotoError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof Error && error.message.startsWith('Unauthorized')) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof Error && error.message.startsWith('Forbidden')) {
    return Response.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof SyntaxError) {
    return Response.json({ error: 'The request body is invalid.' }, { status: 400 });
  }
  console.error(fallback, error);
  return Response.json({ error: fallback }, { status: 500 });
}
