import { CLIENT_PHOTO_RETENTION_DAYS } from '@/config/client-photos';
import { DEFAULT_BOOKING_RULES, type BookingRules } from '@/lib/admin/booking-rules';
import { EMPTY_PAYMENT_ACCOUNTS, type PaymentAccounts } from '@/lib/admin/payment-accounts';
import { STAFF_RECIPIENT_LIMITS } from '@/lib/automation/catalog';
import { isEmailAddress } from '@/lib/email-address';
import { DEFAULT_VISIT_RULES, type VisitRules } from '@/lib/visit-rules';
import {
  DEFAULT_PUBLIC_SYSTEM_SETTINGS,
  type PublicSystemSettings,
} from '@/lib/system-settings-types';

export const SESSION_TIMEOUT_OPTIONS = [15, 30, 60, 240] as const;

/**
 * Each administrator's own light/dark choice from the header toggle. It is kept in a cookie so the
 * panel layout renders that theme from the first paint; without one, the saved default
 * (Settings > Appearance) applies.
 */
export const ADMIN_THEME_COOKIE = 'zentra-admin-theme';
export type AdminTheme = 'light' | 'dark';
export function adminThemeValue(value: unknown): AdminTheme | null {
  return value === 'light' || value === 'dark' ? value : null;
}
export const notificationLabels = {
  newBookingRequests: 'New Booking Requests',
  bookingConfirmations: 'Booking Confirmations',
  bookingCancellations: 'Booking Cancellations',
  customerInquiries: 'Customer Inquiries',
  paymentUpdates: 'Payment Updates',
  contractUpdates: 'Contract Updates',
  testimonyUpdates: 'Testimony Updates',
  supportUpdates: 'Support Center Updates',
  systemAlerts: 'System Alerts',
} as const;
export type NotificationPreference = keyof typeof notificationLabels;
export type AdminPreferences = {
  appearance: PublicSystemSettings['appearance'];
  client: PublicSystemSettings['client'];
  admin: {
    notifications: Record<NotificationPreference, boolean>;
    security: { sessionTimeoutMinutes: number };
    localization: PublicSystemSettings['localization'];
    /**
     * Inboxes for staff alerts, the daily digest and staff calendar invitations. Empty means the
     * server default (STAFF_NOTIFICATION_EMAIL, else the sending account).
     */
    staffNotifications: { emails: string[] };
    /** Payment deadline and review limit of the booking automation (docs/booking-automation.md). */
    bookingRules: BookingRules;
    /** GCash and bank accounts for each client's private payment page (phase 2). */
    paymentAccounts: PaymentAccounts;
    /** When Zion receives ocular visits and how long each lasts (docs/visits.md). */
    visitRules: VisitRules;
    /**
     * Retention of personal data the system deletes on its own (docs/client-photos.md). The
     * periods are defaults to confirm with Zion.
     */
    privacy: { clientPhotoRetentionDays: number };
  };
};
export type PreferencesResponse = {
  settings: AdminPreferences;
  updatedAt: string | null;
  canEdit: boolean;
};
export const DEFAULT_ADMIN_PREFERENCES: AdminPreferences = {
  appearance: { ...DEFAULT_PUBLIC_SYSTEM_SETTINGS.appearance },
  client: { ...DEFAULT_PUBLIC_SYSTEM_SETTINGS.client },
  admin: {
    notifications: Object.fromEntries(
      Object.keys(notificationLabels).map((key) => [key, true]),
    ) as Record<NotificationPreference, boolean>,
    security: { sessionTimeoutMinutes: 30 },
    localization: { ...DEFAULT_PUBLIC_SYSTEM_SETTINGS.localization },
    staffNotifications: { emails: [] },
    bookingRules: { ...DEFAULT_BOOKING_RULES },
    paymentAccounts: structuredClone(EMPTY_PAYMENT_ACCOUNTS),
    visitRules: structuredClone(DEFAULT_VISIT_RULES),
    privacy: { clientPhotoRetentionDays: CLIENT_PHOTO_RETENTION_DAYS.default },
  },
};

