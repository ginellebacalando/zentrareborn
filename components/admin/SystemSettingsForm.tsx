'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import useSWR, { mutate as refreshCache } from 'swr';
import {
  DATE_FORMAT_OPTIONS,
  LANGUAGE_OPTIONS,
  TIMEZONE_OPTIONS,
} from '@/lib/system-settings-types';
import {
  SESSION_TIMEOUT_OPTIONS,
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
  parseBookingRules,
} from '@/lib/admin/booking-rules';
import { useAdminPreferences } from './AdminPreferencesProvider';
import styles from './admin.module.css';

const clientControls = [
  ['maintenanceMode', 'Maintenance Mode', 'Temporarily pauses public client features.'],
  [
    'inquirySubmissionsEnabled',
    'Inquiry Submissions',
    'Controls Contact Us and homepage inquiry forms.',
  ],
  ['packagesVisible', 'Public Packages', 'Controls public packages and package information.'],
  ['faqVisible', 'Client FAQ', 'Controls client FAQ pages, previews, and APIs.'],
  [
    'publicTestimoniesVisible',
    'Public Testimonies',
    'Controls public testimonies and featured stories.',
  ],
  [
    'testimonySubmissionsEnabled',
    'Testimony Submissions',
    'Controls client testimony submissions.',
  ],
] as const;

function SectionTitle({ title, icon }: { title: string; icon: string }) {
  return (
    <div className={styles.settingsSectionTitle}>
      <span>
        <i className={`fi ${icon}`} aria-hidden="true" />
      </span>
      <h2>{title}</h2>
    </div>
  );
}
function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={styles.settingsSwitch}
    >
      <span />
    </button>
  );
}

