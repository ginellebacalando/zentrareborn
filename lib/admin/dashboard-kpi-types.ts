import type { ReportInterval } from './analytics-types';

export type DashboardKpi = {
  value: number;
  current: number;
  previous: number;
};

export type DashboardKpis = {
  asOf: string;
  timezone: 'Asia/Manila';
  year: number;
  annual: { current: ReportInterval; comparison: ReportInterval };
  outlook: { current: ReportInterval; comparison: ReportInterval };
  sales: DashboardKpi;
  pending: DashboardKpi;
  upcoming: DashboardKpi;
  bookings: DashboardKpi;
  quality: { undatedSecuredBookings: number; untrackedSecuredBookings: number };
};
