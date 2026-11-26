import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  BOOKING_EXTRAS,
  BOOKING_PAYMENT_METHODS,
  BOOKING_REQUEST_RULES,
  bookingTimeOptions,
} from '@/config/booking';
import { enqueueBookingNotice } from '@/lib/automation/bookings';
import { offeredPaymentMethods } from '@/lib/automation/payment-proofs';
import { offeredBookingPaymentMethods, preferredPaymentNote } from '@/lib/booking-payment-choice';
import { scheduleAutomationDelivery } from '@/lib/automation/trigger';
import { OCCUPYING_BOOKINGS } from '@/lib/booking-occupancy';
import { bookingScheduleProblem, manilaDateAfter, packageQuote } from '@/lib/booking-quote';
import { paymentPagePath } from '@/lib/payment-link';
import { nextAcknowledgmentNumber } from '@/lib/payment-receipts';
import { PHILIPPINE_MOBILE_ERROR, philippineMobile } from '@/lib/phone-number';
import { prisma } from '@/lib/prisma';
import { readPublicDateAvailability } from '@/lib/public-availability';
import {
  getPublicEventCategories,
  getPublicPackagesForCategory,
  ServicesPackagesError,
} from '@/lib/services-packages';
import {
  CONSENT_LABELS,
  CONSENT_METHODS,
  type WalkInCategory,
  type WalkInOptions,
  type WalkInOutcome,
  type WalkInPrefill,
  type WalkInResult,
} from '@/lib/walk-in-types';
import type { AdminActor } from './access';
import { paymentDeadline, requiresPayment, walkInReview } from './booking-rules';
import { confirmationError, eventDate, money } from './domain';
import { AdminError } from './errors';
import { readBookingRules } from './preferences';

/**
 * Walk-in bookings at the Front desk (plan section 16.2, docs/walk-ins.md): staff book for a
 * client at the desk with the website's rules and prices, record the client's consent, and take
 * cash on the spot or leave the payment for later. A cash payment that meets the venue policy
 * confirms the booking in the same step, exactly like Record cash on Bookings.
 */

/** The admin calendar's single venue (lib/admin/domain.ts). */
const VENUE = 'Zion Events Place';
const identifier = z.string().min(1).max(64);
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Choose a valid time.');
const paymentMethods = BOOKING_PAYMENT_METHODS.map((method) => method.value) as [
  (typeof BOOKING_PAYMENT_METHODS)[number]['value'],
  ...(typeof BOOKING_PAYMENT_METHODS)[number]['value'][],
];

/** The venue payment policy that new bookings follow; unreviewed until saved in Settings. */
async function venuePolicy() {
  const stored = await prisma.adminPolicy.findUnique({
    where: { id: 'venue' },
    select: { paymentRule: true, version: true, reviewed: true, cashInstructions: true },
  });
  return (
    stored ?? {
      paymentRule: 'DEPOSIT_REQUIRED',
      version: 1,
      reviewed: false,
      cashInstructions: 'Pay the reservation fee in cash at Zion Events Place.',
    }
  );
}

/** The published event types and packages, priced the way the booking page shows them. */
async function publishedCategories(): Promise<WalkInCategory[]> {
  const listed = (await getPublicEventCategories()).filter((category) => category !== null);
  return Promise.all(
    listed.map(async (category) => {
      let packages: WalkInCategory['packages'] = [];
      try {
        packages = (await getPublicPackagesForCategory(category.slug)).packages.map((pkg) => ({
          id: pkg.id,
          name: pkg.packageName,
          price: pkg.price,
          paxIncluded: pkg.paxIncluded,
          excessPaxFee: pkg.excessPaxFee,
          reservationFee: pkg.reservationFee,
        }));
      } catch {
        // A category without a published package still takes custom-proposal requests.
      }
      return { slug: category.slug, name: category.name, packages };
    }),
  );
}

