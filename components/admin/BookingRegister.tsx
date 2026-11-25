'use client';
import { useState, useSyncExternalStore } from 'react';
import { CalendarDays, CircleAlert, ImageIcon, LayoutGrid, Rows3, ShieldAlert } from 'lucide-react';
import { money, paidTotal, paymentStatus } from '@/lib/admin/domain';
import {
  countDisplayStatuses,
  displayStatus,
  displayStatusDescriptions,
  displayStatusLabels,
  displayStatuses,
  type DisplayStatus,
} from '@/lib/admin/dashboard-status';
import { Badge } from './AdminBadge';
import { StatusChip, StatusDot, statusTone } from './BookingStatus';
import MobileBookingRegister from './MobileBookingRegister';
import { useAdminDate } from './AdminPreferencesProvider';
import type { Booking } from './types';
import styles from './admin.module.css';

type View = 'cards' | 'table';
export type StatusView = DisplayStatus | 'all';

/* The layout choice is a per-browser convenience; storage may be unavailable. */
const VIEW_KEY = 'zentra-admin-booking-view';
const viewListeners = new Set<() => void>();
let memoryView: View | null = null;
function readView(): View {
  try {
    const value = window.localStorage.getItem(VIEW_KEY);
    if (value === 'cards' || value === 'table') return value;
  } catch {
    if (memoryView) return memoryView;
  }
  return 'cards';
}
function subscribeView(onChange: () => void) {
  viewListeners.add(onChange);
  return () => viewListeners.delete(onChange);
}
function writeView(view: View) {
  memoryView = view;
  try {
    window.localStorage.setItem(VIEW_KEY, view);
  } catch {
    // The in-memory value still applies to this page view.
  }
  viewListeners.forEach((listener) => listener());
}

/**
 * The Bookings page leads with what needs staff first (docs/admin-design.md): requests waiting for a
 * decision, highlighted, with one action that shows only them. Other waiting work follows as a
 * short line. Counts cover the bookings loaded on this page.
 */
export function AttentionCallout({
  bookings,
  partial,
  statusView,
  onStatusView,
}: {
  bookings: Booking[];
  partial: boolean;
  statusView: StatusView;
  onStatusView: (view: StatusView) => void;
}) {
  const counts = countDisplayStatuses(bookings);
  if (!counts.request) return null;
  const screenshots = bookings.filter((booking) => booking.proofsToVerify).length;
  const others = [
    counts.pending ? `${counts.pending} waiting for payment` : '',
    screenshots
      ? `${screenshots} payment ${screenshots === 1 ? 'screenshot' : 'screenshots'} to verify`
      : '',
  ].filter(Boolean);
  return (
    <section className={styles.attention} aria-labelledby="bookings-attention">
      <CircleAlert
        size={22}
        strokeWidth={1.75}
        className={styles.attentionIcon}
        aria-hidden="true"
      />
      <p className={styles.attentionText}>
        <strong id="bookings-attention">
          {counts.request} {counts.request === 1 ? 'request needs' : 'requests need'} your decision
          {partial ? ' on this page' : ''}
        </strong>
        {others.length > 0 && <span>Also: {others.join(' · ')}.</span>}
      </p>
      {/* One button that stays in place, so keyboard focus is kept when the view changes. */}
      <button
        type="button"
        className={statusView === 'request' ? styles.secondary : styles.primary}
        onClick={() => onStatusView(statusView === 'request' ? 'all' : 'request')}
      >
        {statusView === 'request' ? 'Show all bookings' : 'Review requests'}
      </button>
    </section>
  );
}

