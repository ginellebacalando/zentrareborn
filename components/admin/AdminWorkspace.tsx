'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import useSWR, { mutate as refreshCache } from 'swr';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowUpRight,
  Search,
  Plus,
  X,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
} from 'lucide-react';
import { displayStatuses } from '@/lib/admin/dashboard-status';
import { bookingPagePath, rememberListPosition, restoreListPosition } from './booking-links';
import { Badge, enumLabel } from './AdminBadge';
import AdminOverviewSections from './AdminOverviewSections';
import TeamPanel from './TeamPanel';
import LoadingSkeleton from './LoadingSkeleton';
import AnalyticsOverview from './AnalyticsOverview';
import SystemSettingsForm from './SystemSettingsForm';
import AdminPageHeader from './AdminPageHeader';
import ServicesPackages from './ServicesPackages';
import DashboardGreeting from './DashboardGreeting';
import DashboardOverview from './DashboardOverview';
import BookingRegister, { AttentionCallout, type StatusView } from './BookingRegister';
import BookingCalendar from './BookingCalendar';
import { useAdminDate } from './AdminPreferencesProvider';
import { BookingForm, SettingsForm, ProfileForm } from './Forms';
import { adminPageLabel } from './navigation';
import type { AdminData, Booking, Notice } from './types';
import { canDo } from '@/lib/admin/permissions';
import styles from './admin.module.css';
import { Button, IconButton } from '@/components/shared/Button';

/** List filters kept in the address, so "← Bookings" returns to the same list. */
const LIST_FILTERS = ['q', 'approval', 'reservation', 'from', 'to', 'page'] as const;
/** Search filters after a short pause instead of a Search button. */
const SEARCH_DELAY_MS = 300;

/*
 * Page headers (docs/admin-design.md): every page shows its title, equal to the sidebar label. A
 * short line follows only when it adds a fact staff need on that page; descriptions that only
 * restate the page's purpose were removed in the November 2026 redesign.
 */
const contexts: Record<string, string> = {
  calendar: 'All times are Manila time.',
};
const PAGE_SIZE = 50;

