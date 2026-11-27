import 'server-only';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { CLIENT_PHOTO_RETENTION_DAYS } from '@/config/client-photos';
import {
  BOOKING_WINDOW_LIMITS,
  normalizeBookingWindow,
  type BookingWindow,
} from '@/lib/booking-window';
import { prisma } from '@/lib/prisma';
import {
  LANGUAGE_OPTIONS,
  TIMEZONE_OPTIONS,
  DATE_FORMAT_OPTIONS,
} from '@/lib/system-settings-types';
import {
  BALANCE_DUE_DAYS,
  DEFAULT_BOOKING_RULES,
  PAYMENT_DEADLINE_DAYS,
  REVIEW_GUEST_LIMIT,
  type BookingRules,
} from './booking-rules';
import {
  EMPTY_PAYMENT_ACCOUNTS,
  normalizePaymentAccounts,
  paymentAccountsProblem,
  type PaymentAccounts,
} from './payment-accounts';
import {
  DEFAULT_VISIT_RULES,
  VISIT_CLOSED_DATES_MAX,
  visitRulesProblem,
  type VisitRules,
} from '@/lib/visit-rules';
import {
  CONTRACT_SIGNATORY_LIMITS,
  DEFAULT_ADMIN_PREFERENCES,
  DEFAULT_CONTRACT_SIGNATORY,
  SESSION_TIMEOUT_OPTIONS,
  contractSignatoryProblem,
  type ContractSignatory,
  notificationLabels,
  formatPreferenceDate,
  staffNotificationEmailsProblem,
} from './preferences-types';
import type { AdminActor } from './access';
import { AdminError } from './errors';
import { canDo } from './permissions';

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
        staffNotifications: z
          .object({
            emails: z.array(z.string().trim().toLowerCase()).superRefine((emails, context) => {
              const problem = staffNotificationEmailsProblem(emails);
              if (problem) context.addIssue({ code: 'custom', message: problem });
            }),
          })
          .strict(),
        // Optional so an older Settings page cannot erase saved rules; omitted means unchanged.
        bookingRules: z
          .object({
            paymentDeadlineDays: z
              .number()
              .int('Enter a whole number of days.')
              .min(
                PAYMENT_DEADLINE_DAYS.min,
                `Give clients at least ${PAYMENT_DEADLINE_DAYS.min} day to pay.`,
              )
              .max(
                PAYMENT_DEADLINE_DAYS.max,
                `Give clients at most ${PAYMENT_DEADLINE_DAYS.max} days to pay.`,
              ),
            reviewGuestLimit: z
              .number()
              .int('Enter a whole number of guests.')
              .min(REVIEW_GUEST_LIMIT.min, 'Enter at least 1 guest, or leave the limit empty.')
              .max(REVIEW_GUEST_LIMIT.max, `Enter at most ${REVIEW_GUEST_LIMIT.max} guests.`)
              .nullable(),
            // Optional: a Settings page from before phase 3 keeps the saved value (see the save).
            balanceDueDays: z
              .number()
              .int('Enter a whole number of days.')
              .min(BALANCE_DUE_DAYS.min, `Enter at least ${BALANCE_DUE_DAYS.min} day.`)
              .max(BALANCE_DUE_DAYS.max, `Enter at most ${BALANCE_DUE_DAYS.max} days.`)
              .optional(),
          })
          .strict()
          .optional(),
        // Optional like the others: an older Settings page leaves the saved visit rules unchanged.
        visitRules: z
          .object({
            weekly: z
              .array(
                z
                  .object({ open: z.string().max(5), close: z.string().max(5) })
                  .strict()
                  .nullable(),
              )
              .length(7),
            slotMinutes: z.number().int(),
            capacity: z.number().int(),
            noticeHours: z.number().int(),
            closedDates: z.array(z.string().max(10)).max(VISIT_CLOSED_DATES_MAX),
          })
          .strict()
          .superRefine((rules, context) => {
            const issue = visitRulesProblem(rules);
            if (issue) context.addIssue({ code: 'custom', message: issue.problem });
          })
          .optional(),
        // Optional like bookingRules: an older Settings page leaves saved accounts unchanged.
        paymentAccounts: z
          .object({
            gcash: z
              .object({ accountName: z.string().max(100), number: z.string().max(20) })
              .strict(),
            bank: z
              .object({
                bankName: z.string().max(100),
                accountName: z.string().max(100),
                accountNumber: z.string().max(40),
              })
              .strict(),
          })
          .strict()
          .transform(normalizePaymentAccounts)
          .superRefine((accounts, context) => {
            const issue = paymentAccountsProblem(accounts);
            if (issue) context.addIssue({ code: 'custom', message: issue.problem });
          })
          .optional(),
        // Optional like the others: an older Settings page leaves the saved window unchanged.
        bookingWindow: z
          .object({
            minNoticeDays: z
              .number()
              .int('Enter a whole number of days.')
              .min(
                BOOKING_WINDOW_LIMITS.minNoticeDays.min,
                `Ask for at least ${BOOKING_WINDOW_LIMITS.minNoticeDays.min} day of notice.`,
              )
              .max(
                BOOKING_WINDOW_LIMITS.minNoticeDays.max,
                `Ask for at most ${BOOKING_WINDOW_LIMITS.minNoticeDays.max} days of notice.`,
              ),
            maxMonthsAhead: z
              .number()
              .int('Enter a whole number of months.')
              .min(
                BOOKING_WINDOW_LIMITS.maxMonthsAhead.min,
                `Allow at least ${BOOKING_WINDOW_LIMITS.maxMonthsAhead.min} month ahead.`,
              )
              .max(
                BOOKING_WINDOW_LIMITS.maxMonthsAhead.max,
                `Allow at most ${BOOKING_WINDOW_LIMITS.maxMonthsAhead.max} months ahead.`,
              ),
          })
          .strict()
          .optional(),
        // Optional like the others: an older Settings page leaves the saved periods unchanged.
        privacy: z
          .object({
            clientPhotoRetentionDays: z
              .number()
              .int('Enter a whole number of days.')
              .min(
                CLIENT_PHOTO_RETENTION_DAYS.min,
                `Keep photos at least ${CLIENT_PHOTO_RETENTION_DAYS.min} days.`,
              )
              .max(
                CLIENT_PHOTO_RETENTION_DAYS.max,
                `Keep photos at most ${CLIENT_PHOTO_RETENTION_DAYS.max} days.`,
              ),
          })
          .strict()
          .optional(),
        // Optional like the others: an older Settings page leaves the saved signatory unchanged.
        contractSignatory: z
          .object({
            name: z.string().trim().max(CONTRACT_SIGNATORY_LIMITS.nameMax),
            title: z.string().trim().max(CONTRACT_SIGNATORY_LIMITS.titleMax),
          })
          .strict()
          .superRefine((signatory, context) => {
            const problem = contractSignatoryProblem(signatory);
            if (problem) context.addIssue({ code: 'custom', message: problem });
          })
          .optional(),
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
/** Lenient reader for a stored list: keeps the valid, unique addresses that fit the limits. */
function storedStaffNotificationEmails(settings: unknown) {
  const stored = record(record(record(settings).admin).staffNotifications).emails;
  const emails: string[] = [];
  for (const item of Array.isArray(stored) ? stored : []) {
    const email = typeof item === 'string' ? item.trim().toLowerCase() : '';
    if (email && !staffNotificationEmailsProblem([...emails, email])) emails.push(email);
  }
  return emails;
}
/**
 * The saved staff notification inboxes (empty when none are saved). Inside a transaction pass its
 * client: with a one-connection pool, a read through the shared client would wait for the
 * connection the transaction holds.
 */
