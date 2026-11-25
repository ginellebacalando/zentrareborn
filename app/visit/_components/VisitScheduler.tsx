'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { CheckCircle2, CircleAlert, Info, Mail, MapPin, Phone } from 'lucide-react';
import { BRAND } from '@/config/brand';
import type { VisitDay } from '@/lib/visit-rules';
import { VISIT_FIELD_LIMITS, type ScheduledVisit } from '@/lib/visit-types';
import shared from '../../booking/_components/BookingRequest.module.css';
import styles from './Visit.module.css';
import VisitSlotPicker, { visitClock, visitDateKey, visitDayLabel } from './VisitSlotPicker';

type Field =
  'date' | 'time' | 'fullName' | 'email' | 'phone' | 'eventDate' | 'guests' | 'message' | 'consent';
type Errors = Partial<Record<Field, string>>;

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  eventType: string;
  eventDate: string;
  guests: string;
  message: string;
  consent: boolean;
  website: string;
};

const EMPTY_FORM: FormState = {
  fullName: '',
  email: '',
  phone: '',
  eventType: '',
  eventDate: '',
  guests: '',
  message: '',
  consent: false,
  website: '',
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s()-]{7,30}$/;
/** Field order for the error summary, top to bottom. */
const FIELD_ORDER: Field[] = [
  'date',
  'time',
  'fullName',
  'email',
  'phone',
  'eventDate',
  'guests',
  'message',
  'consent',
];

function validate(form: FormState, date: string, time: string, today: string): Errors {
  const errors: Errors = {};
  if (!date) errors.date = 'Choose a day for your visit.';
  else if (!time) errors.time = 'Choose a time for your visit.';
  if (form.fullName.trim().length < 2) errors.fullName = 'Enter your full name.';
  if (!EMAIL.test(form.email.trim())) errors.email = 'Enter a valid email address.';
  if (!PHONE.test(form.phone.trim())) errors.phone = 'Enter a valid mobile number.';
  if (form.eventDate && form.eventDate < today)
    errors.eventDate = 'Enter an event date from today onward.';
  if (form.guests.trim()) {
    const guests = Number(form.guests);
    if (
      !Number.isInteger(guests) ||
      guests < VISIT_FIELD_LIMITS.guests.min ||
      guests > VISIT_FIELD_LIMITS.guests.max
    )
      errors.guests = 'Enter the number of guests as a whole number, or leave it empty.';
  }
  if (form.message.length > VISIT_FIELD_LIMITS.message)
    errors.message = `Keep the message under ${VISIT_FIELD_LIMITS.message} characters.`;
  if (!form.consent)
    errors.consent = 'Please agree to the privacy notice so we can arrange your visit.';
  return errors;
}

function ContactLinks() {
  return (
    <ul className={shared.contactLinks}>
      <li>
        <a href={BRAND.contact.phoneHref}>
          <Phone aria-hidden="true" className={shared.inlineIcon} />
          {BRAND.contact.phone}
        </a>
      </li>
      <li>
        <a href={BRAND.contact.emailHref}>
          <Mail aria-hidden="true" className={shared.inlineIcon} />
          {BRAND.contact.email}
        </a>
      </li>
    </ul>
  );
}

/** Visit hours, address and directions beside the form. */
function VisitInfo() {
  return (
    <aside className={styles.aside} aria-labelledby="visit-info-title">
      <h2 id="visit-info-title">Good to know</h2>
      <ul className={styles.hours}>
        {BRAND.visits.hours.map((line) => (
          <li key={line.days}>
            <strong>{line.days}</strong>: {line.time}
          </li>
        ))}
      </ul>
      <p>{BRAND.visits.notice}. A visit is free and there is no obligation to book.</p>
      <p>
        <MapPin aria-hidden="true" className={shared.inlineIcon} /> {BRAND.address.full}
      </p>
      <p>
        <a href={BRAND.maps.directionsUrl} target="_blank" rel="noopener noreferrer">
          Get directions in Google Maps
          <span className={shared.visuallyHidden}> (opens in a new tab)</span>
        </a>
      </p>
      <ContactLinks />
    </aside>
  );
}

