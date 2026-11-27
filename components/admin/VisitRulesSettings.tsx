'use client';

import { useId, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  visitRulesProblem,
  VISIT_CAPACITY,
  VISIT_CLOSED_DATES_MAX,
  VISIT_NOTICE_HOURS,
  VISIT_SLOT_MINUTES,
  WEEKDAYS,
  type VisitRuleField,
  type VisitRules,
} from '@/lib/visit-rules';
import styles from './admin.module.css';
import local from './VisitRulesSettings.module.css';
import { Button } from '@/components/shared/Button';

/** Lets the Settings form check these rules on save, before anything is sent. */
export type VisitRulesHandle = {
  /** The rules to save, or null after showing the problem under its field and focusing it. */
  validate: () => VisitRules | null;
};

type Draft = {
  days: { open: boolean; from: string; to: string }[];
  slotMinutes: string;
  capacity: string;
  noticeHours: string;
  closedDates: string[];
};

const closedDate = new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', dateStyle: 'full' });

function draftOf(rules: VisitRules): Draft {
  return {
    days: rules.weekly.map((hours) => ({
      open: Boolean(hours),
      from: hours?.open ?? '10:00',
      to: hours?.close ?? '18:00',
    })),
    slotMinutes: String(rules.slotMinutes),
    capacity: String(rules.capacity),
    noticeHours: String(rules.noticeHours),
    closedDates: [...rules.closedDates].sort(),
  };
}

function rulesOf(draft: Draft): VisitRules {
  const whole = (value: string) => (value.trim() ? Number(value) : Number.NaN);
  return {
    weekly: draft.days.map((day) => (day.open ? { open: day.from, close: day.to } : null)),
    slotMinutes: Number(draft.slotMinutes),
    capacity: whole(draft.capacity),
    noticeHours: whole(draft.noticeHours),
    closedDates: draft.closedDates,
  };
}

/**
 * Settings > Ocular Visits (docs/visits.md): the weekly hours, how long a visit lasts, how many
 * visits share a time, the notice the website needs and the dates without visits. Checked on
 * save like the other rule cards; the problem appears under its own field.
 */
