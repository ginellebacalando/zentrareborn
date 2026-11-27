'use client';
import { useEffect, useId, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import {
  displayStatus,
  displayStatusLabels,
  displayStatuses,
  type DisplayStatus,
} from '@/lib/admin/dashboard-status';
import { visitStatusLabel, type CalendarVisit } from '@/lib/visit-types';
import { Button, ButtonLink, IconButton } from '@/components/shared/Button';
import { StatusChip, StatusDot, statusTone } from './BookingStatus';
import { bookingPagePath } from './booking-links';
import { packageShortName } from './booking-view';
import type { Booking } from './types';
import styles from './admin.module.css';
import cal from './BookingCalendar.module.css';

const TIME_ZONE = 'Asia/Manila';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (value: number) => String(value).padStart(2, '0');
/** Calendar dates are compared as Manila YYYY-MM-DD keys. */
const dateKey = (value: string | Date) =>
  new Date(value).toLocaleDateString('en-CA', { timeZone: TIME_ZONE });
const timeLabel = (value: string) =>
  new Date(value).toLocaleTimeString('en-PH', {
    timeZone: TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  });
const dayLabel = (key: string, style: 'long' | 'short' = 'short') =>
  new Date(`${key}T12:00:00+08:00`).toLocaleDateString('en-US', {
    timeZone: TIME_ZONE,
    weekday: style,
    month: style === 'long' ? 'long' : 'short',
    day: 'numeric',
  });
function manilaMonth(date = new Date()) {
  const [year, month] = dateKey(date).split('-').map(Number);
  return { year, month: month - 1 };
}

type Kind = DisplayStatus | 'visit';
type Entry =
  | { kind: 'booking'; id: string; at: string; booking: Booking; status: DisplayStatus }
  | { kind: 'visit'; id: string; at: string; visit: CalendarVisit };
type Preview = { entry: Entry; top: number; left: number; opener: HTMLElement };

/** Chip height and the day number and "+N more" lines, for how many chips a day can show. */
const CHIP_PX = 22;
const DAY_CHROME_PX = 46;

/**
 * The admin Calendar (docs/admin-design.md, "Calendar"): a compact toolbar, status chips that are
 * both the legend and the filters, a month whose days show their events as labelled chips (as
 * many as fit, then "+N more"), a list view, and a side panel with the chosen day or today and
 * what comes next. Times are Manila time, the venue's own.
 */
export default function BookingCalendar({
  bookings,
  visits,
  query,
  onQuery,
  onMonth,
}: {
  bookings: Booking[];
  /** The month's ocular visits; staff manage them on the Front desk (docs/visits.md). */
  visits: CalendarVisit[];
  query: string;
  onQuery: (value: string) => void;
  onMonth: (from: string, to: string) => void;
}) {
  const id = useId();
  const gridRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDialogElement>(null);
  const [{ year, month }, setMonth] = useState(() => manilaMonth());
  const [view, setView] = useState<'month' | 'list'>(() =>
    // Phones open the list: a month of chips is too small to read there.
    typeof window !== 'undefined' && window.matchMedia('(max-width: 47.99rem)').matches
      ? 'list'
      : 'month',
  );
  const [hidden, setHidden] = useState<Set<Kind>>(() => new Set<Kind>(['cancelled']));
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [maxChips, setMaxChips] = useState(3);

  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const prefix = `${year}-${pad(month + 1)}-`;
  const today = dateKey(new Date());
  const current = manilaMonth();
  const isCurrentMonth = current.year === year && current.month === month;
  const monthLabel = new Date(Date.UTC(year, month, 1)).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  });

  useEffect(() => {
    onMonth(`${prefix}01`, `${prefix}${pad(days)}`);
  }, [prefix, days, onMonth]);

  // How many chips a day can show, from the height the month leaves each week.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || view !== 'month') return;
    const observer = new ResizeObserver(() => {
      const cell = grid.querySelector<HTMLElement>('[data-day]');
      if (!cell) return;
      const fit = Math.floor((cell.clientHeight - DAY_CHROME_PX) / CHIP_PX);
      setMaxChips(Math.max(1, Math.min(3, fit)));
    });
    observer.observe(grid);
    return () => observer.disconnect();
  }, [view, year, month]);

  useEffect(() => {
    const dialog = previewRef.current;
    if (preview && dialog && !dialog.open) dialog.showModal();
  }, [preview]);

  function shift(offset: number) {
    const next = new Date(Date.UTC(year, month + offset, 1));
    setMonth({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
    setSelected(null);
  }

  function toggle(kind: Kind) {
    setHidden((was) => {
      const next = new Set(was);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  const entries: Entry[] = [
    ...bookings.map((booking) => ({
      kind: 'booking' as const,
      id: booking.id,
      at: booking.startsAt,
      booking,
      status: displayStatus(booking),
    })),
    ...visits.map((visit) => ({ kind: 'visit' as const, id: visit.id, at: visit.startsAt, visit })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const kindOf = (entry: Entry): Kind => (entry.kind === 'visit' ? 'visit' : entry.status);
  const shown = entries.filter((entry) => !hidden.has(kindOf(entry)));
  const counts = Object.fromEntries(
    [...displayStatuses, 'visit'].map((kind) => [
      kind,
      entries.filter((entry) => kindOf(entry) === kind).length,
    ]),
  ) as Record<Kind, number>;
  const onDay = (key: string) =>
    shown.filter((entry) =>
      entry.kind === 'visit'
        ? dateKey(entry.visit.startsAt) === key
        : dateKey(entry.booking.startsAt) <= key && dateKey(entry.booking.endsAt) >= key,
    );
  const filtersOn = query.trim() !== '' || hidden.size !== 1 || !hidden.has('cancelled');

  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: days }, (_, index) => `${prefix}${pad(index + 1)}`),
  ];
  while (cells.length % 7) cells.push(null);

  function openPreview(entry: Entry, event: ReactMouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const width = 320;
    setPreview({
      entry,
      opener: event.currentTarget,
      top: Math.min(rect.bottom + 6, window.innerHeight - 260),
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
    });
  }

  function closePreview() {
    const opener = preview?.opener;
    previewRef.current?.close();
    setPreview(null);
    if (opener?.isConnected) opener.focus();
  }

  function chipLabel(entry: Entry) {
    return entry.kind === 'visit'
      ? `${timeLabel(entry.visit.startsAt)} · Ocular visit`
      : `${timeLabel(entry.booking.startsAt)} · ${entry.booking.eventType}`;
  }

  function chipName(entry: Entry) {
    return entry.kind === 'visit'
      ? `${chipLabel(entry)}, ${entry.visit.clientName}, ${visitStatusLabel(entry.visit.status)}`
      : `${chipLabel(entry)}, ${entry.booking.clientName}, ${displayStatusLabels[entry.status]}`;
  }

  /** One schedule line; `withDay` adds the date for lists that span days. */
  function scheduleItem(entry: Entry, withDay = false) {
    const dayPrefix = withDay ? `${dayLabel(dateKey(entry.at))} · ` : '';
    if (entry.kind === 'visit')
      return (
        <li key={`visit-${entry.id}`} className={cal.item}>
          <span className={cal.itemTime}>
            {dayPrefix}
            {timeLabel(entry.visit.startsAt)}–{timeLabel(entry.visit.endsAt)}
          </span>
          <span className={cal.itemMain}>
            <strong>Ocular visit · {entry.visit.clientName}</strong>
            <span className={cal.itemMeta}>
              <span className={cal.visitMark} aria-hidden="true" />
              {visitStatusLabel(entry.visit.status)} ·{' '}
              <Link href="/admin/front-desk" className={cal.itemLink}>
                Front desk
              </Link>
            </span>
          </span>
        </li>
      );
    const { booking } = entry;
    return (
      <li key={booking.id} className={cal.item}>
        <span className={cal.itemTime}>
          {dayPrefix}
          {timeLabel(booking.startsAt)}–{timeLabel(booking.endsAt)}
        </span>
        <span className={cal.itemMain}>
          <Link href={bookingPagePath(booking.reference)} className={cal.itemLink}>
            <strong>{booking.clientName}</strong>
          </Link>
          <span className={cal.itemMeta}>
            {booking.eventType} · {booking.venue}
          </span>
          <StatusChip status={entry.status} />
        </span>
      </li>
    );
  }

  const selectedEntries = selected ? onDay(selected) : [];
  // After today; today's own events are listed under Today.
  const upcoming = shown.filter((entry) => dateKey(entry.at) > today).slice(0, 5);
  const todayEntries = isCurrentMonth ? onDay(today) : [];
  const listDays = Array.from(new Set(shown.map((entry) => dateKey(entry.at)))).filter((key) =>
    key.startsWith(prefix),
  );

  return (
    <div className={cal.calendar}>
      <div className={cal.toolbar}>
        <div className={cal.monthNav}>
          <IconButton
            type="button"
            variant="secondary"
            size="sm"
            label="Previous month"
            icon={<ChevronLeft aria-hidden="true" />}
            onClick={() => shift(-1)}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isCurrentMonth}
            onClick={() => {
              setMonth(manilaMonth());
              setSelected(null);
            }}
          >
            Today
          </Button>
          <IconButton
            type="button"
            variant="secondary"
            size="sm"
            label="Next month"
            icon={<ChevronRight aria-hidden="true" />}
            onClick={() => shift(1)}
          />
          <h2 id={`${id}-month`} className={cal.monthTitle} aria-live="polite">
            {monthLabel}
          </h2>
        </div>
        <div className={cal.tools}>
          <label className={cal.search}>
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              placeholder="Search client, event or reference"
              aria-label="Search the calendar by client, event, email or reference"
            />
          </label>
          <div className={cal.switch} role="group" aria-label="View">
            {(['month', 'list'] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => setView(value)}
              >
                {value === 'month' ? 'Month' : 'List'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={cal.filters} role="group" aria-label="Show statuses">
        {[...displayStatuses, 'visit' as const].map((kind) => (
          <button
            key={kind}
            type="button"
            className={`${cal.filter} ${kind === 'visit' ? cal.visitFilter : statusTone[kind]}`}
            aria-pressed={!hidden.has(kind)}
            onClick={() => toggle(kind)}
          >
            {kind === 'visit' ? (
              <span className={cal.visitMark} aria-hidden="true" />
            ) : (
              <StatusDot status={kind} />
            )}
            {kind === 'visit'
              ? 'Ocular visit'
              : kind === 'cancelled' && hidden.has('cancelled')
                ? 'Show cancelled'
                : displayStatusLabels[kind]}
            <span className={cal.count}>{counts[kind]}</span>
          </button>
        ))}
        {filtersOn && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={<X aria-hidden="true" />}
            onClick={() => {
              onQuery('');
              setHidden(new Set<Kind>(['cancelled']));
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <div className={cal.body}>
        {view === 'month' ? (
          <div
            ref={gridRef}
            className={cal.grid}
            role="table"
            aria-labelledby={`${id}-month`}
            style={{ gridTemplateRows: `auto repeat(${cells.length / 7}, minmax(0, 1fr))` }}
          >
            <div role="row" className={cal.weekdays}>
              {WEEKDAYS.map((name) => (
                <span key={name} role="columnheader">
                  {name}
                </span>
              ))}
            </div>
            {Array.from({ length: cells.length / 7 }, (_, week) => (
              <div key={week} role="row" className={cal.week}>
                {cells.slice(week * 7, week * 7 + 7).map((key, column) => {
                  if (!key)
                    return (
                      <span key={`blank-${week}-${column}`} role="cell" className={cal.blank} />
                    );
                  const items = onDay(key);
                  const extra = items.length - maxChips;
                  return (
                    <div
                      key={key}
                      role="cell"
                      data-day={key}
                      className={cal.day}
                      data-today={key === today || undefined}
                      data-past={key < today || undefined}
                      data-selected={key === selected || undefined}
                    >
                      <button
                        type="button"
                        className={cal.dayNumber}
                        aria-pressed={key === selected}
                        aria-current={key === today ? 'date' : undefined}
                        aria-label={`${dayLabel(key, 'long')}${items.length ? `: ${items.length} ${items.length === 1 ? 'event' : 'events'}` : ''}`}
                        onClick={() => setSelected(key === selected ? null : key)}
                      >
                        {Number(key.slice(-2))}
                      </button>
                      <ul className={cal.chips}>
                        {items.slice(0, maxChips).map((entry) => (
                          <li key={`${entry.kind}-${entry.id}`}>
                            <button
                              type="button"
                              className={`${cal.chip} ${entry.kind === 'visit' ? cal.visitChip : statusTone[entry.status]}`}
                              aria-label={chipName(entry)}
                              title={chipName(entry)}
                              onClick={(event) => openPreview(entry, event)}
                            >
                              {chipLabel(entry)}
                            </button>
                          </li>
                        ))}
                      </ul>
                      {extra > 0 && (
                        <button type="button" className={cal.more} onClick={() => setSelected(key)}>
                          +{extra} more
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          <div className={cal.list}>
            {listDays.length ? (
              listDays.map((key) => (
                <section key={key} aria-labelledby={`${id}-list-${key}`}>
                  <h3 id={`${id}-list-${key}`} className={cal.listDay}>
                    {dayLabel(key, 'long')}
                    {key === today && <span className={cal.todayTag}>Today</span>}
                  </h3>
                  <ul className={cal.items}>{onDay(key).map((entry) => scheduleItem(entry))}</ul>
                </section>
              ))
            ) : (
              <p className={cal.empty}>Nothing scheduled in {monthLabel} for these filters.</p>
            )}
          </div>
        )}

        <aside className={cal.panel} aria-labelledby={`${id}-panel`}>
          {selected ? (
            <>
              <div className={cal.panelHeading}>
                <h2 id={`${id}-panel`}>{dayLabel(selected, 'long')}</h2>
                <IconButton
                  type="button"
                  size="sm"
                  label="Show today and coming up"
                  icon={<X aria-hidden="true" />}
                  onClick={() => setSelected(null)}
                />
              </div>
              {selectedEntries.length ? (
                <ul className={cal.items}>{selectedEntries.map((entry) => scheduleItem(entry))}</ul>
              ) : (
                <p className={cal.empty}>Nothing scheduled.</p>
              )}
            </>
          ) : (
            <>
              <h2 id={`${id}-panel`}>{isCurrentMonth ? 'Today' : monthLabel}</h2>
              {isCurrentMonth &&
                (todayEntries.length ? (
                  <ul className={cal.items}>{todayEntries.map((entry) => scheduleItem(entry))}</ul>
                ) : (
                  <p className={cal.empty}>Nothing scheduled today.</p>
                ))}
              <h3 className={cal.panelSub}>Coming up</h3>
              {upcoming.length ? (
                <ul className={cal.items}>{upcoming.map((entry) => scheduleItem(entry, true))}</ul>
              ) : (
                <p className={cal.empty}>Nothing else this month.</p>
              )}
            </>
          )}
        </aside>
      </div>

      {preview && (
        <dialog
          ref={previewRef}
          className={cal.preview}
          style={{ top: preview.top, left: preview.left }}
          aria-labelledby={`${id}-preview`}
          onCancel={(event) => {
            event.preventDefault();
            closePreview();
          }}
        >
          <div className={cal.previewBody}>
            <div className={cal.panelHeading}>
              <h2 id={`${id}-preview`}>
                {preview.entry.kind === 'visit'
                  ? `Ocular visit · ${preview.entry.visit.clientName}`
                  : preview.entry.booking.clientName}
              </h2>
              <IconButton
                type="button"
                size="sm"
                label="Close"
                icon={<X aria-hidden="true" />}
                onClick={closePreview}
              />
            </div>
            {preview.entry.kind === 'visit' ? (
              <>
                <p className={cal.previewLine}>
                  {dayLabel(dateKey(preview.entry.visit.startsAt), 'long')} ·{' '}
                  {timeLabel(preview.entry.visit.startsAt)}–{timeLabel(preview.entry.visit.endsAt)}
                </p>
                <p className={cal.previewLine}>{visitStatusLabel(preview.entry.visit.status)}</p>
                <ButtonLink href="/admin/front-desk" variant="secondary" size="sm">
                  Open the Front desk
                </ButtonLink>
              </>
            ) : (
              <>
                <StatusChip status={preview.entry.status} />
                <p className={cal.previewLine}>
                  {preview.entry.booking.eventType} ·{' '}
                  {dayLabel(dateKey(preview.entry.booking.startsAt), 'long')} ·{' '}
                  {timeLabel(preview.entry.booking.startsAt)}–
                  {timeLabel(preview.entry.booking.endsAt)}
                </p>
                <p className={cal.previewLine}>
                  {preview.entry.booking.guests} guests ·{' '}
                  {packageShortName(preview.entry.booking.packageName)} ·{' '}
                  {preview.entry.booking.reference}
                </p>
                <ButtonLink
                  href={bookingPagePath(preview.entry.booking.reference)}
                  variant="primary"
                  size="sm"
                >
                  Open booking
                </ButtonLink>
              </>
            )}
          </div>
        </dialog>
      )}
      <p className={styles.srOnly} role="status">
        {shown.length} of {entries.length} events shown in {monthLabel}.
      </p>
    </div>
  );
}
