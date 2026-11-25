'use client';
import { useState } from 'react';
import useSWR from 'swr';
import {
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  Clock3,
  Inbox,
  LoaderCircle,
  MailCheck,
  MailWarning,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  type LucideIcon,
} from 'lucide-react';
import {
  AUTOMATION_STATUSES,
  AUTOMATION_STATUS_DESCRIPTIONS,
  AUTOMATION_STATUS_LABELS,
  isAutomationStatus,
  type AutomationJobView,
  type AutomationOverview,
  type AutomationStatus,
  type StaffRecipientSource,
} from '@/lib/automation/catalog';
import styles from './AutomationPanel.module.css';

const ENDPOINT = '/api/admin/automation';
const STATUS_ICONS: Record<AutomationStatus, LucideIcon> = {
  QUEUED: Clock3,
  PROCESSING: Send,
  ACCEPTED: CheckCircle2,
  REVIEW_REQUIRED: AlertTriangle,
  EXPIRED: CircleSlash,
};
const STATUS_TONES: Record<AutomationStatus, string> = {
  QUEUED: styles.toneWaiting,
  PROCESSING: styles.toneWaiting,
  ACCEPTED: styles.toneSuccess,
  REVIEW_REQUIRED: styles.toneDanger,
  EXPIRED: styles.toneNeutral,
};
const STAFF_SOURCE_NOTES: Record<StaffRecipientSource, string> = {
  settings: 'Saved in Settings under Communications.',
  environment:
    'Server default (STAFF_NOTIFICATION_EMAIL). Saving staff notification emails in Settings replaces it.',
  'sending-account':
    'Server default: the sending account (SMTP_USER). Saving staff notification emails in Settings replaces it.',
  none: 'A super administrator can add staff notification emails in Settings under Communications.',
};
const dateTime = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatDate(value: string | null) {
  return value ? `${dateTime.format(new Date(value))} PHT` : 'Not scheduled';
}

async function load(url: string): Promise<AutomationOverview> {
  const response = await fetch(url, { cache: 'no-store' });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Automation data is unavailable.');
  return body;
}

/** Status is always conveyed by text and an icon, with color only as reinforcement. */
function StatusBadge({ status }: { status: string }) {
  if (!isAutomationStatus(status))
    return <span className={`${styles.badge} ${styles.toneNeutral}`}>{status}</span>;
  const Icon = STATUS_ICONS[status];
  return (
    <span className={`${styles.badge} ${STATUS_TONES[status]}`}>
      <Icon size={14} aria-hidden="true" />
      {AUTOMATION_STATUS_LABELS[status]}
    </span>
  );
}

function ConfigBadge({ configured }: { configured: boolean }) {
  const Icon = configured ? CheckCircle2 : AlertTriangle;
  return (
    <span className={`${styles.badge} ${configured ? styles.toneSuccess : styles.toneDanger}`}>
      <Icon size={14} aria-hidden="true" />
      {configured ? 'Configured' : 'Not configured'}
    </span>
  );
}

function JobItem({
  job,
  busy,
  onRetry,
}: {
  job: AutomationJobView;
  busy: boolean;
  onRetry: (job: AutomationJobView) => void;
}) {
  return (
    <li className={styles.job}>
      <div className={styles.jobTop}>
        <h3>{job.label}</h3>
        <StatusBadge status={job.status} />
      </div>
      <dl className={styles.facts}>
        <div>
          <dt>Recipient</dt>
          <dd>{job.recipient || 'Not set'}</dd>
        </div>
        <div>
          <dt>Attempts</dt>
          <dd>
            {job.attempts} of {job.maxAttempts}
          </dd>
        </div>
        <div>
          <dt>Next attempt</dt>
          <dd>{formatDate(job.nextAttemptAt)}</dd>
        </div>
        <div>
          <dt>{job.sentAt ? 'Sent' : 'Created'}</dt>
          <dd>{formatDate(job.sentAt ?? job.createdAt)}</dd>
        </div>
        {job.calendar && (
          <div>
            <dt>Calendar</dt>
            <dd>{job.calendar === 'REQUEST' ? 'Invitation attached' : 'Cancellation attached'}</dd>
          </div>
        )}
      </dl>
      {job.lastError && (
        <p className={styles.jobError}>
          <span className={styles.visuallyHidden}>Last error: </span>
          {job.lastError}
        </p>
      )}
      {job.retryable && (
        <div className={styles.jobActions}>
          <button
            type="button"
            className={styles.secondary}
            disabled={busy}
            onClick={() => onRetry(job)}
            aria-label={`Retry ${job.label}${job.recipient ? ` to ${job.recipient}` : ''}`}
          >
            <RotateCcw size={16} aria-hidden="true" />
            Retry
          </button>
        </div>
      )}
    </li>
  );
}

