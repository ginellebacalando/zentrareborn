'use client';
import { useRef, useState } from 'react';
import useSWR from 'swr';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CircleSlash,
  Clock3,
  LoaderCircle,
  Lock,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  AUTOMATION_STATUSES,
  AUTOMATION_STATUS_LABELS,
  isAutomationStatus,
  type AutomationJobView,
  type AutomationOverview,
  type AutomationStatus,
} from '@/lib/automation/catalog';
import type { AutomationSummary } from '@/lib/automation/automations';
import { enumLabel } from './AdminBadge';
import AdminPageHeader from './AdminPageHeader';
import styles from './AutomationPanel.module.css';
import { Button, IconButton } from '@/components/shared/Button';

/**
 * Automation (super administrators): every automation as one line, "When [trigger] → Do
 * [action]", with its switch, its state and when it last ran (lib/automation/automations.ts).
 * Details, numbers and that automation's recent emails open in a side panel; the full email log
 * stays folded away at the foot of the page.
 */
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
const dateTime = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  dateStyle: 'medium',
  timeStyle: 'short',
});
const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

function formatDate(value: string | null) {
  return value ? `${dateTime.format(new Date(value))} PHT` : 'Not scheduled';
}

/** "A booking request arrives" reads "When a booking request arrives" after its label. */
function lowerFirst(text: string) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function ago(value: string | null) {
  if (!value) return 'Not run yet';
  const minutes = Math.round((new Date(value).getTime() - Date.now()) / 60000);
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 48) return relative.format(hours, 'hour');
  return relative.format(Math.round(hours / 24), 'day');
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
    return <span className={`${styles.badge} ${styles.toneNeutral}`}>{enumLabel(status)}</span>;
  const Icon = STATUS_ICONS[status];
  return (
    <span className={`${styles.badge} ${STATUS_TONES[status]}`}>
      <Icon size={16} aria-hidden="true" />
      {AUTOMATION_STATUS_LABELS[status]}
    </span>
  );
}

