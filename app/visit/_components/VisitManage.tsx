'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarCheck2, CircleAlert, MapPin } from 'lucide-react';
import { BRAND } from '@/config/brand';
import type { VisitManageView } from '@/lib/visit-types';
import shared from '../../booking/_components/BookingRequest.module.css';
import styles from './Visit.module.css';
import VisitSlotPicker, { visitClock, visitDateKey, visitDayLabel } from './VisitSlotPicker';
import { Button, ButtonLink } from '@/components/shared/Button';

type View = Exclude<VisitManageView, { state: 'invalid' }>;
type OpenView = Extract<VisitManageView, { state: 'open' }>;

const CLOSED_TITLES: Record<string, string> = {
  CANCELLED: 'This visit is cancelled',
  COMPLETED: 'Thank you for visiting',
  CHECKED_IN: 'You are checked in',
  NO_SHOW: 'This visit has passed',
  SCHEDULED: 'This visit has started',
};

const CLOSED_NOTES: Record<string, string> = {
  CANCELLED: 'This visit was cancelled, so it can no longer be changed here.',
  COMPLETED: 'We hope you enjoyed seeing the venue. When you are ready, you can book your event.',
  CHECKED_IN: 'Enjoy your visit. Our team is with you.',
  NO_SHOW: 'We missed you at this visit. You are welcome to schedule another one.',
  SCHEDULED: 'The visit time has started, so it can no longer be changed here.',
};

function VisitDetails({ view }: { view: View }) {
  return (
    <dl className={styles.details}>
      <dt>Date</dt>
      <dd>{visitDayLabel(visitDateKey(view.startsAt))}</dd>
      <dt>Time</dt>
      <dd>
        {visitClock(view.startsAt)} to {visitClock(view.endsAt)} (Manila time)
      </dd>
      <dt>Venue</dt>
      <dd>
        {BRAND.legalName}, {BRAND.address.full}
      </dd>
    </dl>
  );
}

async function send(payload: Record<string, unknown>) {
  const response = await fetch('/api/client/visits/manage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => ({}))) as { error?: string; code?: string };
  if (!response.ok) throw Object.assign(new Error(body.error || 'Please try again.'), body);
}

/** Moving the visit to another open time, and cancelling it after a confirmation step. */
function ChangeVisit({
  view,
  token,
  onChanged,
}: {
  view: OpenView;
  token: string;
  onChanged: (message: string) => void;
}) {
  const id = useId();
  // The visit's own time is not a new time.
  const days = view.days.map((day) => ({
    ...day,
    slots: day.slots.filter((slot) => slot.startsAt !== view.startsAt),
  }));
  const router = useRouter();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [error, setError] = useState('');
  const [timeError, setTimeError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const confirmRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  async function act(payload: Record<string, unknown>) {
    setBusy(true);
    setError('');
    try {
      await send({ token, revision: view.revision, ...payload });
      onChanged(
        payload.action === 'cancel'
          ? 'Your visit is cancelled. We emailed you a confirmation and a calendar update.'
          : 'Your visit has a new time. We emailed you the details and a calendar update.',
      );
      // The page reads the visit again: the new time, or the cancelled state.
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Please try again.');
      if ((failure as { code?: string }).code === 'TIME_TAKEN') {
        setTime('');
        router.refresh();
      }
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form
        className={shared.fieldset}
        aria-labelledby={`${id}-move-title`}
        aria-busy={busy}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!time) {
            setTimeError(date ? 'Choose a new time.' : 'Choose a new day and time.');
            return;
          }
          void act({ action: 'reschedule', startsAt: time });
        }}
      >
        <h2 id={`${id}-move-title`} className={shared.subheading}>
          Choose a new time
        </h2>
        <VisitSlotPicker
          idPrefix={id}
          days={days}
          date={date}
          time={time}
          onDate={(value) => {
            setDate(value);
            setTime('');
            setTimeError('');
          }}
          onTime={(value) => {
            setTime(value);
            setTimeError('');
          }}
          errors={date ? { time: timeError } : { date: timeError }}
          emptyMessage="No other visit times are open in the coming weeks. Please call or email us to arrange a time."
        />
        <div className={shared.actions}>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={busy && !confirming}
            loadingLabel="Moving…"
            disabled={busy && confirming}
          >
            Move my visit
          </Button>
        </div>
      </form>

      {error && (
        <p ref={errorRef} tabIndex={-1} className={shared.submitError} role="alert">
          <CircleAlert aria-hidden="true" className={shared.inlineIcon} />
          {error}
        </p>
      )}

      <section className={shared.fieldset} aria-labelledby={`${id}-cancel-title`}>
        <h2 id={`${id}-cancel-title`} className={shared.subheading}>
          Cancel the visit
        </h2>
        {confirming ? (
          <div className={styles.confirmBox}>
            <p ref={confirmRef} tabIndex={-1}>
              Cancel your visit on {visitDayLabel(visitDateKey(view.startsAt))} at{' '}
              {visitClock(view.startsAt)}? The time opens for other visitors.
            </p>
            <div className={shared.actions}>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={() => setConfirming(false)}
                disabled={busy}
              >
                Keep my visit
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="lg"
                loading={busy}
                loadingLabel="Cancelling…"
                onClick={() => void act({ action: 'cancel' })}
              >
                Yes, cancel my visit
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Button
              type="button"
              variant="destructive"
              size="lg"
              onClick={() => setConfirming(true)}
            >
              Cancel my visit
            </Button>
          </div>
        )}
      </section>
    </>
  );
}

