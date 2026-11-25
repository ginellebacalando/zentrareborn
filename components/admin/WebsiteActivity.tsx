'use client';

import { useState, useSyncExternalStore, type FocusEvent, type ReactNode } from 'react';
import Link from 'next/link';
import useSWR, { mutate as revalidateCache, type SWRConfiguration } from 'swr';
import {
  ArrowUpRight,
  BotMessageSquare,
  CalendarPlus,
  Globe,
  MessageCircleQuestionMark,
  MessageSquare,
  MessageSquareQuote,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { displayStatuses, type DisplayStatus } from '@/lib/admin/dashboard-status';
import {
  WEBSITE_ACTIVITY_POLL_MS,
  activityAge,
  activityNewerThan,
  newActivityMessage,
  type WebsiteActivityFeed,
  type WebsiteActivityItem,
  type WebsiteActivityKind,
  type WebsiteActivityStatus,
} from '@/lib/admin/website-activity-feed';
import { StatusChip } from './BookingStatus';
import { useAdminDate, useAdminPreferences } from './AdminPreferencesProvider';
import admin from './admin.module.css';
import styles from './WebsiteActivity.module.css';

const WEBSITE_ACTIVITY_ENDPOINT = '/api/admin/website-activity';
const CLOCK_STEP_MS = 30_000;
/** Sign-in and permission failures do not fix themselves, so they are not retried. */
const FINAL_STATUSES = new Set([401, 403, 404]);

const kindIcons: Record<WebsiteActivityKind, LucideIcon> = {
  booking: CalendarPlus,
  inquiry: MessageSquare,
  handoff: BotMessageSquare,
  testimony: MessageSquareQuote,
  question: MessageCircleQuestionMark,
};

class ActivityLoadError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ActivityLoadError';
    this.status = status;
  }
}

/** The feed plus the server-minus-browser clock difference, so ages follow the server's clock. */
type LoadedFeed = WebsiteActivityFeed & { clockOffsetMs: number };

function isFeed(value: unknown): value is WebsiteActivityFeed {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'items' in value &&
    Array.isArray(value.items) &&
    'generatedAt' in value &&
    typeof value.generatedAt === 'string',
  );
}

async function loadActivity(url: string): Promise<LoadedFeed> {
  const response = await fetch(url, { cache: 'no-store' });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !isFeed(body)) {
    const message =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : 'The server sent an unexpected response. Use Refresh to try again.';
    throw new ActivityLoadError(message, response.status);
  }
  return { ...body, clockOffsetMs: Date.parse(body.generatedAt) - Date.now() };
}

const pollingOptions: SWRConfiguration<LoadedFeed, Error> = {
  // SWR polls only while the tab is visible and checks again when the tab or window regains focus.
  refreshInterval: WEBSITE_ACTIVITY_POLL_MS,
  shouldRetryOnError: (error) =>
    !(error instanceof ActivityLoadError && FINAL_STATUSES.has(error.status)),
  // SWR pauses polling after a failure; keep checking at the polling pace instead of backing off.
  onErrorRetry: (_error, _key, _config, revalidate, options) => {
    window.setTimeout(() => void revalidate(options), WEBSITE_ACTIVITY_POLL_MS);
  },
};

/** Lets dashboard actions that change the feed (testimony moderation) refresh it right away. */
export function refreshWebsiteActivity() {
  return revalidateCache(WEBSITE_ACTIVITY_ENDPOINT);
}

function subscribeToClock(onChange: () => void) {
  const timer = window.setInterval(onChange, CLOCK_STEP_MS);
  document.addEventListener('visibilitychange', onChange);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onChange);
  };
}
/** Rounded to the step so React reads the same snapshot until the next tick. */
const readClock = () => Math.floor(Date.now() / CLOCK_STEP_MS) * CLOCK_STEP_MS;
/** Rows render only after the feed loads in the browser, so the server value is never shown. */
const readServerClock = () => 0;

const isDisplayStatus = (tone: WebsiteActivityStatus['tone']): tone is DisplayStatus =>
  (displayStatuses as readonly string[]).includes(tone);

function ActivityStatusTag({ status }: { status: WebsiteActivityStatus }) {
  if (isDisplayStatus(status.tone)) return <StatusChip status={status.tone} />;
  return (
    <span
      className={`${admin.badge} ${status.tone === 'attention' ? admin.bad : admin.neutral} ${styles.tag}`}
    >
      {status.label}
    </span>
  );
}

function ActivityRow({
  item,
  age,
  exactTime,
}: {
  item: WebsiteActivityItem;
  age: string;
  exactTime: string;
}) {
  const Icon = kindIcons[item.kind];
  const label: ReactNode = (
    <>
      <span className={styles.text}>
        <strong>{item.title}</strong> · {item.summary}
      </span>
      <ArrowUpRight className={styles.arrow} size={16} aria-hidden="true" />
    </>
  );
  return (
    <li className={styles.item}>
      <span className={styles.icon} aria-hidden="true">
        <Icon size={18} strokeWidth={1.75} />
      </span>
      <div className={styles.body}>
        {item.href.startsWith('#') ? (
          // Same-page anchor: native fragment navigation also moves keyboard focus to the card.
          <a href={item.href} className={styles.link}>
            {label}
          </a>
        ) : (
          <Link href={item.href} className={styles.link}>
            {label}
          </Link>
        )}
        <div className={styles.meta}>
          {item.status && <ActivityStatusTag status={item.status} />}
          <time className={styles.time} dateTime={item.occurredAt} title={exactTime}>
            {age}
            <span className={admin.srOnly}> ({exactTime})</span>
          </time>
        </div>
      </div>
    </li>
  );
}