export default function VisitRulesSettings({
  initial,
  disabled,
  ref,
}: {
  initial: VisitRules;
  disabled: boolean;
  ref: Ref<VisitRulesHandle>;
}) {
  const id = useId();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const fields = useRef<Partial<Record<string, HTMLElement | null>>>({});
  const [draft, setDraft] = useState(() => draftOf(initial));
  const [newDate, setNewDate] = useState('');
  // `attempt` remounts the message so a repeated save failure is announced again.
  const [error, setError] = useState<{
    field: VisitRuleField;
    message: string;
    attempt: number;
  } | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      validate() {
        const rules = rulesOf(draft);
        const issue = visitRulesProblem(rules);
        if (!issue) {
          setError(null);
          return rules;
        }
        setError((current) => ({
          field: issue.field,
          message: issue.problem,
          attempt: (current?.attempt ?? 0) + 1,
        }));
        // The fields sit in a disclosure that may be closed; open it before moving focus there.
        if (detailsRef.current) detailsRef.current.open = true;
        requestAnimationFrame(() => fields.current[issue.field]?.focus());
        return null;
      },
    }),
    [draft],
  );

  const errorId = `${id}-error`;
  const errorFor = (field: VisitRuleField) =>
    error?.field === field ? (
      <p key={error.attempt} id={errorId} className={styles.error} role="alert">
        {error.message}
      </p>
    ) : null;
  const describedBy = (field: VisitRuleField, help?: string) =>
    [help, error?.field === field ? errorId : null].filter(Boolean).join(' ') || undefined;
  function change(next: Partial<Draft>, field: VisitRuleField) {
    setDraft((current) => ({ ...current, ...next }));
    if (error?.field === field) setError(null);
  }
  function changeDay(index: number, next: Partial<Draft['days'][number]>) {
    change(
      { days: draft.days.map((day, at) => (at === index ? { ...day, ...next } : day)) },
      `weekly.${index}`,
    );
  }

  return (
    <details ref={detailsRef} className={`${styles.settingsCard} ${styles.settingsDisclosure}`}>
      <summary>
        <h2 className={styles.settingsSectionTitle}>
          Ocular visits
          <ChevronDown size={20} aria-hidden="true" />
        </h2>
      </summary>
      <div className={styles.settingsCardBody}>
        <p className={styles.help}>
          When visitors can schedule an ocular visit on the website visit page. Times that overlap a
          confirmed or held event are never offered. Staff on the Front desk can schedule any open
          time without the notice below.
        </p>
        <div className={local.days}>
          {WEEKDAYS.map((name, index) => {
            const day = draft.days[index];
            const field = `weekly.${index}` as const;
            return (
              <fieldset key={name} className={local.day} disabled={disabled}>
                <legend>{name}</legend>
                <label className={local.toggle}>
                  <input
                    type="checkbox"
                    checked={day.open}
                    onChange={(event) => changeDay(index, { open: event.target.checked })}
                  />
                  Takes visits
                </label>
                <div className={local.times}>
                  <label>
                    Opens
                    <input
                      ref={(input) => {
                        fields.current[field] = input;
                      }}
                      type="time"
                      step={900}
                      required={day.open}
                      disabled={!day.open}
                      value={day.from}
                      aria-invalid={error?.field === field ? true : undefined}
                      aria-describedby={describedBy(field)}
                      onChange={(event) => changeDay(index, { from: event.target.value })}
                    />
                  </label>
                  <label>
                    Closes
                    <input
                      type="time"
                      step={900}
                      required={day.open}
                      disabled={!day.open}
                      value={day.to}
                      aria-invalid={error?.field === field ? true : undefined}
                      aria-describedby={describedBy(field)}
                      onChange={(event) => changeDay(index, { to: event.target.value })}
                    />
                  </label>
                </div>
                {errorFor(field)}
              </fieldset>
            );
          })}
        </div>
        <div className={styles.settingsEmails}>
          <label>
            Length of each visit
            <select
              ref={(select) => {
                fields.current.slotMinutes = select;
              }}
              disabled={disabled}
              value={draft.slotMinutes}
              aria-invalid={error?.field === 'slotMinutes' ? true : undefined}
              aria-describedby={describedBy('slotMinutes')}
              onChange={(event) => change({ slotMinutes: event.target.value }, 'slotMinutes')}
            >
              {VISIT_SLOT_MINUTES.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} minutes
                </option>
              ))}
            </select>
          </label>
          {errorFor('slotMinutes')}
        </div>
        <div className={styles.settingsEmails}>
          <label>
            Visits at the same time
            <input
              ref={(input) => {
                fields.current.capacity = input;
              }}
              type="number"
              inputMode="numeric"
              min={VISIT_CAPACITY.min}
              max={VISIT_CAPACITY.max}
              step={1}
              required
              disabled={disabled}
              value={draft.capacity}
              aria-invalid={error?.field === 'capacity' ? true : undefined}
              aria-describedby={describedBy('capacity', `${id}-capacity-help`)}
              onChange={(event) => change({ capacity: event.target.value }, 'capacity')}
            />
          </label>
          <p id={`${id}-capacity-help`} className={styles.help}>
            How many visitors or groups staff can show around at once ({VISIT_CAPACITY.min} to{' '}
            {VISIT_CAPACITY.max}).
          </p>
          {errorFor('capacity')}
        </div>
        <div className={styles.settingsEmails}>
          <label>
            Hours of notice for website visits
            <input
              ref={(input) => {
                fields.current.noticeHours = input;
              }}
              type="number"
              inputMode="numeric"
              min={VISIT_NOTICE_HOURS.min}
              max={VISIT_NOTICE_HOURS.max}
              step={1}
              required
              disabled={disabled}
              value={draft.noticeHours}
              aria-invalid={error?.field === 'noticeHours' ? true : undefined}
              aria-describedby={describedBy('noticeHours', `${id}-notice-help`)}
              onChange={(event) => change({ noticeHours: event.target.value }, 'noticeHours')}
            />
          </label>
          <p id={`${id}-notice-help`} className={styles.help}>
            The website offers no time sooner than this ({VISIT_NOTICE_HOURS.min} to{' '}
            {VISIT_NOTICE_HOURS.max} hours), so staff can prepare.
          </p>
          {errorFor('noticeHours')}
        </div>
        <div className={styles.settingsEmails}>
          <div className={local.addDate}>
            <label>
              Closed dates
              <input
                ref={(input) => {
                  fields.current.closedDates = input;
                }}
                type="date"
                disabled={disabled}
                value={newDate}
                aria-invalid={error?.field === 'closedDates' ? true : undefined}
                aria-describedby={describedBy('closedDates', `${id}-dates-help`)}
                onChange={(event) => setNewDate(event.target.value)}
              />
            </label>
            <Button
              type="button"
              variant="secondary"
              disabled={disabled}
              disabledReason={
                disabled
                  ? null
                  : !newDate
                    ? 'Choose a date first'
                    : draft.closedDates.includes(newDate)
                      ? 'This date is already listed'
                      : draft.closedDates.length >= VISIT_CLOSED_DATES_MAX
                        ? `Up to ${VISIT_CLOSED_DATES_MAX} closed dates`
                        : null
              }
              onClick={() => {
                change({ closedDates: [...draft.closedDates, newDate].sort() }, 'closedDates');
                setNewDate('');
              }}
            >
              Add date
            </Button>
          </div>
          <p id={`${id}-dates-help`} className={styles.help}>
            Holidays or private days: the website offers no visit times on these dates. Up to{' '}
            {VISIT_CLOSED_DATES_MAX} dates.
          </p>
          {draft.closedDates.length > 0 && (
            <ul className={local.dates} aria-label="Closed dates">
              {draft.closedDates.map((date) => {
                const label = closedDate.format(new Date(`${date}T00:00:00Z`));
                return (
                  <li key={date}>
                    <span>{label}</span>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={disabled}
                      aria-label={`Remove ${label}`}
                      onClick={() =>
                        change(
                          { closedDates: draft.closedDates.filter((value) => value !== date) },
                          'closedDates',
                        )
                      }
                    >
                      Remove
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          {errorFor('closedDates')}
        </div>
      </div>
    </details>
  );
}
