'use client';

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import useSWR from 'swr';
import { CalendarPlus, LoaderCircle, RefreshCw, Search, UserPlus } from 'lucide-react';
import { displayStatus } from '@/lib/admin/dashboard-status';
import {
  visitSourceLabel,
  visitStatusLabel,
  VISIT_FIELD_LIMITS,
  type ClientLookup,
  type FrontDeskAgenda,
  type FrontDeskEvent,
  type FrontDeskSlots,
  type FrontDeskVisit,
  type VisitStatus,
} from '@/lib/visit-types';
import Link from 'next/link';
import { StatusChip } from './BookingStatus';
import { bookingPagePath } from './booking-links';
import ClientPhotoAvatar, { ClientPhotoStatus } from './ClientPhoto';
import AdminPageHeader from './AdminPageHeader';
import styles from './FrontDesk.module.css';
import { Button, ButtonLink, IconButton } from '@/components/shared/Button';
import MoreMenu from './MoreMenu';

const ENDPOINT = '/api/admin/front-desk';
/** Walk-in bookings at the desk (components/admin/WalkInBooking.tsx). */
const WALK_IN_PATH = '/admin/front-desk/walk-in';
/** The confirmation of the last action; it takes focus when the visit it was about moved away. */
const NOTICE_ID = 'front-desk-notice';
const clock = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', timeStyle: 'short' });
const longDay = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const shortDay = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const mediumDate = new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', dateStyle: 'medium' });
const moment = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  dateStyle: 'medium',
  timeStyle: 'short',
});

const STATUS_TONES: Record<VisitStatus, string> = {
  SCHEDULED: styles.toneScheduled,
  CHECKED_IN: styles.toneCheckedIn,
  COMPLETED: styles.toneCompleted,
  NO_SHOW: styles.toneClosed,
  CANCELLED: styles.toneClosed,
};

type ActResult = { ok: true; body: Record<string, unknown> } | { ok: false; error: string };
type Act = (payload: Record<string, unknown>, success: string) => Promise<ActResult>;
/** Contact details carried into the schedule form, for example from the client lookup. */
type Prefill = { clientName: string; email: string; phone: string };

async function load<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Front desk data is unavailable.');
  return body;
}

/** Kept outside render so the components stay pure. */
function hasStarted(iso: string) {
  return new Date(iso).getTime() <= Date.now();
}