/** The automation's state in a word: on, off, failing or waiting for email setup. */
/** Only what needs attention gets a badge; the switch or "Always on" already says on or off. */
function AutomationState({ automation, mail }: { automation: AutomationSummary; mail: boolean }) {
  if (!automation.enabled) return null;
  if (automation.failed)
    return (
      <span className={`${styles.badge} ${styles.toneDanger}`}>
        <AlertTriangle size={16} aria-hidden="true" />
        {automation.failed} failed
      </span>
    );
  if (!mail && automation.waiting)
    return (
      <span className={`${styles.badge} ${styles.toneWaiting}`}>
        <Clock3 size={16} aria-hidden="true" />
        {automation.waiting} waiting
      </span>
    );
  return null;
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
          <dt>{job.sentAt ? 'Sent' : 'Created'}</dt>
          <dd>{formatDate(job.sentAt ?? job.createdAt)}</dd>
        </div>
        {job.status === 'QUEUED' && (
          <div>
            <dt>Next attempt</dt>
            <dd>{formatDate(job.nextAttemptAt)}</dd>
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
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => onRetry(job)}
            aria-label={`Retry ${job.label}${job.recipient ? ` to ${job.recipient}` : ''}`}
          >
            <RotateCcw size={16} aria-hidden="true" />
            Retry
          </Button>
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
  const [openKey, setOpenKey] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDialogElement>(null);
  const { data, error, isLoading, isValidating, mutate } = useSWR<AutomationOverview>(
    filter ? `${ENDPOINT}?status=${filter}` : ENDPOINT,
    load,
    { keepPreviousData: true, shouldRetryOnError: false },
  );

  async function act(
    payload:
      { op: 'run' } | { op: 'retry'; id: string } | { op: 'switch'; key: string; enabled: boolean },
  ) {
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

  function openDetails(key: string) {
    setOpenKey(key);
    sheetRef.current?.showModal();
  }

  const loadError = error instanceof Error ? error.message : '';
  const automations = data?.automations ?? [];
  const opened = automations.find((automation) => automation.key === openKey) ?? null;
  const openedJobs = opened
    ? (data?.jobs ?? []).filter((job) => opened.events.includes(job.event))
    : [];
  const failing = automations.reduce((sum, automation) => sum + automation.failed, 0);
  const off = automations.filter((automation) => !automation.enabled).length;

  const statusLine = data
    ? [
        data.emailConfigured ? 'Email is on' : 'Email is not set up yet',
        data.lastRun
          ? `last run ${ago(data.lastRun.at)} (${data.lastRun.sent} sent, ${data.lastRun.failed} failed)`
          : 'no scheduled run recorded yet',
        failing ? `${failing} failed ${failing === 1 ? 'email needs' : 'emails need'} a look` : '',
        off ? `${off} turned off` : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  function row(automation: AutomationSummary) {
    return (
      <li key={automation.key} className={styles.row}>
        <button
          type="button"
          className={styles.rowMain}
          onClick={() => openDetails(automation.key)}
          aria-haspopup="dialog"
        >
          <span className={styles.rule}>
            <span className={styles.when}>
              <span className={styles.ruleLabel}>When</span> {lowerFirst(automation.when)}
            </span>
            <ArrowRight size={16} className={styles.ruleArrow} aria-hidden="true" />
            <span className={styles.do}>
              <span className={styles.ruleLabel}>Do</span> {lowerFirst(automation.action)}
            </span>
          </span>
          <span className={styles.rowMeta}>
            <AutomationState automation={automation} mail={Boolean(data?.emailConfigured)} />
            <span className={styles.lastRan}>
              {automation.lastRanAt ? `Last ran ${ago(automation.lastRanAt)}` : 'Not run yet'}
            </span>
          </span>
          <ChevronRight size={16} className={styles.rowChevron} aria-hidden="true" />
        </button>
        {automation.canSwitchOff ? (
          <button
            type="button"
            role="switch"
            aria-checked={automation.enabled}
            aria-label={`${automation.action} when ${automation.when.toLowerCase()}`}
            className={styles.switch}
            disabled={busy}
            onClick={() =>
              void act({ op: 'switch', key: automation.key, enabled: !automation.enabled })
            }
          >
            <span className={styles.switchTrack} aria-hidden="true">
              <span className={styles.switchThumb} />
            </span>
            <span className={styles.switchText}>{automation.enabled ? 'On' : 'Off'}</span>
          </button>
        ) : (
          <span className={styles.always} data-tip={automation.essential}>
            <Lock size={16} aria-hidden="true" />
            Always on
          </span>
        )}
      </li>
    );
  }

  return (
    <section className={styles.panel} aria-labelledby="automation-title" aria-busy={busy}>
      <AdminPageHeader
        title="Automation"
        titleId="automation-title"
        status={statusLine ? `${statusLine}.` : undefined}
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              icon={<RefreshCw aria-hidden="true" />}
              loading={isValidating && !busy}
              loadingLabel="Refreshing…"
              onClick={() => void mutate()}
            >
              Refresh
            </Button>
            <Button
              type="button"
              variant="primary"
              icon={<Play aria-hidden="true" />}
              loading={busy}
              loadingLabel="Running due jobs…"
              onClick={() => void act({ op: 'run' })}
            >
              Run due jobs now
            </Button>
          </>
        }
      />

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
          <LoaderCircle size={20} aria-hidden="true" className={styles.spin} />
          Loading automations…
        </p>
      )}

      {data && !data.emailConfigured && (
        <p className={styles.alert}>
          Emails wait in the queue until sending is set up: add SMTP_USER (the Gmail address) and
          SMTP_PASSWORD (a Gmail App Password) in Vercel under Settings, Environment Variables, then
          redeploy.
        </p>
      )}

      {data && (
        <>
          <section className={styles.card} aria-labelledby="automation-instant">
            <h2 id="automation-instant">When something happens</h2>
            <ul className={styles.rows}>
              {automations.filter((a) => a.timing === 'instant').map(row)}
            </ul>
          </section>
          <section className={styles.card} aria-labelledby="automation-scheduled">
            <h2 id="automation-scheduled">On a schedule</h2>
            <p className={styles.sectionIntro}>Checked every 10 minutes.</p>
            <ul className={styles.rows}>
              {automations.filter((a) => a.timing === 'scheduled').map(row)}
            </ul>
          </section>

          <details className={`${styles.card} ${styles.log}`}>
            <summary>
              <span>
                <strong>Email log</strong>
                <span className={styles.sectionIntro}>
                  Latest 50 emails, addresses partly hidden. Failed ones can be retried.
                </span>
              </span>
              <ChevronRight size={16} className={styles.logChevron} aria-hidden="true" />
            </summary>
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
          </details>
        </>
      )}

      <dialog
        ref={sheetRef}
        className={styles.sheet}
        aria-labelledby="automation-sheet-title"
        onClose={() => setOpenKey(null)}
      >
        {opened && (
          <>
            <div className={styles.sheetHeading}>
              <div>
                <p className={styles.ruleLabel}>When {lowerFirst(opened.when)}</p>
                <h2 id="automation-sheet-title">{opened.action}</h2>
              </div>
              <IconButton
                type="button"
                label="Close"
                icon={<X aria-hidden="true" />}
                onClick={() => sheetRef.current?.close()}
              />
            </div>
            <div className={styles.sheetBody}>
              <p>{opened.details}</p>
              {opened.canSwitchOff ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={opened.enabled}
                  className={styles.switch}
                  disabled={busy}
                  onClick={() =>
                    void act({ op: 'switch', key: opened.key, enabled: !opened.enabled })
                  }
                >
                  <span className={styles.switchTrack} aria-hidden="true">
                    <span className={styles.switchThumb} />
                  </span>
                  <span className={styles.switchText}>
                    {opened.enabled ? 'On: emails go out' : 'Off: emails are skipped'}
                  </span>
                </button>
              ) : (
                <p className={styles.always}>
                  <Lock size={16} aria-hidden="true" />
                  Always on. {opened.essential}
                </p>
              )}
              <dl className={styles.sheetFacts}>
                <div>
                  <dt>Last ran</dt>
                  <dd>{opened.lastRanAt ? formatDate(opened.lastRanAt) : 'Not run yet'}</dd>
                </div>
                <div>
                  <dt>Sent</dt>
                  <dd>{opened.sent}</dd>
                </div>
                <div>
                  <dt>Waiting</dt>
                  <dd>{opened.waiting}</dd>
                </div>
                <div>
                  <dt>Failed</dt>
                  <dd>{opened.failed}</dd>
                </div>
              </dl>
              <h3>Recent emails</h3>
              {openedJobs.length ? (
                <ul className={styles.jobs}>
                  {openedJobs.map((job) => (
                    <JobItem key={job.id} job={job} busy={busy} onRetry={retry} />
                  ))}
                </ul>
              ) : (
                <p className={styles.empty}>None among the latest 50 emails.</p>
              )}
            </div>
          </>
        )}
      </dialog>
    </section>
  );
}
