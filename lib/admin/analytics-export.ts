import type { AnalyticsMeasures, AnalyticsReport, ReportInterval } from './analytics-types';

const dateOptions: Intl.DateTimeFormatOptions = {
  timeZone: 'Asia/Manila',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
};
export function reportDates(interval: ReportInterval) {
  return `${new Date(interval.start).toLocaleDateString('en-PH', dateOptions)} – ${new Date(new Date(interval.through).getTime() - 1).toLocaleDateString('en-PH', dateOptions)}`;
}
export const reportTimestamp = (iso: string) =>
  new Date(iso).toLocaleString('en-PH', { ...dateOptions, hour: 'numeric', minute: '2-digit' });
export const conversionRate = (measures: AnalyticsMeasures, complete: boolean) =>
  complete && measures.inquiries ? (measures.convertedInquiries / measures.inquiries) * 100 : null;

function cell(value: string | number) {
  const text = String(value);
  const safe = /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function analyticsCsv(report: AnalyticsReport) {
  const { current: c, comparison: p, snapshot: s, range, quality: q } = report;
  const rows: (string | number)[][] = [
    ['Zion Events Place — Analytics'],
    ['As of (Asia/Manila)', reportTimestamp(report.asOf)],
    ['Period', range.current.label, reportDates(range.current)],
    ['Comparison', range.comparison.label, reportDates(range.comparison)],
    [
      'Trajectory (cash and newly secured bookings)',
      report.trajectory.label,
      report.trajectory.detail,
    ],
    ['Measure', 'Selected interval', 'Comparison interval', 'Scope / unit'],
    [
      'Cash income',
      c.cashCents / 100,
      p.cashCents / 100,
      'PHP; non-voided receipts by received date',
    ],
    [
      'New secured bookings',
      c.newSecuredBookings,
      p.newSecuredBookings,
      q.confirmationHistoryComplete
        ? 'Current CONFIRMED/COMPLETED; first confirmation date'
        : 'Tracked dated confirmations only; history incomplete',
    ],
    ['Booking requests received', c.requests, p.requests, 'By created date'],
    ['Inquiries received', c.inquiries, p.inquiries, 'By submitted date'],
    [
      'Inquiries with linked requests',
      c.linkedInquiries,
      p.linkedInquiries,
      'Distinct inquiry cohort; verified links only',
    ],
    [
      'Inquiries with solid bookings',
      c.convertedInquiries,
      p.convertedInquiries,
      'Distinct inquiry cohort; current CONFIRMED/COMPLETED',
    ],
    [
      'Inquiry conversion (%)',
      conversionRate(c, q.currentAttributionComplete) ?? 'Unavailable',
      conversionRate(p, q.comparisonAttributionComplete) ?? 'Unavailable',
      'Current status of period inquiry cohort',
    ],
    [
      'Secured event dates',
      c.securedEvents,
      p.securedEvents,
      'By event start; current CONFIRMED/COMPLETED',
    ],
    ['Completed events', c.completedEvents, p.completedEvents, 'By event start; current COMPLETED'],
    [
      'Cancellations recorded',
      c.cancellations,
      p.cancellations,
      'Distinct bookings by cancellation event date',
    ],
    ['Current snapshot — all secured bookings', 'PHP / count'],
    ['Overall cash income', s.allTimeCashCents / 100, 'All-time actual cash through response time'],
    [
      'Pending balance',
      s.outstandingCents / 100,
      `${s.outstandingBookings} secured bookings; current snapshot`,
    ],
    [
      'Past-event unpaid balance',
      s.pastEventBalanceCents / 100,
      `${s.pastEventBalanceBookings} past events; not a contractual due-date claim`,
    ],
    [
      'Cash applied to secured value',
      s.paidOnSecuredCents / 100,
      'Capped per booking at contract value',
    ],
    ['Secured contract value', s.securedContractCents / 100, 'CONFIRMED/COMPLETED portfolio'],
    [
      'Approved request pipeline',
      s.pipelineCents / 100,
      `${s.pipelineRequests} prospective requests; not income or receivables`,
    ],
    ['Upcoming confirmed events', s.upcomingEvents, 'Within selected full calendar period'],
    ['Undated secured confirmations', s.undatedConfirmations],
    ['Overpaid bookings', s.overpaidBookings],
    ['Untracked origins affecting selected inquiry cohort', c.unattributedOrigins],
    ['Attribution tracking since', q.trackingSince ?? 'No structured booking origins yet'],
    [
      'Income trend; PHP',
      'Cash income',
      'Secured event dates',
      'Completed events',
      'Requests',
      'Inquiries',
      'Start UTC (inclusive)',
      'Through UTC (exclusive)',
    ],
    ...report.buckets.map((b) => [
      b.label,
      b.cashCents / 100,
      b.securedEvents,
      b.completedEvents,
      b.requests,
      b.inquiries,
      b.start,
      b.end,
    ]),
    ['Notes', 'Expenses are not recorded. This report does not calculate profit or loss.'],
    [
      'Notes',
      'Balances and inquiry outcomes show current status. Historical reports are not frozen historical snapshots.',
    ],
  ];
  return '\uFEFF' + rows.map((row) => row.map(cell).join(',')).join('\r\n');
}

export const compactReportCash = (cents: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(cents / 100);
