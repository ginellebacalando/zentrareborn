'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import useSWR, { mutate as refreshCache } from 'swr';
import { useRouter } from 'next/navigation';
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
import BookingDetail from './BookingDetail';
import { Badge } from './AdminBadge';
import AdminOverviewSections from './AdminOverviewSections';
import AnalyticsOverview from './AnalyticsOverview';
import SystemSettingsForm from './SystemSettingsForm';
import ServicesPackages from './ServicesPackages';
import DashboardGreeting from './DashboardGreeting';
import DashboardOverview from './DashboardOverview';
import BookingRegister, { bookingsContext, type StatusView } from './BookingRegister';
import BookingCalendar from './BookingCalendar';
import { useAdminDate } from './AdminPreferencesProvider';
import { BookingForm, SettingsForm, ProfileForm } from './Forms';
import { adminPageLabel } from './navigation';
import type { AdminData, Booking, Notice } from './types';
import styles from './admin.module.css';

/*
 * Naming rules (plan section 20.3): the sidebar label is the only prominent module name. Each page
 * keeps an h1 equal to that label, visually hidden while the sidebar shows it, and a visible
 * context sentence that never repeats the module name.
 */
const contexts: Record<string, string> = {
  contracts: 'Prepare an accurate agreement from a verified booking and reviewed venue terms.',
  calendar:
    'Confirmed reservations secure dates; requests stay tentative. All times are in Manila.',
  inquiries: 'Website messages with event details, ready to review before preparing a request.',
  analytics: 'Income, balances, inquiry conversion, and the direction of the business.',
  team: 'Administrators who can sign in to the venue workspace.',
  payments: 'Record money actually received. Approval never marks a booking paid.',
  services: 'Event categories, prices, inclusions, and what clients can see.',
  logs: 'Read-only history and the actual status of notification processing.',
  profile: 'Manage your own details and password. Your role is controlled by the venue owner.',
  settings: 'Manage appearance, security, client access, communications, and localization.',
};
const PAGE_SIZE = 50;

