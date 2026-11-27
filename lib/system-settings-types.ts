export type ThemePreference = 'light' | 'dark';

export type PublicSystemSettings = {
  appearance: {
    defaultTheme: ThemePreference;
  };
  client: {
    maintenanceMode: boolean;
    inquirySubmissionsEnabled: boolean;
    packagesVisible: boolean;
    faqVisible: boolean;
    publicTestimoniesVisible: boolean;
    testimonySubmissionsEnabled: boolean;
    disabledMessage: string;
  };
  localization: {
    language: string;
    timezone: string;
    dateFormat: string;
  };
};

export const LANGUAGE_OPTIONS = ['English (US)', 'Tagalog (PH)', 'Spanish (ES)'] as const;

export const TIMEZONE_OPTIONS = [
  { value: 'Asia/Manila', label: '(GMT+08:00) Manila, Taipei' },
  { value: 'Asia/Tokyo', label: '(GMT+09:00) Tokyo, Seoul' },
  { value: 'America/Los_Angeles', label: '(GMT-08:00) Pacific Time (US)' },
  { value: 'America/New_York', label: '(GMT-05:00) Eastern Time (US)' },
] as const;

export const DATE_FORMAT_OPTIONS = [
  'MM/DD/YYYY (12-hour)',
  'DD/MM/YYYY (24-hour)',
  'YYYY-MM-DD (ISO)',
] as const;

/** How each stored choice reads in the admin: friendly dates, with no time-zone name. */
export const DATE_FORMAT_LABELS: Record<(typeof DATE_FORMAT_OPTIONS)[number], string> = {
  'MM/DD/YYYY (12-hour)': 'Tue, Dec 8, 2026 · 5:00 PM',
  'DD/MM/YYYY (24-hour)': 'Tue, 8 Dec 2026 · 17:00',
  'YYYY-MM-DD (ISO)': '2026-12-08 17:00',
};

export const DEFAULT_PUBLIC_SYSTEM_SETTINGS: PublicSystemSettings = {
  appearance: {
    defaultTheme: 'light',
  },
  client: {
    maintenanceMode: false,
    inquirySubmissionsEnabled: true,
    packagesVisible: true,
    faqVisible: true,
    publicTestimoniesVisible: true,
    testimonySubmissionsEnabled: true,
    disabledMessage:
      'This feature is temporarily unavailable. Please contact Zion Events Place directly for assistance.',
  },
  localization: {
    language: 'English (US)',
    timezone: 'Asia/Manila',
    dateFormat: 'MM/DD/YYYY (12-hour)',
  },
};
