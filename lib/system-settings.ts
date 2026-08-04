import 'server-only';

import { prisma } from '@/lib/prisma';
import {
  DATE_FORMAT_OPTIONS,
  DEFAULT_PUBLIC_SYSTEM_SETTINGS,
  LANGUAGE_OPTIONS,
  TIMEZONE_OPTIONS,
  type PublicSystemSettings,
  type ThemePreference,
} from '@/lib/system-settings-types';

const SETTINGS_ROW_ID = 'singleton';

type SettingsRow = {
  settings: unknown;
};

export type ClientFeature =
  | 'inquirySubmissions'
  | 'packages'
  | 'faq'
  | 'publicTestimonies'
  | 'testimonySubmissions';

const FEATURE_LABELS: Record<ClientFeature, string> = {
  inquirySubmissions: 'Client inquiries',
  packages: 'Public packages',
  faq: 'Client FAQ',
  publicTestimonies: 'Public testimonies',
  testimonySubmissions: 'Testimony submissions',
};

export class SystemSettingsError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'SystemSettingsError';
    this.status = status;
  }
}

export class ClientFeatureDisabledError extends SystemSettingsError {
  constructor(message: string) {
    super(message, 503);
    this.name = 'ClientFeatureDisabledError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function textValue(value: unknown, fallback: string, maxLength = 300) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

function optionValue(value: unknown, options: readonly string[], fallback: string) {
  return typeof value === 'string' && options.includes(value) ? value : fallback;
}

function timezoneValue(value: unknown, fallback: string) {
  return typeof value === 'string' && TIMEZONE_OPTIONS.some((option) => option.value === value)
    ? value
    : fallback;
}

function themeValue(value: unknown, fallback: ThemePreference): ThemePreference {
  return value === 'dark' || value === 'light' ? value : fallback;
}

function normalizePublicSettings(input: unknown): PublicSystemSettings {
  const root = isRecord(input) ? input : {};
  const appearance = isRecord(root.appearance) ? root.appearance : {};
  const client = isRecord(root.client) ? root.client : {};
  const localization = isRecord(root.localization) ? root.localization : {};
  const defaults = DEFAULT_PUBLIC_SYSTEM_SETTINGS;

  return {
    appearance: {
      defaultTheme: themeValue(appearance.defaultTheme, defaults.appearance.defaultTheme),
    },
    client: {
      maintenanceMode: booleanValue(client.maintenanceMode, defaults.client.maintenanceMode),
      inquirySubmissionsEnabled: booleanValue(client.inquirySubmissionsEnabled, defaults.client.inquirySubmissionsEnabled),
      packagesVisible: booleanValue(client.packagesVisible, defaults.client.packagesVisible),
      faqVisible: booleanValue(client.faqVisible, defaults.client.faqVisible),
      publicTestimoniesVisible: booleanValue(client.publicTestimoniesVisible, defaults.client.publicTestimoniesVisible),
      testimonySubmissionsEnabled: booleanValue(client.testimonySubmissionsEnabled, defaults.client.testimonySubmissionsEnabled),
      disabledMessage: textValue(client.disabledMessage, defaults.client.disabledMessage),
    },
    localization: {
      language: optionValue(localization.language, LANGUAGE_OPTIONS, defaults.localization.language),
      timezone: timezoneValue(localization.timezone, defaults.localization.timezone),
      dateFormat: optionValue(localization.dateFormat, DATE_FORMAT_OPTIONS, defaults.localization.dateFormat),
    },
  };
}

export async function getPublicSystemSettings() {
  const rows = await prisma.$queryRaw<SettingsRow[]>`
    SELECT "settings"
    FROM "system_settings"
    WHERE "id" = ${SETTINGS_ROW_ID}
    LIMIT 1
  `;

  return normalizePublicSettings(rows[0]?.settings ?? DEFAULT_PUBLIC_SYSTEM_SETTINGS);
}

function isClientFeatureEnabled(settings: PublicSystemSettings, feature: ClientFeature) {
  if (settings.client.maintenanceMode) return false;

  switch (feature) {
    case 'inquirySubmissions':
      return settings.client.inquirySubmissionsEnabled;
    case 'packages':
      return settings.client.packagesVisible;
    case 'faq':
      return settings.client.faqVisible;
    case 'publicTestimonies':
      return settings.client.publicTestimoniesVisible;
    case 'testimonySubmissions':
      return settings.client.testimonySubmissionsEnabled && settings.client.publicTestimoniesVisible;
  }
}

export async function getClientFeatureAvailability(feature: ClientFeature) {
  const settings = await getPublicSystemSettings();
  const enabled = isClientFeatureEnabled(settings, feature);
  const message = settings.client.maintenanceMode
    ? settings.client.disabledMessage
    : `${FEATURE_LABELS[feature]} are temporarily unavailable. Please contact Zion Events Place directly for assistance.`;

  return { enabled, message, settings };
}

export async function requireClientFeature(feature: ClientFeature) {
  const availability = await getClientFeatureAvailability(feature);
  if (!availability.enabled) throw new ClientFeatureDisabledError(availability.message);
  return availability.settings;
}

export function settingsErrorResponse(error: unknown, fallback = 'Unable to load system settings.') {
  if (error instanceof SystemSettingsError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  return Response.json({
    error: fallback,
    details: process.env.NODE_ENV === 'development' && error instanceof Error
      ? error.message
      : undefined,
  }, { status: 500 });
}