export async function readWalkInOptions(): Promise<WalkInOptions> {
  const today = manilaDateAfter(0);
  const earliest = manilaDateAfter(BOOKING_REQUEST_RULES.minLeadDays);
  const latest = manilaDateAfter(BOOKING_REQUEST_RULES.maxDaysAhead);
  const [categories, availability, policy, rules, online] = await Promise.all([
    publishedCategories(),
    readPublicDateAvailability(today, latest),
    venuePolicy(),
    readBookingRules(),
    offeredPaymentMethods(prisma),
  ]);
  return {
    categories,
    earliest,
    latest,
    booked: availability.booked,
    inquired: availability.inquired,
    times: bookingTimeOptions(),
    extras: [...BOOKING_EXTRAS],
    minGuests: BOOKING_REQUEST_RULES.minGuests,
    maxGuests: BOOKING_REQUEST_RULES.maxGuests,
    reviewGuestLimit: rules.reviewGuestLimit,
    paymentDeadlineDays: rules.paymentDeadlineDays,
    policy: {
      paymentRule: policy.paymentRule,
      reviewed: policy.reviewed,
      cashInstructions: policy.cashInstructions,
    },
    onlinePayments: online.length > 0,
    paymentMethods: offeredBookingPaymentMethods(online),
  };
}

/** A client's details from a visit ("Start booking") or an earlier booking ("Book again"). */
export async function readWalkInPrefill(params: URLSearchParams): Promise<WalkInPrefill> {
  const visitId = params.get('visit');
  if (visitId) {
    const visit = await prisma.adminVisit.findUnique({
      where: { id: visitId },
      select: {
        id: true,
        reference: true,
        clientName: true,
        email: true,
        phone: true,
        eventType: true,
        eventDate: true,
        guests: true,
      },
    });
    if (!visit) throw new AdminError('Visit not found.', 404);
    return {
      source: 'visit',
      reference: visit.reference,
      visitId: visit.id,
      clientName: visit.clientName,
      email: visit.email,
      phone: visit.phone,
      eventType: visit.eventType,
      eventDate: visit.eventDate ? visit.eventDate.toISOString().slice(0, 10) : null,
      guests: visit.guests,
    };
  }
  const booking = await prisma.adminBooking.findUnique({
    where: { id: params.get('booking') ?? '' },
    select: {
      reference: true,
      clientName: true,
      email: true,
      phone: true,
      eventType: true,
      guests: true,
    },
  });
  if (!booking) throw new AdminError('Booking not found.', 404);
  return {
    source: 'booking',
    reference: booking.reference,
    visitId: null,
    clientName: booking.clientName,
    email: booking.email,
    phone: booking.phone,
    eventType: booking.eventType,
    eventDate: null,
    guests: booking.guests,
  };
}

