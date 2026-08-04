import 'server-only';

import { randomUUID } from 'node:crypto';
import { AuditAction, AuditStatus, NotificationPriority, NotificationType, Prisma, TestimonyStatus } from '@prisma/client';
import { createAuditLog, getRequestContext } from '@/lib/audit';
import { prisma } from '@/lib/prisma';
import { deleteTestimonyPhoto, TestimonyPhotoError, uploadTestimonyPhoto } from '@/lib/testimony-photo-storage';
const REQUIRED_RATINGS = [
    'overallRating',
    'approachRating',
    'foodRating',
    'serviceRating',
] as const;
const OPTIONAL_RATINGS = ['venueRating', 'communicationRating'] as const;
const STRICT_CONTENT_PATTERN = /\b(fuck|shit|bitch|asshole|cunt|slut|whore|dick|cock|pussy|porn|sex|nude|naked|bastard|motherfucker|faggot|twat|wank|cum|puta|putangina|tangina|gago|tarantado|bobo|engot|tanga|ulol|punyeta|leche|puke|burat|tite|pekpek|kantot|iyot|hindot|kupal|supot|bayag|titi|pokpok|malandi|pukingina|pakyu|bilat|oten|giatay|yawa|piste|buang|boang|amaw|pisting|yati|animal|inatay|kayata|kagwang|jakol|salsal|jerjer|chupa|palos)\b/i;
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
    const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
        ? new Date(`${raw}T12:00:00.000Z`)
        : new Date(raw);
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
        approvedAt: includePrivate ? testimony.approvedAt?.toISOString() ?? null : undefined,
        hiddenBy: includePrivate ? testimony.hiddenBy : undefined,
        hiddenAt: includePrivate ? testimony.hiddenAt?.toISOString() ?? null : undefined,
        deletedBy: includePrivate ? testimony.deletedBy : undefined,
        deletedAt: includePrivate ? testimony.deletedAt?.toISOString() ?? null : undefined,
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
            photo: formData.get('photo') instanceof File ? formData.get('photo') as File : null,
        };
    }
    return {
        payload: await request.json() as Record<string, unknown>,
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
        packages: packages.flatMap((item) => item.packageName ? [item.packageName] : []),
    };
}
export async function getPublicTestimonies(url: URL) {
    const eventType = text(url.searchParams.get('eventType'), 160);
    const packageName = text(url.searchParams.get('package'), 255);
    const rating = Number(url.searchParams.get('rating'));
    const withPhotos = url.searchParams.get('withPhotos') === 'true';
    const sort = url.searchParams.get('sort') === 'highest' ? 'highest' : 'recent' satisfies PublicSort;
    const where: Prisma.TestimonyWhereInput = {
        status: TestimonyStatus.APPROVED,
        isPublic: true,
        deletedAt: null,
    };
    if (eventType)
        where.eventType = eventType;
    if (packageName)
        where.packageName = packageName;
    if (Number.isInteger(rating) && rating >= 1 && rating <= 5)
        where.overallRating = rating;
    if (withPhotos)
        where.photoUrl = { not: null };
    const [testimonies, filterOptions] = await Promise.all([
        prisma.testimony.findMany({
            where,
            orderBy: sort === 'highest'
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
    if (!clientName)
        throw new TestimonyError('Name or nickname is required.');
    if (!eventType)
        throw new TestimonyError('Event type is required.');
    if (eventDate.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
        throw new TestimonyError('Event date cannot be in the future.');
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new TestimonyError('Please enter a valid email address.');
    }
    if (comment.length < 20) {
        throw new TestimonyError('Please share at least a short comment about your experience.');
    }
    if (comment.length > 1000) {
        throw new TestimonyError('Testimony must not exceed 1,000 characters.');
    }
    if (!consent) {
        throw new TestimonyError('Consent is required before feedback can be considered for public display.');
    }
    const contentToCheck = `${clientName} ${nickname || ''} ${comment}`;
    if (STRICT_CONTENT_PATTERN.test(contentToCheck)) {
        throw new TestimonyError('Your testimony contains inappropriate language, harassment, or explicit content and cannot be submitted.');
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
    const id = randomUUID();
    let storedPhoto: Awaited<ReturnType<typeof uploadTestimonyPhoto>> | null = null;
    try {
        if (photo && photo.size > 0) {
            storedPhoto = await uploadTestimonyPhoto({ file: photo, testimonyId: id });
        }
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
                    status: TestimonyStatus.APPROVED,
                    isPublic: true,
                    approvedBy: 'SYSTEM_AUTO_APPROVE',
                    approvedAt: new Date(),
                },
            });
            await tx.notification.create({
                data: {
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
            description: `${nickname || clientName} submitted and auto-published a testimony for ${eventType}.`,
            status: AuditStatus.SUCCESS,
            ...getRequestContext(request),
            newValues: {
                testimonyId: testimony.id,
                eventType,
                eventDate,
                ratings,
                status: testimony.status,
                hasPhoto: Boolean(storedPhoto),
            },
        });
        return {
            id: testimony.id,
            status: testimony.status.toLowerCase(),
            message: 'Thank you for sharing your experience! Your testimony has been automatically published.',
        };
    }
    catch (error) {
        if (storedPhoto)
            await deleteTestimonyPhoto(storedPhoto.path);
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