export default function SystemSettingsForm() {
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
      <div role="alert" className={styles.error}>
        {error.message}{' '}
        <button type="button" className={styles.linkButton} onClick={() => void mutate()}>
          Try again
        </button>
      </div>
    );
  if (!data)
    return (
      <div className={styles.card} role="status">
        Loading settings…
      </div>
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
  onSaved,
}: {
  initial: PreferencesResponse;
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
  const [rulesError, setRulesError] = useState<{
    field: 'paymentDeadlineDays' | 'reviewGuestLimit';
    message: string;
    attempt: number;
  } | null>(null);
  const bookingRulesRef = useRef<HTMLDetailsElement>(null);
  const paymentDaysRef = useRef<HTMLInputElement>(null);
  const guestLimitRef = useRef<HTMLInputElement>(null);
  const rulesId = useId();
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
  const setClient = (key: keyof AdminPreferences['client'], value: boolean | string) =>
    setSettings((current) => ({ ...current, client: { ...current.client, [key]: value } }));

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
    const bookingRules = parseBookingRules(paymentDays, guestLimit);
    if ('problem' in bookingRules) {
      const { field, problem } = bookingRules;
      setRulesError((current) => ({
        field,
        message: problem,
        attempt: (current?.attempt ?? 0) + 1,
      }));
      if (bookingRulesRef.current) bookingRulesRef.current.open = true;
      (field === 'paymentDeadlineDays' ? paymentDaysRef : guestLimitRef).current?.focus();
      return;
    }
    setRulesError(null);
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
      <div className={styles.settingsSaveBar}>
        <div>
          <h2>System preferences</h2>
          <p>
            {initial.updatedAt
              ? `Last saved ${formatPreferenceDate(initial.updatedAt, settings.admin.localization)}`
              : 'Your current system preferences'}
          </p>
        </div>
        {initial.canEdit ? (
          <button type="submit" className={styles.primary} disabled={busy}>
            <i className="fi fi-rr-disk" aria-hidden="true" />
            {busy ? 'Saving…' : 'Save Changes'}
          </button>
        ) : (
          <span className={styles.help}>
            Read-only · Super administrator access required to save
          </span>
        )}
      </div>
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
            <SectionTitle icon="fi-rr-palette" title="Appearance & Theme" />
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
                      previewTheme(theme);
                    }}
                  >
                    <i
                      className={`fi ${theme === 'light' ? 'fi-rr-brightness' : 'fi-rr-moon'}`}
                      aria-hidden="true"
                    />
                    <strong>{theme === 'light' ? 'Light Mode' : 'Evening Gala'}</strong>
                    <span>
                      {theme === 'light' ? 'Default bright interface.' : 'Rich, dark interface.'}
                    </span>
                    {settings.appearance.defaultTheme === theme && (
                      <span className={styles.themeSelection}>
                        <Check size={14} aria-hidden="true" />
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
                <span>
                  <i className="fi fi-rr-shield-check" aria-hidden="true" />
                </span>
                Session & Advanced Security
                <ChevronDown size={18} aria-hidden="true" />
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
                <strong>Two-Factor Auth</strong>
                <span className={styles.badge}>Unavailable</span>
                <p>Authenticator enrollment is not available in the old or current system.</p>
              </div>
              <div className={styles.settingsUnavailable}>
                <strong>Access Policy</strong>
                <p>
                  Admin session lifetime is enforced on login. Destructive-action password prompts
                  are unavailable until those forms support password confirmation.
                </p>
              </div>
            </div>
          </details>
          <section className={styles.settingsCard}>
            <SectionTitle icon="fi-rr-globe" title="Client Panel Controls" />
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
              {['Online Booking Requests', 'Smart Assistant'].map((label) => (
                <div key={label} className={styles.settingsToggleRow}>
                  <div>
                    <strong>{label}</strong>
                    <p>Unavailable · This module is not part of the current system.</p>
                  </div>
                  <Toggle label={label} checked={false} disabled onChange={() => {}} />
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
                <span>
                  <i className="fi fi-rr-bell" aria-hidden="true" />
                </span>
                Communications
                <ChevronDown size={18} aria-hidden="true" />
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
                        {unavailable && <p>Unavailable · No admin module in the current system.</p>}
                      </div>
                      <Toggle
                        label={label}
                        checked={!unavailable && settings.admin.notifications[key]}
                        disabled={disabled || unavailable}
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
            ref={bookingRulesRef}
            className={`${styles.settingsCard} ${styles.settingsDisclosure}`}
          >
            <summary>
              <h2 className={styles.settingsSectionTitle}>
                <span>
                  <i className="fi fi-rr-calendar" aria-hidden="true" />
                </span>
                Booking Automation
                <ChevronDown size={18} aria-hidden="true" />
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
                    aria-describedby={`${rulesId}-days-help${rulesError?.field === 'paymentDeadlineDays' ? ` ${rulesId}-error` : ''}`}
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
                    aria-describedby={`${rulesId}-guests-help${rulesError?.field === 'reviewGuestLimit' ? ` ${rulesId}-error` : ''}`}
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
              </div>
              {rulesError && (
                <p
                  key={rulesError.attempt}
                  id={`${rulesId}-error`}
                  className={styles.error}
                  role="alert"
                >
                  {rulesError.message}
                </p>
              )}
            </div>
          </details>
          <details className={`${styles.settingsCard} ${styles.settingsDisclosure}`}>
            <summary>
              <h2 className={styles.settingsSectionTitle}>
                <span>
                  <i className="fi fi-rr-settings-sliders" aria-hidden="true" />
                </span>
                Localization & Data
                <ChevronDown size={18} aria-hidden="true" />
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
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <p className={styles.help}>
                Language and format preferences apply to displayed dates and data exports. Venue
                schedules are recorded in Manila time.
              </p>
              <div className={styles.settingsExport}>
                <div>
                  <strong>Export Data</strong>
                  <p>Download up to 10,000 activity logs.</p>
                </div>
                <a
                  className={styles.secondary}
                  href={`/api/admin/settings-export?${new URLSearchParams({ timeZone: settings.admin.localization.timezone })}`}
                >
                  <i className="fi fi-rr-download" aria-hidden="true" />
                  Export CSV
                </a>
              </div>
            </div>
          </details>
        </div>
      </div>
    </form>
  );
}
