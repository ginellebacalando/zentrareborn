'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { zeniCopyFor } from '@/config/chatbot-receptionist';
import type { ZeniLanguage } from '@/lib/chatbot/language';
import type { ZeniCalendarCard, ZeniDetailCard } from '@/lib/chatbot/types';
import styles from './Chatbot.module.css';

export function DetailCard({ card, onNavigate }: { card: ZeniDetailCard; onNavigate: () => void }) {
  const titleId = useId();
  return (
    <article className={styles.detailCard} aria-labelledby={titleId}>
      {card.image ? (
        <Image
          src={card.image.src}
          alt={card.image.alt}
          width={96}
          height={96}
          sizes="96px"
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

/**
 * Month view of the next two months. Dates with a confirmed admin-calendar event are marked
 * booked (with text, not color alone); choosing an open date asks Zeni to check it.
 * Arrow keys move between days, Page Up/Down between months; only one day is in the Tab order.
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
  const unavailable = useMemo(() => new Set(card.unavailable), [card.unavailable]);
  const firstMonth = monthKey(card.from);
  const lastMonth = monthKey(card.to);
  const initialFocus = card.selected && card.selected >= card.from ? card.selected : card.from;
  const [month, setMonth] = useState(monthKey(initialFocus));
  const [focusKey, setFocusKey] = useState(initialFocus);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const keyboardMove = useRef(false);

  useEffect(() => {
    if (!keyboardMove.current) return;
    keyboardMove.current = false;
    buttons.current.get(focusKey)?.focus();
  }, [focusKey, month]);

  const inRange = (key: string) => key >= card.from && key <= card.to;
  const status = (key: string) =>
    !inRange(key) ? 'outside' : unavailable.has(key) ? 'booked' : 'open';

  function moveFocus(target: string) {
    const clamped = target < card.from ? card.from : target > card.to ? card.to : target;
    keyboardMove.current = true;
    setMonth(monthKey(clamped));
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

  return (
    <section className={styles.calendarCard} aria-labelledby={headingId} aria-describedby={noteId}>
      <div className={styles.calendarHeader}>
        <button
          type="button"
          className={styles.calendarNav}
          aria-label={copy.previousMonth}
          disabled={month <= firstMonth}
          onClick={() => setMonth((value) => shiftMonth(value, -1))}
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
          disabled={month >= lastMonth}
          onClick={() => setMonth((value) => shiftMonth(value, 1))}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
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
          const label = `${fullDate(key)}, ${
            state === 'booked' ? copy.booked : state === 'outside' ? copy.outside : copy.open
          }${selected ? `, ${copy.selected}` : ''}`;
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
      <div className={styles.calendarLegend} aria-hidden="true">
        <span className={styles.legendItem} data-state="booked">
          {copy.legendBooked}
        </span>
        <span className={styles.legendItem} data-state="open">
          {copy.legendOpen}
        </span>
      </div>
      <p id={noteId} className={styles.calendarNote}>
        {copy.note}
      </p>
    </section>
  );
}
