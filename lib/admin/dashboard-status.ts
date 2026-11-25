/**
 * The four booking states shown in the ZENTRA Figma frames (Request, Pending, Confirmed,
 * Cancelled). They are a display layer derived from the real, independent booking fields; they
 * never replace those fields, and every action still follows the state machine enforced in
 * lib/admin/service.ts (approval, then cash and policy checks, then confirmation).
 *
 * - request:   reservation REQUESTED and approval PENDING. Under review: a request the booking
 *              automation could not approve by itself, or one staff entered, waiting for a staff
 *              decision (flagged requests stay here and keep their own badge).
 * - pending:   reservation REQUESTED and approval APPROVED. Waiting for payment: the date is held
 *              until the payment deadline; the payment that meets the rule confirms it.
 *              Approval is not confirmation (docs/booking-automation.md).
 * - confirmed: reservation CONFIRMED or COMPLETED. The date is secured; completed events stay here.
 * - cancelled: reservation CANCELLED, or approval REJECTED. Closed without a secured date.
 *
 * lib/admin/dashboard.ts groups the same fields with this function, so dashboard and booking
 * counts agree.
 */
export const displayStatuses = ['request', 'pending', 'confirmed', 'cancelled'] as const;
export type DisplayStatus = (typeof displayStatuses)[number];
export type DisplayStatusCounts = Record<DisplayStatus, number>;

export const displayStatusLabels: Record<DisplayStatus, string> = {
  request: 'Under review',
  pending: 'Waiting for payment',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
};

/** One short sentence per state, used in accessible names and empty states. */
export const displayStatusDescriptions: Record<DisplayStatus, string> = {
  request: 'Waiting for a staff decision',
  pending: 'Approved; the date is held until the client pays',
  confirmed: 'Date secured',
  cancelled: 'Cancelled or rejected',
};

export function displayStatus(booking: { approval: string; reservation: string }): DisplayStatus {
  if (booking.reservation === 'CONFIRMED' || booking.reservation === 'COMPLETED')
    return 'confirmed';
  if (booking.reservation === 'CANCELLED' || booking.approval === 'REJECTED') return 'cancelled';
  if (booking.approval === 'APPROVED') return 'pending';
  return 'request';
}

export function emptyStatusCounts(): DisplayStatusCounts {
  return { request: 0, pending: 0, confirmed: 0, cancelled: 0 };
}

export function countDisplayStatuses(
  bookings: { approval: string; reservation: string; count?: number }[],
): DisplayStatusCounts {
  const counts = emptyStatusCounts();
  for (const booking of bookings) counts[displayStatus(booking)] += booking.count ?? 1;
  return counts;
}
