'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, Download, Moon, Save, Sun } from 'lucide-react';
import useSWR, { mutate as refreshCache } from 'swr';
import {
  DATE_FORMAT_LABELS,
  DATE_FORMAT_OPTIONS,
  LANGUAGE_OPTIONS,
  TIMEZONE_OPTIONS,
} from '@/lib/system-settings-types';
import {
  CONTRACT_SIGNATORY_LIMITS,
  SESSION_TIMEOUT_OPTIONS,
  contractSignatoryProblem,
  notificationLabels,
  formatPreferenceDate,
  parseStaffNotificationEmails,
  type AdminPreferences,
  type NotificationPreference,
  type PreferencesResponse,
} from '@/lib/admin/preferences-types';
import {
  PAYMENT_DEADLINE_DAYS,
  REVIEW_GUEST_LIMIT,
  BALANCE_DUE_DAYS,
  parseBookingRules,
  type BookingRuleField,
} from '@/lib/admin/booking-rules';
import {
  normalizePaymentAccounts,
  paymentAccountsProblem,
  type PaymentAccountField,
  type PaymentAccounts,
} from '@/lib/admin/payment-accounts';
import { CLIENT_PHOTO_RETENTION_DAYS } from '@/config/client-photos';
import {
  BOOKING_WINDOW_LIMITS,
  parseBookingWindow,
  type BookingWindowField,
} from '@/lib/booking-window';
import { switchTheme } from '@/lib/theme-switch';
import { useAdminPreferences } from './AdminPreferencesProvider';
import AdminPageHeader from './AdminPageHeader';
import VisitRulesSettings, { type VisitRulesHandle } from './VisitRulesSettings';
import styles from './admin.module.css';
import { Button, ButtonAnchor } from '@/components/shared/Button';

/** The Online Payments fields, in the order a problem is reported. */
const paymentAccountFields: {
  field: PaymentAccountField;
  label: string;
  group: 'gcash' | 'bank';
  key: string;
  hint?: string;
}[] = [
  { field: 'gcashName', label: 'GCash account name', group: 'gcash', key: 'accountName' },
  {
    field: 'gcashNumber',
    label: 'GCash number',
    group: 'gcash',
    key: 'number',
    hint: 'For example 09171234567.',
  },
  { field: 'bankName', label: 'Bank name', group: 'bank', key: 'bankName' },
  { field: 'bankAccountName', label: 'Bank account name', group: 'bank', key: 'accountName' },
  { field: 'bankAccountNumber', label: 'Bank account number', group: 'bank', key: 'accountNumber' },
];

function accountValue(accounts: PaymentAccounts, group: 'gcash' | 'bank', key: string) {
  return (accounts[group] as Record<string, string>)[key] ?? '';
}

const clientControls = [
  ['maintenanceMode', 'Maintenance mode', 'Temporarily pauses public client features.'],
  [
    'inquirySubmissionsEnabled',
    'Inquiry submissions',
    'Controls Contact Us and homepage inquiry forms.',
  ],
  ['packagesVisible', 'Public packages', 'Controls public packages and package information.'],
  ['faqVisible', 'Client FAQ', 'Controls client FAQ pages, previews, and APIs.'],
  [
    'publicTestimoniesVisible',
    'Public testimonies',
    'Controls public testimonies and featured stories.',
  ],
  [
    'testimonySubmissionsEnabled',
    'Testimony submissions',
    'Controls client testimony submissions.',
  ],
] as const;

function SectionTitle({ title }: { title: string }) {
  return (
    <div className={styles.settingsSectionTitle}>
      <h2>{title}</h2>
    </div>
  );
}
function Toggle({
  label,
  checked,
  disabled,
  describedBy,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  /** The id of the text that explains the switch, such as why it is unavailable. */
  describedBy?: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={onChange}
      className={styles.settingsSwitch}
    >
      <span />
    </button>
  );
}

