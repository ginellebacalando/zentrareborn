'use client';
import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  countDisplayStatuses,
  displayStatus,
  displayStatusLabels,
  displayStatuses,
} from '@/lib/admin/dashboard-status';
import { visitStatusLabel, type CalendarVisit } from '@/lib/visit-types';
import { StatusDot, statusTone } from './BookingStatus';
import type { Booking } from './types';
import styles from './admin.module.css';
import { Button, IconButton } from '@/components/shared/Button';

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

const shortDate = (value: string) =>
  new Date(value).toLocaleDateString('en-US', {
    timeZone: TIME_ZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

/** A hollow square, so a visit differs from the round booking dots by shape as well as colour. */
function VisitMark() {
  return <span className={styles.visitMark} aria-hidden="true" />;
}

export default function BookingCalendar({
  bookings,
  visits,
  onOpen,
  onMonth,
}: {
  bookings: Booking[];
  /** The month's ocular visits; staff manage them on the Front desk (docs/visits.md). */
  visits: CalendarVisit[];
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
  const visitsOn = (date: string) => visits.filter((visit) => dateKey(visit.startsAt) === date);
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
  // Bookings and visits in one list, by start time.
  const entries = [
    ...listed.map((booking) => ({ kind: 'booking' as const, at: booking.startsAt, booking })),
    ...visits.map((visit) => ({ kind: 'visit' as const, at: visit.startsAt, visit })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className={styles.calendarLayout}>
      <section className={`${styles.card} ${styles.monthCard}`} aria-labelledby={titleId}>
        <div className={styles.monthHeading}>
          <h2 id={titleId}>{monthLabel}</h2>
          <div className={styles.monthNav}>
            <IconButton
              type="button"
              variant="secondary"
              label="Previous month"
              icon={<ChevronLeft aria-hidden="true" />}
              onClick={() => shift(-1)}
            />
            <Button type="button" variant="secondary" onClick={() => setMonth(manilaMonth())}>
              Today
            </Button>
            <IconButton
              type="button"
              variant="secondary"
              label="Next month"
              icon={<ChevronRight aria-hidden="true" />}
              onClick={() => shift(1)}
            />
          </div>
        </div>
        <table className={styles.monthGrid}>
          <caption className={styles.srOnly}>
            {monthLabel}: days with bookings, by status, and with ocular visits. Open a booking from
            the list.
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
                  const dayVisits = visitsOn(date);
                  const counts = countDisplayStatuses(events);
                  const isToday = date === today;
                  const summary = [
                    events.length
                      ? `${events.length} ${events.length === 1 ? 'booking' : 'bookings'}: ${displayStatuses
                          .filter((status) => counts[status])
                          .map(
                            (status) =>
                              `${counts[status]} ${displayStatusLabels[status].toLowerCase()}`,
                          )
                          .join(', ')}`
                      : '',
                    dayVisits.length
                      ? `${dayVisits.length} ocular ${dayVisits.length === 1 ? 'visit' : 'visits'}`
                      : '',
                  ]
                    .filter(Boolean)
                    .join('. ');
                  return (
                    <td key={date}>
                      <span
                        className={`${styles.dayNumber} ${isToday ? styles.today : ''}`}
                        aria-current={isToday ? 'date' : undefined}
                      >
                        {Number(date.slice(-2))}
                      </span>
                      {summary && (
                        <>
                          <span className={styles.dayDots} aria-hidden="true">
                            {events.slice(0, 3).map((booking) => (
                              <StatusDot key={booking.id} status={displayStatus(booking)} />
                            ))}
                            {events.length > 3 && (
                              <span className={styles.dayMore}>+{events.length - 3}</span>
                            )}
                            {dayVisits.length > 0 && (
                              <span className={styles.dayVisits}>
                                <VisitMark />
                                {dayVisits.length > 1 && (
                                  <span className={styles.dayMore}>{dayVisits.length}</span>
                                )}
                              </span>
                            )}
                          </span>
                          <span className={styles.srOnly}>
                            {isToday ? 'Today. ' : ''}
                            {summary}
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
          <li>
            <VisitMark />
            Ocular visit
          </li>
        </ul>
      </section>
      <section className={styles.monthPanel} aria-labelledby={panelId}>
        <h2 id={panelId}>{panelTitle}</h2>
        {entries.length ? (
          <ol className={styles.panelList}>
            {entries.map((entry) => {
              if (entry.kind === 'visit') {
                const { visit } = entry;
                return (
                  <li key={`visit-${visit.id}`}>
                    <div className={`${styles.panelItem} ${styles.panelVisit}`}>
                      <span className={styles.panelDate}>{shortDate(visit.startsAt)}</span>
                      <strong>Ocular visit · {visit.clientName}</strong>
                      <span className={styles.panelMeta}>
                        <VisitMark />
                        {visitStatusLabel(visit.status)} · {timeLabel(visit.startsAt)} –{' '}
                        {timeLabel(visit.endsAt)}
                      </span>
                    </div>
                  </li>
                );
              }
              const { booking } = entry;
              const status = displayStatus(booking);
              return (
                <li key={booking.id}>
                  <button
                    type="button"
                    className={`${styles.panelItem} ${statusTone[status]}`}
                    onClick={() => onOpen(booking)}
                  >
                    <span className={styles.panelDate}>{shortDate(booking.startsAt)}</span>
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
          <p className={styles.panelEmpty}>
            No bookings or visits match this month and the filters.
          </p>
        )}
        {visits.length > 0 && (
          <p className={styles.panelNote}>
            <Link className={styles.panelLink} href="/admin/front-desk">
              Manage visits on the Front desk
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}
