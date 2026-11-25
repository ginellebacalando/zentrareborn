import 'server-only';

import { randomUUID } from 'node:crypto';
import { NotificationPriority, NotificationType } from '@prisma/client';
import { z } from 'zod';
import {
  BOOKING_EXTRAS,
  BOOKING_PAYMENT_METHODS,
  BOOKING_REQUEST_RULES,
  WEBSITE_BOOKING_ACTOR,
} from '@/config/booking';
import { errorMetadata, getRequestContext } from '@/lib/audit';
import { enqueueWebsiteBookingRequest } from '@/lib/automation/booking-requests';
import { prisma } from '@/lib/prisma';
import { readPublicDateAvailability } from '@/lib/public-availability';
import { getPublicPackagesForCategory, ServicesPackagesError } from '@/lib/services-packages';

/** The admin calendar's single venue (lib/admin/domain.ts, lib/public-availability.ts). */
const VENUE = 'Zion Events Place';
const DAY_MS = 24 * 60 * 60_000;
const HOUR_MS = 60 * 60_000;
/** Flood guard across all visitors; real demand is far below this. */
const WEBSITE_REQUESTS_PER_HOUR = 30;

export class BookingRequestError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = 'BookingRequestError';
  }
}

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Choose a valid time.');
const paymentMethods = BOOKING_PAYMENT_METHODS.map((method) => method.value) as [
  (typeof BOOKING_PAYMENT_METHODS)[number]['value'],
  ...(typeof BOOKING_PAYMENT_METHODS)[number]['value'][],
];