/**
 * Why a staff notification list cannot be saved, or null when it can. Addresses must already be
 * trimmed and lowercased. The Settings form and the server apply the same rules, which match the
 * outbox and the calendar writer, so a saved address is never refused at delivery.
 */
export function staffNotificationEmailsProblem(emails: readonly string[]) {
  if (emails.length > STAFF_RECIPIENT_LIMITS.emails)
    return `Enter up to ${STAFF_RECIPIENT_LIMITS.emails} email addresses.`;
  const invalid = emails.find((email) => !isEmailAddress(email));
  if (invalid !== undefined) {
    if (!invalid) return 'Remove the empty address from the list.';
    const shown = invalid.length > 60 ? `${invalid.slice(0, 57)}...` : invalid;
    return `"${shown}" is not a valid email address. Use the form name@example.com.`;
  }
  if (new Set(emails).size !== emails.length) return 'List each email address only once.';
  if (emails.join(', ').length > STAFF_RECIPIENT_LIMITS.listLength)
    return `Together the addresses must fit in ${STAFF_RECIPIENT_LIMITS.listLength} characters. Remove an address or use a shorter one.`;
  return null;
}

/** Reads the Settings field: addresses separated by commas, semicolons or spaces. */
export function parseStaffNotificationEmails(text: string) {
  const emails = text
    .split(/[\s,;]+/)
    .map((part) => part.toLowerCase())
    .filter(Boolean);
  return { emails, problem: staffNotificationEmailsProblem(emails) };
}
type Localization = AdminPreferences['admin']['localization'];

function localeOf(localization: Localization) {
  return localization.language === 'Tagalog (PH)'
    ? 'fil-PH'
    : localization.language === 'Spanish (ES)'
      ? 'es-ES'
      : 'en-US';
}

/**
 * Friendly dates in the admin (27 November 2026): "Tue, Dec 8, 2026" for the 12-hour choice,
 * "Tue, 8 Dec 2026" for the 24-hour one and "2026-12-08" for ISO. The page says once which time
 * zone applies (timeZoneNote), so times carry no "GMT+8".
 */
export function formatPreferenceDay(value: string | Date, localization: Localization) {
  const date = new Date(value);
  if (localization.dateFormat === 'YYYY-MM-DD (ISO)')
    return date.toLocaleDateString('en-CA', { timeZone: localization.timezone });
  const parts = new Intl.DateTimeFormat(localeOf(localization), {
    timeZone: localization.timezone,
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || '';
  return localization.dateFormat === 'DD/MM/YYYY (24-hour)'
    ? `${part('weekday')}, ${part('day')} ${part('month')} ${part('year')}`
    : `${part('weekday')}, ${part('month')} ${part('day')}, ${part('year')}`;
}

/** "5:00 PM" for the 12-hour choice, "17:00" otherwise. */
export function formatPreferenceTime(value: string | Date, localization: Localization) {
  return new Intl.DateTimeFormat(localeOf(localization), {
    timeZone: localization.timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: localization.dateFormat === 'MM/DD/YYYY (12-hour)',
  }).format(new Date(value));
}

/** "Tue, Dec 8, 2026 · 5:00 PM"; ISO reads "2026-12-08 17:00". */
export function formatPreferenceDate(value: string | Date, localization: Localization) {
  const day = formatPreferenceDay(value, localization);
  const time = formatPreferenceTime(value, localization);
  return localization.dateFormat === 'YYYY-MM-DD (ISO)' ? `${day} ${time}` : `${day} · ${time}`;
}

const ZONE_NAMES: Record<string, string> = {
  'Asia/Manila': 'Manila',
  'Asia/Tokyo': 'Tokyo',
  'America/Los_Angeles': 'Pacific (US)',
  'America/New_York': 'Eastern (US)',
};

/** The one line a page shows instead of a zone name on every time. */
export function timeZoneNote(localization: Localization) {
  return `Times are ${ZONE_NAMES[localization.timezone] ?? localization.timezone} time.`;
}
