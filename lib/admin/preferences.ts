import 'server-only';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  LANGUAGE_OPTIONS,
  TIMEZONE_OPTIONS,
  DATE_FORMAT_OPTIONS,
} from '@/lib/system-settings-types';
import {
  DEFAULT_ADMIN_PREFERENCES,
  SESSION_TIMEOUT_OPTIONS,
  notificationLabels,
  formatPreferenceDate,
} from './preferences-types';
import type { AdminActor } from './access';
import { AdminError } from './errors';

const defaults = DEFAULT_ADMIN_PREFERENCES;
export const preferencesSchema = z
  .object({
    appearance: z.object({ defaultTheme: z.enum(['light', 'dark']) }).strict(),
    admin: z
      .object({
        notifications: z
          .object({
            newBookingRequests: z.boolean(),
            bookingConfirmations: z.boolean(),
            bookingCancellations: z.boolean(),
            customerInquiries: z.boolean(),
            paymentUpdates: z.boolean(),
            contractUpdates: z.boolean(),
            testimonyUpdates: z.boolean(),
            supportUpdates: z.boolean(),
            systemAlerts: z.boolean(),
          })
          .strict(),
        security: z
          .object({
            sessionTimeoutMinutes: z
              .number()
              .refine(
                (value) => SESSION_TIMEOUT_OPTIONS.some((option) => option === value),
                'Choose a supported session timeout.',
              ),
          })
          .strict(),
        localization: z
          .object({
            language: z.enum(LANGUAGE_OPTIONS),
            timezone: z
              .string()
              .refine(
                (value) => TIMEZONE_OPTIONS.some((option) => option.value === value),
                'Choose a supported timezone.',
              ),
            dateFormat: z.enum(DATE_FORMAT_OPTIONS),
          })
          .strict(),
      })
      .strict(),
    client: z
      .object({
        maintenanceMode: z.boolean(),
        inquirySubmissionsEnabled: z.boolean(),
        packagesVisible: z.boolean(),
        faqVisible: z.boolean(),
        publicTestimoniesVisible: z.boolean(),
        testimonySubmissionsEnabled: z.boolean(),
        disabledMessage: z.string().trim().min(1).max(300),
      })
      .strict(),
  })
  .strict();
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function normalizeAdminPreferences(input: unknown) {
  const root = record(input),
    admin = record(root.admin),
    security = record(admin.security);
  const notifications = record(admin.notifications),
    appearance = record(root.appearance),
    client = record(root.client);
  const localization = { ...record(admin.localization), ...record(root.localization) };
  const pick = <T extends string>(value: unknown, options: readonly T[], fallback: T): T =>
    typeof value === 'string' && options.includes(value as T) ? (value as T) : fallback;
  const bool = (value: unknown, fallback: boolean) =>
    typeof value === 'boolean' ? value : fallback;
  return {
    appearance: {
      defaultTheme: pick(
        appearance.defaultTheme,
        ['light', 'dark'] as const,
        defaults.appearance.defaultTheme,
      ),
    },
    admin: {
      notifications: Object.fromEntries(
        Object.keys(notificationLabels).map((key) => [key, bool(notifications[key], true)]),
      ) as typeof defaults.admin.notifications,
      security: {
        sessionTimeoutMinutes: SESSION_TIMEOUT_OPTIONS.some(
          (value) => value === security.sessionTimeoutMinutes,
        )
          ? (security.sessionTimeoutMinutes as number)
          : 30,
      },
      localization: {
        language: pick(
          localization.language,
          LANGUAGE_OPTIONS,
          defaults.admin.localization.language,
        ),
        timezone: pick(
          localization.timezone,
          TIMEZONE_OPTIONS.map((option) => option.value),
          defaults.admin.localization.timezone,
        ),
        dateFormat: pick(
          localization.dateFormat,
          DATE_FORMAT_OPTIONS,
          defaults.admin.localization.dateFormat,
        ),
      },
    },
    client: {
      maintenanceMode: bool(client.maintenanceMode, defaults.client.maintenanceMode),
      inquirySubmissionsEnabled: bool(
        client.inquirySubmissionsEnabled,
        defaults.client.inquirySubmissionsEnabled,
      ),
      packagesVisible: bool(client.packagesVisible, defaults.client.packagesVisible),
      faqVisible: bool(client.faqVisible, defaults.client.faqVisible),
      publicTestimoniesVisible: bool(
        client.publicTestimoniesVisible,
        defaults.client.publicTestimoniesVisible,
      ),
      testimonySubmissionsEnabled: bool(
        client.testimonySubmissionsEnabled,
        defaults.client.testimonySubmissionsEnabled,
      ),
      disabledMessage:
        typeof client.disabledMessage === 'string' && client.disabledMessage.trim()
          ? client.disabledMessage.trim().slice(0, 300)
          : defaults.client.disabledMessage,
    },
  };
}
export async function getAdminPreferences() {
  const row = await prisma.systemSetting.findUnique({ where: { id: 'singleton' } });
  return {
    settings: normalizeAdminPreferences(row?.settings),
    updatedAt: row?.updatedAt.toISOString() ?? null,
  };
}
export async function saveAdminPreferences(raw: unknown, actor: AdminActor) {
  if (actor.role !== 'SUPERADMIN')
    throw new AdminError('Only a super administrator may change system settings.', 403);
  const input = z
    .object({
      op: z.literal('preferences'),
      settings: preferencesSchema,
      updatedAt: z.iso.datetime().nullable(),
    })
    .strict()
    .parse(raw);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('zion-system-settings'))::text`;
    const previous = await tx.systemSetting.findUnique({ where: { id: 'singleton' } });
    if ((previous?.updatedAt.toISOString() ?? null) !== input.updatedAt)
      throw new AdminError('Settings changed in another window. Refresh before saving.', 409);
    const oldRoot = record(previous?.settings),
      oldAdmin = record(oldRoot.admin),
      settings = input.settings;
    const stored = {
      ...oldRoot,
      appearance: { ...record(oldRoot.appearance), ...settings.appearance },
      client: { ...record(oldRoot.client), ...settings.client },
      localization: settings.admin.localization,
      admin: {
        ...oldAdmin,
        notifications: { ...record(oldAdmin.notifications), ...settings.admin.notifications },
        security: { ...record(oldAdmin.security), ...settings.admin.security },
        localization: settings.admin.localization,
      },
    };
    const row = await tx.systemSetting.upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        settings: JSON.parse(JSON.stringify(stored)),
        updatedBy: actor.username,
      },
      update: { settings: JSON.parse(JSON.stringify(stored)), updatedBy: actor.username },
    });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        userName: actor.fullName || actor.username,
        userRole: actor.role,
        action: 'SETTINGS_CHANGE',
        module: 'Settings',
        description:
          'Updated appearance, communications, session, client access, and localization preferences.',
        status: 'SUCCESS',
        source: 'zion-admin',
      },
    });
    return { settings, updatedAt: row.updatedAt.toISOString(), canEdit: true };
  });
}
export function csvCell(value: string) {
  const safe = /^[\s]*[=+@\-\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
export async function activityCsv(actor: AdminActor, timezone: string | null) {
  const { settings } = await getAdminPreferences();
  const localization = { ...settings.admin.localization };
  if (timezone) {
    if (!TIMEZONE_OPTIONS.some((option) => option.value === timezone))
      throw new AdminError('Unsupported export timezone.');
    localization.timezone = timezone;
  }
  const logs = await prisma.auditLog.findMany({
    where: actor.role === 'SUPERADMIN' ? {} : { userId: actor.id },
    orderBy: [{ timestamp: 'desc' }, { id: 'asc' }],
    take: 10000,
    select: {
      timestamp: true,
      userName: true,
      userRole: true,
      action: true,
      module: true,
      description: true,
      status: true,
    },
  });
  const rows = [
    ['Date and time', 'User', 'Role', 'Action', 'Module', 'Description', 'Status'],
    ...logs.map((log) => [
      formatPreferenceDate(log.timestamp, localization),
      log.userName,
      log.userRole,
      log.action,
      log.module,
      log.description,
      log.status,
    ]),
  ];
  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      userName: actor.fullName || actor.username,
      userRole: actor.role,
      action: 'EXPORT',
      module: 'Settings',
      description: `Exported ${logs.length} activity records as CSV.`,
      status: 'SUCCESS',
      source: 'zion-admin',
    },
  });
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}