const walkInSchema = z
  .object({
    op: z.literal('walk-in-booking'),
    client: z
      .object({
        fullName: z.string().trim().min(2, 'Enter the client name.').max(180),
        email: z.preprocess(
          (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
          z.email('Enter a valid email address.').max(255),
        ),
        phone: z
          .string()
          .refine((value) => philippineMobile(value) !== null, PHILIPPINE_MOBILE_ERROR)
          .transform((value) => philippineMobile(value) ?? value),
      })
      .strict(),
    event: z
      .object({
        eventCategory: z.string().trim().min(1, 'Choose the event.').max(100),
        /** null asks Zion for a custom proposal instead of a listed package. */
        packageId: z.string().trim().min(1).max(64).nullable(),
        date: z.iso.date('Choose a valid date.'),
        startTime: clock,
        endTime: clock,
        guests: z
          .number('Enter the number of guests.')
          .int('Enter a whole number of guests.')
          .min(
            BOOKING_REQUEST_RULES.minGuests,
            `Guests must be at least ${BOOKING_REQUEST_RULES.minGuests}.`,
          )
          .max(
            BOOKING_REQUEST_RULES.maxGuests,
            `Bookings take at most ${BOOKING_REQUEST_RULES.maxGuests} guests.`,
          ),
        extras: z.array(z.enum(BOOKING_EXTRAS)).max(BOOKING_EXTRAS.length).default([]),
        notes: z.string().trim().max(2000).default(''),
      })
      .strict(),
    consent: z.enum(CONSENT_METHODS, 'Record how the client gave consent.'),
    payment: z.discriminatedUnion('kind', [
      z
        .object({
          kind: z.literal('CASH_NOW'),
          amountCents: z.number().int().positive('Enter the cash received.').max(2000000000),
          receiptNumber: z.string().trim().min(3, 'Enter the receipt number.').max(80),
          note: z.string().trim().max(1000).default(''),
        })
        .strict(),
      z.object({ kind: z.literal('LATER'), method: z.enum(paymentMethods) }).strict(),
    ]),
    /** Approves a booking above the guest limit at the desk; recorded in the activity log. */
    overrideReason: z.string().trim().max(500).default(''),
    sourceVisitId: identifier.optional(),
  })
  .strict();

/** The published category and package, or an error that names what is no longer offered. */
async function chosenPackage(categorySlug: string, packageId: string | null) {
  try {
    const { category, packages } = await getPublicPackagesForCategory(categorySlug);
    if (!category) throw new AdminError('That event type is not available for booking.', 409);
    if (!packageId) return { category, pkg: null };
    const pkg = packages.find((candidate) => candidate.id === packageId);
    if (!pkg) throw new AdminError('That package is no longer available.', 409);
    return { category, pkg };
  } catch (error) {
    if (error instanceof ServicesPackagesError)
      throw new AdminError('That event type is not available for booking.', 409);
    throw error;
  }
}

/**
 * Books for a client at the desk in one transaction: the booking, the consent record, the cash
 * payment when taken now, the client's email and the staff calendar event. Returns what the
 * desk tells the client next.
 */
export async function createWalkInBooking(raw: unknown, actor: AdminActor): Promise<WalkInResult> {
  const input = walkInSchema.parse(raw);
  const { client, event, payment } = input;
  const now = new Date();
  const scheduleIssue = bookingScheduleProblem(event, now.getTime());
  if (scheduleIssue) throw new AdminError(scheduleIssue.problem);
  const { category, pkg } = await chosenPackage(event.eventCategory, event.packageId);
  const quote = pkg
    ? packageQuote(pkg, event.guests)
    : { extraGuests: 0, extraCents: 0, totalCents: 0, depositCents: 0 };
  const [policy, rules, online] = await Promise.all([
    venuePolicy(),
    readBookingRules(),
    offeredPaymentMethods(prisma),
  ]);
  // GCash and bank transfer need Zion's account on the client's payment page for the receipt.
  if (payment.kind === 'LATER' && !offeredBookingPaymentMethods(online).includes(payment.method))
    throw new AdminError(
      'That way to pay is not set up. Add the account in Settings → Online payments, or choose another way.',
    );
  const review = walkInReview({
    totalCents: quote.totalCents,
    depositCents: quote.depositCents,
    paymentRule: policy.paymentRule,
    guests: event.guests,
    policyReviewed: policy.reviewed,
    reviewGuestLimit: rules.reviewGuestLimit,
  });
  // A reason approves a larger event at the desk; without one it waits for review like online.
  if (input.overrideReason && input.overrideReason.length < 5)
    throw new AdminError('Give a reason of at least 5 characters to approve at the desk.');
  const overridden =
    !review.blocking.length && review.overridable.length > 0 && Boolean(input.overrideReason);
  const approved = !review.blocking.length && (!review.overridable.length || overridden);
  const reviewReasons = approved ? [] : [...review.blocking, ...review.overridable];
  if (payment.kind === 'CASH_NOW' && !approved)
    throw new AdminError(
      `This booking needs a decision on Bookings first (${reviewReasons.join('; ')}). Save it without a payment.`,
    );
  if (payment.kind === 'CASH_NOW' && payment.amountCents > quote.totalCents)
    throw new AdminError(`The cash is more than the total of ${money(quote.totalCents)}.`);
  const paid = payment.kind === 'CASH_NOW' ? payment.amountCents : 0;
  // Like Record cash: the payment that meets the policy confirms the booking at once.
  const confirmsNow =
    paid > 0 &&
    !confirmationError(
      {
        approval: 'APPROVED',
        verification: 'VERIFIED',
        reservation: 'REQUESTED',
        paymentRule: policy.paymentRule,
        depositCents: quote.depositCents,
        totalCents: quote.totalCents,
      },
      paid,
      policy.reviewed,
    );
  const startsAt = new Date(`${event.date}T${event.startTime}:00+08:00`);
  const endsAt = new Date(`${event.date}T${event.endTime}:00+08:00`);
  const holdExpiresAt =
    approved &&
    !confirmsNow &&
    requiresPayment({ paymentRule: policy.paymentRule, depositCents: quote.depositCents })
      ? paymentDeadline(now, startsAt, rules.paymentDeadlineDays)
      : null;
  const staffName = actor.fullName || actor.username;
  const label = CONSENT_LABELS[input.consent];
  const consent = `${label.charAt(0).toLowerCase()}${label.slice(1)}`;
  const notes = [
    `Walk-in booking at the front desk with ${staffName}.`,
    `Consent: ${consent} (${eventDate(now)}).`,
    payment.kind === 'LATER' ? preferredPaymentNote(payment.method) : '',
    event.extras.length ? `Asked about: ${event.extras.join(', ')}.` : '',
    pkg && quote.extraGuests > 0
      ? `Price includes ${quote.extraGuests} guests above the package's ${pkg.paxIncluded}.`
      : '',
    overridden
      ? `Approved at the desk despite ${review.overridable.join('; ')}: ${input.overrideReason}`
      : '',
    reviewReasons.length ? `Needs review: ${reviewReasons.join('; ')}.` : '',
    event.notes ? `Notes: ${event.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const reference = `ZION-${now.getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;

  const { result, notificationIds } = await prisma.$transaction(
    async (tx) => {
      // Serializes with website requests, holds and confirmations, then rechecks the slot.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${VENUE}))::text`;
      const taken = await tx.adminBooking.findFirst({
        where: {
          venue: VENUE,
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
          OR: OCCUPYING_BOOKINGS,
        },
        select: { reference: true },
      });
      if (taken)
        throw new AdminError(
          `That time is already held or confirmed for ${taken.reference}. Choose another date or time.`,
          409,
        );
      let booking = await tx.adminBooking.create({
        data: {
          reference,
          clientName: client.fullName,
          email: client.email,
          phone: client.phone,
          eventType: category.name,
          packageName: pkg?.packageName || 'Custom proposal',
          venue: VENUE,
          startsAt,
          endsAt,
          guests: event.guests,
          totalCents: quote.totalCents,
          depositCents: quote.depositCents,
          paymentRule: policy.paymentRule,
          approval: approved ? 'APPROVED' : 'PENDING',
          decisionReason: overridden ? input.overrideReason : '',
          holdExpiresAt,
          // Staff met the client and saw the contact details in person.
          verification: 'VERIFIED',
          verificationNote: 'Met in person at the front desk.',
          verifiedBy: actor.id,
          verifiedAt: now,
          notes,
          policyVersion: policy.version,
          createdBy: actor.id,
          updatedBy: actor.id,
        },
      });
      const audit = (
        module: string,
        action: 'CREATE' | 'UPDATE' | 'APPROVAL',
        description: string,
        metadata: Record<string, string | null>,
      ) =>
        tx.auditLog.create({
          data: {
            userId: actor.id,
            userName: staffName,
            userRole: actor.role,
            action,
            module,
            description,
            status: 'SUCCESS',
            source: 'zion-admin',
            metadata,
          },
        });
      // The dashboard and analytics count booking CREATE entries that name the booking and its
      // source inquiry (docs/dashboard-kpi-contract.md); a walk-in has none.
      await audit(
        'Bookings',
        'CREATE',
        confirmsNow
          ? `Walk-in booking ${reference} created at the front desk and confirmed with the payment received there. Consent: ${consent}.`
          : approved
            ? `Walk-in booking ${reference} created at the front desk${holdExpiresAt ? `; the date is held until ${eventDate(holdExpiresAt)} for the payment` : ''}. Consent: ${consent}.`
            : `Walk-in booking ${reference} created at the front desk; it needs staff review (${reviewReasons.join('; ')}). Consent: ${consent}.`,
        {
          bookingId: booking.id,
          sourceInquiryId: null,
          channel: 'walk-in',
          consentMethod: input.consent,
          consentAt: now.toISOString(),
          sourceVisitId: input.sourceVisitId ?? null,
        },
      );
      if (overridden)
        await audit(
          'Bookings',
          'APPROVAL',
          `Approved walk-in ${reference} at the desk despite ${review.overridable.join('; ')}: ${input.overrideReason}`,
          { bookingId: booking.id },
        );

      let paymentId: string | null = null;
      if (payment.kind === 'CASH_NOW') {
        const recorded = await tx.adminCashPayment.create({
          data: {
            bookingId: booking.id,
            amountCents: payment.amountCents,
            receiptNumber: payment.receiptNumber,
            receivedAt: now,
            recordedBy: actor.id,
            note: payment.note,
            acknowledgmentNumber: await nextAcknowledgmentNumber(tx, now),
          },
          select: { id: true },
        });
        paymentId = recorded.id;
        booking = await tx.adminBooking.update({
          where: { id: booking.id },
          data: {
            revision: { increment: 1 },
            ...(confirmsNow ? { reservation: 'CONFIRMED' } : {}),
          },
        });
        await audit(
          'Payments',
          'CREATE',
          `Recorded CASH ${money(payment.amountCents)} for ${reference}; receipt ${payment.receiptNumber}.`,
          { bookingId: booking.id },
        );
        if (confirmsNow)
          await audit(
            'Bookings',
            'UPDATE',
            `Confirmed ${reference} automatically: the required payment was received at the front desk.`,
            { bookingId: booking.id },
          );
      }

      const notice = (
        eventName: string,
        options: Partial<Parameters<typeof enqueueBookingNotice>[1]> = {},
      ) =>
        enqueueBookingNotice(tx, {
          booking,
          event: eventName,
          paid,
          instructions: policy.cashInstructions,
          now,
          ...options,
        });
      const ids: string[] = [];
      if (confirmsNow) {
        ids.push(...(await notice('CASH_RECEIPT', { receiptPaymentId: paymentId ?? undefined })));
        ids.push(
          ...(await notice('RESERVATION_CONFIRMED', {
            calendar: 'REQUEST',
            staffCalendar: 'CONFIRMED',
          })),
        );
      } else {
        // A held date tells the client what to pay and by when; a request under review says so.
        ids.push(
          ...(await notice(approved ? 'REQUEST_APPROVED' : 'REQUEST_RECEIVED', {
            staffCalendar: 'PENDING',
          })),
        );
        if (paymentId) ids.push(...(await notice('CASH_RECEIPT', { receiptPaymentId: paymentId })));
      }

      if (input.sourceVisitId) {
        // The visitor booked after their visit: a checked-in visit is complete, and its notes
        // point to the booking.
        const visit = await tx.adminVisit.findUnique({
          where: { id: input.sourceVisitId },
          select: { id: true, reference: true, status: true, staffNotes: true },
        });
        if (visit) {
          await tx.adminVisit.update({
            where: { id: visit.id },
            data: {
              staffNotes: [visit.staffNotes, `Booked ${reference} at the front desk.`]
                .filter(Boolean)
                .join('\n')
                .slice(0, 2000),
              ...(visit.status === 'CHECKED_IN' ? { status: 'COMPLETED', completedAt: now } : {}),
            },
          });
          await audit(
            'Front desk',
            'UPDATE',
            `Ocular visit ${visit.reference} led to walk-in booking ${reference}${visit.status === 'CHECKED_IN' ? '; the visit is marked completed' : ''}.`,
            { visitId: visit.id, bookingId: booking.id },
          );
        }
      }

      const outcome: WalkInOutcome = confirmsNow ? 'CONFIRMED' : approved ? 'HELD' : 'REVIEW';
      const required =
        policy.paymentRule === 'FULL_PAYMENT_REQUIRED' ? booking.totalCents : booking.depositCents;
      return {
        result: {
          id: booking.id,
          reference,
          outcome,
          holdExpiresAt: booking.holdExpiresAt?.toISOString() ?? null,
          totalCents: booking.totalCents,
          paidCents: paid,
          amountDueCents: Math.max(0, (confirmsNow ? booking.totalCents : required) - paid),
          reviewReasons,
          paymentPath: outcome === 'REVIEW' ? null : paymentPagePath(booking.id),
          receiptPath: paymentId ? `/api/admin/receipts/${paymentId}` : null,
        } satisfies WalkInResult,
        notificationIds: ids,
      };
    },
    { maxWait: 10_000, timeout: 20_000 },
  );
  scheduleAutomationDelivery(notificationIds);
  return result;
}
