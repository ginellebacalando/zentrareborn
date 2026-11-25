import type { Prisma } from '@prisma/client';

/**
 * Bookings that occupy their time slot in every availability check: confirmed reservations, and
 * approved requests that hold their date while the client pays (docs/booking-automation.md). The
 * scheduled automation run releases an unpaid hold within minutes of its payment deadline.
 */
export const OCCUPYING_BOOKINGS: Prisma.AdminBookingWhereInput[] = [
  { reservation: 'CONFIRMED' },
  { reservation: 'REQUESTED', approval: 'APPROVED' },
];

/** Whether a booking occupies its slot (see OCCUPYING_BOOKINGS). */
export function occupiesSlot(booking: { reservation: string; approval: string }) {
  return (
    booking.reservation === 'CONFIRMED' ||
    (booking.reservation === 'REQUESTED' && booking.approval === 'APPROVED')
  );
}