function manilaDateKey(iso: string) {
  return new Date(new Date(iso).getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}

function timeRange(startsAt: string, endsAt: string) {
  return `${clock.format(new Date(startsAt))} to ${clock.format(new Date(endsAt))}`;
}

function StatusBadge({ status }: { status: VisitStatus }) {
  return (
    <span className={`${styles.badge} ${STATUS_TONES[status] ?? styles.toneClosed}`}>
      {visitStatusLabel(status)}
    </span>
  );
}

/** A day select and a time select over the open visit times (staff need no notice). */
function SlotSelects({
  except,
  value,
  onChange,
}: {
  except?: string;
  value: string;
  onChange: (startsAt: string) => void;
}) {
  const { data, error, isLoading } = useSWR<FrontDeskSlots>(
    `${ENDPOINT}?slots=1${except ? `&except=${encodeURIComponent(except)}` : ''}`,
    load,
    { shouldRetryOnError: false },
  );
  const [date, setDate] = useState('');
  const open = data?.days.filter((day) => day.slots.length) ?? [];
  const chosen = open.find((day) => day.date === date);
  return (
    <>
      <label className={styles.field}>
        Day
        <select
          value={date}
          required
          onChange={(event) => {
            setDate(event.target.value);
            onChange('');
          }}
        >
          <option value="">
            {isLoading ? 'Loading open days…' : open.length ? 'Choose a day' : 'No open days'}
          </option>
          {open.map((day) => (
            <option key={day.date} value={day.date}>
              {shortDay.format(new Date(`${day.date}T00:00:00Z`))} ({day.slots.length} open)
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        Time
        <select
          value={value}
          required
          disabled={!chosen}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">{chosen ? 'Choose a time' : 'Choose a day first'}</option>
          {chosen?.slots.map((slot) => (
            <option key={slot.startsAt} value={slot.startsAt}>
              {clock.format(new Date(slot.startsAt))}
              {slot.remaining > 1 ? ` (${slot.remaining} places)` : ''}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p className={`${styles.alert} ${styles.wide}`} role="alert">
          The open visit times could not be loaded. Refresh and try again.
        </p>
      )}
    </>
  );
}

function FormError({ message }: { message: string }) {
  return message ? (
    <p className={styles.alert} role="alert">
      {message}
    </p>
  ) : null;
}

/** Schedules a visit for a caller or a walk-in who wants to come back another time. */
function ScheduleVisitForm({
  prefill,
  act,
  busy,
  onClose,
}: {
  prefill: Prefill;
  act: Act;
  busy: boolean;
  onClose: () => void;
}) {
  const id = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [startsAt, setStartsAt] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? '').trim();
    if (!startsAt) {
      setError('Choose a day and a time for the visit.');
      return;
    }
    const guests = text('guests');
    const result = await act(
      {
        op: 'schedule-visit',
        visit: {
          clientName: text('clientName'),
          email: text('email'),
          phone: text('phone'),
          startsAt,
          eventType: text('eventType'),
          eventDate: text('eventDate'),
          guests: guests ? Number(guests) : null,
          message: text('message'),
          staffNotes: text('staffNotes'),
        },
        consent: form.get('consent') === 'on',
      },
      `Visit scheduled for ${text('clientName')} on ${moment.format(new Date(startsAt))}.`,
    );
    if (result.ok) onClose();
    else setError(result.error);
  }

  return (
    <section className={styles.card} aria-labelledby={`${id}-title`}>
      <div>
        <h2 id={`${id}-title`} ref={headingRef} tabIndex={-1} className={styles.focusTarget}>
          Schedule a visit
        </h2>
        <p className={styles.intro}>
          For a caller or a walk-in who wants to come back. With an email, the client gets the
          confirmation and calendar invitation; staff calendars get the event either way.
        </p>
      </div>
      <form className={styles.form} onSubmit={submit} aria-busy={busy}>
        <div className={styles.fields}>
          <label className={styles.field}>
            Client name
            <input
              name="clientName"
              required
              minLength={2}
              maxLength={VISIT_FIELD_LIMITS.name}
              autoComplete="off"
              defaultValue={prefill.clientName}
            />
          </label>
          <label className={styles.field}>
            Phone
            <input
              name="phone"
              type="tel"
              required
              maxLength={VISIT_FIELD_LIMITS.phone}
              autoComplete="off"
              defaultValue={prefill.phone}
            />
          </label>
          <label className={styles.field}>
            Email (optional)
            <input
              name="email"
              type="email"
              maxLength={VISIT_FIELD_LIMITS.email}
              autoComplete="off"
              defaultValue={prefill.email}
            />
          </label>
          <SlotSelects value={startsAt} onChange={setStartsAt} />
          <label className={styles.field}>
            Event (optional)
            <input name="eventType" maxLength={VISIT_FIELD_LIMITS.eventType} />
          </label>
          <label className={styles.field}>
            Event date (optional)
            <input name="eventDate" type="date" />
          </label>
          <label className={styles.field}>
            Guests (optional)
            <input
              name="guests"
              type="number"
              min={VISIT_FIELD_LIMITS.guests.min}
              max={VISIT_FIELD_LIMITS.guests.max}
            />
          </label>
          <label className={`${styles.field} ${styles.wide}`}>
            What the client wants to see (optional)
            <textarea name="message" maxLength={VISIT_FIELD_LIMITS.message} rows={2} />
          </label>
          <label className={`${styles.field} ${styles.wide}`}>
            Staff notes (optional, never sent to the client)
            <textarea name="staffNotes" maxLength={VISIT_FIELD_LIMITS.staffNotes} rows={2} />
          </label>
        </div>
        <label className={styles.check}>
          <input name="consent" type="checkbox" required />
          <span>
            The client agreed that Zion may keep these details to arrange the visit (Privacy
            Notice).
          </span>
        </label>
        <FormError message={error} />
        <div className={styles.actions}>
          <Button type="submit" variant="primary" disabled={busy}>
            Schedule visit
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </form>
    </section>
  );
}

type Panel = 'reschedule' | 'cancel' | 'notes' | null;

/** One visit with the actions its state allows; each change is announced and refocused. */
function VisitCard({
  visit,
  today,
  act,
  busy,
  refresh,
  showDate,
}: {
  visit: FrontDeskVisit;
  today: string;
  act: Act;
  busy: boolean;
  /** Reloads the desk after a photo change. */
  refresh: () => unknown;
  showDate?: boolean;
}) {
  const id = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [startsAt, setStartsAt] = useState('');
  const [error, setError] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const status = visit.status;
  const scheduled = status === 'SCHEDULED';
  const started = hasStarted(visit.startsAt);
  const isToday = manilaDateKey(visit.startsAt) === today;
  const name = visit.clientName;

  useEffect(() => {
    if (panel) panelRef.current?.querySelector<HTMLElement>('select, textarea')?.focus();
  }, [panel]);

  /** The Staff notes button opens its panel and closes it again. */
  function open(next: Panel) {
    setError('');
    setStartsAt('');
    setPanel((current) => (current === next ? null : next));
  }

  /** From the More menu: always opens the chosen panel and moves focus into it. */
  function choose(next: Exclude<Panel, null>) {
    setError('');
    setStartsAt('');
    setPanel(next);
    requestAnimationFrame(() =>
      panelRef.current?.querySelector<HTMLElement>('select, textarea')?.focus(),
    );
  }

  /** Closes the open panel and keeps keyboard focus on this visit. */
  function close() {
    open(null);
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  async function run(payload: Record<string, unknown>, success: string) {
    setError('');
    const result = await act({ id: visit.id, ...payload }, success);
    if (result.ok) {
      setPanel(null);
      // The pressed button may be gone now; the visit's heading keeps the place, or the
      // confirmation when the visit left this list (for example a no-show).
      requestAnimationFrame(() =>
        (headingRef.current?.isConnected
          ? headingRef.current
          : document.getElementById(NOTICE_ID)
        )?.focus(),
      );
    } else setError(result.error);
  }

  const when = showDate
    ? `${longDay.format(new Date(visit.startsAt))}, ${timeRange(visit.startsAt, visit.endsAt)}`
    : timeRange(visit.startsAt, visit.endsAt);
  const subject = { kind: 'visit' as const, id: visit.id };
  return (
    <li className={styles.item}>
      <div className={styles.person}>
        <ClientPhotoAvatar
          name={name}
          photo={visit.clientPhoto}
          subject={subject}
          onChanged={refresh}
          size={isToday ? 64 : 48}
        />
        <div className={styles.personText}>
          <div className={styles.itemTop}>
            <h3 id={`${id}-name`} ref={headingRef} tabIndex={-1} className={styles.focusTarget}>
              {clock.format(new Date(visit.startsAt))} · {name}
            </h3>
            <StatusBadge status={status} />
          </div>
          {visit.email && (scheduled || status === 'CHECKED_IN') && (
            <ClientPhotoStatus
              name={name}
              photo={visit.clientPhoto}
              subject={subject}
              onChanged={refresh}
            />
          )}
        </div>
      </div>
      <dl className={styles.facts}>
        <div>
          <dt>When</dt>
          <dd>{when}</dd>
        </div>
        <div>
          <dt>Contact</dt>
          <dd>
            <a href={`tel:${visit.phone.replace(/[^\d+]/g, '')}`}>{visit.phone}</a>
            {visit.email && (
              <>
                <br />
                <a href={`mailto:${visit.email}`}>{visit.email}</a>
              </>
            )}
          </dd>
        </div>
        {(visit.eventType || visit.eventDate || visit.guests) && (
          <div>
            <dt>Event</dt>
            <dd>
              {[
                visit.eventType,
                visit.eventDate && mediumDate.format(new Date(`${visit.eventDate}T00:00:00Z`)),
                visit.guests && `${visit.guests} guests`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </dd>
          </div>
        )}
        <div>
          <dt>Reference</dt>
          <dd>
            {visit.reference} · {visitSourceLabel(visit.source)}
          </dd>
        </div>
      </dl>
      {visit.message && <p className={styles.note}>Visitor: {visit.message}</p>}
      {visit.staffNotes && <p className={styles.note}>Staff notes: {visit.staffNotes}</p>}
      {visit.cancelReason && status === 'CANCELLED' && (
        <p className={styles.note}>Cancelled: {visit.cancelReason}</p>
      )}
      <div className={styles.actions} role="group" aria-labelledby={`${id}-name`}>
        {scheduled && isToday && (
          <Button
            type="button"
            variant="primary"
            disabled={busy}
            onClick={() =>
              void run({ op: 'visit-outcome', outcome: 'CHECK_IN' }, `${name} is checked in.`)
            }
          >
            Check in
          </Button>
        )}
        {((scheduled && started) || status === 'CHECKED_IN') && (
          <Button
            type="button"
            variant={status === 'CHECKED_IN' ? 'primary' : 'secondary'}
            disabled={busy}
            onClick={() =>
              void run(
                { op: 'visit-outcome', outcome: 'COMPLETE' },
                `${name}'s visit is marked completed.`,
              )
            }
          >
            Mark completed
          </Button>
        )}
        {scheduled && started && (
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() =>
              void run(
                { op: 'visit-outcome', outcome: 'NO_SHOW' },
                `${name}'s visit is marked as a no-show.`,
              )
            }
          >
            No-show
          </Button>
        )}
        {status !== 'CANCELLED' && status !== 'NO_SHOW' && (
          <ButtonLink variant="secondary" href={`${WALK_IN_PATH}?visit=${visit.id}`}>
            Start booking
            <span className={styles.visuallyHidden}> for {name}</span>
          </ButtonLink>
        )}
        {/* Less frequent actions of a scheduled visit share one menu, so the row stays one line. */}
        {scheduled ? (
          <MoreMenu
            label={`More actions for ${name}`}
            items={[
              { label: 'Reschedule', onSelect: () => choose('reschedule') },
              { label: 'Staff notes', onSelect: () => choose('notes') },
              { label: 'Cancel visit', destructive: true, onSelect: () => choose('cancel') },
            ]}
          />
        ) : (
          <Button
            type="button"
            variant="secondary"
            aria-expanded={panel === 'notes'}
            onClick={() => open('notes')}
          >
            Staff notes
          </Button>
        )}
      </div>
      {panel && (
        <div className={styles.subpanel} ref={panelRef}>
          {panel === 'reschedule' && (
            <form
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault();
                if (!startsAt) return setError('Choose a new day and time.');
                void run(
                  { op: 'reschedule-visit', revision: visit.revision, startsAt },
                  `${name}'s visit moved to ${moment.format(new Date(startsAt))}. The client and staff calendars get the new time.`,
                );
              }}
            >
              <h4>Move the visit</h4>
              <div className={styles.fields}>
                <SlotSelects except={visit.id} value={startsAt} onChange={setStartsAt} />
              </div>
              <FormError message={error} />
              <div className={styles.actions}>
                <Button type="submit" variant="primary" disabled={busy}>
                  Move visit
                </Button>
                <Button type="button" variant="secondary" onClick={close}>
                  Close
                </Button>
              </div>
            </form>
          )}
          {panel === 'cancel' && (
            <form
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault();
                const reason = String(new FormData(event.currentTarget).get('reason') ?? '');
                void run(
                  { op: 'cancel-visit', revision: visit.revision, reason },
                  `${name}'s visit is cancelled. The time is open again.`,
                );
              }}
            >
              <h4>Cancel the visit</h4>
              <label className={styles.field}>
                Reason (staff only)
                <textarea
                  name="reason"
                  required
                  minLength={3}
                  maxLength={VISIT_FIELD_LIMITS.cancelReason}
                  rows={2}
                />
                <span className={styles.hint}>
                  {visit.email
                    ? 'The client gets a cancellation email and calendar update, without this reason.'
                    : 'The client has no email; let them know by phone.'}
                </span>
              </label>
              <FormError message={error} />
              <div className={styles.actions}>
                <Button type="submit" variant="destructive" disabled={busy}>
                  Cancel visit
                </Button>
                <Button type="button" variant="secondary" onClick={close}>
                  Keep visit
                </Button>
              </div>
            </form>
          )}
          {panel === 'notes' && (
            <form
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault();
                const staffNotes = String(
                  new FormData(event.currentTarget).get('staffNotes') ?? '',
                );
                void run({ op: 'visit-notes', staffNotes }, `Notes saved for ${name}.`);
              }}
            >
              <h4>Staff notes</h4>
              <label className={styles.field}>
                <span className={styles.visuallyHidden}>Staff notes for {name}</span>
                <textarea
                  name="staffNotes"
                  maxLength={VISIT_FIELD_LIMITS.staffNotes}
                  rows={3}
                  defaultValue={visit.staffNotes}
                />
                <span className={styles.hint}>Never sent to the client.</span>
              </label>
              <FormError message={error} />
              <div className={styles.actions}>
                <Button type="submit" variant="primary" disabled={busy}>
                  Save notes
                </Button>
                <Button type="button" variant="secondary" onClick={close}>
                  Close
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * One of today's events as an arrival (docs/client-photos.md): the client's photo, name, time
 * and event, and "Check in" when they arrive. Checking in records the arrival time only; the
 * booking's status never changes.
 */
function EventArrival({
  event,
  act,
  busy,
  refresh,
}: {
  event: FrontDeskEvent;
  act: Act;
  busy: boolean;
  refresh: () => unknown;
}) {
  const id = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [error, setError] = useState('');
  const name = event.clientName;
  const subject = { kind: 'booking' as const, id: event.id };
  async function checkIn() {
    setError('');
    const result = await act({ op: 'event-check-in', id: event.id }, `${name} is checked in.`);
    if (result.ok) requestAnimationFrame(() => headingRef.current?.focus());
    else setError(result.error);
  }
  return (
    <li className={styles.item}>
      <div className={styles.person}>
        <ClientPhotoAvatar
          name={name}
          photo={event.clientPhoto}
          subject={subject}
          onChanged={refresh}
          size={64}
        />
        <div className={styles.personText}>
          <div className={styles.itemTop}>
            <h3 id={`${id}-name`} ref={headingRef} tabIndex={-1} className={styles.focusTarget}>
              {clock.format(new Date(event.startsAt))} · {name}
            </h3>
            <span className={`${styles.badge} ${event.checkedInAt ? styles.toneCheckedIn : ''}`}>
              {event.checkedInAt
                ? 'Arrived'
                : event.state === 'CONFIRMED'
                  ? 'Event'
                  : 'Event, held'}
            </span>
          </div>
          {!event.checkedInAt && (
            <ClientPhotoStatus
              name={name}
              photo={event.clientPhoto}
              subject={subject}
              onChanged={refresh}
            />
          )}
        </div>
      </div>
      <p className={styles.intro}>
        {timeRange(event.startsAt, event.endsAt)} · {event.eventType} · {event.packageName} ·{' '}
        {event.guests} guests ·{' '}
        <Link href={bookingPagePath(event.reference)}>{event.reference}</Link>
      </p>
      <FormError message={error} />
      <div className={styles.actions} role="group" aria-labelledby={`${id}-name`}>
        {event.checkedInAt ? (
          <p className={styles.intro}>Checked in at {clock.format(new Date(event.checkedInAt))}.</p>
        ) : (
          <Button type="button" variant="primary" disabled={busy} onClick={() => void checkIn()}>
            Check in
          </Button>
        )}
      </div>
    </li>
  );
}

function VisitList({
  visits,
  empty,
  children,
}: {
  visits: FrontDeskVisit[];
  empty: string;
  children: (visit: FrontDeskVisit) => ReactNode;
}) {
  return visits.length ? (
    <ul className={styles.list}>{visits.map(children)}</ul>
  ) : (
    <p className={styles.empty}>{empty}</p>
  );
}

/** Upcoming visits grouped under a heading per day. */
function UpcomingVisits({
  visits,
  today,
  act,
  busy,
  refresh,
}: {
  visits: FrontDeskVisit[];
  today: string;
  act: Act;
  busy: boolean;
  refresh: () => unknown;
}) {
  if (!visits.length)
    return <p className={styles.empty}>No visits are scheduled for the next two weeks.</p>;
  const days = [...new Set(visits.map((visit) => manilaDateKey(visit.startsAt)))];
  return (
    <>
      {days.map((day) => (
        <div key={day} className={styles.form}>
          <h3 className={styles.dayHeading}>{longDay.format(new Date(`${day}T12:00:00+08:00`))}</h3>
          <ul className={styles.list}>
            {visits
              .filter((visit) => manilaDateKey(visit.startsAt) === day)
              .map((visit) => (
                <VisitCard
                  key={visit.id}
                  visit={visit}
                  today={today}
                  act={act}
                  busy={busy}
                  refresh={refresh}
                />
              ))}
          </ul>
        </div>
      ))}
    </>
  );
}

/** A returning client's bookings and visits, found by email, phone or name. */
function ClientLookupCard({ onSchedule }: { onSchedule: (prefill: Prefill) => void }) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const {
    data,
    error,
    isLoading,
    mutate: refreshLookup,
  } = useSWR<ClientLookup>(
    submitted ? `${ENDPOINT}?lookup=${encodeURIComponent(submitted)}` : null,
    load,
    { shouldRetryOnError: false },
  );
  const latest = data && (data.clientVisits[0] ?? data.clientBookings[0]);
  // Only an id travels in the address; the walk-in page reads the client's details itself.
  const bookFrom = data?.clientBookings[0]
    ? `booking=${data.clientBookings[0].id}`
    : data?.clientVisits[0]
      ? `visit=${data.clientVisits[0].id}`
      : null;
  const found = data ? data.clientBookings.length + data.clientVisits.length : 0;
  return (
    <section className={styles.card} aria-labelledby={`${id}-title`}>
      <div>
        <h2 id={`${id}-title`}>Client lookup</h2>
        <p className={styles.intro}>
          Find a returning client by email, phone number or name to see their bookings and visits.
        </p>
      </div>
      <form
        className={styles.search}
        role="search"
        aria-labelledby={`${id}-title`}
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(query.trim());
        }}
      >
        <label className={styles.field}>
          Email, phone or name
          <input
            type="search"
            value={query}
            minLength={3}
            maxLength={120}
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <Button type="submit" variant="primary">
          <Search size={16} aria-hidden="true" />
          Search
        </Button>
      </form>
      <div aria-live="polite">
        {isLoading && <p className={styles.loading}>Searching…</p>}
        {error instanceof Error && (
          <p className={styles.alert} role="alert">
            {error.message}
          </p>
        )}
        {data && !isLoading && (
          <div className={styles.form}>
            <p>
              {found
                ? `${found} record${found === 1 ? '' : 's'} for "${data.query}".`
                : `No bookings or visits match "${data.query}".`}
            </p>
            {data.clientBookings.length > 0 && (
              <>
                <h3>Bookings</h3>
                <ul className={styles.list}>
                  {data.clientBookings.map((booking) => (
                    <li key={booking.id} className={styles.item}>
                      <div className={styles.person}>
                        <ClientPhotoAvatar
                          name={booking.clientName}
                          photo={booking.clientPhoto}
                          subject={{ kind: 'booking', id: booking.id }}
                          onChanged={() => refreshLookup()}
                        />
                        <div className={styles.personText}>
                          <div className={styles.itemTop}>
                            <h4>
                              {booking.eventType} · {booking.clientName}
                            </h4>
                            <StatusChip status={displayStatus(booking)} />
                          </div>
                          <p className={styles.intro}>
                            {booking.reference} · {moment.format(new Date(booking.startsAt))} ·{' '}
                            {booking.packageName}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {data.clientVisits.length > 0 && (
              <>
                <h3>Visits</h3>
                <ul className={styles.list}>
                  {data.clientVisits.map((visit) => (
                    <li key={visit.id} className={styles.item}>
                      <div className={styles.person}>
                        <ClientPhotoAvatar
                          name={visit.clientName}
                          photo={visit.clientPhoto}
                          subject={{ kind: 'visit', id: visit.id }}
                          onChanged={() => refreshLookup()}
                        />
                        <div className={styles.personText}>
                          <div className={styles.itemTop}>
                            <h4>{visit.clientName}</h4>
                            <StatusBadge status={visit.status} />
                          </div>
                          <p className={styles.intro}>
                            {visit.reference} · {moment.format(new Date(visit.startsAt))}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {latest && (
              <div className={styles.actions}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    onSchedule({
                      clientName: latest.clientName,
                      email: latest.email,
                      phone: latest.phone,
                    })
                  }
                >
                  <CalendarPlus size={16} aria-hidden="true" />
                  Schedule a visit for {latest.clientName}
                </Button>
                {bookFrom && (
                  <ButtonLink variant="secondary" href={`${WALK_IN_PATH}?${bookFrom}`}>
                    <UserPlus size={16} aria-hidden="true" />
                    Book for {latest.clientName}
                  </ButtonLink>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * The Front desk (docs/visits.md): today's visits and events at a glance, visits that still need
 * an outcome, the next two weeks of visits, scheduling for callers, and a client lookup.
 */
export default function FrontDesk() {
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [scheduling, setScheduling] = useState<Prefill | null>(null);
  const { data, error, isLoading, isValidating, mutate } = useSWR<FrontDeskAgenda>(
    ENDPOINT,
    load,
    // Website visits appear without a reload while the desk is open.
    { keepPreviousData: true, shouldRetryOnError: false, refreshInterval: 60_000 },
  );

  const act: Act = async (payload, success) => {
    setBusy(true);
    setNotice('');
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok)
        return {
          ok: false,
          error: typeof body.error === 'string' ? body.error : 'The front desk action failed.',
        };
      setNotice(success);
      await mutate();
      return { ok: true, body };
    } catch {
      return { ok: false, error: 'The front desk action failed. Check the connection.' };
    } finally {
      setBusy(false);
    }
  };

  const today = data?.today ?? '';
  const refresh = () => mutate();
  // Today's events and visits in one list, in the order clients arrive.
  const arrivals = data
    ? [
        ...data.eventsToday.map((event) => ({
          kind: 'event' as const,
          at: event.startsAt,
          event,
        })),
        ...data.visitsToday.map((visit) => ({ kind: 'visit' as const, at: visit.startsAt, visit })),
      ].sort((a, b) => a.at.localeCompare(b.at))
    : [];
  return (
    <section className={styles.panel} aria-labelledby="front-desk-title" aria-busy={busy}>
      <AdminPageHeader
        title="Front desk"
        titleId="front-desk-title"
        actions={
          <>
            <IconButton
              type="button"
              variant="secondary"
              label="Refresh"
              icon={<RefreshCw aria-hidden="true" />}
              loading={isValidating}
              loadingLabel="Refreshing…"
              onClick={() => void mutate()}
            />
            <Button
              type="button"
              variant="primary"
              icon={<CalendarPlus aria-hidden="true" />}
              onClick={() => setScheduling({ clientName: '', email: '', phone: '' })}
            >
              Schedule a visit
            </Button>
            <ButtonLink
              variant="secondary"
              href={WALK_IN_PATH}
              icon={<UserPlus aria-hidden="true" />}
            >
              Walk-in booking
            </ButtonLink>
          </>
        }
      />

      <div role="status" aria-live="polite" className={styles.liveRegion}>
        {notice && (
          <p id={NOTICE_ID} tabIndex={-1} className={`${styles.notice} ${styles.focusTarget}`}>
            {notice}
          </p>
        )}
      </div>
      {error instanceof Error && (
        <p className={styles.alert} role="alert">
          {error.message}
        </p>
      )}

      {scheduling && (
        <ScheduleVisitForm
          key={`${scheduling.clientName}|${scheduling.email}|${scheduling.phone}`}
          prefill={scheduling}
          act={act}
          busy={busy}
          onClose={() => setScheduling(null)}
        />
      )}

      {!data && isLoading && (
        <p className={styles.loading} role="status">
          <LoaderCircle size={20} aria-hidden="true" className={styles.spin} />
          Loading the front desk…
        </p>
      )}

      {data && (
        <div className={styles.columns}>
          <div className={styles.stack}>
            <section className={styles.card} aria-labelledby="front-desk-today">
              <div>
                <h2 id="front-desk-today">Today&apos;s arrivals</h2>
                <p className={styles.intro}>
                  {longDay.format(new Date(`${today}T12:00:00+08:00`))} · Events and ocular visits
                  in time order; visits last {data.slotMinutes} minutes. Times are in Manila time.
                </p>
              </div>
              {arrivals.length ? (
                <ul className={styles.list}>
                  {arrivals.map((arrival) =>
                    arrival.kind === 'event' ? (
                      <EventArrival
                        key={`event-${arrival.event.id}`}
                        event={arrival.event}
                        act={act}
                        busy={busy}
                        refresh={refresh}
                      />
                    ) : (
                      <VisitCard
                        key={`visit-${arrival.visit.id}`}
                        visit={arrival.visit}
                        today={today}
                        act={act}
                        busy={busy}
                        refresh={refresh}
                      />
                    ),
                  )}
                </ul>
              ) : (
                <p className={styles.empty}>No events or visits today.</p>
              )}
            </section>

            {data.needsOutcome.length > 0 && (
              <section className={styles.card} aria-labelledby="front-desk-outcome">
                <div>
                  <h2 id="front-desk-outcome">Earlier visits without an outcome</h2>
                  <p className={styles.intro}>
                    Mark each as completed or as a no-show so the records stay accurate.
                  </p>
                </div>
                <VisitList visits={data.needsOutcome} empty="">
                  {(visit) => (
                    <VisitCard
                      key={visit.id}
                      visit={visit}
                      today={today}
                      act={act}
                      busy={busy}
                      refresh={refresh}
                      showDate
                    />
                  )}
                </VisitList>
              </section>
            )}

            <section className={styles.card} aria-labelledby="front-desk-upcoming">
              <h2 id="front-desk-upcoming">Upcoming visits</h2>
              <UpcomingVisits
                visits={data.upcoming}
                today={today}
                act={act}
                busy={busy}
                refresh={refresh}
              />
            </section>
          </div>
          <ClientLookupCard onSchedule={setScheduling} />
        </div>
      )}
    </section>
  );
}