export async function readStaffNotificationEmails(db: Prisma.TransactionClient = prisma) {
  const row = await db.systemSetting.findUnique({
    where: { id: 'singleton' },
    select: { settings: true },
  });
  return storedStaffNotificationEmails(row?.settings);
}
/** Lenient reader for the saved booking rules: out-of-range values fall back to the defaults. */
function storedBookingRules(settings: unknown): BookingRules {
  const stored = record(record(record(settings).admin).bookingRules);
  const whole = (value: unknown, min: number, max: number) =>
    typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
      ? value
      : null;
  return {
    paymentDeadlineDays:
      whole(stored.paymentDeadlineDays, PAYMENT_DEADLINE_DAYS.min, PAYMENT_DEADLINE_DAYS.max) ??
      DEFAULT_BOOKING_RULES.paymentDeadlineDays,
    reviewGuestLimit: whole(
      stored.reviewGuestLimit,
      REVIEW_GUEST_LIMIT.min,
      REVIEW_GUEST_LIMIT.max,
    ),
    balanceDueDays:
      whole(stored.balanceDueDays, BALANCE_DUE_DAYS.min, BALANCE_DUE_DAYS.max) ??
      DEFAULT_BOOKING_RULES.balanceDueDays,
  };
}
function storedBookingWindow(settings: unknown): BookingWindow {
  return normalizeBookingWindow(record(record(settings).admin).bookingWindow);
}
/**
 * How soon and how far ahead guests can book (Settings > Booking window). Public pages, the
 * booking server, walk-ins and Zeni read it here; inside a transaction pass its client.
 */
