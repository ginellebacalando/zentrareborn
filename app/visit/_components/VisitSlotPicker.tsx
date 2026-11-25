'use client';

import { useState } from 'react';
import { CircleAlert } from 'lucide-react';
import type { VisitDay } from '@/lib/visit-rules';
import shared from '../../booking/_components/BookingRequest.module.css';
import styles from './Visit.module.css';

const DAYS_PER_PAGE = 12;
const weekday = new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', weekday: 'short' });
const dayMonth = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
});
const fullDay = new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', dateStyle: 'full' });
const clock = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', timeStyle: 'short' });

/** A Manila date key (YYYY-MM-DD) written out, for example "Tuesday, 1 December 2026". */
export function visitDayLabel(dateKey: string) {
  return fullDay.format(new Date(`${dateKey}T00:00:00Z`));
}

/** A visit time in Manila, for example "10:00 AM". */
export function visitClock(iso: string) {
  return clock.format(new Date(iso));
}

/** The Manila date key of an instant. */
export function visitDateKey(iso: string) {
  return new Date(new Date(iso).getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}

export type SlotErrors = { date?: string; time?: string };

/**
 * Day and time choices as native radio groups: arrow keys move within a group, and only days
 * with an open time are listed. The first radio of each group carries the id that error
 * summaries link to (`<idPrefix>-date`, `<idPrefix>-time`).
 */
export default function VisitSlotPicker({
  idPrefix,
  days,
  date,
  time,
  onDate,
  onTime,
  errors = {},
  emptyMessage,
}: {
  idPrefix: string;
  days: VisitDay[];
  date: string;
  time: string;
  onDate: (date: string) => void;
  onTime: (startsAt: string) => void;
  errors?: SlotErrors;
  emptyMessage: string;
}) {
  const open = days.filter((day) => day.slots.length);
  const [shown, setShown] = useState(() =>
    Math.max(DAYS_PER_PAGE, open.findIndex((day) => day.date === date) + 1),
  );
  const chosen = open.find((day) => day.date === date);
  const errorId = (field: keyof SlotErrors) =>
    errors[field] ? `${idPrefix}-${field}-error` : undefined;

  return (
    <>
      <fieldset className={shared.fieldset} aria-describedby={errorId('date')}>
        <legend className={shared.legend}>Choose a day</legend>
        {open.length ? (
          <>
            <ul className={styles.choices}>
              {open.slice(0, shown).map((day, index) => (
                <li key={day.date}>
                  <label className={styles.choice}>
                    <input
                      id={index === 0 ? `${idPrefix}-date` : undefined}
                      type="radio"
                      className={shared.optionInput}
                      name={`${idPrefix}-date`}
                      value={day.date}
                      checked={day.date === date}
                      onChange={() => onDate(day.date)}
                    />
                    <span className={styles.choiceMain} aria-hidden="true">
                      {weekday.format(new Date(`${day.date}T00:00:00Z`))}{' '}
                      {dayMonth.format(new Date(`${day.date}T00:00:00Z`))}
                    </span>
                    <span className={shared.visuallyHidden}>{visitDayLabel(day.date)}, </span>
                    <span className={styles.choiceMeta}>
                      {day.slots.length} {day.slots.length === 1 ? 'time' : 'times'} open
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {shown < open.length && (
              <button
                type="button"
                className={`${shared.secondaryButton} ${styles.more}`}
                onClick={() => setShown((count) => count + DAYS_PER_PAGE)}
              >
                Show more days
              </button>
            )}
          </>
        ) : (
          <p className={shared.hint}>{emptyMessage}</p>
        )}
        {errors.date && (
          <p id={errorId('date')} className={shared.fieldError}>
            <CircleAlert aria-hidden="true" className={shared.inlineIcon} />
            {errors.date}
          </p>
        )}
      </fieldset>

      {chosen && (
        <fieldset className={shared.fieldset} aria-describedby={errorId('time')}>
          <legend className={shared.legend}>Choose a time on {visitDayLabel(chosen.date)}</legend>
          <ul className={styles.choices}>
            {chosen.slots.map((slot, index) => (
              <li key={slot.startsAt}>
                <label className={styles.choice}>
                  <input
                    id={index === 0 ? `${idPrefix}-time` : undefined}
                    type="radio"
                    className={shared.optionInput}
                    name={`${idPrefix}-time`}
                    value={slot.startsAt}
                    checked={slot.startsAt === time}
                    onChange={() => onTime(slot.startsAt)}
                  />
                  <span className={styles.choiceMain}>{visitClock(slot.startsAt)}</span>
                </label>
              </li>
            ))}
          </ul>
          {errors.time && (
            <p id={errorId('time')} className={shared.fieldError}>
              <CircleAlert aria-hidden="true" className={shared.inlineIcon} />
              {errors.time}
            </p>
          )}
        </fieldset>
      )}
    </>
  );
}
