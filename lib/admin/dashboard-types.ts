import type { DisplayStatusCounts } from './dashboard-status';

export type DashboardMonth = {
  key: string;
  label: string;
  bookings: number;
  inquiries: number;
  cashCents: number;
  /** Distinct bookings whose first recorded confirmation falls in the month. */
  confirmed: number;
  /** Distinct bookings with a recorded cancellation or rejection in the month. */
  cancelled: number;
};

export type ReservationSlice = {
  key: string;
  label: string;
  count: number;
};

export type DashboardInsights = {
  generatedAt: string;
  timezone: 'Asia/Manila';
  months: DashboardMonth[];
  reservations: ReservationSlice[];
  /** Bookings whose event starts in the current Manila month, by display status. */
  thisMonth: { key: string; label: string; statuses: DisplayStatusCounts };
  /** Activity recorded in the 30 days up to generatedAt. */
  last30: {
    requests: number;
    confirmed: number;
    cancelled: number;
    inquiries: number;
    cashCents: number;
  };
};