/**
 * The visitor's private visit page: the visit, and while it is still ahead, a new time or a
 * cancellation. Every change is rechecked by the server and emailed with a calendar update.
 */
export default function VisitManage({ view, token }: { view: View; token: string }) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [changed, setChanged] = useState('');
  const open = view.state === 'open';
  const title = open ? 'Your ocular visit' : (CLOSED_TITLES[view.status] ?? 'Your ocular visit');
  // After a change the page shows the new state; its heading takes focus so it is announced.
  // The first load leaves focus where the browser puts it.
  const key = open ? `${view.startsAt}:${view.revision}` : view.status;
  const firstKey = useRef(key);
  useEffect(() => {
    if (key !== firstKey.current) titleRef.current?.focus();
  }, [key]);
  return (
    <div className={shared.page}>
      <section className={shared.done} aria-labelledby="visit-manage-title">
        <CalendarCheck2 aria-hidden="true" className={shared.doneIcon} />
        <h1 id="visit-manage-title" ref={titleRef} tabIndex={-1} className={shared.doneTitle}>
          {title}
        </h1>
        <p className={shared.reference}>
          Visit reference <strong>{view.reference}</strong>
        </p>
        <VisitDetails view={view} />
        {open ? (
          <>
            <p className={`${styles.status} ${styles.statusSuccess}`} role="status">
              {changed ||
                `${view.firstName ? `${view.firstName}, your` : 'Your'} visit is scheduled. A member of our team will meet you at the venue.`}
            </p>
            <p>
              <a
                className={styles.textLink}
                href={BRAND.maps.directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MapPin aria-hidden="true" className={shared.inlineIcon} /> Get directions
                <span className={shared.visuallyHidden}> (opens in a new tab)</span>
              </a>
            </p>
            {/* A new time starts the choices afresh. */}
            <ChangeVisit key={key} view={view} token={token} onChanged={setChanged} />
          </>
        ) : (
          <>
            <p className={styles.status} role="status">
              {changed || CLOSED_NOTES[view.status] || 'This visit can no longer be changed here.'}
            </p>
            <div className={shared.actions}>
              <ButtonLink href="/visit" variant="secondary" size="lg">
                Schedule a new visit
              </ButtonLink>
              <ButtonLink href="/booking" variant="primary" size="lg">
                Book your event
              </ButtonLink>
            </div>
          </>
        )}
        <p className={shared.hint}>
          Questions? Call <a href={BRAND.contact.phoneHref}>{BRAND.contact.phone}</a> or email{' '}
          <a href={BRAND.contact.emailHref}>{BRAND.contact.email}</a>.
        </p>
      </section>
    </div>
  );
}
