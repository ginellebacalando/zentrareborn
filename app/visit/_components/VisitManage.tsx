'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarCheck2, CircleAlert, MapPin } from 'lucide-react';
import ClientPhotoCapture from '@/components/client-photo/ClientPhotoCapture';
import { BRAND } from '@/config/brand';
import type { VisitManageView } from '@/lib/visit-types';
import shared from '../../booking/_components/BookingRequest.module.css';
import styles from './Visit.module.css';
import VisitSlotPicker, { visitClock, visitDateKey, visitDayLabel } from './VisitSlotPicker';
import { Button, ButtonLink } from '@/components/shared/Button';

type View = Exclude<VisitManageView, { state: 'invalid' }>;
type OpenView = Extract<VisitManageView, { state: 'open' }>;

/** The page's titles after the time has passed or changed; `noun` is "visit" or the meeting. */
function closedTitle(status: string, noun: string) {
  return (
    {
      CANCELLED: `This ${noun} is cancelled`,
      COMPLETED: noun === 'visit' ? 'Thank you for visiting' : 'Thank you for meeting with us',
      CHECKED_IN: 'You are checked in',
      NO_SHOW: `This ${noun} has passed`,
      SCHEDULED: `This ${noun} has started`,
    }[status] ?? null
  );
}

function closedNote(status: string, noun: string) {
  return (
    {
      CANCELLED: `This ${noun} was cancelled, so it can no longer be changed here.`,
      COMPLETED:
        noun === 'visit'
          ? 'We hope you enjoyed seeing the venue. When you are ready, you can book your event.'
          : 'Thank you for your time. Our team will be in touch about the next steps.',
      CHECKED_IN: `Enjoy your ${noun}. Our team is with you.`,
      NO_SHOW: `We missed you at this ${noun}. Please contact us to arrange another time.`,
      SCHEDULED: `The ${noun} time has started, so it can no longer be changed here.`,
    }[status] ?? null
  );
}

function VisitDetails({ view }: { view: View }) {
  return (
    <dl className={styles.details}>
      <dt>Date</dt>
      <dd>{visitDayLabel(visitDateKey(view.startsAt))}</dd>
      <dt>Time</dt>
      <dd>
        {visitClock(view.startsAt)} to {visitClock(view.endsAt)} (Manila time)
      </dd>
      <dt>{view.place ? 'Place' : 'Venue'}</dt>
      <dd>{view.place || `${BRAND.legalName}, ${BRAND.address.full}`}</dd>
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
          ? `Your ${view.noun} is cancelled. We emailed you a confirmation and a calendar update.`
          : `Your ${view.noun} has a new time. We emailed you the details and a calendar update.`,
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
          emptyMessage="No other times are open in the coming weeks. Please call or email us to arrange a time."
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
            Move my {view.noun}
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
          Cancel the {view.noun}
        </h2>
        {confirming ? (
          <div className={styles.confirmBox}>
            <p ref={confirmRef} tabIndex={-1}>
              Cancel your {view.noun} on {visitDayLabel(visitDateKey(view.startsAt))} at{' '}
              {visitClock(view.startsAt)}? The time opens for others.
            </p>
            <div className={shared.actions}>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={() => setConfirming(false)}
                disabled={busy}
              >
                Keep my {view.noun}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="lg"
                loading={busy}
                loadingLabel="Cancelling…"
                onClick={() => void act({ action: 'cancel' })}
              >
                Yes, cancel my {view.noun}
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
              Cancel my {view.noun}
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
  const ocular = view.noun === 'visit';
  const openTitle = ocular ? 'Your ocular visit' : `Your ${view.noun}`;
  const title = open ? openTitle : (closedTitle(view.status, view.noun) ?? openTitle);
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
          {ocular ? 'Visit' : 'Reference'} <strong>{view.reference}</strong>
        </p>
        <VisitDetails view={view} />
        {open ? (
          <>
            <p className={`${styles.status} ${styles.statusSuccess}`} role="status">
              {changed ||
                `${view.firstName ? `${view.firstName}, your` : 'Your'} ${view.noun} is scheduled.${ocular ? ' A member of our team will meet you at the venue.' : ''}`}
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
            {view.photo && <ClientPhotoCapture photo={view.photo} />}
          </>
        ) : (
          <>
            <p className={styles.status} role="status">
              {changed ||
                closedNote(view.status, view.noun) ||
                `This ${view.noun} can no longer be changed here.`}
            </p>
            <div className={shared.actions}>
              <ButtonLink href="/visit" variant="secondary" size="lg">
                Schedule a new visit
              </ButtonLink>
              <ButtonLink href="/booking" variant="primary" size="lg">
                Book your event
              </ButtonLink>
            </div>
            {/* After the visit, a saved photo can still be removed. */}
            {view.photo?.photoUrl && <ClientPhotoCapture photo={view.photo} />}
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