export default function AdminWorkspace({
  section,
  owner,
  adminName = '',
}: {
  section: string;
  owner: boolean;
  adminName?: string;
}) {
  const router = useRouter();
  const eventDate = useAdminDate();
  const filterFieldsId = useId();
  const detailOpener = useRef<HTMLElement | null>(null);
  const recordSearchRef = useRef<HTMLInputElement>(null);
  const restoreDetailFocus = useRef(false);
  const [error, setError] = useState(''),
    [success, setSuccess] = useState(''),
    [busy, setBusy] = useState(false),
    [create, setCreate] = useState(false),
    [selected, setSelected] = useState<Booking | null>(null),
    [inquiry, setInquiry] = useState<AdminData['inquiry']>();
  const [filters, setFilters] = useState<Record<string, string>>({}),
    [query, setQuery] = useState(''),
    [filtersOpen, setFiltersOpen] = useState(false),
    // Dashboard status cards link here with ?status=request|pending|confirmed|cancelled. The board
    // renders only after client-side data loads, so reading the URL here cannot cause a hydration
    // mismatch.
    [statusView, setStatusView] = useState<StatusView>(() => {
      if (section !== 'bookings' || typeof window === 'undefined') return 'all';
      const status = new URLSearchParams(window.location.search).get('status');
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
  useEffect(() => {
    if (!selected && restoreDetailFocus.current) {
      const target = detailOpener.current?.isConnected
        ? detailOpener.current
        : recordSearchRef.current;
      target?.focus();
      restoreDetailFocus.current = false;
    }
  }, [selected]);
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
      if (body.id) {
        const r = await fetch(`/api/admin/bookings?id=${encodeURIComponent(body.id)}`, {
          cache: 'no-store',
        });
        const detail = await r.json();
        if (r.ok) setSelected(detail.booking);
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
  async function openBooking(b: Booking) {
    detailOpener.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setError('');
    try {
      const r = await fetch(`/api/admin/bookings?id=${encodeURIComponent(b.id)}`, {
        cache: 'no-store',
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error);
      setSelected(body.booking);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load booking.');
    }
  }
  function filter(key: string, value: string) {
    setFilters((v) => ({ ...v, page: '1', [key]: value }));
  }
  const isList = ['bookings', 'payments', 'contracts', 'calendar'].includes(section);
  const advancedFilterCount = ['approval', 'reservation', 'from', 'to'].filter(
    (key) => filters[key],
  ).length;
  const context =
    section === 'bookings' ? bookingsContext(data?.bookings, data?.total) : contexts[section];
  return (
    <>
      <div className={styles.pageHeading}>
        <div className={styles.pageIntro}>
          <h1 className={styles.pageTitle}>{adminPageLabel(section)}</h1>
          {section === 'dashboard' ? (
            <DashboardGreeting name={adminName} />
          ) : (
            context && <p className={styles.pageContext}>{context}</p>
          )}
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.secondary} ${styles.quiet}`}
            onClick={() => {
              if (section === 'services')
                void refreshCache(
                  (key) => typeof key === 'string' && key.startsWith('/api/admin/services?'),
                );
              else void load();
              if (section === 'settings') void refreshCache('/api/admin/preferences');
            }}
            disabled={loading}
            aria-label="Refresh current data"
          >
            <RefreshCw size={16} aria-hidden="true" />
            Refresh
          </button>
          {section === 'bookings' && (
            <button
              type="button"
              className={create ? styles.secondary : styles.primary}
              onClick={(event) => {
                detailOpener.current = event.currentTarget;
                setCreate(!create);
                setSelected(null);
              }}
            >
              {create ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
              {create ? 'Close form' : 'New request'}
            </button>
          )}
        </div>
      </div>
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
      {loading && !data && (
        <div className={styles.card} role="status">
          Loading secure workspace…
        </div>
      )}
      {create && data?.policy && (
        <BookingForm
          key={inquiry?.inquiryReference || 'new-request'}
          policy={data.policy}
          inquiry={inquiry}
          busy={busy}
          mutate={mutate}
        />
      )}
      {selected && (
        <BookingDetail
          key={selected.id}
          booking={selected}
          owner={owner}
          busy={busy}
          focus={section}
          policy={data?.policy}
          mutate={mutate}
          onClose={() => {
            restoreDetailFocus.current = true;
            setSelected(null);
          }}
        />
      )}
      {isList && (
        <>
          <form
            className={styles.filterPanel}
            onSubmit={(event) => {
              event.preventDefault();
              filter('q', query);
            }}
            aria-label="Search and filter records"
          >
            <div className={styles.searchRow}>
              <label className={styles.searchLabel}>
                Search records
                <span className={styles.searchField}>
                  <Search size={18} aria-hidden="true" />
                  <input
                    aria-label="Search by reference, client, email, event or package"
                    ref={recordSearchRef}
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Reference, client or event"
                  />
                </span>
              </label>
              <button type="submit" className={styles.primary}>
                Search
              </button>
              <button
                type="button"
                className={`${styles.secondary} ${styles.filterToggle}`}
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
              </button>
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
                    <option key={value}>{value}</option>
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
                    <option key={value}>{value}</option>
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
            {(filters.q || advancedFilterCount > 0) && (
              <div className={styles.filterSummary}>
                <p>
                  Showing {filters.q ? `matches for “${filters.q}”` : 'all matching records'}
                  {filters.approval ? ` · ${filters.approval.toLowerCase()}` : ''}
                  {filters.reservation ? ` · ${filters.reservation.toLowerCase()}` : ''}
                  {filters.from ? ` · from ${filters.from}` : ''}
                  {filters.to ? ` · through ${filters.to}` : ''}.
                </p>
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => {
                    setFilters({});
                    setQuery('');
                  }}
                >
                  Clear search and filters
                </button>
              </div>
            )}
          </form>
          {data?.bookings &&
            (section === 'calendar' ? (
              <BookingCalendar
                bookings={data.bookings}
                visits={data.visits ?? []}
                onOpen={openBooking}
                onMonth={onCalendarMonth}
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
          {!!data?.total && (
            <div className={styles.pagination}>
              <span>
                Page {data.page} · {data.total} records · {PAGE_SIZE} per page
              </span>
              <button
                type="button"
                className={styles.secondary}
                disabled={(data.page ?? 1) <= 1 || loading}
                onClick={() =>
                  setFilters((v) => ({
                    ...v,
                    page: String((data.page ?? 1) - 1),
                  }))
                }
              >
                Previous
              </button>
              <button
                type="button"
                className={styles.secondary}
                disabled={(data.page ?? 1) * PAGE_SIZE >= data.total || loading}
                onClick={() =>
                  setFilters((v) => ({
                    ...v,
                    page: String((data.page ?? 1) + 1),
                  }))
                }
              >
                Next
              </button>
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
      {data && ['inquiries', 'team'].includes(section) && (
        <AdminOverviewSections
          section={section}
          data={data}
          loading={loading}
          onPage={(page) => filter('page', String(page))}
        />
      )}
      {section === 'settings' && <SystemSettingsForm />}
      {section === 'services' && <ServicesPackages />}
      {data && section === 'settings' && data.policy && (
        <SettingsForm
          policy={data.policy}
          owner={owner}
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
              <button type="submit" className={styles.secondary}>
                Apply
              </button>
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
                        <small>{log.userRole}</small>
                      </td>
                      <td>
                        {log.module}
                        <small>{log.action}</small>
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
              <button
                type="button"
                className={styles.secondary}
                disabled={(data.page ?? 1) <= 1}
                onClick={() => filter('page', String((data.page ?? 1) - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className={styles.secondary}
                disabled={(data.page ?? 1) * PAGE_SIZE >= (data.total ?? 0)}
                onClick={() =>
                  setFilters((v) => ({
                    ...v,
                    page: String((data.page ?? 1) + 1),
                  }))
                }
              >
                Next
              </button>
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
              {owner && (
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={busy}
                  onClick={() => void mutate('notifications', {}).catch(() => {})}
                >
                  Process queued notices
                </button>
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
                Open Automation <ArrowUpRight size={14} aria-hidden="true" />
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