export default function AdminWorkspace({
  section,
  role,
  adminName = '',
}: {
  section: string;
  /** The signed-in role; what it may do comes from lib/admin/permissions.ts. */
  role: string;
  adminName?: string;
}) {
  const canChangeSettings = canDo(role, 'change-settings');
  const canRunAutomation = canDo(role, 'run-automation');
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventDate = useAdminDate();
  const filterFieldsId = useId();
  const recordSearchRef = useRef<HTMLInputElement>(null);
  const listRestored = useRef(false);
  const keepsFilters = ['bookings', 'payments', 'contracts'].includes(section);
  const [error, setError] = useState(''),
    [success, setSuccess] = useState(''),
    [busy, setBusy] = useState(false),
    [create, setCreate] = useState(false),
    [inquiry, setInquiry] = useState<AdminData['inquiry']>();
  // List filters start from the address, so returning from a booking restores them.
  const [filters, setFilters] = useState<Record<string, string>>(() => {
      const initial: Record<string, string> = {};
      if (keepsFilters)
        for (const key of LIST_FILTERS) {
          const value = searchParams.get(key);
          if (value) initial[key] = value;
        }
      return initial;
    }),
    [query, setQuery] = useState(() => (keepsFilters ? (searchParams.get('q') ?? '') : '')),
    [filtersOpen, setFiltersOpen] = useState(false),
    // Dashboard status cards link here with ?status=request|pending|confirmed|cancelled.
    [statusView, setStatusView] = useState<StatusView>(() => {
      if (section !== 'bookings') return 'all';
      const status = searchParams.get('status');
      return displayStatuses.find((value) => value === status) ?? 'all';
    });
  const onCalendarMonth = useCallback(
    (from: string, to: string) =>
      setFilters((v) => (v.from === from && v.to === to ? v : { ...v, from, to, page: '1' })),
    [],
  );
  const {
    data,
    error: loadError,
    isLoading: loading,
    isValidating,
    mutate: load,
  } = useSWR<AdminData>(
    section === 'services' ? null : `/api/admin/${section}?${new URLSearchParams(filters)}`,
    async (url: string) => {
      const response = await fetch(url, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to load admin data.');
      return body;
    },
    { keepPreviousData: true, shouldRetryOnError: false },
  );
  const visibleError = error || loadError?.message;
  // Search filters after a short pause; the list keeps its other filters.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) => {
        const q = query.trim();
        if ((current.q ?? '') === q) return current;
        const next: Record<string, string> = { ...current, page: '1' };
        if (q) next.q = q;
        else delete next.q;
        return next;
      });
    }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [query]);
  // The filters and status view live in the address (replaced, not added to the history).
  useEffect(() => {
    if (!keepsFilters) return;
    // Only the filter keys change; links such as ?booking=<id> or ?inquiry=<id> keep theirs.
    const params = new URLSearchParams(window.location.search);
    for (const key of LIST_FILTERS) {
      const value = filters[key];
      if (value && !(key === 'page' && value === '1')) params.set(key, value);
      else params.delete(key);
    }
    if (section === 'bookings') {
      if (statusView !== 'all') params.set('status', statusView);
      else params.delete('status');
    }
    const search = params.toString();
    const next = `${window.location.pathname}${search ? `?${search}` : ''}`;
    if (next !== `${window.location.pathname}${window.location.search}`)
      window.history.replaceState(window.history.state, '', next);
  }, [filters, statusView, section, keepsFilters]);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('inquiry');
    if (section === 'bookings' && id) {
      const controller = new AbortController();
      fetch(`/api/admin/bookings?inquiry=${encodeURIComponent(id)}`, {
        signal: controller.signal,
      })
        .then(async (r) => {
          const body = await r.json();
          if (!r.ok) throw new Error(body.error);
          setCreate(true);
          setInquiry(body.inquiry);
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        });
      return () => controller.abort();
    }
  }, [section]);
  // A link such as /admin/bookings?booking=<id> (Dashboard "Coming up") opens the booking's page.
  useEffect(() => {
    if (section !== 'bookings') return;
    const id = new URLSearchParams(window.location.search).get('booking');
    if (!id) return;
    const controller = new AbortController();
    fetch(`/api/admin/bookings?id=${encodeURIComponent(id)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Unable to load booking.');
        router.replace(bookingPagePath(body.booking.reference));
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : 'Unable to load booking.');
      });
    return () => controller.abort();
  }, [section, router]);
  // Back from a booking: the list scrolls to where staff left it, once its rows are loaded.
  useEffect(() => {
    if (!data || listRestored.current) return;
    listRestored.current = true;
    restoreListPosition();
  }, [data]);
  async function mutate(
    module: string,
    payload: unknown,
    options: { inlineErrors?: boolean } = {},
  ) {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const r = await fetch(`/api/admin/${module}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || 'Unable to save.');
      setSuccess('Saved. The activity history has been updated.');
      if (body.signInAgain) {
        router.replace('/admin');
        router.refresh();
        return;
      }
      // A new request opens on its own page.
      if (body.id && create) {
        const r = await fetch(`/api/admin/bookings?id=${encodeURIComponent(body.id)}`, {
          cache: 'no-store',
        });
        const detail = await r.json();
        if (r.ok) router.push(bookingPagePath(detail.booking.reference));
      }
      setCreate(false);
      await load();
      if (['bookings', 'payments'].includes(module))
        void refreshCache(
          (key) => typeof key === 'string' && key.startsWith('/api/admin/analytics?'),
        );
      if (module === 'profile') router.refresh();
    } catch (e) {
      if (!options.inlineErrors) setError(e instanceof Error ? e.message : 'Unable to save.');
      throw e;
    } finally {
      setBusy(false);
    }
  }
  // Each booking opens on its own page; Payments and Agreements open on their tab.
  function openBooking(b: Booking) {
    rememberListPosition(b.reference);
    router.push(
      bookingPagePath(
        b.reference,
        section === 'payments' ? 'payments' : section === 'contracts' ? 'agreements' : undefined,
      ),
    );
  }
  function filter(key: string, value: string) {
    setFilters((v) => ({ ...v, page: '1', [key]: value }));
  }
  const isList = ['bookings', 'payments', 'contracts', 'calendar'].includes(section);
  const advancedFilterCount = ['approval', 'reservation', 'from', 'to'].filter(
    (key) => filters[key],
  ).length;
  const refreshButton = (
    <IconButton
      type="button"
      variant="secondary"
      label="Refresh"
      icon={<RefreshCw aria-hidden="true" />}
      onClick={() => {
        if (section === 'services')
          void refreshCache(
            (key) => typeof key === 'string' && key.startsWith('/api/admin/services?'),
          );
        else void load();
        if (section === 'settings') void refreshCache('/api/admin/preferences');
      }}
      disabled={loading}
    />
  );
  // Team and Settings put their status and main action in the header themselves.
  const ownHeader = section === 'settings' || (section === 'team' && Boolean(data));
  return (
    <>
      {!ownHeader && (
        <AdminPageHeader
          title={adminPageLabel(section)}
          intro={section === 'dashboard' ? <DashboardGreeting name={adminName} /> : undefined}
          status={contexts[section]}
          actions={
            <>
              {refreshButton}
              {section === 'bookings' && (
                <Button
                  type="button"
                  variant={create ? 'secondary' : 'primary'}
                  icon={create ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />}
                  onClick={() => setCreate(!create)}
                >
                  {create ? 'Close form' : 'New request'}
                </Button>
              )}
            </>
          }
        />
      )}
      {visibleError && (
        <div className={styles.error} role="alert">
          {visibleError}
        </div>
      )}
      {success && (
        <div className={styles.success} role="status">
          {success}
        </div>
      )}
      {loading && !data && <LoadingSkeleton label="Loading secure workspace…" />}
      {create && data?.policy && (
        <BookingForm
          key={inquiry?.inquiryReference || 'new-request'}
          policy={data.policy}
          inquiry={inquiry}
          busy={busy}
          mutate={mutate}
        />
      )}
      {section === 'bookings' && data?.bookings && (
        <AttentionCallout
          bookings={data.bookings}
          partial={(data.total ?? 0) > data.bookings.length}
          statusView={statusView}
          onStatusView={setStatusView}
        />
      )}
      {isList && (
        <>
          {/* The Calendar has its own toolbar (BookingCalendar). */}
          {section !== 'calendar' && (
            <form
              className={styles.toolbar}
              role="search"
              onSubmit={(event) => {
                // Enter applies the search at once; otherwise it follows typing after a pause.
                event.preventDefault();
                filter('q', query.trim());
              }}
              aria-label="Search and filter records"
            >
              <div className={styles.toolbarRow}>
                <label className={styles.searchBox}>
                  <span className={styles.srOnly}>Search records</span>
                  <Search size={16} aria-hidden="true" />
                  <input
                    aria-label="Search by reference, client, email, event or package"
                    ref={recordSearchRef}
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search reference, client or event"
                  />
                </label>
                <Button
                  type="button"
                  variant="secondary"
                  className={styles.filterToggle}
                  aria-expanded={filtersOpen}
                  aria-controls={filterFieldsId}
                  onClick={() => setFiltersOpen((open) => !open)}
                >
                  <SlidersHorizontal size={16} aria-hidden="true" />
                  Filter
                  {advancedFilterCount > 0 && (
                    <span className={styles.filterCount}>
                      {advancedFilterCount}
                      <span className={styles.srOnly}> active</span>
                    </span>
                  )}
                  <ChevronDown size={16} aria-hidden="true" />
                </Button>
                {(filters.q || advancedFilterCount > 0) && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setFilters({});
                      setQuery('');
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
              <div id={filterFieldsId} className={styles.filterFields} hidden={!filtersOpen}>
                <label>
                  Approval
                  <select
                    value={filters.approval || ''}
                    onChange={(event) => filter('approval', event.target.value)}
                  >
                    <option value="">All approvals</option>
                    {['PENDING', 'APPROVED', 'REJECTED'].map((value) => (
                      <option key={value} value={value}>
                        {enumLabel(value)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Reservation
                  <select
                    value={filters.reservation || ''}
                    onChange={(event) => filter('reservation', event.target.value)}
                  >
                    <option value="">All reservations</option>
                    {['REQUESTED', 'CONFIRMED', 'CANCELLED', 'COMPLETED'].map((value) => (
                      <option key={value} value={value}>
                        {enumLabel(value)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Event date from
                  <input
                    type="date"
                    value={filters.from || ''}
                    onChange={(event) => filter('from', event.target.value)}
                  />
                </label>
                <label>
                  Event date through
                  <input
                    type="date"
                    value={filters.to || ''}
                    onChange={(event) => filter('to', event.target.value)}
                  />
                </label>
              </div>
            </form>
          )}
          {data?.bookings &&
            (section === 'calendar' ? (
              <BookingCalendar
                bookings={data.bookings}
                visits={data.visits ?? []}
                query={query}
                onQuery={setQuery}
                onMonth={onCalendarMonth}
                onPhotoChanged={() => load()}
                onChanged={() => load()}
              />
            ) : (
              <BookingRegister
                bookings={data.bookings}
                total={data.total ?? data.bookings.length}
                section={section}
                loading={loading || isValidating}
                filtered={!!filters.q || advancedFilterCount > 0}
                statusView={statusView}
                onStatusView={setStatusView}
                onOpen={openBooking}
              />
            ))}
          {/* Paging appears only when there is more than one page. */}
          {!!data?.total && (data.total > PAGE_SIZE || (data.page ?? 1) > 1) && (
            <div className={styles.pagination}>
              <span>
                Page {data.page} · {data.total} records · {PAGE_SIZE} per page
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={(data.page ?? 1) <= 1 || loading}
                onClick={() =>
                  setFilters((v) => ({
                    ...v,
                    page: String((data.page ?? 1) - 1),
                  }))
                }
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={(data.page ?? 1) * PAGE_SIZE >= data.total || loading}
                onClick={() =>
                  setFilters((v) => ({
                    ...v,
                    page: String((data.page ?? 1) + 1),
                  }))
                }
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
      {data && section === 'dashboard' && (
        <DashboardOverview data={data} busy={busy} mutate={mutate} />
      )}
      {data?.analyticsReport && section === 'analytics' && (
        <AnalyticsOverview
          report={data.analyticsReport}
          portfolio={data.analytics}
          busy={isValidating}
          failed={!!loadError}
          onChange={(period, date) => setFilters({ period, date })}
        />
      )}
      {data && section === 'team' && (
        <TeamPanel
          members={data.members ?? []}
          canManage={Boolean(data.canManage)}
          onChanged={load}
          refresh={refreshButton}
        />
      )}
      {data && section === 'inquiries' && (
        <AdminOverviewSections
          section={section}
          data={data}
          loading={loading}
          onPage={(page) => filter('page', String(page))}
        />
      )}
      {section === 'settings' && <SystemSettingsForm refresh={refreshButton} />}
      {section === 'services' && <ServicesPackages />}
      {data && section === 'settings' && data.policy && (
        <SettingsForm
          policy={data.policy}
          owner={canChangeSettings}
          configured={!!data.notificationConfigured}
          busy={busy}
          mutate={mutate}
        />
      )}
      {data?.user && section === 'profile' && (
        <ProfileForm user={data.user} busy={busy} mutate={mutate} />
      )}
      {data && section === 'logs' && (
        <>
          <div className={styles.card}>
            <div className={styles.cardHeading}>
              <h2>Recent entries</h2>
              <span>Read-only · latest 50</span>
            </div>
            <form
              className={styles.filters}
              onSubmit={(e) => {
                e.preventDefault();
                filter('q', query);
              }}
            >
              <label>
                Search entries
                <input
                  type="search"
                  aria-label="Search log descriptions"
                  placeholder="Search descriptions…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <label>
                Module
                <select
                  aria-label="Log module"
                  value={filters.module || ''}
                  onChange={(e) => filter('module', e.target.value)}
                >
                  <option value="">All modules</option>
                  {[
                    'Bookings',
                    'Contracts',
                    'Payments',
                    'Settings',
                    'Profile',
                    'Authentication',
                    'Notifications',
                    'Services & Packages',
                  ].map((v) => (
                    // Values match stored audit modules; the label follows the sidebar name.
                    <option key={v} value={v}>
                      {v === 'Services & Packages' ? 'Packages' : v}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" variant="secondary">
                Apply
              </Button>
            </form>
            <div className={styles.tableWrap} role="region" aria-label="Log entries">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Time</th>
                    <th scope="col">Actor</th>
                    <th scope="col">Module / action</th>
                    <th scope="col">Description</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.logs?.map((log) => (
                    <tr key={log.id}>
                      <td>{eventDate(log.timestamp)}</td>
                      <td>
                        {log.userName}
                        <small>{enumLabel(log.userRole)}</small>
                      </td>
                      <td>
                        {log.module}
                        <small>{enumLabel(log.action)}</small>
                      </td>
                      <td>{log.description}</td>
                      <td>
                        <Badge value={log.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.logs?.length && (
              <div className={styles.empty}>
                <h3>No entries yet</h3>
                <p>Actions appear here after they are saved.</p>
              </div>
            )}
            <div className={styles.pagination}>
              <span>
                {data.total} entries · page {data.page}
              </span>
              <Button
                type="button"
                variant="secondary"
                disabled={(data.page ?? 1) <= 1}
                onClick={() => filter('page', String((data.page ?? 1) - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={(data.page ?? 1) * PAGE_SIZE >= (data.total ?? 0)}
                onClick={() =>
                  setFilters((v) => ({
                    ...v,
                    page: String((data.page ?? 1) + 1),
                  }))
                }
              >
                Next
              </Button>
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardHeading}>
              <div>
                <h2>Notification outbox</h2>
                <p>
                  Queued is not sent. Accepted is not proof of delivery. Interrupted sends require
                  review.
                </p>
              </div>
              {canRunAutomation && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void mutate('notifications', {}).catch(() => {})}
                >
                  Process queued notices
                </Button>
              )}
            </div>
            {(data.outbox as Notice[] | undefined)?.map((n) => (
              <details key={n.id} className={styles.noticeRow}>
                <summary>
                  <span>
                    {n.subject}
                    <small>
                      {eventDate(n.createdAt)} · {n.attempts} attempts
                    </small>
                  </span>
                  <Badge value={n.status} />
                </summary>
                {n.lastError && <p className={styles.error}>{n.lastError}</p>}
                <pre className={styles.preview}>{n.body}</pre>
              </details>
            ))}
            {!data.outbox?.length && (
              <div className={styles.empty}>
                <h3>No queued notices</h3>
                <p>
                  Booking decisions and cash receipts automatically create standardized notices.
                </p>
              </div>
            )}
          </div>
          <div className={styles.card}>
            <div className={styles.cardHeading}>
              <div>
                <h2>Automation jobs</h2>
                <p>Built-in emails, reminders and digests, with their actual status.</p>
              </div>
              <Link href="/admin/automation">
                Open Automation <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>
            {/* The API keeps its earlier field names (workflows / workflowName) for compatibility. */}
            {data.workflows?.map((job) => (
              <div className={styles.row} key={job.id}>
                <span className={styles.grow}>
                  <strong>{job.workflowName}</strong>
                  <small>
                    Queued {eventDate(job.createdAt)}
                    {job.completedAt ? ` · sent ${eventDate(job.completedAt)}` : ''}
                  </small>
                </span>
                <Badge value={job.status} />
              </div>
            ))}
            {!data.workflows?.length && (
              <div className={styles.empty}>
                <h3>No automation job has run yet.</h3>
                <p>Jobs appear here after the first email, reminder or digest is prepared.</p>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