export async function readBookingWindow(db: Prisma.TransactionClient = prisma) {
  const row = await db.systemSetting.findUnique({
    where: { id: 'singleton' },
    select: { settings: true },
  });
  return storedBookingWindow(row?.settings);
}
/** Lenient reader for the saved retention periods: out-of-range values fall back to the defaults. */
function storedPrivacy(settings: unknown) {
  const days = record(record(record(settings).admin).privacy).clientPhotoRetentionDays;
  return {
    clientPhotoRetentionDays:
      typeof days === 'number' &&
      Number.isInteger(days) &&
      days >= CLIENT_PHOTO_RETENTION_DAYS.min &&
      days <= CLIENT_PHOTO_RETENTION_DAYS.max
        ? days
        : CLIENT_PHOTO_RETENTION_DAYS.default,
  };
}
/** Lenient reader for the saved contract signatory: without a usable name, Zion's default. */
function storedContractSignatory(settings: unknown): ContractSignatory {
  const stored = record(record(record(settings).admin).contractSignatory);
  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  const signatory = { name: text(stored.name), title: text(stored.title) };
  return contractSignatoryProblem(signatory) ? { ...DEFAULT_CONTRACT_SIGNATORY } : signatory;
}
/** Who signs contracts for Zion; inside a transaction pass its client. */
export async function readContractSignatory(db: Prisma.TransactionClient = prisma) {
  const row = await db.systemSetting.findUnique({
    where: { id: 'singleton' },
    select: { settings: true },
  });
  return storedContractSignatory(row?.settings);
}
/** How many days client photos are kept after the client's last event or visit ends. */
export async function readClientPhotoRetentionDays(db: Prisma.TransactionClient = prisma) {
  const row = await db.systemSetting.findUnique({
    where: { id: 'singleton' },
    select: { settings: true },
  });
  return storedPrivacy(row?.settings).clientPhotoRetentionDays;
}
/** Lenient reader for the saved payment accounts: an incomplete or invalid set is ignored. */
function storedPaymentAccounts(settings: unknown): PaymentAccounts {
  const stored = record(record(record(settings).admin).paymentAccounts);
  const text = (value: unknown) => (typeof value === 'string' ? value : '');
  const gcash = record(stored.gcash),
    bank = record(stored.bank);
  const accounts = normalizePaymentAccounts({
    gcash: { accountName: text(gcash.accountName), number: text(gcash.number) },
    bank: {
      bankName: text(bank.bankName),
      accountName: text(bank.accountName),
      accountNumber: text(bank.accountNumber),
    },
  });
  return paymentAccountsProblem(accounts) ? structuredClone(EMPTY_PAYMENT_ACCOUNTS) : accounts;
}
/** Lenient reader for the saved visit rules: a missing or invalid set falls back to the defaults. */
function storedVisitRules(settings: unknown): VisitRules {
  const stored = record(record(record(settings).admin).visitRules);
  const hours = (value: unknown) => {
    const day = record(value);
    return typeof day.open === 'string' && typeof day.close === 'string'
      ? { open: day.open, close: day.close }
      : null;
  };
  const rules: VisitRules = {
    weekly: Array.isArray(stored.weekly) ? stored.weekly.map(hours) : [],
    slotMinutes: typeof stored.slotMinutes === 'number' ? stored.slotMinutes : NaN,
    capacity: typeof stored.capacity === 'number' ? stored.capacity : NaN,
    noticeHours: typeof stored.noticeHours === 'number' ? stored.noticeHours : NaN,
    closedDates: Array.isArray(stored.closedDates)
      ? stored.closedDates.filter((date): date is string => typeof date === 'string')
      : [],
  };
  return visitRulesProblem(rules) ? structuredClone(DEFAULT_VISIT_RULES) : rules;
}
/** The saved visit rules; inside a transaction pass its client. */
export async function readVisitRules(db: Prisma.TransactionClient = prisma) {
  const row = await db.systemSetting.findUnique({
    where: { id: 'singleton' },
    select: { settings: true },
  });
  return storedVisitRules(row?.settings);
}
/** The saved payment accounts; inside a transaction pass its client. */
export async function readPaymentAccounts(db: Prisma.TransactionClient = prisma) {
  const row = await db.systemSetting.findUnique({
    where: { id: 'singleton' },
    select: { settings: true },
  });
  return storedPaymentAccounts(row?.settings);
}
/** The saved booking rules; inside a transaction pass its client (see readStaffNotificationEmails). */
export async function readBookingRules(db: Prisma.TransactionClient = prisma) {
  const row = await db.systemSetting.findUnique({
    where: { id: 'singleton' },
    select: { settings: true },
  });
  return storedBookingRules(row?.settings);
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
      staffNotifications: { emails: storedStaffNotificationEmails(root) },
      bookingRules: storedBookingRules(root),
      bookingWindow: storedBookingWindow(root),
      paymentAccounts: storedPaymentAccounts(root),
      visitRules: storedVisitRules(root),
      privacy: storedPrivacy(root),
      contractSignatory: storedContractSignatory(root),
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
  if (!canDo(actor.role, 'change-settings'))
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
    const previousRules = storedBookingRules(previous?.settings);
    const rules: BookingRules | null = settings.admin.bookingRules
      ? {
          ...settings.admin.bookingRules,
          balanceDueDays:
            settings.admin.bookingRules.balanceDueDays ?? previousRules.balanceDueDays,
        }
      : null;
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
        staffNotifications: settings.admin.staffNotifications,
        ...(rules ? { bookingRules: rules } : {}),
        ...(settings.admin.bookingWindow ? { bookingWindow: settings.admin.bookingWindow } : {}),
        ...(settings.admin.paymentAccounts
          ? { paymentAccounts: settings.admin.paymentAccounts }
          : {}),
        ...(settings.admin.visitRules ? { visitRules: settings.admin.visitRules } : {}),
        ...(settings.admin.privacy ? { privacy: settings.admin.privacy } : {}),
        ...(settings.admin.contractSignatory
          ? { contractSignatory: settings.admin.contractSignatory }
          : {}),
      },
    };
    // The audit trail records that the staff inboxes changed and how many there are, never which.
    const staffEmails = settings.admin.staffNotifications.emails;
    const staffChange =
      storedStaffNotificationEmails(previous?.settings).join(',') === staffEmails.join(',')
        ? ''
        : staffEmails.length
          ? ` Staff notification emails changed (${staffEmails.length} address${staffEmails.length === 1 ? '' : 'es'}).`
          : ' Staff notification emails cleared; the server default applies.';
    const rulesChange =
      rules &&
      (rules.paymentDeadlineDays !== previousRules.paymentDeadlineDays ||
        rules.reviewGuestLimit !== previousRules.reviewGuestLimit ||
        rules.balanceDueDays !== previousRules.balanceDueDays)
        ? ` Booking rules changed: ${rules.paymentDeadlineDays} day${rules.paymentDeadlineDays === 1 ? '' : 's'} to pay, ${rules.reviewGuestLimit === null ? 'no guest limit' : `review above ${rules.reviewGuestLimit} guests`}, full payment ${rules.balanceDueDays} day${rules.balanceDueDays === 1 ? '' : 's'} before the event.`
        : '';
    // Like the staff inboxes, the audit trail notes a change, never the account details.
    const accountsChange =
      settings.admin.paymentAccounts &&
      JSON.stringify(settings.admin.paymentAccounts) !==
        JSON.stringify(storedPaymentAccounts(previous?.settings))
        ? ' Payment accounts changed.'
        : '';
    const visitsChange =
      settings.admin.visitRules &&
      JSON.stringify(settings.admin.visitRules) !==
        JSON.stringify(storedVisitRules(previous?.settings))
        ? ' Visit hours or rules changed.'
        : '';
    const window = settings.admin.bookingWindow;
    const previousWindow = storedBookingWindow(previous?.settings);
    const windowChange =
      window &&
      (window.minNoticeDays !== previousWindow.minNoticeDays ||
        window.maxMonthsAhead !== previousWindow.maxMonthsAhead)
        ? ` Booking window changed: at least ${window.minNoticeDays} day${window.minNoticeDays === 1 ? '' : 's'} ahead, up to ${window.maxMonthsAhead} month${window.maxMonthsAhead === 1 ? '' : 's'} ahead.`
        : '';
    const retentionDays = settings.admin.privacy?.clientPhotoRetentionDays;
    const privacyChange =
      retentionDays !== undefined &&
      retentionDays !== storedPrivacy(previous?.settings).clientPhotoRetentionDays
        ? ` Client photos are now kept ${retentionDays} days after the client's last event or visit.`
        : '';
    const signatory = settings.admin.contractSignatory;
    const previousSignatory = storedContractSignatory(previous?.settings);
    const signatoryChange =
      signatory &&
      (signatory.name !== previousSignatory.name || signatory.title !== previousSignatory.title)
        ? ` Contracts are now signed for Zion by ${signatory.name}${signatory.title ? `, ${signatory.title}` : ''}.`
        : '';
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
        description: `Updated appearance, communications, session, client access, and localization preferences.${staffChange}${rulesChange}${windowChange}${accountsChange}${visitsChange}${privacyChange}${signatoryChange}`,
        status: 'SUCCESS',
        source: 'zion-admin',
      },
    });
    return {
      settings: normalizeAdminPreferences(stored),
      updatedAt: row.updatedAt.toISOString(),
      canEdit: true,
    };
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
