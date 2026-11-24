'use client';
import { useEffect, useId, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  countDisplayStatuses,
  displayStatus,
  displayStatusLabels,
  displayStatuses,
} from '@/lib/admin/dashboard-status';
import { StatusDot, statusTone } from './BookingStatus';
import type { Booking } from './types';
import styles from './admin.module.css';

const TIME_ZONE = 'Asia/Manila';
const weekdays = [
  ['S', 'Sunday'],
  ['M', 'Monday'],
  ['T', 'Tuesday'],
  ['W', 'Wednesday'],
  ['T', 'Thursday'],
  ['F', 'Friday'],
  ['S', 'Saturday'],
] as const;
const pad = (value: number) => String(value).padStart(2, '0');
/** Calendar dates are compared as Manila YYYY-MM-DD keys. */
const dateKey = (value: string | Date) =>
  new Date(value).toLocaleDateString('en-CA', { timeZone: TIME_ZONE });
function manilaMonth(date = new Date()) {
  const [year, month] = dateKey(date).split('-').map(Number);
  return { year, month: month - 1 };
}
const timeLabel = (value: string) =>
  new Date(value).toLocaleTimeString('en-PH', {
    timeZone: TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  });

export default function BookingCalendar({
  bookings,
  onOpen,
  onMonth,
}: {
  bookings: Booking[];
  onOpen: (booking: Booking) => void;
  onMonth: (from: string, to: string) => void;
}) {
  const titleId = useId();
  const panelId = useId();
  const [{ year, month }, setMonth] = useState(() => manilaMonth());
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const prefix = `${year}-${pad(month + 1)}-`;
  const today = dateKey(new Date());
  const current = manilaMonth();
  const isCurrentMonth = current.year === year && current.month === month;
  const monthLabel = new Date(Date.UTC(year, month, 1)).toLocaleDateString('en-PH', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  });
  useEffect(() => {
    onMonth(`${prefix}01`, `${prefix}${pad(days)}`);
  }, [prefix, days, onMonth]);

  function shift(offset: number) {
    const next = new Date(Date.UTC(year, month + offset, 1));
    setMonth({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
  }
  const eventsOn = (date: string) =>
    bookings.filter(
      (booking) => dateKey(booking.startsAt) <= date && dateKey(booking.endsAt) >= date,
    );
  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: days }, (_, index) => `${prefix}${pad(index + 1)}`),
  ];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, index) =>
    cells.slice(index * 7, index * 7 + 7),
  );
  const listed = [...bookings].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const inMonth = listed.every(
    (booking) =>
      dateKey(booking.startsAt) <= `${prefix}31` && dateKey(booking.endsAt) >= `${prefix}01`,
  );
  const panelTitle = !inMonth
    ? 'Matching bookings'
    : isCurrentMonth
      ? 'This month'
      : `${monthLabel.split(' ')[0]} schedule`;

  return (
    <div className={styles.calendarLayout}>
      <section className={`${styles.card} ${styles.monthCard}`} aria-labelledby={titleId}>
        <div className={styles.monthHeading}>
          <h2 id={titleId}>{monthLabel}</h2>
          <div className={styles.monthNav}>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Previous month"
              onClick={() => shift(-1)}
            >
              <ChevronLeft size={18} strokeWidth={1.5} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => setMonth(manilaMonth())}
            >
              Today
            </button>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Next month"
              onClick={() => shift(1)}
            >
              <ChevronRight size={18} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        </div>
        <table className={styles.monthGrid}>
          <caption className={styles.srOnly}>
            {monthLabel}: days with bookings, by status. Open a booking from the list.
          </caption>
          <thead>
            <tr>
              {weekdays.map(([initial, name]) => (
                <th key={name} scope="col">
                  <abbr title={name}>{initial}</abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, row) => (
              <tr key={row}>
                {week.map((date, column) => {
                  if (!date)
                    return <td key={`blank-${row}-${column}`} className={styles.blankDay} />;
                  const events = eventsOn(date);
                  const counts = countDisplayStatuses(events);
                  const isToday = date === today;
                  return (
                    <td key={date}>
                      <span
                        className={`${styles.dayNumber} ${isToday ? styles.today : ''}`}
                        aria-current={isToday ? 'date' : undefined}
                      >
                        {Number(date.slice(-2))}
                      </span>
                      {events.length > 0 && (
                        <>
                          <span className={styles.dayDots} aria-hidden="true">
                            {events.slice(0, 3).map((booking) => (
                              <StatusDot key={booking.id} status={displayStatus(booking)} />
                            ))}
                            {events.length > 3 && (
                              <span className={styles.dayMore}>+{events.length - 3}</span>
                            )}
                          </span>
                          <span className={styles.srOnly}>
                            {isToday ? 'Today. ' : ''}
                            {events.length} {events.length === 1 ? 'booking' : 'bookings'}:{' '}
                            {displayStatuses
                              .filter((status) => counts[status])
                              .map(
                                (status) =>
                                  `${counts[status]} ${displayStatusLabels[status].toLowerCase()}`,
                              )
                              .join(', ')}
                          </span>
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <ul className={styles.calendarLegend} aria-label="Status colours">
          {displayStatuses.map((status) => (
            <li key={status}>
              <StatusDot status={status} />
              {displayStatusLabels[status]}
            </li>
          ))}
        </ul>
      </section>
      <section className={styles.monthPanel} aria-labelledby={panelId}>
        <h2 id={panelId}>{panelTitle}</h2>
        {listed.length ? (
          <ol className={styles.panelList}>
            {listed.map((booking) => {
              const status = displayStatus(booking);
              return (
                <li key={booking.id}>
                  <button
                    type="button"
                    className={`${styles.panelItem} ${statusTone[status]}`}
                    onClick={() => onOpen(booking)}
                  >
                    <span className={styles.panelDate}>
                      {new Date(booking.startsAt).toLocaleDateString('en-US', {
                        timeZone: TIME_ZONE,
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <strong>
                      {booking.eventType} · {booking.clientName}
                    </strong>
                    <span className={styles.panelMeta}>
                      <StatusDot status={status} />
                      {displayStatusLabels[status]} · {timeLabel(booking.startsAt)} –{' '}
                      {timeLabel(booking.endsAt)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className={styles.panelEmpty}>No bookings match this month and the filters.</p>
        )}
      </section>
    </div>
  );
}
