import {
  DEFAULT_PUBLIC_SYSTEM_SETTINGS,
  type PublicSystemSettings,
} from '@/lib/system-settings-types';

export const SESSION_TIMEOUT_OPTIONS = [15, 30, 60, 240] as const;
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
  },
};
export function formatPreferenceDate(
  value: string | Date,
  localization: AdminPreferences['admin']['localization'],
) {
  const locale =
    localization.language === 'Tagalog (PH)'
      ? 'fil-PH'
      : localization.language === 'Spanish (ES)'
        ? 'es-ES'
        : 'en-US';
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone: localization.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || '';
  const day = part('day'),
    month = part('month'),
    year = part('year');
  const formatted =
    localization.dateFormat === 'YYYY-MM-DD (ISO)'
      ? `${year}-${month}-${day}`
      : localization.dateFormat === 'DD/MM/YYYY (24-hour)'
        ? `${day}/${month}/${year}`
        : `${month}/${day}/${year}`;
  const time = new Intl.DateTimeFormat(locale, {
    timeZone: localization.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: localization.dateFormat === 'MM/DD/YYYY (12-hour)',
    timeZoneName: 'short',
  }).format(date);
  return `${formatted}, ${time}`;
}
