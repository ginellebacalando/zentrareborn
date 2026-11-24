'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import useSWR, { mutate as refreshCache } from 'swr';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowUpRight,
  CheckCircle2,
  Search,
  Plus,
  X,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  SlidersHorizontal,
  ChevronDown,
  Clock3,
} from 'lucide-react';
import { money, paidTotal, paymentStatus } from '@/lib/admin/domain';
import BookingDetail from './BookingDetail';
import { Badge } from './AdminBadge';
import MobileBookingRegister from './MobileBookingRegister';
import AdminOverviewSections from './AdminOverviewSections';
import AnalyticsOverview from './AnalyticsOverview';
import SystemSettingsForm from './SystemSettingsForm';
import ServicesPackages from './ServicesPackages';
import DashboardGreeting from './DashboardGreeting';
import DashboardCharts from './DashboardCharts';
import DashboardKpis from './DashboardKpis';
import { useAdminDate } from './AdminPreferencesProvider';
import { BookingForm, SettingsForm, ProfileForm } from './Forms';
import type { AdminData, Booking, Notice } from './types';
import styles from './admin.module.css';

const titles: Record<string, [string, string]> = {
  dashboard: [
    'A clear view of your venue',
    'Review requests, secure schedules, and keep every commitment on track.',
  ],
  bookings: [
    'Booking management',
    'Staff-entered requests. Verify contact, review, then confirm a schedule.',
  ],
  contracts: [
    'Contract management',
    'Prepare an accurate agreement from a verified booking and reviewed venue terms.',
  ],
  calendar: [
    'Venue calendar',
    'Confirmed reservations secure dates. Requests remain tentative. All times are in Manila.',
  ],
  inquiries: [
    'Inquiries',
    'Review business inquiries and their event details before preparing a booking request.',
  ],
  analytics: [
    'Analytics',
    'Follow income, balances, inquiry conversion, and the direction of your business.',
  ],
  team: ['Team', 'View the administrators who have access to your venue workspace.'],
  payments: [
    'Cash payments',
    'Record money actually received. Approval never marks a booking paid.',
  ],
  services: [
    'Services & Packages',
    'Manage event categories, package details, prices, and inclusions.',
  ],
  logs: [
    'System logs',
    'Read-only activity history and the actual status of notification processing.',
  ],
  profile: [
    'Your admin profile',
    'Manage your own details and password. Your role is controlled by the venue owner.',
  ],
  settings: [
    'Settings',
    'Manage appearance, security, client access, communications, and localization.',
  ],
};
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
    [query, setQuery] = useState('');
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
  async function mutate(module: string, payload: unknown) {
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
      setError(e instanceof Error ? e.message : 'Unable to save.');
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
  const [title, description] = titles[section];
  return (
    <>
      <div className={styles.pageHeading}>
        <div>
          {section === 'dashboard' ? (
            <DashboardGreeting name={adminName} />
          ) : (
            <>
              <h1>{title}</h1>
              {section !== 'analytics' && <p>{description}</p>}
            </>
          )}
        </div>
        <div className={styles.actions}>
          <button
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
            <RefreshCw size={16} />
            Refresh
          </button>
          {section === 'bookings' && (
            <button
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
            aria-label="Search and filter bookings"
          >
            <div className={styles.searchRow}>
              <label className={styles.searchLabel}>
                Search records
                <span className={styles.searchField}>
                  <Search size={18} aria-hidden="true" />
                  <input
                    aria-label="Search bookings by reference, client, email, event or package"
                    ref={recordSearchRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Reference, client or event"
                  />
                </span>
              </label>
              <button className={styles.secondary}>Search</button>
            </div>
            <details className={styles.filterDisclosure}>
              <summary>
                <SlidersHorizontal size={16} aria-hidden="true" />
                Filters
                <span>
                  {advancedFilterCount ? `· ${advancedFilterCount} active` : '· optional'}
                </span>
                <ChevronDown size={16} aria-hidden="true" />
              </summary>
              <div className={styles.filterFields}>
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
                    aria-label="Event date from"
                    type="date"
                    value={filters.from || ''}
                    onChange={(event) => filter('from', event.target.value)}
                  />
                </label>
                <label>
                  Event date through
                  <input
                    aria-label="Event date through"
                    type="date"
                    value={filters.to || ''}
                    onChange={(event) => filter('to', event.target.value)}
                  />
                </label>
              </div>
              {(advancedFilterCount > 0 || filters.q || query) && (
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
              )}
            </details>
            {(filters.q || advancedFilterCount > 0) && (
              <p className={styles.filterSummary}>
                Showing {filters.q ? `matches for “${filters.q}”` : 'all matching records'}
                {filters.approval ? ` · ${filters.approval.toLowerCase()}` : ''}
                {filters.reservation ? ` · ${filters.reservation.toLowerCase()}` : ''}
                {filters.from ? ` · from ${filters.from}` : ''}
                {filters.to ? ` · through ${filters.to}` : ''}.
              </p>
            )}
          </form>
          {data?.bookings &&
            (section === 'calendar' ? (
              <Calendar bookings={data.bookings} onOpen={openBooking} onMonth={onCalendarMonth} />
            ) : (
              <div className={styles.card}>
                <div className={styles.cardHeading}>
                  <h2>
                    {section === 'payments'
                      ? 'Cash ledger by booking'
                      : section === 'contracts'
                        ? 'Agreement register'
                        : 'Booking register'}
                  </h2>
                  <span role="status">
                    {data.total} records {loading ? '· updating…' : ''}
                  </span>
                </div>
                {data.bookings.length > 0 && (
                  <div className={`${styles.tableWrap} ${styles.desktopRecords}`}>
                    <table>
                      <thead>
                        <tr>
                          <th>Booking / client</th>
                          <th>Event schedule</th>
                          {section === 'contracts' ? (
                            <>
                              <th>Latest version</th>
                              <th>Contract status</th>
                            </>
                          ) : (
                            <>
                              <th>Approval</th>
                              <th>Reservation</th>
                              <th>Payment</th>
                            </>
                          )}
                          <th>
                            <span className={styles.srOnly}>Open record</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.bookings.map((b) => {
                          const paid = paidTotal(b.payments),
                            c = b.contracts[0];
                          return (
                            <tr key={b.id}>
                              <td>
                                <strong>{b.clientName}</strong>
                                <small>
                                  {b.reference} · {b.eventType}
                                </small>
                              </td>
                              <td>
                                {eventDate(b.startsAt)}
                                <small>{b.packageName}</small>
                              </td>
                              {section === 'contracts' ? (
                                <>
                                  <td>{c ? `v${c.version}` : 'Not prepared'}</td>
                                  <td>{c ? <Badge value={c.status} /> : <span>—</span>}</td>
                                </>
                              ) : (
                                <>
                                  <td>
                                    <Badge value={b.approval} />
                                  </td>
                                  <td>
                                    <Badge value={b.reservation} />
                                  </td>
                                  <td>
                                    <Badge value={paymentStatus(b.totalCents, paid)} />
                                    <small>
                                      {money(paid)} / {money(b.totalCents)}
                                    </small>
                                  </td>
                                </>
                              )}
                              <td>
                                <button
                                  className={`${styles.linkButton} ${styles.rowAction}`}
                                  onClick={() => void openBooking(b)}
                                  aria-label={`Open ${b.reference}`}
                                >
                                  Open
                                  <ArrowUpRight size={15} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <MobileBookingRegister
                  bookings={data.bookings}
                  section={section}
                  onOpen={openBooking}
                />
                {!data.bookings.length && (
                  <Empty
                    title={
                      filters.q || advancedFilterCount ? 'No matching bookings' : 'No bookings yet'
                    }
                    detail={
                      filters.q || advancedFilterCount
                        ? 'Try another search term or clear the filters.'
                        : section === 'bookings'
                          ? 'Create a pending request to start reviewing an event.'
                          : 'Booking records will appear here. Open a booking to manage its payments or agreements.'
                    }
                  />
                )}
              </div>
            ))}
          {!!data?.total && (
            <div className={styles.pagination}>
              <span>
                Page {data.page} · {data.total} records · 50 per page
              </span>
              <button
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
                className={styles.secondary}
                disabled={(data.page ?? 1) * 50 >= data.total || loading}
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
      {data && section === 'dashboard' && <Dashboard data={data} />}
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
              <h2>Activity history</h2>
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
                Search activity
                <input
                  aria-label="Search log descriptions"
                  placeholder="Search activity…"
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
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <button className={styles.secondary}>Filter</button>
            </form>
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Actor</th>
                    <th>Module / action</th>
                    <th>Activity</th>
                    <th>Status</th>
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
              <Empty title="No activity yet" detail="Actions appear here after they are saved." />
            )}
            <div className={styles.pagination}>
              <span>
                {data.total} entries · page {data.page}
              </span>
              <button
                className={styles.secondary}
                disabled={(data.page ?? 1) <= 1}
                onClick={() => filter('page', String((data.page ?? 1) - 1))}
              >
                Previous
              </button>
              <button
                className={styles.secondary}
                disabled={(data.page ?? 1) * 50 >= (data.total ?? 0)}
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
              <Empty
                title="No queued notices"
                detail="Booking decisions and cash receipts automatically create standardized notices."
              />
            )}
          </div>
          <div className={styles.card}>
            <h2>Existing inquiry workflow executions</h2>
            <p>Actual execution records, not a simulated health score.</p>
            {data.workflows?.map((w) => (
              <div className={styles.row} key={w.id}>
                <span>
                  {w.workflowName}
                  <small>{eventDate(w.createdAt)}</small>
                </span>
                <Badge value={w.status} />
              </div>
            ))}
            {!data.workflows?.length && <p>No workflow execution has been recorded.</p>}
          </div>
        </>
      )}
    </>
  );
}
function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className={styles.empty}>
      <Clipboard />
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}
function Clipboard() {
  return <Clock3 size={28} aria-hidden="true" />;
}
function Dashboard({ data }: { data: AdminData }) {
  const eventDate = useAdminDate();
  return (
    <>
      <DashboardKpis summary={data.dashboardKpis} />
      {data.dashboardInsights && <DashboardCharts insights={data.dashboardInsights} />}
      <div className={styles.dashboardGrid}>
        <div className={styles.card}>
          <div className={styles.cardHeading}>
            <h2>Coming up at Zion</h2>
            <Link href="/admin/calendar">View calendar →</Link>
          </div>
          {data.upcoming?.map((b) => (
            <div className={styles.row} key={b.id}>
              <div className={styles.dateBlock}>
                {new Date(b.startsAt).toLocaleDateString('en-PH', {
                  timeZone: 'Asia/Manila',
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
              <div className={styles.grow}>
                <strong>
                  {b.eventType} · {b.clientName}
                </strong>
                <small>
                  {eventDate(b.startsAt)} · {b.guests} guests
                </small>
              </div>
              <Badge value={b.reservation} />
            </div>
          ))}
          {!data.upcoming?.length && (
            <div className={styles.empty}>
              <Clipboard />
              <h3>No upcoming events</h3>
            </div>
          )}
        </div>
        <div className={styles.card}>
          <h2>Operational checks</h2>
          <div className={styles.checkRow}>
            <ShieldCheck size={20} />
            <div>
              <strong>Reservation safeguards</strong>
            </div>
          </div>
          <div className={styles.checkRow}>
            <CheckCircle2 size={20} />
            <div>
              <strong>Policy review</strong>
              <p>{data.policyReviewed ? 'Reviewed' : 'Review required · confirmation blocked'}</p>
              <Link href="/admin/settings">Review policy →</Link>
            </div>
          </div>
          <div className={styles.checkRow}>
            <Clock3 size={20} />
            <div>
              <strong>Notification automation</strong>
              <p>
                {data.notificationConfigured
                  ? 'Delivery configured'
                  : 'Delivery unavailable · notices queued'}
              </p>
              <Link href="/admin/logs">
                {(data.outbox as { status: string; _count: number }[] | undefined)
                  ?.map((v) => `${v._count} ${v.status.toLowerCase().replaceAll('_', ' ')}`)
                  .join(' · ') || 'No dispatch history'}{' '}
                →
              </Link>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.cardHeading}>
          <div>
            <h2>Inquiries awaiting review</h2>
          </div>
        </div>
        {data.inquiries?.map((i) => (
          <div className={styles.row} key={i.id}>
            <div className={styles.grow}>
              <strong>{i.fullName}</strong>
              <small>
                {i.inquiryReference} · {i.eventInterest || 'General inquiry'}
              </small>
            </div>
            <Link className={styles.secondary} href={`/admin/bookings?inquiry=${i.id}`}>
              Review as request
              <ArrowUpRight size={14} />
            </Link>
          </div>
        ))}
        {!data.inquiries?.length && <p>No new business inquiries.</p>}
      </div>
    </>
  );
}
function Calendar({
  bookings,
  onOpen,
  onMonth,
}: {
  bookings: Booking[];
  onOpen: (b: Booking) => Promise<void>;
  onMonth: (from: string, to: string) => void;
}) {
  const eventDate = useAdminDate();
  const [month, setMonth] = useState(
    () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })),
  );
  const year = month.getFullYear(),
    m = month.getMonth(),
    first = new Date(year, m, 1),
    days = new Date(year, m + 1, 0).getDate();
  useEffect(() => {
    const pad = (v: number) => String(v).padStart(2, '0');
    onMonth(`${year}-${pad(m + 1)}-01`, `${year}-${pad(m + 1)}-${days}`);
  }, [year, m, days, onMonth]);
  return (
    <div className={styles.card}>
      <div className={styles.cardHeading}>
        <div>
          <h2>
            {month.toLocaleDateString('en-PH', {
              month: 'long',
              year: 'numeric',
            })}
          </h2>
          <p>Manila time · filters apply · paginated results</p>
        </div>
        <div className={styles.actions}>
          <button
            className={styles.secondary}
            aria-label="Previous month"
            onClick={() => setMonth(new Date(year, m - 1, 1))}
          >
            <ChevronLeft size={18} />
          </button>
          <button className={styles.secondary} onClick={() => setMonth(new Date())}>
            Today
          </button>
          <button
            className={styles.secondary}
            aria-label="Next month"
            onClick={() => setMonth(new Date(year, m + 1, 1))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className={styles.calendar}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div className={styles.weekday} key={d}>
            {d}
          </div>
        ))}
        {Array.from({ length: first.getDay() }, (_, i) => (
          <div key={`blank-${i}`} className={styles.calendarBlank} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const date = `${year}-${String(m + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
          const events = bookings.filter(
            (b) =>
              new Date(b.startsAt).toLocaleDateString('en-CA', {
                timeZone: 'Asia/Manila',
              }) <= date &&
              new Date(b.endsAt).toLocaleDateString('en-CA', {
                timeZone: 'Asia/Manila',
              }) >= date,
          );
          return (
            <div className={styles.calendarDay} key={date}>
              <strong>{i + 1}</strong>
              {events.map((b) => (
                <button
                  className={`${styles.calendarEvent} ${b.reservation === 'CONFIRMED' ? styles.confirmedEvent : ''}`}
                  key={b.id}
                  onClick={() => void onOpen(b)}
                >
                  <span>{b.clientName}</span>
                  <small>
                    {b.eventType} · {b.reservation.toLowerCase()}
                  </small>
                </button>
              ))}
            </div>
          );
        })}
      </div>
      <div
        className={`${styles.agenda} ${
          bookings.some((b) => {
            const date = new Date(b.startsAt).toLocaleDateString('en-CA', {
              timeZone: 'Asia/Manila',
            });
            return !date.startsWith(`${year}-${String(m + 1).padStart(2, '0')}-`);
          })
            ? styles.filteredAgenda
            : ''
        }`}
      >
        <h3>Schedule list</h3>
        {bookings.map((b) => (
          <button className={styles.row} key={b.id} onClick={() => void onOpen(b)}>
            <span>
              {eventDate(b.startsAt)} — {b.clientName}
            </span>
            <Badge value={b.reservation} />
          </button>
        ))}
        {!bookings.length && <p>No events match the selected filters.</p>}
      </div>
    </div>
  );
}
