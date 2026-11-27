'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { zeniCopyFor } from '@/config/chatbot-receptionist';
import type { ZeniLanguage } from '@/lib/chatbot/language';
import type { ZeniCalendarCard, ZeniCalendarMonth, ZeniDetailCard } from '@/lib/chatbot/types';
import styles from './Chatbot.module.css';

export function DetailCard({ card, onNavigate }: { card: ZeniDetailCard; onNavigate: () => void }) {
  const titleId = useId();
  return (
    <article className={styles.detailCard} aria-labelledby={titleId}>
      {card.image ? (
        // A 6rem square, or the card's full width (at most 15rem) in a narrow chat: 240px covers
        // both, so a landscape photo cropped to a square is never enlarged.
        <Image
          src={card.image.src}
          alt={card.image.alt}
          width={96}
          height={96}
          sizes="240px"
          className={styles.detailImage}
        />
      ) : null}
      <div className={styles.detailBody}>
        <h3 id={titleId} className={styles.detailTitle}>
          {card.title}
        </h3>
        {card.description ? <p className={styles.detailText}>{card.description}</p> : null}
        {card.startsAt ? <p className={styles.detailPrice}>{card.startsAt}</p> : null}
        <Link href={card.href} className={styles.detailLink} onClick={onNavigate}>
          {card.linkLabel}
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function shiftDate(key: string, days: number) {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function monthKey(key: string) {
  return key.slice(0, 7);
}

function shiftMonth(month: string, delta: number) {
  const [year, value] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, value - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

function fullDate(key: string) {
  return new Intl.DateTimeFormat('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${key}T12:00:00Z`));
}

function shortDate(key: string) {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${key}T12:00:00Z`));
}

function monthLabel(month: string) {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T12:00:00Z`));
}

function monthCells(month: string) {
  const first = `${month}-01`;
  const offset = new Date(`${first}T12:00:00Z`).getUTCDay();
  const cells: Array<string | null> = Array.from({ length: offset }, () => null);
  for (let key = first; monthKey(key) === month; key = shiftDate(key, 1)) cells.push(key);
  while (cells.length % 7) cells.push(null);
  return cells;
}

type MonthData =
  | { status: 'ready'; unavailable: ReadonlySet<string> }
  | { status: 'loading' }
  | { status: 'error' };

type DayState = 'open' | 'booked' | 'notice' | 'pending' | 'outside';

/** Every month from `first` to `last` (YYYY-MM), inclusive. */
function monthsBetween(first: string, last: string) {
  const months: string[] = [];
  for (let month = first; month <= last; month = shiftMonth(month, 1)) months.push(month);
  return months;
}

/**
 * Month view of the booking window (docs/booking-window.md): from today to the last bookable date,
 * one month at a time. Each month's held or booked dates load when it is opened. Days inside the
 * minimum notice period and booked days say why they cannot be chosen (text, not color alone);
 * choosing an open date asks Zeni to check it. Arrow keys move between days, Page Up/Down between
 * months; only one day is in the Tab order.
 */
export function CalendarCard({
  card,
  language,
  disabled,
  onPick,
}: {
  card: ZeniCalendarCard;
  language: ZeniLanguage | undefined;
  disabled: boolean;
  onPick: (date: string, label: string) => void;
}) {
  const copy = zeniCopyFor(language).calendar;
  const headingId = useId();
  const noteId = useId();
  const limitId = useId();
  const earliest = card.earliest ?? card.from;
  const firstMonth = monthKey(card.from);
  const lastMonth = monthKey(card.to);
  const chosen =
    card.selected && card.selected >= card.from && card.selected <= card.to ? card.selected : null;
  const openingMonth = card.month ?? monthKey(chosen ?? card.from);
  const initialFocus =
    chosen ??
    (monthKey(earliest) === openingMonth && earliest <= card.to ? earliest : `${openingMonth}-01`);
  const [months, setMonths] = useState<Record<string, MonthData>>(() => {
    const unavailable = new Set(card.unavailable);
    // A card saved before months loaded separately holds every month's dates.
    const loaded = card.month ? [card.month] : monthsBetween(firstMonth, lastMonth);
    return Object.fromEntries(
      loaded.map((month) => [month, { status: 'ready', unavailable } satisfies MonthData]),
    );
  });
  const [month, setMonth] = useState(openingMonth);
  const [focusKey, setFocusKey] = useState(initialFocus);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const keyboardMove = useRef(false);
  const requested = useRef(new Set<string>(Object.keys(months)));

  useEffect(() => {
    if (!keyboardMove.current) return;
    keyboardMove.current = false;
    buttons.current.get(focusKey)?.focus();
  }, [focusKey, month]);

  async function load(target: string) {
    setMonths((current) => ({ ...current, [target]: { status: 'loading' } }));
    try {
      const response = await fetch(`/api/client/chatbot/calendar?month=${target}`, {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('calendar');
      const data = (await response.json()) as ZeniCalendarMonth;
      setMonths((current) => ({
        ...current,
        [target]: { status: 'ready', unavailable: new Set(data.unavailable) },
      }));
    } catch {
      requested.current.delete(target);
      setMonths((current) => ({ ...current, [target]: { status: 'error' } }));
    }
  }

  /** Shows a month, loading its dates the first time it is opened. */
  function showMonth(target: string) {
    const clamped = target < firstMonth ? firstMonth : target > lastMonth ? lastMonth : target;
    setMonth(clamped);
    if (!requested.current.has(clamped)) {
      requested.current.add(clamped);
      void load(clamped);
    }
    return clamped;
  }

  const inRange = (key: string) => key >= card.from && key <= card.to;
  const status = (key: string): DayState => {
    if (!inRange(key)) return 'outside';
    if (key < earliest) return 'notice';
    const data = months[monthKey(key)];
    if (data?.status !== 'ready') return 'pending';
    return data.unavailable.has(key) ? 'booked' : 'open';
  };

  function moveFocus(target: string) {
    const clamped = target < card.from ? card.from : target > card.to ? card.to : target;
    keyboardMove.current = true;
    showMonth(monthKey(clamped));
    setFocusKey(clamped);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, key: string) {
    const weekday = new Date(`${key}T12:00:00Z`).getUTCDay();
    const moves: Record<string, () => string> = {
      ArrowLeft: () => shiftDate(key, -1),
      ArrowRight: () => shiftDate(key, 1),
      ArrowUp: () => shiftDate(key, -7),
      ArrowDown: () => shiftDate(key, 7),
      Home: () => shiftDate(key, -weekday),
      End: () => shiftDate(key, 6 - weekday),
      PageUp: () => `${shiftMonth(monthKey(key), -1)}-01`,
      PageDown: () => `${shiftMonth(monthKey(key), 1)}-01`,
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    moveFocus(move());
  }

  const cells = monthCells(month);
  const focusInMonth = monthKey(focusKey) === month ? focusKey : null;
  const tabbable =
    focusInMonth ?? cells.find((key): key is string => Boolean(key && inRange(key))) ?? null;
  const shown = months[month];
  const minNoticeDays = card.minNoticeDays ?? 0;
  const dayLabel: Record<DayState, string> = {
    open: copy.open,
    booked: copy.booked,
    notice: copy.notice(minNoticeDays),
    pending: copy.loading,
    outside: copy.outside,
  };

  return (
    <section className={styles.calendarCard} aria-labelledby={headingId} aria-describedby={noteId}>
      <div className={styles.calendarHeader}>
        <button
          type="button"
          className={styles.calendarNav}
          aria-label={copy.previousMonth}
          disabled={month <= firstMonth}
          onClick={() => showMonth(shiftMonth(month, -1))}
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <h3 id={headingId} className={styles.calendarMonth} aria-live="polite">
          {monthLabel(month)}
        </h3>
        <button
          type="button"
          className={styles.calendarNav}
          aria-label={copy.nextMonth}
          aria-describedby={month >= lastMonth && card.maxMonthsAhead ? limitId : undefined}
          disabled={month >= lastMonth}
          onClick={() => showMonth(shiftMonth(month, 1))}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
      {shown?.status === 'loading' ? (
        <p className={styles.calendarStatus} role="status">
          {copy.loading}
        </p>
      ) : shown?.status === 'error' ? (
        <p className={styles.calendarStatus} role="alert">
          {copy.loadError}{' '}
          <button type="button" className={styles.calendarRetry} onClick={() => showMonth(month)}>
            {copy.retry}
          </button>
        </p>
      ) : null}
      <div className={styles.calendarGrid} role="group" aria-labelledby={headingId}>
        {WEEKDAYS.map((day) => (
          <span key={day} className={styles.calendarWeekday} aria-hidden="true">
            {day}
          </span>
        ))}
        {cells.map((key, index) => {
          if (!key) return <span key={`blank-${index}`} aria-hidden="true" />;
          const state = status(key);
          const selected = key === card.selected;
          const blocked = state !== 'open' || disabled;
          const label = `${fullDate(key)}, ${dayLabel[state]}${selected ? `, ${copy.selected}` : ''}`;
          return (
            <button
              key={key}
              ref={(element) => {
                if (element) buttons.current.set(key, element);
                else buttons.current.delete(key);
              }}
              type="button"
              className={styles.calendarDay}
              data-state={state}
              data-selected={selected || undefined}
              data-today={key === card.today || undefined}
              aria-label={label}
              aria-disabled={blocked || undefined}
              aria-current={selected ? 'date' : undefined}
              tabIndex={key === tabbable ? 0 : -1}
              onKeyDown={(event) => onKeyDown(event, key)}
              onFocus={() => setFocusKey(key)}
              onClick={() => {
                if (blocked) return;
                onPick(key, copy.check(shortDate(key)));
              }}
            >
              <span aria-hidden="true">{Number(key.slice(8))}</span>
            </button>
          );
        })}
      </div>
      {/* Each day's name already says its status; the legend repeats it for the eye. */}
      <div className={styles.calendarLegend} aria-hidden="true">
        <span className={styles.legendItem} data-state="open">
          {copy.legendOpen}
        </span>
        <span className={styles.legendItem} data-state="booked">
          {copy.legendBooked}
        </span>
        {minNoticeDays ? (
          <span className={styles.legendItem} data-state="notice">
            {copy.legendNotice}
          </span>
        ) : null}
      </div>
      <p id={noteId} className={styles.calendarNote}>
        {card.maxMonthsAhead ? (
          <span id={limitId} className={styles.calendarLimit}>
            {minNoticeDays ? `${copy.noticeNote(minNoticeDays)} ` : ''}
            {copy.limitNote(card.maxMonthsAhead, monthLabel(lastMonth))}
          </span>
        ) : null}{' '}
        {copy.note}
      </p>
    </section>
  );
}