export default function SystemSettingsForm({ refresh }: { refresh?: ReactNode }) {
  const [savedNotice, setSavedNotice] = useState('');
  const { data, error, mutate } = useSWR<PreferencesResponse>(
    '/api/admin/preferences',
    async (url) => {
      const response = await fetch(url, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to load settings.');
      return payload;
    },
    { shouldRetryOnError: false },
  );
  if (error)
    return (
      <>
        <AdminPageHeader title="Settings" actions={refresh} />
        <div role="alert" className={styles.error}>
          {error.message}{' '}
          <Button type="button" variant="ghost" onClick={() => void mutate()}>
            Try again
          </Button>
        </div>
      </>
    );
  if (!data)
    return (
      <>
        <AdminPageHeader title="Settings" actions={refresh} />
        <div className={styles.card} role="status">
          Loading settings…
        </div>
      </>
    );
  return (
    <>
      {savedNotice && (
        <div className={styles.success} role="status">
          {savedNotice}
        </div>
      )}
      <PreferencesEditor
        key={data.updatedAt || 'defaults'}
        initial={data}
        refresh={refresh}
        onSaved={async (saved) => {
          await mutate(saved, { revalidate: false });
          setSavedNotice('Settings saved.');
        }}
      />
    </>
  );
}

function PreferencesEditor({
  initial,
  refresh,
  onSaved,
}: {
  initial: PreferencesResponse;
  refresh?: ReactNode;
  onSaved: (saved: PreferencesResponse) => Promise<void>;
}) {
  const [settings, setSettings] = useState<AdminPreferences>(initial.settings);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; message: string } | null>(null);
  // The address list keeps the typed text; it is checked and split only when saving.
  const [staffEmails, setStaffEmails] = useState(
    initial.settings.admin.staffNotifications.emails.join(', '),
  );
  // `attempt` remounts the message so a repeated save failure is announced again.
  const [staffEmailsError, setStaffEmailsError] = useState<{
    message: string;
    attempt: number;
  } | null>(null);
  const communicationsRef = useRef<HTMLDetailsElement>(null);
  const staffEmailsRef = useRef<HTMLInputElement>(null);
  const staffEmailsId = useId();
  // Booking automation rules keep the typed text too; they are checked when saving.
  const [paymentDays, setPaymentDays] = useState(
    String(initial.settings.admin.bookingRules.paymentDeadlineDays),
  );
  const [guestLimit, setGuestLimit] = useState(
    initial.settings.admin.bookingRules.reviewGuestLimit?.toString() ?? '',
  );
  const [balanceDays, setBalanceDays] = useState(
    String(initial.settings.admin.bookingRules.balanceDueDays),
  );
  const [rulesError, setRulesError] = useState<{
    field: BookingRuleField;
    message: string;
    attempt: number;
  } | null>(null);
  const bookingRulesRef = useRef<HTMLDetailsElement>(null);
  const paymentDaysRef = useRef<HTMLInputElement>(null);
  const guestLimitRef = useRef<HTMLInputElement>(null);
  const balanceDaysRef = useRef<HTMLInputElement>(null);
  const rulesId = useId();
  /** The rule's message, shown under its own field so it is next to where focus moves. */
  const ruleError = (field: BookingRuleField) =>
    rulesError?.field === field ? (
      <p key={rulesError.attempt} id={`${rulesId}-error`} className={styles.error} role="alert">
        {rulesError.message}
      </p>
    ) : null;
  const ruleDescribedBy = (field: BookingRuleField, help: string) =>
    `${rulesId}-${help}${rulesError?.field === field ? ` ${rulesId}-error` : ''}`;
  // The booking window (lib/booking-window.ts) keeps the typed text, checked when saving.
  const [noticeDays, setNoticeDays] = useState(
    String(initial.settings.admin.bookingWindow.minNoticeDays),
  );
  const [monthsAhead, setMonthsAhead] = useState(
    String(initial.settings.admin.bookingWindow.maxMonthsAhead),
  );
  const [windowError, setWindowError] = useState<{
    field: BookingWindowField;
    message: string;
    attempt: number;
  } | null>(null);
  const windowRef = useRef<HTMLDetailsElement>(null);
  const noticeDaysRef = useRef<HTMLInputElement>(null);
  const monthsAheadRef = useRef<HTMLInputElement>(null);
  const windowId = useId();
  const windowFieldError = (field: BookingWindowField) =>
    windowError?.field === field ? (
      <p key={windowError.attempt} id={`${windowId}-error`} className={styles.error} role="alert">
        {windowError.message}
      </p>
    ) : null;
  const windowDescribedBy = (field: BookingWindowField, help: string) =>
    `${windowId}-${help}${windowError?.field === field ? ` ${windowId}-error` : ''}`;
  // Online payment accounts are checked when saving, like the rules above.
  const [accountsError, setAccountsError] = useState<{
    field: PaymentAccountField;
    message: string;
    attempt: number;
  } | null>(null);
  const paymentsRef = useRef<HTMLDetailsElement>(null);
  const accountInputs = useRef<Partial<Record<PaymentAccountField, HTMLInputElement | null>>>({});
  const accountsId = useId();
  const unavailableId = useId();
  // Ocular visit rules check themselves on save (components/admin/VisitRulesSettings.tsx).
  const visitRulesRef = useRef<VisitRulesHandle>(null);
  // Client photo retention (docs/client-photos.md) keeps the typed text, checked when saving.
  const [photoDays, setPhotoDays] = useState(
    String(initial.settings.admin.privacy.clientPhotoRetentionDays),
  );
  const [photoDaysError, setPhotoDaysError] = useState<{
    message: string;
    attempt: number;
  } | null>(null);
  const privacyRef = useRef<HTMLDetailsElement>(null);
  const photoDaysRef = useRef<HTMLInputElement>(null);
  const privacyId = useId();
  // Who signs contracts for Zion (docs/admin-panel.md, "Contracts"), checked when saving.
  const [signatoryError, setSignatoryError] = useState<{
    message: string;
    attempt: number;
  } | null>(null);
  const contractsRef = useRef<HTMLDetailsElement>(null);
  const signatoryNameRef = useRef<HTMLInputElement>(null);
  const contractsId = useId();
  const { previewTheme, clearPersonalTheme } = useAdminPreferences();
  const disabled = !initial.canEdit || busy;
  useEffect(() => () => previewTheme(null), [previewTheme]);
  const setNotifications = (key: NotificationPreference) =>
    setSettings((current) => ({
      ...current,
      admin: {
        ...current.admin,
        notifications: { ...current.admin.notifications, [key]: !current.admin.notifications[key] },
      },
    }));
  const setLocalization = (key: keyof AdminPreferences['admin']['localization'], value: string) =>
    setSettings((current) => ({
      ...current,
      admin: { ...current.admin, localization: { ...current.admin.localization, [key]: value } },
    }));
  const setSignatory = (key: 'name' | 'title', value: string) => {
    setSignatoryError(null);
    setSettings((current) => ({
      ...current,
      admin: {
        ...current.admin,
        contractSignatory: { ...current.admin.contractSignatory, [key]: value },
      },
    }));
  };
  const setClient = (key: keyof AdminPreferences['client'], value: boolean | string) =>
    setSettings((current) => ({ ...current, client: { ...current.client, [key]: value } }));
  const setAccount = (group: 'gcash' | 'bank', key: string, value: string) =>
    setSettings((current) => ({
      ...current,
      admin: {
        ...current.admin,
        paymentAccounts: {
          ...current.admin.paymentAccounts,
          [group]: { ...current.admin.paymentAccounts[group], [key]: value },
        },
      },
    }));

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const staffList = parseStaffNotificationEmails(staffEmails);
    if (staffList.problem) {
      const message = staffList.problem;
      setStaffEmailsError((current) => ({ message, attempt: (current?.attempt ?? 0) + 1 }));
      // The field sits in a disclosure that may be closed; open it before moving focus there.
      if (communicationsRef.current) communicationsRef.current.open = true;
      staffEmailsRef.current?.focus();
      return;
    }
    setStaffEmailsError(null);
    const bookingWindow = parseBookingWindow(noticeDays, monthsAhead);
    if ('problem' in bookingWindow) {
      const { field, problem } = bookingWindow;
      setWindowError((current) => ({
        field,
        message: problem,
        attempt: (current?.attempt ?? 0) + 1,
      }));
      if (windowRef.current) windowRef.current.open = true;
      (field === 'minNoticeDays' ? noticeDaysRef : monthsAheadRef).current?.focus();
      return;
    }
    setWindowError(null);
    const bookingRules = parseBookingRules(paymentDays, guestLimit, balanceDays);
    if ('problem' in bookingRules) {
      const { field, problem } = bookingRules;
      setRulesError((current) => ({
        field,
        message: problem,
        attempt: (current?.attempt ?? 0) + 1,
      }));
      if (bookingRulesRef.current) bookingRulesRef.current.open = true;
      const fieldRefs = {
        paymentDeadlineDays: paymentDaysRef,
        reviewGuestLimit: guestLimitRef,
        balanceDueDays: balanceDaysRef,
      };
      fieldRefs[field].current?.focus();
      return;
    }
    setRulesError(null);
    const paymentAccounts = normalizePaymentAccounts(settings.admin.paymentAccounts);
    const accountsIssue = paymentAccountsProblem(paymentAccounts);
    if (accountsIssue) {
      setAccountsError((current) => ({
        field: accountsIssue.field,
        message: accountsIssue.problem,
        attempt: (current?.attempt ?? 0) + 1,
      }));
      if (paymentsRef.current) paymentsRef.current.open = true;
      accountInputs.current[accountsIssue.field]?.focus();
      return;
    }
    setAccountsError(null);
    const retentionDays = Number(photoDays);
    if (
      !photoDays.trim() ||
      !Number.isInteger(retentionDays) ||
      retentionDays < CLIENT_PHOTO_RETENTION_DAYS.min ||
      retentionDays > CLIENT_PHOTO_RETENTION_DAYS.max
    ) {
      setPhotoDaysError((current) => ({
        message: `Enter a whole number of days from ${CLIENT_PHOTO_RETENTION_DAYS.min} to ${CLIENT_PHOTO_RETENTION_DAYS.max}.`,
        attempt: (current?.attempt ?? 0) + 1,
      }));
      if (privacyRef.current) privacyRef.current.open = true;
      photoDaysRef.current?.focus();
      return;
    }
    setPhotoDaysError(null);
    const signatory = {
      name: settings.admin.contractSignatory.name.trim(),
      title: settings.admin.contractSignatory.title.trim(),
    };
    const signatoryIssue = contractSignatoryProblem(signatory);
    if (signatoryIssue) {
      setSignatoryError((current) => ({
        message: signatoryIssue,
        attempt: (current?.attempt ?? 0) + 1,
      }));
      if (contractsRef.current) contractsRef.current.open = true;
      signatoryNameRef.current?.focus();
      return;
    }
    setSignatoryError(null);
    const visitRules = visitRulesRef.current?.validate();
    if (visitRules === null) return;
    setBusy(true);
    try {
      const response = await fetch('/api/admin/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          op: 'preferences',
          settings: {
            ...settings,
            admin: {
              ...settings.admin,
              staffNotifications: { emails: staffList.emails },
              bookingRules: bookingRules.rules,
              bookingWindow: bookingWindow.window,
              paymentAccounts,
              privacy: { clientPhotoRetentionDays: retentionDays },
              contractSignatory: signatory,
              ...(visitRules ? { visitRules } : {}),
            },
          },
          updatedAt: initial.updatedAt,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to save settings.');
      await onSaved(payload);
      previewTheme(null);
      // The saver sees the default they just chose instead of their header-toggle override.
      clearPersonalTheme();
      await refreshCache('/api/admin/notifications');
    } catch (error) {
      setNotice({
        error: true,
        message: error instanceof Error ? error.message : 'Unable to save settings.',
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className={styles.systemSettings}>
      <AdminPageHeader
        title="Settings"
        status={
          initial.canEdit
            ? initial.updatedAt
              ? `Last saved ${formatPreferenceDate(initial.updatedAt, settings.admin.localization)}`
              : 'Not saved yet'
            : 'Read-only: only a super administrator can save these settings.'
        }
        actions={
          <>
            {refresh}
            {initial.canEdit && (
              <Button
                type="submit"
                variant="primary"
                icon={<Save aria-hidden="true" />}
                loading={busy}
                loadingLabel="Saving…"
              >
                Save changes
              </Button>
            )}
          </>
        }
      />
      {initial.updatedAt && (
        <p className={styles.srOnly} role="status">
          Settings loaded. Last saved{' '}
          {formatPreferenceDate(initial.updatedAt, settings.admin.localization)}.
        </p>
      )}
      {notice && (
        <div role="alert" className={notice.error ? styles.error : styles.success}>
          {notice.message}
        </div>
      )}
      <div className={styles.settingsColumns}>
        <div>
          <section className={styles.settingsCard}>
            <SectionTitle title="Appearance and theme" />
            <div className={styles.settingsCardBody}>
              <div className={styles.themeChoices} role="group" aria-label="Default theme">
                {(['light', 'dark'] as const).map((theme) => (
                  <button
                    key={theme}
                    type="button"
                    disabled={disabled}
                    className={`${styles.themeChoice} ${settings.appearance.defaultTheme === theme ? styles.themeSelected : ''}`}
                    aria-pressed={settings.appearance.defaultTheme === theme}
                    onClick={() => {
                      setSettings((current) => ({
                        ...current,
                        appearance: { defaultTheme: theme },
                      }));
                      switchTheme(() => previewTheme(theme));
                    }}
                  >
                    {theme === 'light' ? (
                      <Sun size={20} aria-hidden="true" />
                    ) : (
                      <Moon size={20} aria-hidden="true" />
                    )}
                    <strong>{theme === 'light' ? 'Light mode' : 'Dark mode'}</strong>
                    <span>
                      {theme === 'light' ? 'Default bright interface.' : 'Rich, dark interface.'}
                    </span>
                    {settings.appearance.defaultTheme === theme && (
                      <span className={styles.themeSelection}>
                        <Check size={16} aria-hidden="true" />
                        Selected
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </section>
          <details className={`${styles.settingsCard} ${styles.settingsDisclosure}`}>
            <summary>
              <h2 className={styles.settingsSectionTitle}>
                Session and security
                <ChevronDown size={20} aria-hidden="true" />
              </h2>
            </summary>
            <div className={styles.settingsCardBody}>
              <label>
                Session Timeout
                <select
                  disabled={disabled}
                  value={settings.admin.security.sessionTimeoutMinutes}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      admin: {
                        ...current.admin,
                        security: { sessionTimeoutMinutes: Number(event.target.value) },
                      },
                    }))
                  }
                >
                  {SESSION_TIMEOUT_OPTIONS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes < 60
                        ? `${minutes} Minutes`
                        : `${minutes / 60} Hour${minutes > 60 ? 's' : ''}`}
                    </option>
                  ))}
                </select>
              </label>
              <p className={styles.help}>
                Applies at the next regular admin sign-in. Existing sessions and temporary local
                preview access keep their current expiry.
              </p>
              <div className={styles.settingsUnavailable}>
                <strong>Two-factor authentication</strong>
                <span className={styles.badge}>Unavailable</span>
                <p>Authenticator enrollment is not available in the old or current system.</p>
              </div>
              <div className={styles.settingsUnavailable}>
                <strong>Access policy</strong>
                <p>
                  Admin session lifetime is enforced on login. Destructive-action password prompts
                  are unavailable until those forms support password confirmation.
                </p>
              </div>
            </div>
          </details>
          <section className={styles.settingsCard}>
            <SectionTitle title="Client website controls" />
            <div className={styles.settingsCardBody}>
              {clientControls.map(([key, label, detail]) => (
                <div key={key} className={styles.settingsToggleRow}>
                  <div>
                    <strong>{label}</strong>
                    <p>{detail}</p>
                  </div>
                  <Toggle
                    label={label}
                    checked={settings.client[key]}
                    disabled={disabled}
                    onChange={() => setClient(key, !settings.client[key])}
                  />
                </div>
              ))}
              {['Online booking requests', 'Smart assistant'].map((label, index) => (
                <div key={label} className={styles.settingsToggleRow}>
                  <div>
                    <strong>{label}</strong>
                    <p id={`${unavailableId}-module-${index}`}>
                      Unavailable · This module is not part of the current system.
                    </p>
                  </div>
                  <Toggle
                    label={label}
                    checked={false}
                    disabled
                    describedBy={`${unavailableId}-module-${index}`}
                    onChange={() => {}}
                  />
                </div>
              ))}
              <label className={styles.settingsMessage}>
                Unavailable Message
                <textarea
                  rows={3}
                  required
                  maxLength={300}
                  disabled={disabled}
                  value={settings.client.disabledMessage}
                  onChange={(event) => setClient('disabledMessage', event.target.value)}
                />
              </label>
            </div>
          </section>
        </div>
        <div>
          <details
            ref={communicationsRef}
            className={`${styles.settingsCard} ${styles.settingsDisclosure}`}
          >
            <summary>
              <h2 className={styles.settingsSectionTitle}>
                Communications
                <ChevronDown size={20} aria-hidden="true" />
              </h2>
            </summary>
            <div className={styles.settingsCardBody}>
              <p className={styles.settingsCaption}>System alerts</p>
              {(Object.entries(notificationLabels) as [NotificationPreference, string][]).map(
                ([key, label]) => {
                  const unavailable = key === 'testimonyUpdates' || key === 'supportUpdates';
                  return (
                    <div key={key} className={styles.settingsToggleRow}>
                      <div>
                        <strong>{label}</strong>
                        {unavailable && (
                          <p id={`${unavailableId}-${key}`}>
                            Unavailable · No admin module in the current system.
                          </p>
                        )}
                      </div>
                      <Toggle
                        label={label}
                        checked={!unavailable && settings.admin.notifications[key]}
                        disabled={disabled || unavailable}
                        describedBy={unavailable ? `${unavailableId}-${key}` : undefined}
                        onChange={() => setNotifications(key)}
                      />
                    </div>
                  );
                },
              )}
              <p className={styles.help}>
                Alert preferences apply to available admin updates. They do not stop transactional
                notices sent to clients.
              </p>
              <div className={styles.settingsEmails}>
                <label>
                  Staff notification emails
                  <input
                    ref={staffEmailsRef}
                    type="text"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    disabled={disabled}
                    value={staffEmails}
                    aria-invalid={staffEmailsError ? true : undefined}
                    aria-describedby={`${staffEmailsId}-help${staffEmailsError ? ` ${staffEmailsId}-error` : ''}`}
                    onChange={(event) => {
                      const text = event.target.value;
                      setStaffEmails(text);
                      // The message stays until the list is corrected or saved again.
                      if (staffEmailsError && !parseStaffNotificationEmails(text).problem)
                        setStaffEmailsError(null);
                    }}
                  />
                </label>
                <p id={`${staffEmailsId}-help`} className={styles.help}>
                  Staff alerts, the daily digest and calendar events for booking requests and
                  confirmed reservations go to these addresses. Separate up to 5 with commas. Leave
                  empty to use the server default; Automation shows the addresses in use.
                </p>
                {staffEmailsError && (
                  <p
                    key={staffEmailsError.attempt}
                    id={`${staffEmailsId}-error`}
                    className={styles.error}
                    role="alert"
                  >
                    {staffEmailsError.message}
                  </p>
                )}
              </div>
            </div>
          </details>
          <details
            ref={windowRef}
            className={`${styles.settingsCard} ${styles.settingsDisclosure}`}
          >
            <summary>
              <h2 className={styles.settingsSectionTitle}>
                Booking window
                <ChevronDown size={20} aria-hidden="true" />
              </h2>
            </summary>
            <div className={styles.settingsCardBody}>
              <p className={styles.help}>
                How soon and how far ahead guests can book. The booking page and its server check,
                walk-ins, the event pages and Zeni&apos;s calendar all use these two numbers. To
                confirm with Zion: the team plan suggests{' '}
                {BOOKING_WINDOW_LIMITS.minNoticeDays.default} days and{' '}
                {BOOKING_WINDOW_LIMITS.maxMonthsAhead.default} months.
              </p>
              <div className={styles.settingsEmails}>
                <label>
                  Minimum notice (days)
                  <input
                    ref={noticeDaysRef}
                    type="number"
                    inputMode="numeric"
                    min={BOOKING_WINDOW_LIMITS.minNoticeDays.min}
                    max={BOOKING_WINDOW_LIMITS.minNoticeDays.max}
                    step={1}
                    required
                    disabled={disabled}
                    value={noticeDays}
                    aria-invalid={windowError?.field === 'minNoticeDays' ? true : undefined}
                    aria-describedby={windowDescribedBy('minNoticeDays', 'notice-help')}
                    onChange={(event) => {
                      setNoticeDays(event.target.value);
                      if (windowError?.field === 'minNoticeDays') setWindowError(null);
                    }}
                  />
                </label>
                <p id={`${windowId}-notice-help`} className={styles.help}>
                  Guests can book an event at least this many days after today.
                </p>
                {windowFieldError('minNoticeDays')}
              </div>
              <div className={styles.settingsEmails}>
                <label>
                  Furthest date (months ahead)
                  <input
                    ref={monthsAheadRef}
                    type="number"
                    inputMode="numeric"
                    min={BOOKING_WINDOW_LIMITS.maxMonthsAhead.min}
                    max={BOOKING_WINDOW_LIMITS.maxMonthsAhead.max}
                    step={1}
                    required
                    disabled={disabled}
                    value={monthsAhead}
                    aria-invalid={windowError?.field === 'maxMonthsAhead' ? true : undefined}
                    aria-describedby={windowDescribedBy('maxMonthsAhead', 'months-help')}
                    onChange={(event) => {
                      setMonthsAhead(event.target.value);
                      if (windowError?.field === 'maxMonthsAhead') setWindowError(null);
                    }}
                  />
                </label>
                <p id={`${windowId}-months-help`} className={styles.help}>
                  Guests can book up to this many months after today. Bookings already made are not
                  changed.
                </p>
                {windowFieldError('maxMonthsAhead')}
              </div>
            </div>
          </details>
          <details
            ref={bookingRulesRef}
            className={`${styles.settingsCard} ${styles.settingsDisclosure}`}
          >
            <summary>
              <h2 className={styles.settingsSectionTitle}>
                Booking automation
                <ChevronDown size={20} aria-hidden="true" />
              </h2>
            </summary>
            <div className={styles.settingsCardBody}>
              <p className={styles.help}>
                Ordinary website bookings are approved automatically and hold their date while the
                client pays. Recording the payment confirms the booking; an unpaid hold is released
                when its deadline passes. Custom proposals, packages without a reservation fee and
                larger events go to staff review.
              </p>
              <div className={styles.settingsEmails}>
                <label>
                  Days to pay the reservation fee
                  <input
                    ref={paymentDaysRef}
                    type="number"
                    inputMode="numeric"
                    min={PAYMENT_DEADLINE_DAYS.min}
                    max={PAYMENT_DEADLINE_DAYS.max}
                    step={1}
                    required
                    disabled={disabled}
                    value={paymentDays}
                    aria-invalid={rulesError?.field === 'paymentDeadlineDays' ? true : undefined}
                    aria-describedby={ruleDescribedBy('paymentDeadlineDays', 'days-help')}
                    onChange={(event) => {
                      setPaymentDays(event.target.value);
                      if (rulesError?.field === 'paymentDeadlineDays') setRulesError(null);
                    }}
                  />
                </label>
                <p id={`${rulesId}-days-help`} className={styles.help}>
                  {PAYMENT_DEADLINE_DAYS.min} to {PAYMENT_DEADLINE_DAYS.max} days. A deadline never
                  falls after the event starts. New deadlines use this value; existing ones stay
                  until staff extend them.
                </p>
                {ruleError('paymentDeadlineDays')}
              </div>
              <div className={styles.settingsEmails}>
                <label>
                  Review bookings with more guests than
                  <input
                    ref={guestLimitRef}
                    type="number"
                    inputMode="numeric"
                    min={REVIEW_GUEST_LIMIT.min}
                    max={REVIEW_GUEST_LIMIT.max}
                    step={1}
                    disabled={disabled}
                    value={guestLimit}
                    aria-invalid={rulesError?.field === 'reviewGuestLimit' ? true : undefined}
                    aria-describedby={ruleDescribedBy('reviewGuestLimit', 'guests-help')}
                    onChange={(event) => {
                      setGuestLimit(event.target.value);
                      if (rulesError?.field === 'reviewGuestLimit') setRulesError(null);
                    }}
                  />
                </label>
                <p id={`${rulesId}-guests-help`} className={styles.help}>
                  Leave empty for no limit. To confirm with Zion: their documents give the capacity
                  as 120 in one place and 130 in another.
                </p>
                {ruleError('reviewGuestLimit')}
              </div>
              <div className={styles.settingsEmails}>
                <label>
                  Days before the event full payment is due
                  <input
                    ref={balanceDaysRef}
                    type="number"
                    inputMode="numeric"
                    min={BALANCE_DUE_DAYS.min}
                    max={BALANCE_DUE_DAYS.max}
                    step={1}
                    required
                    disabled={disabled}
                    value={balanceDays}
                    aria-invalid={rulesError?.field === 'balanceDueDays' ? true : undefined}
                    aria-describedby={ruleDescribedBy('balanceDueDays', 'balance-help')}
                    onChange={(event) => {
                      setBalanceDays(event.target.value);
                      if (rulesError?.field === 'balanceDueDays') setRulesError(null);
                    }}
                  />
                </label>
                <p id={`${rulesId}-balance-help`} className={styles.help}>
                  Zion&apos;s terms ask for full payment {BALANCE_DUE_DAYS.default} days before the
                  event. Clients see this date on their payment page and get reminders 7 days and 1
                  day before it.
                </p>
                {ruleError('balanceDueDays')}
              </div>
            </div>
          </details>
          <details
            ref={privacyRef}
            className={`${styles.settingsCard} ${styles.settingsDisclosure}`}
          >
            <summary>
              <h2 className={styles.settingsSectionTitle}>
                Privacy and retention
                <ChevronDown size={20} aria-hidden="true" />
              </h2>
            </summary>
            <div className={styles.settingsCardBody}>
              <p className={styles.help}>
                Personal data the system deletes on its own. The periods are defaults to confirm
                with Zion.
              </p>
              <div className={styles.settingsEmails}>
                <label>
                  Delete client photos after (days)
                  <input
                    ref={photoDaysRef}
                    type="number"
                    inputMode="numeric"
                    min={CLIENT_PHOTO_RETENTION_DAYS.min}
                    max={CLIENT_PHOTO_RETENTION_DAYS.max}
                    step={1}
                    required
                    disabled={disabled}
                    value={photoDays}
                    aria-invalid={photoDaysError ? true : undefined}
                    aria-describedby={`${privacyId}-photo-help${photoDaysError ? ` ${privacyId}-photo-error` : ''}`}
                    onChange={(event) => {
                      setPhotoDays(event.target.value);
                      setPhotoDaysError(null);
                    }}
                  />
                </label>
                <p id={`${privacyId}-photo-help`} className={styles.help}>
                  To confirm with Zion. Counted from the day the client&apos;s last event or visit
                  is completed or cancelled. A client can remove their photo sooner, and it is then
                  deleted at once. Clients see this number where they add a photo.
                </p>
                {photoDaysError && (
                  <p
                    key={photoDaysError.attempt}
                    id={`${privacyId}-photo-error`}
                    className={styles.error}
                    role="alert"
                  >
                    {photoDaysError.message}
                  </p>
                )}
              </div>
            </div>
          </details>
          <details
            ref={contractsRef}
            className={`${styles.settingsCard} ${styles.settingsDisclosure}`}
          >
            <summary>
              <h2 className={styles.settingsSectionTitle}>
                Contracts
                <ChevronDown size={20} aria-hidden="true" />
              </h2>
            </summary>
            <div className={styles.settingsCardBody}>
              <div className={styles.settingsEmails}>
                <label>
                  Signed for Zion by
                  <input
                    ref={signatoryNameRef}
                    type="text"
                    autoComplete="off"
                    required
                    minLength={CONTRACT_SIGNATORY_LIMITS.nameMin}
                    maxLength={CONTRACT_SIGNATORY_LIMITS.nameMax}
                    disabled={disabled}
                    value={settings.admin.contractSignatory.name}
                    aria-invalid={signatoryError ? true : undefined}
                    aria-describedby={`${contractsId}-help${signatoryError ? ` ${contractsId}-error` : ''}`}
                    onChange={(event) => setSignatory('name', event.target.value)}
                  />
                </label>
                <label>
                  Title
                  <input
                    type="text"
                    autoComplete="off"
                    maxLength={CONTRACT_SIGNATORY_LIMITS.titleMax}
                    disabled={disabled}
                    value={settings.admin.contractSignatory.title}
                    aria-describedby={`${contractsId}-help`}
                    onChange={(event) => setSignatory('title', event.target.value)}
                  />
                </label>
                <p id={`${contractsId}-help`} className={styles.help}>
                  Printed under Zion&apos;s signature line on contracts generated from now on.
                  Contracts already generated keep the name they were generated with.
                </p>
                {signatoryError && (
                  <p
                    key={signatoryError.attempt}
                    id={`${contractsId}-error`}
                    className={styles.error}
                    role="alert"
                  >
                    {signatoryError.message}
                  </p>
                )}
              </div>
            </div>
          </details>
          <details
            ref={paymentsRef}
            className={`${styles.settingsCard} ${styles.settingsDisclosure}`}
          >
            <summary>
              <h2 className={styles.settingsSectionTitle}>
                Online payments
                <ChevronDown size={20} aria-hidden="true" />
              </h2>
            </summary>
            <div className={styles.settingsCardBody}>
              <p id={`${accountsId}-help`} className={styles.help}>
                Clients see these accounts only on their private payment page, once their date is
                held. They send a screenshot of the transfer, and staff check it against these
                accounts before it counts as paid. Leave a method empty to not offer it; paying cash
                at the venue is always possible.
              </p>
              {paymentAccountFields.map(({ field, label, group, key, hint }) => (
                <div key={field} className={styles.settingsEmails}>
                  {(field === 'gcashName' || field === 'bankName') && (
                    <p className={styles.settingsCaption}>
                      {group === 'gcash' ? 'GCash' : 'Bank transfer'}
                    </p>
                  )}
                  <label>
                    {label}
                    <input
                      ref={(input) => {
                        accountInputs.current[field] = input;
                      }}
                      type="text"
                      inputMode={field === 'gcashNumber' ? 'tel' : undefined}
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={
                        field === 'gcashNumber' ? 20 : field === 'bankAccountNumber' ? 40 : 100
                      }
                      disabled={disabled}
                      value={accountValue(settings.admin.paymentAccounts, group, key)}
                      aria-invalid={accountsError?.field === field ? true : undefined}
                      aria-describedby={
                        [
                          hint ? `${accountsId}-${field}-hint` : null,
                          accountsError?.field === field ? `${accountsId}-error` : null,
                        ]
                          .filter(Boolean)
                          .join(' ') || undefined
                      }
                      onChange={(event) => {
                        setAccount(group, key, event.target.value);
                        if (accountsError?.field === field) setAccountsError(null);
                      }}
                    />
                  </label>
                  {hint && (
                    <p id={`${accountsId}-${field}-hint`} className={styles.help}>
                      {hint}
                    </p>
                  )}
                  {/* Shown under the field to fix, so it is next to where focus moves. */}
                  {accountsError?.field === field && (
                    <p
                      key={accountsError.attempt}
                      id={`${accountsId}-error`}
                      className={styles.error}
                      role="alert"
                    >
                      {accountsError.message}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </details>
          <VisitRulesSettings
            ref={visitRulesRef}
            initial={initial.settings.admin.visitRules}
            disabled={disabled}
          />
          <details className={`${styles.settingsCard} ${styles.settingsDisclosure}`}>
            <summary>
              <h2 className={styles.settingsSectionTitle}>
                Localization and data
                <ChevronDown size={20} aria-hidden="true" />
              </h2>
            </summary>
            <div className={styles.settingsCardBody}>
              <label>
                Preferred Language
                <select
                  disabled={disabled}
                  value={settings.admin.localization.language}
                  onChange={(event) => setLocalization('language', event.target.value)}
                >
                  {LANGUAGE_OPTIONS.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                Timezone
                <select
                  disabled={disabled}
                  value={settings.admin.localization.timezone}
                  onChange={(event) => setLocalization('timezone', event.target.value)}
                >
                  {TIMEZONE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Date & Time Format
                <select
                  disabled={disabled}
                  value={settings.admin.localization.dateFormat}
                  onChange={(event) => setLocalization('dateFormat', event.target.value)}
                >
                  {DATE_FORMAT_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {DATE_FORMAT_LABELS[value]}
                    </option>
                  ))}
                </select>
              </label>
              <p className={styles.help}>
                Language and format preferences apply to displayed dates and data exports. Venue
                schedules are recorded in Manila time.
              </p>
              <div className={styles.settingsExport}>
                <div>
                  <strong>Export data</strong>
                  <p>Download up to 10,000 activity logs.</p>
                </div>
                <ButtonAnchor
                  variant="secondary"
                  icon={<Download aria-hidden="true" />}
                  href={`/api/admin/settings-export?${new URLSearchParams({ timeZone: settings.admin.localization.timezone })}`}
                >
                  Export CSV
                </ButtonAnchor>
              </div>
            </div>
          </details>
        </div>
      </div>
    </form>
  );
}
