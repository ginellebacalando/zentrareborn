import type { StaffClientPhoto } from '@/config/client-photos';
import type { TeamMember } from '@/lib/admin/team';
import type { CalendarVisit } from '@/lib/visit-types';
import type { DashboardInsights } from '@/lib/admin/dashboard-types';
import type { DashboardKpis } from '@/lib/admin/dashboard-kpi-types';
import type { AnalyticsReport } from '@/lib/admin/analytics-types';

export type Receipt = {
  id: string;
  receiptNumber: string;
  amountCents: number;
  receivedAt: string;
  recordedBy: string;
  note: string;
  /** CASH at the venue, or GCASH / BANK_TRANSFER verified from a payment screenshot. */
  method: string;
  /** Printed on the payment's acknowledgment receipt (phase 3); older rows may have none. */
  acknowledgmentNumber: string | null;
  voidedAt: string | null;
  voidReason: string | null;
};
/** A client's payment screenshot as staff see it; the file itself loads from its own route. */
export type PaymentProof = {
  id: string;
  method: 'GCASH' | 'BANK_TRANSFER';
  referenceNumber: string;
  amountCents: number;
  /** The date the client says they paid, YYYY-MM-DD. */
  paidOn: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  status: 'SUBMITTED' | 'VERIFIED' | 'REJECTED';
  reviewReason: string;
  reviewedAt: string | null;
  createdAt: string;
  /** Signs the payment may not be new, for staff to check against their records. */
  warnings: string[];
};
export type Contract = {
  id: string;
  version: number;
  bookingRevision: number;
  body: string;
  status: string;
  signedBy: string | null;
  signedAt: string | null;
  signedReference: string | null;
  createdAt: string;
};
export type Booking = {
  id: string;
  reference: string;
  clientName: string;
  email: string;
  phone: string;
  eventType: string;
  packageName: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  guests: number;
  totalCents: number;
  depositCents: number;
  paymentRule: string;
  approval: string;
  reservation: string;
  verification: string;
  verificationNote: string;
  notes: string;
  /** Why staff or the automation closed or decided the booking. */
  decisionReason?: string;
  revision: number;
  policyVersion: number;
  /** Payment deadline while an approved request holds its date (booking automation). */
  holdExpiresAt: string | null;
  payments: Receipt[];
  contracts: Contract[];
  /** Loaded with a single booking (booking automation phase 2). */
  paymentProofs?: PaymentProof[];
  /** Screenshots waiting for review; set on booking lists. */
  proofsToVerify?: number;
  /**
   * The client's optional arrival photo (docs/client-photos.md), on the booking page, the
   * Calendar and the dashboard; left out for roles that may not see photos.
   */
  clientPhoto?: StaffClientPhoto | null;
};
export type Policy = {
  version: number;
  reviewed: boolean;
  paymentRule: string;
  cashInstructions: string;
  contractTerms: string;
};
export type Inquiry = {
  id?: string;
  inquiryReference: string;
  fullName: string;
  email?: string;
  phoneNumber?: string | null;
  eventInterest: string | null;
  packageInterest?: string | null;
  requestedEventDate?: string | null;
  message?: string;
  status?: string;
  submittedAt?: string;
};
export type Log = {
  id: string;
  timestamp: string;
  userName: string;
  userRole: string;
  action: string;
  module: string;
  description: string;
  status: string;
};
export type HeldTestimony = {
  id: string;
  clientName: string;
  eventType: string;
  eventDate: string;
  overallRating: number;
  comment: string;
  photoUrl: string | null;
  status: string;
  flagReasons: string[];
  submittedAt: string;
};
export type Notice = {
  id: string;
  event: string;
  subject: string;
  body: string;
  status: string;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
};
export type AdminData = {
  dashboardKpis?: DashboardKpis;
  analyticsReport?: AnalyticsReport;
  dashboardInsights?: DashboardInsights;
  analytics?: {
    totalBookings: number;
    inquiryCount: number;
    cashCents: number;
    reservations: { label: string; count: number }[];
    eventTypes: { label: string; count: number }[];
  };
  /** Team (lib/admin/team.ts); super administrators only. */
  members?: TeamMember[];
  canManage?: boolean;
  bookings?: Booking[];
  /** The Calendar month's ocular visits (lib/admin/front-desk.ts). */
  visits?: CalendarVisit[];
  booking?: Booking;
  inquiry?: Inquiry;
  total?: number;
  page?: number;
  policy?: Policy;
  user?: {
    fullName: string | null;
    profileImage: string | null;
    username: string;
    email: string;
    contactNumber: string | null;
    role: string;
    status: string;
  };
  pending?: number;
  confirmed?: number;
  flagged?: number;
  cashCents?: number;
  upcoming?: Booking[];
  inquiries?: Inquiry[];
  heldTestimonies?: HeldTestimony[];
  outbox?: Notice[] | { status: string; _count: number }[];
  logs?: Log[];
  /** Built-in automation jobs; the API keeps the earlier field names. */
  workflows?: {
    id: string;
    workflowName: string;
    status: string;
    createdAt: string;
    completedAt?: string | null;
  }[];
  notificationConfigured?: boolean;
  policyReviewed?: boolean;
};
/** `inlineErrors` keeps a failure out of the page-level alert so the form can show it in place. */
export type Mutate = (
  section: string,
  payload: unknown,
  options?: { inlineErrors?: boolean },
) => Promise<void>;

export type AdminNotificationSummary = {
  notifications: {
    id: string;
    title: string;
    message: string;
    href: string;
    kind: 'booking' | 'inquiry' | 'warning' | 'policy' | 'payment' | 'contract';
    /** It came in after this admin last opened the bell. */
    isNew: boolean;
  }[];
  /** The bell's number: notices new since this admin last opened it. */
  unseen: number;
  /** The Messages number: open inquiries received since this admin last opened Messages. */
  newMessages: number;
};
/** The reply to a look (app/api/admin/notifications/seen): the summary, and what it revealed. */
export type AdminNotificationLook = AdminNotificationSummary & { wasNew: string[] };