export default function BookingRegister({
  bookings,
  total,
  section,
  loading,
  filtered,
  statusView,
  onStatusView,
  onOpen,
}: {
  bookings: Booking[];
  total: number;
  section: string;
  loading: boolean;
  filtered: boolean;
  statusView: StatusView;
  onStatusView: (view: StatusView) => void;
  onOpen: (booking: Booking) => void;
}) {
  const date = useAdminDate();
  const view = useSyncExternalStore(subscribeView, readView, () => 'cards' as View);
  const [announcement, setAnnouncement] = useState('');
  const board = section === 'bookings';
  const counts = countDisplayStatuses(bookings);
  const shown =
    board && statusView !== 'all'
      ? bookings.filter((booking) => displayStatus(booking) === statusView)
      : bookings;
  const partial = total > bookings.length;
  const heading =
    section === 'payments'
      ? 'Cash ledger by booking'
      : section === 'contracts'
        ? 'Register'
        : 'Requests and reservations';

  return (
    <div className={styles.card}>
      <div className={styles.cardHeading}>
        <h2>{heading}</h2>
        <span role="status">
          {total} {total === 1 ? 'record' : 'records'}
          {loading ? ' · updating…' : ''}
        </span>
      </div>
      {board && (
        <div className={styles.boardToolbar}>
          <div className={styles.statusBar} role="group" aria-label="Show by status">
            <button
              type="button"
              className={styles.statusFilter}
              aria-pressed={statusView === 'all'}
              onClick={() => onStatusView('all')}
            >
              All <span className={styles.statusCount}>{bookings.length}</span>
            </button>
            {displayStatuses.map((status) => (
              <button
                key={status}
                type="button"
                className={`${styles.statusFilter} ${statusTone[status]}`}
                aria-pressed={statusView === status}
                title={displayStatusDescriptions[status]}
                onClick={() => onStatusView(status)}
              >
                <StatusDot status={status} />
                {displayStatusLabels[status]}{' '}
                <span className={styles.statusCount}>{counts[status]}</span>
              </button>
            ))}
          </div>
          <div className={styles.viewToggle} role="group" aria-label="Layout">
            {(
              [
                ['cards', 'Cards', LayoutGrid],
                ['table', 'Table', Rows3],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => {
                  writeView(value);
                  setAnnouncement(`${label} layout`);
                }}
              >
                <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
          <p className={styles.srOnly} role="status">
            {announcement}
          </p>
        </div>
      )}
      {board && partial && (
        <p className={styles.help}>
          Status counts and the status view cover the {bookings.length} bookings on this page.
        </p>
      )}
      {board && view === 'cards' && shown.length > 0 && (
        <ul className={styles.bookingCards} aria-label="Bookings">
          {shown.map((booking) => {
            const status = displayStatus(booking);
            return (
              <li key={booking.id} className={`${styles.bookingCard} ${styles.clickableCard}`}>
                <div className={styles.bookingCardHeader}>
                  <StatusChip status={status} />
                  {booking.verification === 'FLAGGED' && (
                    <span className={styles.flagged}>
                      <ShieldAlert size={14} strokeWidth={1.5} aria-hidden="true" />
                      Flagged
                    </span>
                  )}
                  {!!booking.proofsToVerify && (
                    <span className={styles.proofWaiting}>
                      <ImageIcon size={14} strokeWidth={1.5} aria-hidden="true" />
                      Screenshot to verify
                    </span>
                  )}
                </div>
                <h3>
                  {/* The card's one control; its ::after makes the whole card clickable. */}
                  <button
                    type="button"
                    className={styles.rowLink}
                    onClick={() => onOpen(booking)}
                    aria-label={`${booking.clientName}, ${booking.reference}: open details`}
                  >
                    {booking.clientName}
                  </button>
                </h3>
                <p>
                  {booking.eventType} · {booking.packageName}
                </p>
                <div className={styles.bookingCardFooter}>
                  <span className={styles.bookingCardDate}>
                    <CalendarDays size={16} strokeWidth={1.75} aria-hidden="true" />
                    {date(booking.startsAt)}
                  </span>
                  <span className={styles.bookingCardRef}>{booking.reference}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {(!board || view === 'table') && shown.length > 0 && (
        <>
          <div
            className={`${styles.tableWrap} ${styles.desktopRecords}`}
            role="region"
            aria-label={`${heading} table`}
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Reference / client</th>
                  <th scope="col">Event schedule</th>
                  {section === 'contracts' ? (
                    <>
                      <th scope="col">Latest version</th>
                      <th scope="col">Status</th>
                    </>
                  ) : (
                    <>
                      {board && <th scope="col">Status</th>}
                      <th scope="col">Approval</th>
                      <th scope="col">Reservation</th>
                      <th scope="col">Payment</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {shown.map((booking) => {
                  const paid = paidTotal(booking.payments),
                    contract = booking.contracts[0];
                  return (
                    <tr key={booking.id} className={styles.clickableRow}>
                      <td>
                        {/* The row's one control; its ::after makes the whole row clickable. */}
                        <strong>
                          <button
                            type="button"
                            className={styles.rowLink}
                            onClick={() => onOpen(booking)}
                            aria-label={`${booking.clientName}, ${booking.reference}: open details`}
                          >
                            {booking.clientName}
                          </button>
                        </strong>
                        <small>
                          {booking.reference} · {booking.eventType}
                        </small>
                      </td>
                      <td>
                        {date(booking.startsAt)}
                        <small>{booking.packageName}</small>
                      </td>
                      {section === 'contracts' ? (
                        <>
                          <td>{contract ? `v${contract.version}` : 'Not prepared'}</td>
                          <td>{contract ? <Badge value={contract.status} /> : <span>—</span>}</td>
                        </>
                      ) : (
                        <>
                          {board && (
                            <td>
                              <StatusChip status={displayStatus(booking)} />
                            </td>
                          )}
                          <td>
                            <Badge value={booking.approval} />
                          </td>
                          <td>
                            <Badge value={booking.reservation} />
                          </td>
                          <td>
                            <Badge value={paymentStatus(booking.totalCents, paid)} />
                            <small>
                              {money(paid)} / {money(booking.totalCents)}
                            </small>
                            {!!booking.proofsToVerify && (
                              <small className={styles.proofWaiting}>Screenshot to verify</small>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <MobileBookingRegister bookings={shown} section={section} onOpen={onOpen} />
        </>
      )}
      {!shown.length && (
        <div className={styles.empty}>
          <h3>
            {bookings.length && statusView !== 'all'
              ? `No ${displayStatusLabels[statusView as DisplayStatus].toLowerCase()} bookings`
              : filtered
                ? 'No matching bookings'
                : 'No bookings yet'}
          </h3>
          <p>
            {bookings.length && statusView !== 'all'
              ? 'Choose another status or show all.'
              : filtered
                ? 'Try another search term or clear the filters.'
                : section === 'bookings'
                  ? 'Create a pending request to start reviewing an event.'
                  : 'Booking records will appear here. Open a booking to manage its payments or agreements.'}
          </p>
        </div>
      )}
    </div>
  );
}