type Announcement = { shownNewest: string | null; failed: boolean; message: string };

/**
 * Dashboard panel listing what visitors did on the public site, newest first. It polls the admin
 * API every minute while the tab is visible (no realtime service) and never moves focus.
 */
export default function WebsiteActivity() {
  const formatExactTime = useAdminDate();
  const { settings } = useAdminPreferences();
  const timeZone = settings.admin.localization.timezone;
  const clock = useSyncExternalStore(subscribeToClock, readClock, readServerClock);
  const { data, error, mutate } = useSWR<LoadedFeed, Error>(
    WEBSITE_ACTIVITY_ENDPOINT,
    loadActivity,
    pollingOptions,
  );
  const [heldRows, setHeldRows] = useState<WebsiteActivityItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [announcement, setAnnouncement] = useState<Announcement>({
    shownNewest: null,
    failed: false,
    message: '',
  });

  const latestRows = data?.items;
  const rows = heldRows ?? latestRows ?? [];
  const now = clock + (data?.clockOffsetMs ?? 0);
  const failed = Boolean(error);

  // Announce politely and sparingly: newly shown activity, or the start of a failure. Routine
  // checks and changing ages stay silent; the first load is not announced.
  const shownNewest = data ? (rows[0]?.occurredAt ?? '') : null;
  if (shownNewest !== announcement.shownNewest || failed !== announcement.failed) {
    let message = announcement.message;
    if (failed && !announcement.failed)
      message = data
        ? 'Website activity could not be refreshed.'
        : 'Website activity could not be loaded.';
    else if (!failed && announcement.failed) message = '';
    if (announcement.shownNewest !== null && shownNewest) {
      const fresh = activityNewerThan(rows, announcement.shownNewest);
      if (fresh.length) message = newActivityMessage(fresh);
    }
    setAnnouncement({ shownNewest, failed, message });
  }

  // While keyboard focus is inside the list its rows stay still, so a refresh can never remove the
  // focused link. The newest rows appear as soon as focus leaves the list.
  function holdRows() {
    setHeldRows((current) => current ?? latestRows ?? null);
  }
  function releaseRows(event: FocusEvent<HTMLUListElement>) {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    // Switching windows blurs the link without moving focus; keep holding until it returns.
    if (!next && !document.hasFocus()) return;
    setHeldRows(null);
  }

  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await mutate();
    } finally {
      setRefreshing(false);
    }
  }

  const updated = data ? activityAge(data.generatedAt, now, timeZone) : '';
  return (
    <section className={`${admin.card} ${styles.panel}`} aria-labelledby="website-activity-title">
      <div className={admin.cardHeading}>
        <div>
          <h2 id="website-activity-title">Website activity</h2>
          <p>
            Newest booking requests, inquiries, testimonies to review and questions Zeni could not
            answer on the public site.
          </p>
        </div>
        <button
          type="button"
          className={`${admin.secondary} ${admin.quiet}`}
          aria-disabled={refreshing || undefined}
          onClick={() => void refresh()}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Refresh<span className={admin.srOnly}> website activity</span>
        </button>
      </div>
      <p className={admin.srOnly} role="status">
        {announcement.message}
      </p>
      {error && (
        <div className={admin.error}>
          {data
            ? `Could not check for new activity, so this list may be out of date (updated ${updated}). Use Refresh to try again.`
            : `Website activity could not be loaded. ${
                error instanceof ActivityLoadError
                  ? error.message
                  : 'Check the connection, then use Refresh to try again.'
              }`}
        </div>
      )}
      {!data && !error && <p className={admin.help}>Loading website activity…</p>}
      {data && rows.length === 0 && (
        <div className={admin.empty}>
          <Globe size={28} aria-hidden="true" />
          <h3>No website activity yet</h3>
          <p>
            Booking requests, inquiries, testimonies to review and questions Zeni could not answer
            appear here as visitors send them.
          </p>
        </div>
      )}
      {rows.length > 0 && (
        <ul className={styles.list} onFocus={holdRows} onBlur={releaseRows}>
          {rows.map((item) => (
            <ActivityRow
              key={item.id}
              item={item}
              age={activityAge(item.occurredAt, now, timeZone)}
              exactTime={formatExactTime(item.occurredAt)}
            />
          ))}
        </ul>
      )}
      {data && (
        <p className={`${admin.help} ${styles.footnote}`}>
          Updated {updated}. Checks for new activity every minute while this page is open.
          {!data.zeniQuestionsAvailable &&
            ' Zeni questions are not shown because their log is not installed on this database.'}
        </p>
      )}
    </section>
  );
}