export default function AutomationPanel() {
  const [filter, setFilter] = useState<AutomationStatus | ''>('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const { data, error, isLoading, isValidating, mutate } = useSWR<AutomationOverview>(
    filter ? `${ENDPOINT}?status=${filter}` : ENDPOINT,
    load,
    { keepPreviousData: true, shouldRetryOnError: false },
  );

  async function act(payload: { op: 'run' } | { op: 'retry'; id: string }) {
    setBusy(true);
    setNotice('');
    setActionError('');
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(body.error || 'The automation action failed.');
      setNotice(body.message || 'Done.');
      await mutate();
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : 'The automation action failed.');
    } finally {
      setBusy(false);
    }
  }

  function retry(job: AutomationJobView) {
    if (
      window.confirm(
        `Send "${job.label}" again? If an earlier attempt was interrupted, the recipient may already have this email.`,
      )
    )
      void act({ op: 'retry', id: job.id });
  }

  const loadError = error instanceof Error ? error.message : '';
  return (
    <section className={styles.panel} aria-labelledby="automation-title" aria-busy={busy}>
      <header className={styles.header}>
        <div>
          <h1 id="automation-title">Automation</h1>
          <p>
            Emails the system sends on its own: inquiry alerts and acknowledgements, booking notices
            with calendar invitations for the client and the staff, event reminders and the daily
            staff digest. Every email is saved first, then delivered; nothing is shown as sent until
            the mail server accepts it.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => void mutate()}
            disabled={isValidating}
          >
            <RefreshCw
              size={16}
              aria-hidden="true"
              className={isValidating ? styles.spin : undefined}
            />
            Refresh
          </button>
          <button
            type="button"
            className={styles.primary}
            onClick={() => void act({ op: 'run' })}
            disabled={busy}
          >
            {busy ? (
              <LoaderCircle size={16} aria-hidden="true" className={styles.spin} />
            ) : (
              <Play size={16} aria-hidden="true" />
            )}
            Run due jobs now
          </button>
        </div>
      </header>

      <div role="status" aria-live="polite">
        {notice && <p className={styles.notice}>{notice}</p>}
      </div>
      {(actionError || loadError) && (
        <p className={styles.alert} role="alert">
          {actionError || loadError}
        </p>
      )}

      {!data && isLoading && (
        <p className={styles.loading} role="status">
          <LoaderCircle size={18} aria-hidden="true" className={styles.spin} />
          Loading automation status…
        </p>
      )}

      {data && (
        <>
          <section className={styles.card} aria-labelledby="automation-setup">
            <h2 id="automation-setup">Setup</h2>
            <p className={styles.sectionIntro}>
              Passwords and secrets stay on the server. Staff addresses are partly hidden.
            </p>
            <ul className={styles.config}>
              <li className={styles.configItem}>
                {data.emailConfigured ? (
                  <MailCheck size={22} aria-hidden="true" />
                ) : (
                  <MailWarning size={22} aria-hidden="true" />
                )}
                <div>
                  <h3>Email delivery (Gmail SMTP)</h3>
                  <ConfigBadge configured={data.emailConfigured} />
                  <p>
                    {data.emailConfigured
                      ? 'Queued emails are delivered through the configured mail account.'
                      : 'Emails are saved and wait in the queue. To start sending, add SMTP_USER (the Gmail address) and SMTP_PASSWORD (a Gmail App Password, not the account password) in Vercel under Settings, Environment Variables, then redeploy. Waiting emails then go out on the next run.'}
                  </p>
                </div>
              </li>
              <li className={styles.configItem}>
                <Clock3 size={22} aria-hidden="true" />
                <div>
                  <h3>Scheduled runs (cron)</h3>
                  <ConfigBadge configured={data.cronConfigured} />
                  <p>
                    {data.lastRun
                      ? `Last run ${formatDate(data.lastRun.at)} (${data.lastRun.trigger}): ${data.lastRun.sent} sent, ${data.lastRun.failed} failed.`
                      : 'No scheduled run has been recorded yet.'}{' '}
                    {data.dueNow > 0 &&
                      `${data.dueNow} email${data.dueNow === 1 ? ' is' : 's are'} due now.`}
                  </p>
                </div>
              </li>
              <li className={styles.configItem}>
                <Inbox size={22} aria-hidden="true" />
                <div>
                  <h3>Staff notifications</h3>
                  <ConfigBadge configured={data.staffRecipients.masked.length > 0} />
                  <p>
                    {data.staffRecipients.masked.length
                      ? `Staff alerts, the daily digest and calendar invitations for confirmed bookings go to ${data.staffRecipients.masked.join(', ')}. In Google Calendar, the "Add invitations to my calendar" setting decides whether an invitation appears on its own.`
                      : 'No valid staff address: staff alerts and the daily digest wait, and confirmed bookings send no staff calendar invitation.'}{' '}
                    {STAFF_SOURCE_NOTES[data.staffRecipients.source]}
                  </p>
                </div>
              </li>
            </ul>
          </section>

          <section className={styles.card} aria-labelledby="automation-counts">
            <h2 id="automation-counts">Email status</h2>
            <ul className={styles.counts}>
              {AUTOMATION_STATUSES.map((status) => (
                <li key={status} className={styles.count}>
                  <StatusBadge status={status} />
                  <strong>{data.counts[status]}</strong>
                  <p>{AUTOMATION_STATUS_DESCRIPTIONS[status]}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.card} aria-labelledby="automation-jobs">
            <div className={styles.listHeader}>
              <div>
                <h2 id="automation-jobs">Recent emails</h2>
                <p className={styles.sectionIntro}>
                  Latest 50. Addresses are partly hidden. Failed emails can be retried once you have
                  checked the error.
                </p>
              </div>
              <label className={styles.filter}>
                Show
                <select
                  value={filter}
                  onChange={(event) =>
                    setFilter(isAutomationStatus(event.target.value) ? event.target.value : '')
                  }
                >
                  <option value="">All statuses</option>
                  {AUTOMATION_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {AUTOMATION_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {data.jobs.length ? (
              <ul className={styles.jobs}>
                {data.jobs.map((job) => (
                  <JobItem key={job.id} job={job} busy={busy} onRetry={retry} />
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>
                {data.filter
                  ? `No ${AUTOMATION_STATUS_LABELS[data.filter].toLowerCase()} emails.`
                  : 'No emails have been prepared yet.'}
              </p>
            )}
          </section>
        </>
      )}
    </section>
  );
}
