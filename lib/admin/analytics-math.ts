import type { AnalyticsMeasures, Trajectory } from './analytics-types';

export function changePercent(current: number, previous: number) {
  return previous ? ((current - previous) / previous) * 100 : current ? null : 0;
}

export function businessTrajectory(
  current: AnalyticsMeasures,
  previous: AnalyticsMeasures,
  historyComplete: boolean,
): Trajectory {
  const cashChangeCents = current.cashCents - previous.cashCents;
  const bookingChange = current.newSecuredBookings - previous.newSecuredBookings;
  const changes = {
    cashChangeCents,
    bookingChange,
    cashChangePercent: changePercent(current.cashCents, previous.cashCents),
    bookingChangePercent: changePercent(current.newSecuredBookings, previous.newSecuredBookings),
  };
  const result = (state: Trajectory['state'], label: string, detail: string): Trajectory => ({
    state,
    label,
    detail,
    ...changes,
  });
  if (!historyComplete)
    return result(
      'limited',
      'Limited booking history',
      'Some secured bookings have no dated confirmation history. Review the independent cash comparison below.',
    );
  if (
    ![
      current.cashCents,
      previous.cashCents,
      current.newSecuredBookings,
      previous.newSecuredBookings,
    ].some((value) => value > 0)
  )
    return result(
      'empty',
      'No activity to assess',
      'There is no cash or confirmed-booking activity in either comparison interval.',
    );
  if (!previous.cashCents && !previous.newSecuredBookings)
    return result(
      'new',
      'New activity',
      'Cash or confirmed bookings are recorded against a zero prior baseline.',
    );
  if (cashChangeCents >= 0 && bookingChange >= 0 && (cashChangeCents || bookingChange))
    return result(
      'improving',
      'Improving',
      'Income and confirmed bookings are stable or rising, with at least one measure increasing.',
    );
  if (cashChangeCents <= 0 && bookingChange <= 0 && (cashChangeCents || bookingChange))
    return result(
      'attention',
      'Needs attention',
      'Income and confirmed bookings are stable or falling, with at least one measure decreasing.',
    );
  if (!cashChangeCents && !bookingChange)
    return result(
      'steady',
      'Steady',
      'Income and confirmed bookings match the previous comparable interval.',
    );
  return result(
    'mixed',
    'Mixed signals',
    'Income and confirmed bookings are moving in different directions.',
  );
}