const requestSchema = z
  .object({
    eventCategory: z.string().trim().min(1).max(100),
    /** null asks Zion for a custom proposal instead of a listed package. */
    packageId: z.string().trim().min(1).max(64).nullable(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid date.'),
    startTime: time,
    endTime: time,
    guests: z
      .number('Enter the number of guests.')
      .int('Enter a whole number of guests.')
      .min(
        BOOKING_REQUEST_RULES.minGuests,
        `Guests must be at least ${BOOKING_REQUEST_RULES.minGuests}.`,
      )
      .max(
        BOOKING_REQUEST_RULES.maxGuests,
        `For more than ${BOOKING_REQUEST_RULES.maxGuests} guests, please contact us directly.`,
      ),
    extras: z.array(z.enum(BOOKING_EXTRAS)).max(BOOKING_EXTRAS.length).default([]),
    fullName: z.string().trim().min(2, 'Enter your full name.').max(180),
    email: z.preprocess(
      (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
      z.email('Enter a valid email address.').max(255),
    ),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[\d\s()-]{7,30}$/, 'Enter a valid mobile number.'),
    facebook: z.string().trim().max(200).default(''),
    notes: z.string().trim().max(2000).default(''),
    paymentMethod: z.enum(paymentMethods),
    acceptedPolicies: z.literal(true, {
      error: 'Please confirm that you have read the policies.',
    }),
    fromZeni: z.boolean().default(false),
    /** Honeypot: real visitors never see or fill this field. */
    website: z.string().max(0).default(''),
  })
  .strict();

export type BookingRequestInput = z.input<typeof requestSchema>;

/** Today's date in Manila (UTC+8, no daylight saving) shifted by `days`, as YYYY-MM-DD. */
function manilaDate(days = 0, now = Date.now()) {
  return new Date(now + 8 * HOUR_MS + days * DAY_MS).toISOString().slice(0, 10);
}

function minutesOf(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function bookingReference() {
  return `ZION-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

async function venuePolicy() {
  const stored = await prisma.adminPolicy.findUnique({
    where: { id: 'venue' },
    select: { paymentRule: true, version: true },
  });
  return stored ?? { paymentRule: 'DEPOSIT_REQUIRED', version: 1 };
}

/** The published package the visitor chose, priced the same way the package pages show it. */
async function chosenPackage(categorySlug: string, packageId: string | null) {
  try {
    const { category, packages } = await getPublicPackagesForCategory(categorySlug);
    if (!category)
      throw new BookingRequestError('That event type is not available for booking.', 409);
    if (!packageId) return { category, pkg: null };
    const pkg = packages.find((candidate) => candidate.id === packageId);
    if (!pkg) throw new BookingRequestError('That package is no longer available.', 409);
    return { category, pkg };
  } catch (error) {
    if (error instanceof ServicesPackagesError)
      throw new BookingRequestError('That event type is not available for booking.', 409);
    throw error;
  }
}

/**
 * Validates and saves a booking request from the public booking page as an admin booking with
 * status Request (approval pending, nothing reserved), together with the audit entry the
 * dashboard reads, an in-app notice and the staff alert and client acknowledgement emails.
 * Returns the outbox ids to deliver once the response is sent.
 */
export async function submitBookingRequest(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success)
    throw new BookingRequestError(
      parsed.error.issues[0]?.message ?? 'Please check the booking details.',
    );
  const input = parsed.data;

  const earliest = manilaDate(BOOKING_REQUEST_RULES.minLeadDays);
  const latest = manilaDate(BOOKING_REQUEST_RULES.maxDaysAhead);
  if (input.date < earliest)
    throw new BookingRequestError('Please choose a date from tomorrow onward.');
  if (input.date > latest)
    throw new BookingRequestError('Please choose a date within the next two years.');
  const start = minutesOf(input.startTime);
  const end = minutesOf(input.endTime);
  if (
    start < minutesOf(BOOKING_REQUEST_RULES.firstStart) ||
    end > minutesOf(BOOKING_REQUEST_RULES.lastEnd) ||
    end - start < BOOKING_REQUEST_RULES.minDurationMinutes
  )
    throw new BookingRequestError('The event must end at least one hour after it starts.');

  const availability = await readPublicDateAvailability(input.date, input.date);
  if (availability.booked.includes(input.date))
    throw new BookingRequestError('This date is already booked. Please choose another date.', 409);

  const now = new Date();
  const [fromThisEmail, inLastHour] = await Promise.all([
    prisma.adminBooking.count({
      where: {
        createdBy: WEBSITE_BOOKING_ACTOR,
        email: input.email,
        createdAt: { gte: new Date(now.getTime() - DAY_MS) },
      },
    }),
    prisma.adminBooking.count({
      where: {
        createdBy: WEBSITE_BOOKING_ACTOR,
        createdAt: { gte: new Date(now.getTime() - HOUR_MS) },
      },
    }),
  ]);
  if (fromThisEmail >= BOOKING_REQUEST_RULES.perEmailPerDay)
    throw new BookingRequestError(
      'We already received several requests from this email today. Our team will contact you soon.',
      429,
    );
  if (inLastHour >= WEBSITE_REQUESTS_PER_HOUR)
    throw new BookingRequestError(
      'We are receiving many requests right now. Please try again in a few minutes.',
      429,
    );

  const { category, pkg } = await chosenPackage(input.eventCategory, input.packageId);
  const extraGuests = pkg ? Math.max(0, input.guests - pkg.paxIncluded) : 0;
  const totalCents = pkg ? Math.round((pkg.price + extraGuests * pkg.excessPaxFee) * 100) : 0;
  const depositCents = pkg ? Math.min(Math.round(pkg.reservationFee * 100), totalCents) : 0;
  const payment = BOOKING_PAYMENT_METHODS.find((method) => method.value === input.paymentMethod);
  const notes = [
    `Sent from the website booking page${input.fromZeni ? ' (opened from a Zeni link)' : ''}.`,
    `Preferred payment: ${payment?.label ?? input.paymentMethod}.`,
    input.extras.length ? `Asked about: ${input.extras.join(', ')}.` : '',
    pkg && extraGuests > 0
      ? `Estimate includes ${extraGuests} guests above the package's ${pkg.paxIncluded}.`
      : '',
    availability.inquired.includes(input.date)
      ? 'Another open request exists for this date; check the calendar before approving.'
      : '',
    input.facebook ? `Facebook: ${input.facebook}` : '',
    input.notes ? `Client notes: ${input.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const policy = await venuePolicy();
  const reference = bookingReference();
  const context = getRequestContext(request);
  const { booking, notificationIds } = await prisma.$transaction(
    async (tx) => {
      const created = await tx.adminBooking.create({
        data: {
          reference,
          clientName: input.fullName,
          email: input.email,
          phone: input.phone,
          eventType: category.name,
          packageName: pkg?.packageName || 'Custom proposal',
          venue: VENUE,
          startsAt: new Date(`${input.date}T${input.startTime}:00+08:00`),
          endsAt: new Date(`${input.date}T${input.endTime}:00+08:00`),
          guests: input.guests,
          totalCents,
          depositCents,
          paymentRule: policy.paymentRule,
          notes,
          policyVersion: policy.version,
          createdBy: WEBSITE_BOOKING_ACTOR,
          updatedBy: WEBSITE_BOOKING_ACTOR,
        },
      });
      // The dashboard and analytics read booking CREATE entries from the bookings module
      // (docs/dashboard-kpi-contract.md); a website request is a direct request (no inquiry).
      await tx.auditLog.create({
        data: {
          userId: null,
          userName: input.fullName,
          userRole: 'PUBLIC',
          action: 'CREATE',
          module: 'Bookings',
          description: `Website booking request ${reference} received. No date or payment confirmed.`,
          status: 'SUCCESS',
          source: 'zion-admin',
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          metadata: { bookingId: created.id, sourceInquiryId: null, channel: 'website' },
        },
      });
      await tx.notification.create({
        data: {
          title: 'New booking request',
          message: `${input.fullName} sent a booking request for ${category.name} on ${input.date}.`,
          type: NotificationType.WORKFLOW,
          priority: NotificationPriority.HIGH,
          relatedModule: 'bookings',
          relatedRecordId: created.id,
          source: WEBSITE_BOOKING_ACTOR,
        },
      });
      const ids = await enqueueWebsiteBookingRequest(tx, created, now);
      return { booking: created, notificationIds: ids };
    },
    { maxWait: 10_000, timeout: 15_000 },
  );

  return { id: booking.id, reference: booking.reference, notificationIds };
}

export function bookingRequestErrorResponse(error: unknown) {
  if (error instanceof BookingRequestError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof SyntaxError)
    return Response.json({ error: 'The request body is invalid.' }, { status: 400 });
  console.error('Unable to save a booking request.', errorMetadata(error));
  return Response.json(
    { error: 'We could not send your request right now. Please try again or contact us.' },
    { status: 500 },
  );
}
