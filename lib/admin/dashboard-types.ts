export type DashboardMonth = {
  key: string;
  label: string;
  bookings: number;
  inquiries: number;
  cashCents: number;
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
};