function Confirmation({ visit, email }: { visit: ScheduledVisit; email: string }) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titleRef.current?.focus();
  }, []);
  return (
    <div className={shared.page}>
      <section className={shared.done} aria-labelledby="visit-done-title">
        <CheckCircle2 aria-hidden="true" className={shared.doneIcon} />
        <h1 id="visit-done-title" ref={titleRef} tabIndex={-1} className={shared.doneTitle}>
          Your visit is scheduled
        </h1>
        <p className={shared.reference}>
          Visit reference <strong>{visit.reference}</strong>
        </p>
        <dl className={styles.details}>
          <dt>Date</dt>
          <dd>{visitDayLabel(visitDateKey(visit.startsAt))}</dd>
          <dt>Time</dt>
          <dd>
            {visitClock(visit.startsAt)} to {visitClock(visit.endsAt)} (Manila time)
          </dd>
          <dt>Venue</dt>
          <dd>
            {BRAND.legalName}, {BRAND.address.full}
          </dd>
        </dl>
        <p className={`${styles.status} ${styles.statusSuccess}`}>
          {visit.emailed
            ? `We sent a confirmation with a calendar invitation to ${email}. If it is not in your inbox, please check your Spam or Junk folder.`
            : 'Your visit is saved. Keep your visit reference; our team will contact you if anything changes.'}
        </p>
        <p className={shared.muted}>
          Need a different time? Use the link in your confirmation email
          {visit.managePath ? ' or the button below' : ''} to reschedule or cancel.
        </p>
        <div className={shared.actions}>
          {visit.managePath ? (
            <Link href={visit.managePath} className={shared.secondaryButton}>
              Reschedule or cancel
            </Link>
          ) : (
            <Link href="/" className={shared.secondaryButton}>
              Back to home
            </Link>
          )}
          <a
            href={BRAND.maps.directionsUrl}
            className={shared.primaryButton}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MapPin aria-hidden="true" className={shared.buttonIcon} />
            Get directions
            <span className={shared.visuallyHidden}> (opens in a new tab)</span>
          </a>
        </div>
      </section>
    </div>
  );
}

export type VisitSchedulerProps = {
  days: VisitDay[];
  slotMinutes: number;
  /** Published event types for the optional "Event" choice. */
  eventTypes: string[];
  /** A day from the link (for example Zeni's "Schedule a visit"), when it has open times. */
  initialDate: string;
  /** The link asked for a day that has no open time. */
  initialDateUnavailable: boolean;
  fromZeni: boolean;
  today: string;
  pausedMessage: string | null;
  loadFailed: boolean;
};

/**
 * The public ocular visit page (docs/visits.md): choose a day and an open time, add contact
 * details, and the visit is scheduled at once with a confirmation email. The server rechecks
 * every rule; a time someone else just took reloads the open times.
 */
