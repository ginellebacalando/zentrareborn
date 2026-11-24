import 'server-only';

import type { Prisma } from '@prisma/client';
import {
  RECEPTIONIST_BOOKING_CONTRACT_VERSION,
  type ReceptionistBookingRequest,
  type ReceptionistBookingResult,
} from './receptionist-booking.contract';

export type ReceptionistAvailabilityRequest = Extract<
  ReceptionistBookingRequest,
  { intent: 'availability_check' }
>;

export type ReceptionistCalendarQuery = {
  venue: 'Zion Events Place';
  startsAt: Date;
  endsAt: Date;
};

export interface ReceptionistCalendarSource {
  hasConfirmedOverlap(query: ReceptionistCalendarQuery): Promise<boolean>;
}

type CalendarBookingReader = {
  findFirst(input: {
    where: Prisma.AdminBookingWhereInput;
    select: { id: true };
  }): Promise<{ id: string } | null>;
};

export type ReceptionistCalendarDependencies = {
  source?: ReceptionistCalendarSource;
  now?: () => Date;
};

export type ReceptionistCalendarAvailability = {
  check(request: ReceptionistAvailabilityRequest): Promise<ReceptionistBookingResult>;
};

// Admin confirmation currently locks and conflicts on this one venue literal, so every public
// space remains a conservative alias of the same exclusive scheduling resource.
const calendarVenueByPublicId = {
  'zion-events-place': 'Zion Events Place',
  'selah-hall': 'Zion Events Place',
  'pavilion-garden': 'Zion Events Place',
  pool: 'Zion Events Place',
} as const;

type PublicVenueId = keyof typeof calendarVenueByPublicId;

function isPublicVenueId(value: string | undefined): value is PublicVenueId {
  return Boolean(value && Object.hasOwn(calendarVenueByPublicId, value));
}

function manilaInstant(date: string, time: string) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  if (
    !year ||
    !month ||
    !day ||
    hour === undefined ||
    minute === undefined ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  const instant = new Date(Date.UTC(year, month - 1, day, hour - 8, minute));
  const manila = new Date(instant.getTime() + 8 * 60 * 60 * 1000);
  if (
    manila.getUTCFullYear() !== year ||
    manila.getUTCMonth() !== month - 1 ||
    manila.getUTCDate() !== day ||
    manila.getUTCHours() !== hour ||
    manila.getUTCMinutes() !== minute
  ) {
    return null;
  }
  return instant;
}

function commonResult(request: ReceptionistAvailabilityRequest, observedAt: Date) {
  return {
    schemaVersion: RECEPTIONIST_BOOKING_CONTRACT_VERSION,
    requestId: request.requestId,
    conversationId: request.conversationId,
    turnId: request.turnId,
    stateRevision: request.stateRevision,
    respondedAt: observedAt.toISOString(),
  } as const;
}

function needsExplicitWindow(
  request: ReceptionistAvailabilityRequest,
  observedAt: Date,
  missingFields: Array<'venue_id' | 'preferred_slots' | 'time_preference'>,
): ReceptionistBookingResult {
  return {
    ...commonResult(request, observedAt),
    provenance: {
      source: 'request_validation',
      authoritative: true,
      observedAt: observedAt.toISOString(),
    },
    status: 'NEEDS_INFO',
    missingFields,
  };
}

function calendarFailure(
  request: ReceptionistAvailabilityRequest,
  observedAt: Date,
): ReceptionistBookingResult {
  return {
    ...commonResult(request, observedAt),
    provenance: {
      source: 'orchestration_adapter',
      authoritative: false,
      observedAt: observedAt.toISOString(),
    },
    status: 'ERROR',
    errorCode: 'PERSISTENCE_UNAVAILABLE',
    retryable: true,
  };
}

export function confirmedCalendarOverlapWhere(
  query: ReceptionistCalendarQuery,
): Prisma.AdminBookingWhereInput {
  return {
    venue: query.venue,
    reservation: 'CONFIRMED',
    startsAt: { lt: query.endsAt },
    endsAt: { gt: query.startsAt },
  };
}

export function createAdminCalendarSource(
  reader?: CalendarBookingReader,
): ReceptionistCalendarSource {
  return {
    async hasConfirmedOverlap(query) {
      const bookingReader =
        reader ??
        ({
          async findFirst(input) {
            const { prisma } = await import('@/lib/prisma');
            return prisma.adminBooking.findFirst(input);
          },
        } satisfies CalendarBookingReader);
      const conflict = await bookingReader.findFirst({
        where: confirmedCalendarOverlapWhere(query),
        select: { id: true },
      });
      return Boolean(conflict);
    },
  };
}

export function createReceptionistCalendarAvailability(
  dependencies: ReceptionistCalendarDependencies = {},
): ReceptionistCalendarAvailability {
  const source = dependencies.source ?? createAdminCalendarSource();
  const now = dependencies.now ?? (() => new Date());

  return {
    async check(request) {
      const observedAt = now();
      const venueId = request.booking.venueId;
      const slot =
        request.booking.preferredSlots.length === 1 ? request.booking.preferredSlots[0] : undefined;
      const missingFields: Array<'venue_id' | 'preferred_slots' | 'time_preference'> = [];
      if (!isPublicVenueId(venueId)) missingFields.push('venue_id');
      if (!slot) missingFields.push('preferred_slots');
      if (!slot?.startTime || !slot.endTime) missingFields.push('time_preference');
      if (missingFields.length > 0) {
        return needsExplicitWindow(request, observedAt, missingFields);
      }
      if (!isPublicVenueId(venueId) || !slot?.startTime || !slot.endTime) {
        return needsExplicitWindow(request, observedAt, ['preferred_slots']);
      }

      const startsAt = manilaInstant(slot.date, slot.startTime);
      const endsAt = manilaInstant(slot.date, slot.endTime);
      if (!startsAt || !endsAt || startsAt >= endsAt || startsAt <= observedAt) {
        return needsExplicitWindow(request, observedAt, ['preferred_slots']);
      }

      let unavailable: boolean;
      try {
        unavailable = await source.hasConfirmedOverlap({
          venue: calendarVenueByPublicId[venueId],
          startsAt,
          endsAt,
        });
      } catch {
        return calendarFailure(request, now());
      }

      const responseTime = now();
      const provenance = {
        source: 'calendar_system' as const,
        authoritative: true,
        observedAt: responseTime.toISOString(),
      };
      if (unavailable) {
        return {
          ...commonResult(request, responseTime),
          provenance,
          status: 'SLOT_UNAVAILABLE',
          serviceId: request.booking.serviceId,
          alternatives: [],
        };
      }
      return {
        ...commonResult(request, responseTime),
        provenance,
        status: 'AVAILABLE',
        serviceId: request.booking.serviceId,
        slots: [
          {
            date: slot.date,
            startTime: slot.startTime,
            endTime: slot.endTime,
            timeZone: 'Asia/Manila',
          },
        ],
      };
    },
  };
}
