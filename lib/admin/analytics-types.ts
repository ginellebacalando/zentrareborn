export const reportKinds = ['week', 'month', 'quarter', 'year'] as const;
export type ReportKind = (typeof reportKinds)[number];

export type ReportInterval = { start: string; end: string; through: string; label: string };
export type AnalyticsBucket = {
  key: string;
  label: string;
  start: string;
  end: string;
  cashCents: number;
  securedEvents: number;
  completedEvents: number;
  requests: number;
  inquiries: number;
};
export type AnalyticsRange = {
  kind: ReportKind;
  anchor: string;
  today: string;
  current: ReportInterval;
  comparison: ReportInterval;
  partial: boolean;
  previousAnchor: string;
  nextAnchor: string;
  canNext: boolean;
  bucketUnit: 'day' | 'seven-day group' | 'month';
};
export type AnalyticsMeasures = {
  cashCents: number;
  newSecuredBookings: number;
  requests: number;
  inquiries: number;
  linkedInquiries: number;
  convertedInquiries: number;
  securedEvents: number;
  completedEvents: number;
  cancellations: number;
  unattributedOrigins: number;
};
export type AnalyticsSnapshot = {
  allTimeCashCents: number;
  outstandingCents: number;
  outstandingBookings: number;
  securedContractCents: number;
  paidOnSecuredCents: number;
  pipelineCents: number;
  pipelineRequests: number;
  pastEventBalanceCents: number;
  pastEventBalanceBookings: number;
  overpaidBookings: number;
  undatedConfirmations: number;
  upcomingEvents: number;
};
export type Trajectory = {
  state: 'improving' | 'attention' | 'mixed' | 'steady' | 'empty' | 'new' | 'limited';
  label: string;
  detail: string;
  cashChangeCents: number;
  cashChangePercent: number | null;
  bookingChange: number;
  bookingChangePercent: number | null;
};
export type AnalyticsReport = {
  asOf: string;
  timezone: 'Asia/Manila';
  range: AnalyticsRange;
  snapshot: AnalyticsSnapshot;
  current: AnalyticsMeasures;
  comparison: AnalyticsMeasures;
  buckets: AnalyticsBucket[];
  quality: {
    currentAttributionComplete: boolean;
    comparisonAttributionComplete: boolean;
    confirmationHistoryComplete: boolean;
    trackingSince: string | null;
  };
  trajectory: Trajectory;
};