export default function VisitScheduler(props: VisitSchedulerProps) {
  const id = useId();
  const [days, setDays] = useState(props.days);
  const [date, setDate] = useState(props.initialDate);
  const [time, setTime] = useState('');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState('');
  const [sending, setSending] = useState(false);
  const [scheduled, setScheduled] = useState<ScheduledVisit | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const submitErrorRef = useRef<HTMLParagraphElement>(null);

  // The slot picker gives its first day and time radios the same ids.
  const fieldId = (field: Field) => `${id}-${field}`;
  const errorId = (field: Field) => `${fieldId(field)}-error`;
  const describedBy = (field: Field, hint?: string) =>
    [hint, errors[field] ? errorId(field) : null].filter(Boolean).join(' ') || undefined;
  const fieldError = (field: Field) =>
    errors[field] ? (
      <p id={errorId(field)} className={shared.fieldError}>
        <CircleAlert aria-hidden="true" className={shared.inlineIcon} />
        {errors[field]}
      </p>
    ) : null;
  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (key in errors) setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function reloadTimes() {
    try {
      const response = await fetch('/api/client/visits', { cache: 'no-store' });
      if (!response.ok) return;
      const body = (await response.json()) as { days: VisitDay[] };
      setDays(body.days);
    } catch {
      // The visitor can still reload the page; the error message explains what happened.
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const found = validate(form, date, time, props.today);
    setErrors(found);
    setSubmitError('');
    if (Object.keys(found).length) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setSending(true);
    try {
      const response = await fetch('/api/client/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startsAt: time,
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          eventType: form.eventType,
          eventDate: form.eventDate,
          guests: form.guests.trim() ? Number(form.guests) : null,
          message: form.message.trim(),
          consent: form.consent,
          fromZeni: props.fromZeni,
          website: form.website,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as ScheduledVisit & {
        error?: string;
        code?: string;
      };
      if (!response.ok) {
        // Someone else took the time a moment ago: show the times that are still open.
        if (body.code === 'TIME_TAKEN') {
          setTime('');
          await reloadTimes();
        }
        throw new Error(body.error || 'We could not schedule your visit. Please try again.');
      }
      setScheduled(body);
    } catch (failure) {
      setSubmitError(
        failure instanceof Error
          ? failure.message
          : 'We could not schedule your visit. Please try again.',
      );
      requestAnimationFrame(() => submitErrorRef.current?.focus());
    } finally {
      setSending(false);
    }
  }

  if (scheduled) return <Confirmation visit={scheduled} email={form.email.trim()} />;

  if (props.pausedMessage || props.loadFailed)
    return (
      <div className={shared.page}>
        <header className={shared.intro}>
          <h1 className={shared.title}>Schedule an ocular visit</h1>
        </header>
        <div className={shared.notice} role="status">
          <Info aria-hidden="true" className={shared.noticeIcon} />
          <div>
            <p className={shared.noticeTitle}>Online visit scheduling is unavailable right now.</p>
            <p>
              {props.pausedMessage ??
                'Please contact us and our team will arrange your visit directly.'}
            </p>
            <ContactLinks />
          </div>
        </div>
      </div>
    );

  const errorList = FIELD_ORDER.filter((field) => errors[field]);
  return (
    <div className={shared.page}>
      <header className={shared.intro}>
        <h1 className={shared.title}>Schedule an ocular visit</h1>
        <p className={shared.lead}>
          See the venue in person before you book. Choose a day and time, and you will get a
          confirmation email with a calendar invitation right away.
        </p>
        <ul className={styles.facts}>
          <li>A visit takes about {props.slotMinutes} minutes.</li>
          <li>A member of our team shows you around and answers your questions.</li>
          <li>You can reschedule or cancel with the link in your email.</li>
        </ul>
      </header>

      <div className={shared.layout}>
        <form
          className={shared.panel}
          onSubmit={submit}
          noValidate
          aria-busy={sending}
          aria-labelledby={`${id}-form-title`}
        >
          <h2 id={`${id}-form-title`} className={shared.stepTitle}>
            Your visit
          </h2>

          {errorList.length ? (
            <div ref={summaryRef} tabIndex={-1} className={shared.errorSummary} role="alert">
              <p className={shared.errorSummaryTitle}>
                <CircleAlert aria-hidden="true" className={shared.inlineIcon} />
                Please check {errorList.length === 1 ? 'this detail' : 'these details'}:
              </p>
              <ul>
                {errorList.map((field) => (
                  <li key={field}>
                    <a href={`#${fieldId(field)}`}>{errors[field]}</a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {props.initialDateUnavailable && (
            <p className={styles.status} role="status">
              The day you asked about has no open visit times. Please choose another day below.
            </p>
          )}

          <VisitSlotPicker
            idPrefix={id}
            days={days}
            date={date}
            time={time}
            onDate={(value) => {
              setDate(value);
              setTime('');
              setErrors((current) => ({ ...current, date: undefined, time: undefined }));
            }}
            onTime={(value) => {
              setTime(value);
              setErrors((current) => ({ ...current, time: undefined }));
            }}
            errors={{ date: errors.date, time: errors.time }}
            emptyMessage="No visit times are open in the coming weeks. Please call or email us and we will arrange a visit."
          />

          <fieldset className={shared.fieldset}>
            <legend className={shared.legend}>Your contact details</legend>
            <div className={shared.fieldGrid}>
              <div className={`${shared.field} ${shared.fieldWide}`}>
                <label htmlFor={fieldId('fullName')} className={shared.label}>
                  Full name
                </label>
                <input
                  id={fieldId('fullName')}
                  className={shared.input}
                  autoComplete="name"
                  maxLength={VISIT_FIELD_LIMITS.name}
                  value={form.fullName}
                  onChange={(event) => update('fullName', event.target.value)}
                  aria-invalid={Boolean(errors.fullName)}
                  aria-describedby={describedBy('fullName')}
                />
                {fieldError('fullName')}
              </div>
              <div className={shared.field}>
                <label htmlFor={fieldId('email')} className={shared.label}>
                  Email
                </label>
                <input
                  id={fieldId('email')}
                  className={shared.input}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  maxLength={VISIT_FIELD_LIMITS.email}
                  value={form.email}
                  onChange={(event) => update('email', event.target.value)}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={describedBy('email', `${id}-email-hint`)}
                />
                <p id={`${id}-email-hint`} className={shared.hint}>
                  We send the confirmation and your reschedule link here.
                </p>
                {fieldError('email')}
              </div>
              <div className={shared.field}>
                <label htmlFor={fieldId('phone')} className={shared.label}>
                  Mobile number
                </label>
                <input
                  id={fieldId('phone')}
                  className={shared.input}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={VISIT_FIELD_LIMITS.phone}
                  value={form.phone}
                  onChange={(event) => update('phone', event.target.value)}
                  aria-invalid={Boolean(errors.phone)}
                  aria-describedby={describedBy('phone')}
                />
                {fieldError('phone')}
              </div>
            </div>
          </fieldset>

          <fieldset className={shared.fieldset}>
            <legend className={shared.legend}>
              About your event <span className={shared.optional}>(optional)</span>
            </legend>
            <div className={shared.fieldGrid}>
              <div className={shared.field}>
                <label htmlFor={`${id}-eventType`} className={shared.label}>
                  Event
                </label>
                <select
                  id={`${id}-eventType`}
                  className={shared.input}
                  value={form.eventType}
                  onChange={(event) => update('eventType', event.target.value)}
                >
                  <option value="">Not decided yet</option>
                  {props.eventTypes.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div className={shared.field}>
                <label htmlFor={fieldId('eventDate')} className={shared.label}>
                  Event date
                </label>
                <input
                  id={fieldId('eventDate')}
                  className={shared.input}
                  type="date"
                  min={props.today}
                  value={form.eventDate}
                  onChange={(event) => update('eventDate', event.target.value)}
                  aria-invalid={Boolean(errors.eventDate)}
                  aria-describedby={describedBy('eventDate')}
                />
                {fieldError('eventDate')}
              </div>
              <div className={shared.field}>
                <label htmlFor={fieldId('guests')} className={shared.label}>
                  Number of guests
                </label>
                <input
                  id={fieldId('guests')}
                  className={shared.input}
                  type="number"
                  inputMode="numeric"
                  min={VISIT_FIELD_LIMITS.guests.min}
                  max={VISIT_FIELD_LIMITS.guests.max}
                  value={form.guests}
                  onChange={(event) => update('guests', event.target.value)}
                  aria-invalid={Boolean(errors.guests)}
                  aria-describedby={describedBy('guests')}
                />
                {fieldError('guests')}
              </div>
              <div className={`${shared.field} ${shared.fieldWide}`}>
                <label htmlFor={fieldId('message')} className={shared.label}>
                  Anything we should prepare?
                </label>
                <textarea
                  id={fieldId('message')}
                  className={`${shared.input} ${shared.textarea}`}
                  maxLength={VISIT_FIELD_LIMITS.message}
                  value={form.message}
                  onChange={(event) => update('message', event.target.value)}
                  aria-invalid={Boolean(errors.message)}
                  aria-describedby={describedBy('message', `${id}-message-hint`)}
                />
                <p id={`${id}-message-hint`} className={shared.hint}>
                  For example the areas you want to see or questions about packages.
                </p>
                {fieldError('message')}
              </div>
            </div>
          </fieldset>

          <div className={shared.field}>
            <label className={styles.consent} htmlFor={fieldId('consent')}>
              <input
                id={fieldId('consent')}
                type="checkbox"
                checked={form.consent}
                onChange={(event) => update('consent', event.target.checked)}
                aria-invalid={Boolean(errors.consent)}
                aria-describedby={describedBy('consent')}
              />
              <span>
                I agree that {BRAND.legalName} may use these details to arrange my visit, as
                described in the{' '}
                <Link href="/privacy" target="_blank">
                  Privacy Notice
                </Link>{' '}
                (opens in a new tab).
              </span>
            </label>
            {fieldError('consent')}
          </div>

          <div className={shared.honeypot} aria-hidden="true">
            <label htmlFor={`${id}-website`}>Leave this field empty</label>
            <input
              id={`${id}-website`}
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={(event) => update('website', event.target.value)}
            />
          </div>

          {submitError ? (
            <p ref={submitErrorRef} tabIndex={-1} className={shared.submitError} role="alert">
              <CircleAlert aria-hidden="true" className={shared.inlineIcon} />
              {submitError}
            </p>
          ) : null}

          <div className={shared.actions}>
            <Link href="/booking" className={shared.secondaryButton}>
              Ready to book instead?
            </Link>
            <button type="submit" className={shared.primaryButton} disabled={sending}>
              {sending ? 'Scheduling…' : 'Schedule my visit'}
            </button>
          </div>
        </form>
        <VisitInfo />
      </div>
    </div>
  );
}
