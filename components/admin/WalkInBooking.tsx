'use client';

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import useSWR from 'swr';
import { CheckCircle2, CircleAlert, LoaderCircle, Search } from 'lucide-react';
import { BOOKING_PAYMENT_METHODS, type BookingPaymentMethod } from '@/config/booking';
import { paymentDeadline, walkInReview } from '@/lib/admin/booking-rules';
import { bookingScheduleProblem, packageQuote } from '@/lib/booking-quote';
import { PHILIPPINE_MOBILE_ERROR, philippineMobile } from '@/lib/phone-number';
import type { ClientLookup } from '@/lib/visit-types';
import {
  CONSENT_LABELS,
  CONSENT_METHODS,
  type ConsentMethod,
  type WalkInOptions,
  type WalkInPrefill,
  type WalkInResult,
} from '@/lib/walk-in-types';
import desk from './FrontDesk.module.css';
import styles from './WalkInBooking.module.css';
import { Button, ButtonAnchor, ButtonLink } from '@/components/shared/Button';

const ENDPOINT = '/api/admin/front-desk';
const STEPS = ['Client', 'Event', 'Consent', 'Payment'] as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const fullDate = new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', dateStyle: 'full' });
const moment = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  dateStyle: 'medium',
  timeStyle: 'short',
});

type Draft = {
  fullName: string;
  email: string;
  phone: string;
  category: string;
  /** A package id, 'custom' for a custom proposal, or '' before a choice. */
  packageId: string;
  date: string;
  startTime: string;
  endTime: string;
  guests: string;
  extras: string[];
  notes: string;
  consent: ConsentMethod | '';
  clientAgreed: boolean;
  payment: 'CASH_NOW' | 'LATER';
  laterMethod: BookingPaymentMethod;
  cashAmount: string;
  receiptNumber: string;
  cashNote: string;
  approveAtDesk: boolean;
  overrideReason: string;
};

type Field =
  | 'fullName'
  | 'email'
  | 'phone'
  | 'category'
  | 'packageId'
  | 'date'
  | 'startTime'
  | 'endTime'
  | 'guests'
  | 'consent'
  | 'clientAgreed'
  | 'cashAmount'
  | 'receiptNumber'
  | 'overrideReason';
type Errors = Partial<Record<Field, string>>;

async function load<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Walk-in booking data is unavailable.');
  return body;
}

function clockLabel(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'UTC',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(Date.UTC(2000, 0, 1, hours, minutes)));
}

function dateLabel(date: string) {
  return fullDate.format(new Date(`${date}T00:00:00Z`));
}

/** Kept outside render so the components stay pure. */
function nowMs() {
  return Date.now();
}

function initialDraft(options: WalkInOptions, prefill: WalkInPrefill | null): Draft {
  const category = prefill?.eventType
    ? options.categories.find(
        (candidate) => candidate.name.toLowerCase() === prefill.eventType.toLowerCase(),
      )
    : undefined;
  const dateOpen =
    prefill?.eventDate &&
    prefill.eventDate >= options.earliest &&
    prefill.eventDate <= options.latest &&
    !options.booked.includes(prefill.eventDate);
  const guests =
    prefill?.guests && prefill.guests >= options.minGuests && prefill.guests <= options.maxGuests
      ? String(prefill.guests)
      : '';
  return {
    fullName: prefill?.clientName ?? '',
    email: prefill?.email ?? '',
    phone: prefill?.phone ?? '',
    category: category?.slug ?? '',
    packageId: '',
    date: dateOpen ? (prefill?.eventDate ?? '') : '',
    startTime: '',
    endTime: '',
    guests,
    extras: [],
    notes: '',
    consent: '',
    clientAgreed: false,
    payment: 'CASH_NOW',
    laterMethod: 'CASH',
    cashAmount: '',
    receiptNumber: '',
    cashNote: '',
    approveAtDesk: false,
    overrideReason: '',
  };
}

/** The price, the review rules and what saving will do, from the same functions the server uses. */
function assess(options: WalkInOptions, draft: Draft) {
  const category = options.categories.find((candidate) => candidate.slug === draft.category);
  const pkg = category?.packages.find((candidate) => candidate.id === draft.packageId) ?? null;
  const guests = Number(draft.guests);
  const guestsValid =
    Number.isInteger(guests) && guests >= options.minGuests && guests <= options.maxGuests;
  const quote = pkg && guestsValid ? packageQuote(pkg, guests) : null;
  const priced = Boolean(quote) || (draft.packageId === 'custom' && guestsValid);
  const review = walkInReview({
    totalCents: quote?.totalCents ?? 0,
    depositCents: quote?.depositCents ?? 0,
    paymentRule: options.policy.paymentRule,
    guests: guestsValid ? guests : 0,
    policyReviewed: options.policy.reviewed,
    reviewGuestLimit: options.reviewGuestLimit,
  });
  const approves = !review.blocking.length && (!review.overridable.length || draft.approveAtDesk);
  const required = !quote
    ? 0
    : options.policy.paymentRule === 'FULL_PAYMENT_REQUIRED'
      ? quote.totalCents
      : quote.depositCents;
  return { category, pkg, quote, priced, review, approves, required };
}

function stepErrors(step: number, draft: Draft, options: WalkInOptions): Errors {
  const errors: Errors = {};
  const info = assess(options, draft);
  if (step === 0) {
    if (draft.fullName.trim().length < 2) errors.fullName = 'Enter the client name.';
    if (!EMAIL.test(draft.email.trim())) errors.email = 'Enter a valid email address.';
    if (!philippineMobile(draft.phone)) errors.phone = PHILIPPINE_MOBILE_ERROR;
  }
  if (step === 1) {
    if (!info.category) errors.category = 'Choose the event.';
    else if (!draft.packageId) errors.packageId = 'Choose a package or a custom proposal.';
    if (!draft.date) errors.date = 'Choose the event date.';
    else if (options.booked.includes(draft.date))
      errors.date = 'That date is already held or confirmed. Choose another date.';
    if (!draft.startTime) errors.startTime = 'Choose the start time.';
    if (!draft.endTime) errors.endTime = 'Choose the end time.';
    if (draft.date && draft.startTime && draft.endTime && !errors.date) {
      const issue = bookingScheduleProblem(
        { date: draft.date, startTime: draft.startTime, endTime: draft.endTime },
        nowMs(),
      );
      if (issue) errors[issue.field] = issue.problem;
    }
    const guests = Number(draft.guests);
    if (!Number.isInteger(guests) || guests < options.minGuests || guests > options.maxGuests)
      errors.guests = `Enter ${options.minGuests} to ${options.maxGuests} guests.`;
  }
  if (step === 2) {
    if (!draft.consent) errors.consent = 'Record how the client gave consent.';
    else if (draft.consent === 'ON_SCREEN' && !draft.clientAgreed)
      errors.clientAgreed = 'The client needs to tick the box to agree.';
  }
  if (step === 3) {
    if (
      draft.approveAtDesk &&
      info.review.overridable.length &&
      draft.overrideReason.trim().length < 5
    )
      errors.overrideReason = 'Give a reason of at least 5 characters to approve at the desk.';
    if (draft.payment === 'CASH_NOW') {
      const cents = Math.round(Number(draft.cashAmount) * 100);
      if (!info.approves)
        errors.cashAmount =
          'This booking is saved for review, so it cannot take a payment now. Choose "Pay later".';
      else if (!(cents > 0)) errors.cashAmount = 'Enter the cash received.';
      else if (info.quote && cents > info.quote.totalCents)
        errors.cashAmount = `The cash is more than the total of ${peso.format(info.quote.totalCents / 100)}.`;
      if (draft.receiptNumber.trim().length < 3) errors.receiptNumber = 'Enter the receipt number.';
    }
  }
  return errors;
}

/** Finds a returning client and copies their details into the booking. */
function ClientSearch({
  onUse,
}: {
  onUse: (client: { name: string; email: string; phone: string }) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const { data, error, isLoading } = useSWR<ClientLookup>(
    submitted ? `${ENDPOINT}?lookup=${encodeURIComponent(submitted)}` : null,
    load,
    { shouldRetryOnError: false },
  );
  const clients = new Map<
    string,
    { name: string; email: string; phone: string; records: string[] }
  >();
  for (const row of [...(data?.clientVisits ?? []), ...(data?.clientBookings ?? [])]) {
    const key = `${row.email.toLowerCase()}|${row.phone.replace(/\D/g, '').slice(-10)}`;
    const client = clients.get(key) ?? {
      name: row.clientName,
      email: row.email,
      phone: row.phone,
      records: [],
    };
    client.records.push(row.reference);
    clients.set(key, client);
  }
  const search = () => setSubmitted(query.trim());
  return (
    <section className={desk.subpanel} aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>Returning client?</h3>
      <div className={desk.search}>
        <label className={desk.field}>
          Email, phone or name
          <input
            type="search"
            value={query}
            maxLength={120}
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
              // The search sits inside the step's form: Enter searches instead of continuing.
              if (event.key === 'Enter') {
                event.preventDefault();
                search();
              }
            }}
          />
        </label>
        <Button type="button" variant="secondary" onClick={search}>
          <Search size={16} aria-hidden="true" />
          Search
        </Button>
      </div>
      <div aria-live="polite">
        {isLoading && <p className={desk.loading}>Searching…</p>}
        {error instanceof Error && (
          <p className={desk.alert} role="alert">
            {error.message}
          </p>
        )}
        {data && !isLoading && !clients.size && (
          <p className={desk.empty}>No bookings or visits match &quot;{data.query}&quot;.</p>
        )}
        {clients.size > 0 && (
          <ul className={desk.list}>
            {[...clients.values()].slice(0, 5).map((client) => (
              <li key={`${client.email}${client.phone}`} className={desk.item}>
                <div className={desk.itemTop}>
                  <h4>{client.name}</h4>
                  <Button type="button" variant="secondary" onClick={() => onUse(client)}>
                    Use these details
                    <span className={desk.visuallyHidden}> for {client.name}</span>
                  </Button>
                </div>
                <p className={desk.intro}>
                  {[client.email, client.phone].filter(Boolean).join(' · ')} ·{' '}
                  {client.records.length} earlier{' '}
                  {client.records.length === 1 ? 'record' : 'records'} (
                  {client.records.slice(0, 3).join(', ')})
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Summary({ options, draft }: { options: WalkInOptions; draft: Draft }) {
  const info = assess(options, draft);
  const startsAt =
    draft.date && draft.startTime ? new Date(`${draft.date}T${draft.startTime}:00+08:00`) : null;
  const deadline =
    startsAt && info.approves && info.required > 0
      ? paymentDeadline(new Date(nowMs()), startsAt, options.paymentDeadlineDays)
      : null;
  return (
    <aside className={`${desk.card} ${styles.summary}`} aria-labelledby="walk-in-summary">
      <h2 id="walk-in-summary">Summary</h2>
      <dl className={styles.summaryList}>
        <dt>Client</dt>
        <dd>{draft.fullName.trim() || 'Not entered'}</dd>
        <dt>Event</dt>
        <dd>
          {info.category?.name ?? 'Not chosen'}
          {info.pkg
            ? ` · ${info.pkg.name}`
            : draft.packageId === 'custom'
              ? ' · Custom proposal'
              : ''}
        </dd>
        <dt>Date</dt>
        <dd>
          {draft.date ? dateLabel(draft.date) : 'Not chosen'}
          {draft.startTime && draft.endTime
            ? `, ${clockLabel(draft.startTime)} to ${clockLabel(draft.endTime)}`
            : ''}
        </dd>
        <dt>Guests</dt>
        <dd>{draft.guests || 'Not entered'}</dd>
        {info.quote && info.pkg && (
          <>
            <dt>Package price</dt>
            <dd>{peso.format(info.pkg.price)}</dd>
            {info.quote.extraGuests > 0 && (
              <>
                <dt>{info.quote.extraGuests} extra guests</dt>
                <dd>{peso.format(info.quote.extraCents / 100)}</dd>
              </>
            )}
            <dt className={styles.total}>Total</dt>
            <dd className={styles.total}>{peso.format(info.quote.totalCents / 100)}</dd>
            <dt>
              {options.policy.paymentRule === 'FULL_PAYMENT_REQUIRED'
                ? 'Full payment to confirm'
                : 'Reservation fee to confirm'}
            </dt>
            <dd>{peso.format(info.required / 100)}</dd>
          </>
        )}
      </dl>
      {info.priced && (
        <p className={info.approves ? desk.notice : desk.alert}>
          {info.approves
            ? deadline
              ? `Approved when saved. The date is held until ${moment.format(deadline)} unless the payment that confirms it is recorded now.`
              : 'Approved when saved.'
            : `Saved for review on Bookings: ${[...info.review.blocking, ...(draft.approveAtDesk ? [] : info.review.overridable)].join('; ')}.`}
        </p>
      )}
      {draft.date &&
        options.inquired.includes(draft.date) &&
        !options.booked.includes(draft.date) && (
          <p className={desk.intro}>Another open request exists for this date.</p>
        )}
    </aside>
  );
}

function Outcome({
  result,
  email,
  onlinePayments,
  onAnother,
}: {
  result: WalkInResult;
  email: string;
  /** Whether the payment page takes GCash or bank screenshots; otherwise it is not offered. */
  onlinePayments: boolean;
  onAnother: () => void;
}) {
  const uploadHere = onlinePayments && Boolean(result.paymentPath) && result.amountDueCents > 0;
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titleRef.current?.focus();
  }, []);
  const title = {
    CONFIRMED: 'Booking confirmed',
    HELD: 'Date on hold',
    REVIEW: 'Saved for review',
  }[result.outcome];
  return (
    <section className={`${desk.card} ${styles.result}`} aria-labelledby="walk-in-result">
      <CheckCircle2 size={20} aria-hidden="true" />
      <h2 id="walk-in-result" ref={titleRef} tabIndex={-1} className={desk.focusTarget}>
        {title}: {result.reference}
      </h2>
      <dl className={styles.summaryList}>
        <dt>Total</dt>
        <dd>{peso.format(result.totalCents / 100)}</dd>
        <dt>Paid now</dt>
        <dd>{peso.format(result.paidCents / 100)}</dd>
        <dt>{result.outcome === 'CONFIRMED' ? 'Balance' : 'Still to pay to confirm'}</dt>
        <dd>{peso.format(result.amountDueCents / 100)}</dd>
        {result.holdExpiresAt && (
          <>
            <dt>Pay by</dt>
            <dd>{moment.format(new Date(result.holdExpiresAt))}</dd>
          </>
        )}
      </dl>
      <p>
        {result.outcome === 'CONFIRMED'
          ? `We are emailing the confirmation, the receipt and a calendar invitation to ${email}.`
          : result.outcome === 'HELD'
            ? `We are emailing how to pay, and the link to the payment page, to ${email}.`
            : `The request is on Bookings for a decision: ${result.reviewReasons.join('; ')}. We are emailing ${email} that it was received.`}
      </p>
      <div className={desk.actions}>
        {result.receiptPath && (
          <ButtonAnchor variant="secondary" href={result.receiptPath} download>
            Download receipt (PDF)
          </ButtonAnchor>
        )}
        {uploadHere && result.paymentPath && (
          <ButtonAnchor
            variant="secondary"
            href={result.paymentPath}
            target="_blank"
            rel="noreferrer"
          >
            Open the payment page
            <span className={desk.visuallyHidden}> (opens in a new tab)</span>
          </ButtonAnchor>
        )}
        <ButtonLink
          variant="secondary"
          href={`/admin/bookings?status=${result.outcome === 'CONFIRMED' ? 'confirmed' : result.outcome === 'HELD' ? 'pending' : 'request'}`}
        >
          Open Bookings
        </ButtonLink>
        <Button type="button" variant="primary" onClick={onAnother}>
          New walk-in booking
        </Button>
      </div>
      {uploadHere && (
        <p className={desk.intro}>
          For a GCash or bank transfer made at the desk, upload the screenshot on the payment page;
          it then waits for verification like any other.
        </p>
      )}
    </section>
  );
}

function WalkInForm({
  options,
  prefill,
  onDone,
}: {
  options: WalkInOptions;
  prefill: WalkInPrefill | null;
  onDone: (result: WalkInResult, email: string) => void;
}) {
  const id = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(() => initialDraft(options, prefill));
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState('');
  const [sending, setSending] = useState(false);
  const info = assess(options, draft);
  const fieldId = (field: Field) => `${id}-${field}`;
  const describedBy = (field: Field) => (errors[field] ? `${fieldId(field)}-error` : undefined);
  const fieldError = (field: Field) =>
    errors[field] ? (
      <span id={`${fieldId(field)}-error`} className={styles.fieldError}>
        {errors[field]}
      </span>
    ) : null;
  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    if (key in errors) setErrors((current) => ({ ...current, [key]: undefined }));
  }
  function goTo(next: number) {
    setStep(next);
    setErrors({});
    setFailure('');
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = stepErrors(step, draft, options);
    setErrors(found);
    if (Object.keys(found).length) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    if (step < STEPS.length - 1) {
      // The cash field starts at the amount that confirms the booking.
      if (step === 2 && !draft.cashAmount && info.required > 0)
        setDraft((current) => ({ ...current, cashAmount: String(info.required / 100) }));
      goTo(step + 1);
      return;
    }
    setSending(true);
    setFailure('');
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          op: 'walk-in-booking',
          client: { fullName: draft.fullName, email: draft.email, phone: draft.phone },
          event: {
            eventCategory: draft.category,
            packageId: draft.packageId === 'custom' ? null : draft.packageId,
            date: draft.date,
            startTime: draft.startTime,
            endTime: draft.endTime,
            guests: Number(draft.guests),
            extras: draft.extras,
            notes: draft.notes,
          },
          consent: draft.consent,
          payment:
            draft.payment === 'CASH_NOW'
              ? {
                  kind: 'CASH_NOW',
                  amountCents: Math.round(Number(draft.cashAmount) * 100),
                  receiptNumber: draft.receiptNumber,
                  note: draft.cashNote,
                }
              : { kind: 'LATER', method: draft.laterMethod },
          overrideReason: draft.approveAtDesk ? draft.overrideReason : '',
          ...(prefill?.visitId ? { sourceVisitId: prefill.visitId } : {}),
        }),
      });
      const body = (await response.json().catch(() => ({}))) as WalkInResult & { error?: string };
      if (!response.ok) throw new Error(body.error || 'The booking could not be saved.');
      onDone(body, draft.email.trim());
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'The booking could not be saved.');
      requestAnimationFrame(() => summaryRef.current?.focus());
    } finally {
      setSending(false);
    }
  }

  const errorList = (Object.entries(errors) as [Field, string | undefined][]).filter(
    ([, message]) => message,
  );
  const category = info.category;
  return (
    <div className={styles.layout}>
      <form className={desk.card} onSubmit={submit} noValidate aria-busy={sending}>
        <ol className={styles.steps} aria-label="Walk-in booking steps">
          {STEPS.map((label, index) => (
            <li
              key={label}
              className={styles.step}
              data-state={index < step ? 'done' : index === step ? 'current' : 'next'}
              aria-current={index === step ? 'step' : undefined}
            >
              <span className={desk.visuallyHidden}>
                Step {index + 1} of {STEPS.length}
                {index < step ? ', completed' : ''}:{' '}
              </span>
              {label}
            </li>
          ))}
        </ol>
        <h2 ref={headingRef} tabIndex={-1} className={desk.focusTarget}>
          {['The client', 'The event', 'Consent', 'Payment and review'][step]}
        </h2>
        {(errorList.length > 0 || failure) && (
          <div ref={summaryRef} tabIndex={-1} className={styles.errorSummary} role="alert">
            <p>
              <CircleAlert size={16} aria-hidden="true" />{' '}
              {failure ||
                `Please check ${errorList.length === 1 ? 'this detail' : 'these details'}:`}
            </p>
            {errorList.length > 0 && (
              <ul>
                {errorList.map(([field, message]) => (
                  <li key={field}>
                    <a href={`#${fieldId(field)}`}>{message}</a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {step === 0 && (
          <>
            {prefill && (
              <p className={desk.notice}>
                Details from {prefill.source === 'visit' ? 'ocular visit' : 'booking'}{' '}
                {prefill.reference}.
              </p>
            )}
            <ClientSearch
              onUse={(client) =>
                setDraft((current) => ({
                  ...current,
                  fullName: client.name,
                  email: client.email,
                  phone: client.phone,
                }))
              }
            />
            <div className={desk.fields}>
              <label className={desk.field} htmlFor={fieldId('fullName')}>
                Client name
                <input
                  id={fieldId('fullName')}
                  value={draft.fullName}
                  maxLength={180}
                  autoComplete="off"
                  aria-invalid={Boolean(errors.fullName)}
                  aria-describedby={describedBy('fullName')}
                  onChange={(event) => update('fullName', event.target.value)}
                />
                {fieldError('fullName')}
              </label>
              <label className={desk.field} htmlFor={fieldId('email')}>
                Email
                <input
                  id={fieldId('email')}
                  type="email"
                  value={draft.email}
                  maxLength={255}
                  autoComplete="off"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={describedBy('email')}
                  onChange={(event) => update('email', event.target.value)}
                />
                <span className={desk.hint}>The confirmation and payment details go here.</span>
                {fieldError('email')}
              </label>
              <label className={desk.field} htmlFor={fieldId('phone')}>
                Mobile number
                <input
                  id={fieldId('phone')}
                  type="tel"
                  value={draft.phone}
                  maxLength={30}
                  autoComplete="off"
                  aria-invalid={Boolean(errors.phone)}
                  aria-describedby={describedBy('phone')}
                  onChange={(event) => update('phone', event.target.value)}
                />
                {fieldError('phone')}
              </label>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className={desk.fields}>
              <label className={desk.field} htmlFor={fieldId('category')}>
                Event
                <select
                  id={fieldId('category')}
                  value={draft.category}
                  aria-invalid={Boolean(errors.category)}
                  aria-describedby={describedBy('category')}
                  onChange={(event) => {
                    update('category', event.target.value);
                    update('packageId', '');
                  }}
                >
                  <option value="">Choose the event</option>
                  {options.categories.map((candidate) => (
                    <option key={candidate.slug} value={candidate.slug}>
                      {candidate.name}
                    </option>
                  ))}
                </select>
                {fieldError('category')}
              </label>
              <label className={desk.field} htmlFor={fieldId('guests')}>
                Guests
                <input
                  id={fieldId('guests')}
                  type="number"
                  inputMode="numeric"
                  min={options.minGuests}
                  max={options.maxGuests}
                  value={draft.guests}
                  aria-invalid={Boolean(errors.guests)}
                  aria-describedby={describedBy('guests')}
                  onChange={(event) => update('guests', event.target.value)}
                />
                <span className={desk.hint}>
                  {options.minGuests} to {options.maxGuests} guests.
                </span>
                {fieldError('guests')}
              </label>
            </div>
            {category && (
              <fieldset className={styles.fieldset} aria-describedby={describedBy('packageId')}>
                <legend>Package</legend>
                <ul className={styles.choices}>
                  {category.packages.map((pkg, index) => (
                    <li key={pkg.id}>
                      <label className={styles.choice}>
                        <input
                          id={index === 0 ? fieldId('packageId') : undefined}
                          type="radio"
                          name={`${id}-package`}
                          checked={draft.packageId === pkg.id}
                          onChange={() => update('packageId', pkg.id)}
                        />
                        <strong className={styles.choiceTitle}>{pkg.name}</strong>
                        <span>
                          {peso.format(pkg.price)} for {pkg.paxIncluded} guests
                          {pkg.excessPaxFee > 0
                            ? `, ${peso.format(pkg.excessPaxFee)} per extra guest`
                            : ''}
                        </span>
                        <span>Reservation fee {peso.format(pkg.reservationFee)}</span>
                      </label>
                    </li>
                  ))}
                  <li>
                    <label className={styles.choice}>
                      <input
                        id={category.packages.length ? undefined : fieldId('packageId')}
                        type="radio"
                        name={`${id}-package`}
                        checked={draft.packageId === 'custom'}
                        onChange={() => update('packageId', 'custom')}
                      />
                      <strong className={styles.choiceTitle}>Custom proposal</strong>
                      <span>Zion quotes the price later; saved for review.</span>
                    </label>
                  </li>
                </ul>
                {fieldError('packageId')}
              </fieldset>
            )}
            <div className={desk.fields}>
              <label className={desk.field} htmlFor={fieldId('date')}>
                Event date
                <input
                  id={fieldId('date')}
                  type="date"
                  min={options.earliest}
                  max={options.latest}
                  value={draft.date}
                  aria-invalid={Boolean(errors.date)}
                  aria-describedby={describedBy('date')}
                  onChange={(event) => update('date', event.target.value)}
                />
                {draft.date && options.booked.includes(draft.date) && !errors.date && (
                  <span className={styles.fieldError}>This date is already held or confirmed.</span>
                )}
                {fieldError('date')}
              </label>
              <label className={desk.field} htmlFor={fieldId('startTime')}>
                Start
                <select
                  id={fieldId('startTime')}
                  value={draft.startTime}
                  aria-invalid={Boolean(errors.startTime)}
                  aria-describedby={describedBy('startTime')}
                  onChange={(event) => update('startTime', event.target.value)}
                >
                  <option value="">Choose a time</option>
                  {options.times.slice(0, -1).map((time) => (
                    <option key={time} value={time}>
                      {clockLabel(time)}
                    </option>
                  ))}
                </select>
                {fieldError('startTime')}
              </label>
              <label className={desk.field} htmlFor={fieldId('endTime')}>
                End
                <select
                  id={fieldId('endTime')}
                  value={draft.endTime}
                  aria-invalid={Boolean(errors.endTime)}
                  aria-describedby={describedBy('endTime')}
                  onChange={(event) => update('endTime', event.target.value)}
                >
                  <option value="">Choose a time</option>
                  {options.times.slice(1).map((time) => (
                    <option key={time} value={time}>
                      {clockLabel(time)}
                    </option>
                  ))}
                </select>
                {fieldError('endTime')}
              </label>
            </div>
            <fieldset className={styles.fieldset}>
              <legend>The client asked about (optional)</legend>
              <ul className={styles.choices}>
                {options.extras.map((extra) => (
                  <li key={extra}>
                    <label className={styles.choice}>
                      <input
                        type="checkbox"
                        checked={draft.extras.includes(extra)}
                        onChange={(event) =>
                          update(
                            'extras',
                            event.target.checked
                              ? [...draft.extras, extra]
                              : draft.extras.filter((value) => value !== extra),
                          )
                        }
                      />
                      <span>{extra}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
            <label className={`${desk.field} ${desk.wide}`}>
              Notes for the team (optional)
              <textarea
                value={draft.notes}
                maxLength={2000}
                rows={3}
                onChange={(event) => update('notes', event.target.value)}
              />
            </label>
          </>
        )}

        {step === 2 && (
          <>
            <fieldset className={styles.fieldset} aria-describedby={describedBy('consent')}>
              <legend>How did the client agree to the terms, policies and privacy notice?</legend>
              <ul className={styles.choices}>
                {CONSENT_METHODS.map((method, index) => (
                  <li key={method}>
                    <label className={styles.choice}>
                      <input
                        id={index === 0 ? fieldId('consent') : undefined}
                        type="radio"
                        name={`${id}-consent`}
                        checked={draft.consent === method}
                        onChange={() => update('consent', method)}
                      />
                      <strong className={styles.choiceTitle}>{CONSENT_LABELS[method]}</strong>
                      <span>
                        {method === 'PRINTED_FORM'
                          ? 'Keep the signed form with the booking papers.'
                          : 'Hand the screen to the client to read and tick the box below.'}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {fieldError('consent')}
            </fieldset>
            {draft.consent === 'ON_SCREEN' && (
              <div className={styles.consentBox}>
                <p>
                  Zion Events Place will use your name, email and mobile number to arrange and
                  confirm your booking, as described in the{' '}
                  <a href="/privacy" target="_blank" rel="noreferrer">
                    Privacy Notice
                  </a>
                  . Your booking follows the{' '}
                  <a href="/terms" target="_blank" rel="noreferrer">
                    Terms and Conditions
                  </a>{' '}
                  and{' '}
                  <a href="/policies" target="_blank" rel="noreferrer">
                    Event Policies
                  </a>{' '}
                  (each opens in a new tab).
                </p>
                <label className={styles.tick} htmlFor={fieldId('clientAgreed')}>
                  <input
                    id={fieldId('clientAgreed')}
                    type="checkbox"
                    checked={draft.clientAgreed}
                    aria-invalid={Boolean(errors.clientAgreed)}
                    aria-describedby={describedBy('clientAgreed')}
                    onChange={(event) => update('clientAgreed', event.target.checked)}
                  />
                  <span>I have read them and I agree.</span>
                </label>
                {fieldError('clientAgreed')}
              </div>
            )}
          </>
        )}

        {step === 3 && (
          <>
            {!info.review.blocking.length && info.review.overridable.length > 0 && (
              <div className={desk.subpanel}>
                <p>
                  The website would send this booking to review:{' '}
                  {info.review.overridable.join('; ')}. You can approve it here instead.
                </p>
                <label className={styles.tick}>
                  <input
                    type="checkbox"
                    checked={draft.approveAtDesk}
                    onChange={(event) => update('approveAtDesk', event.target.checked)}
                  />
                  <span>Approve this booking at the desk</span>
                </label>
                {draft.approveAtDesk && (
                  <label className={desk.field} htmlFor={fieldId('overrideReason')}>
                    Reason (for the activity log)
                    <textarea
                      id={fieldId('overrideReason')}
                      value={draft.overrideReason}
                      maxLength={500}
                      rows={2}
                      aria-invalid={Boolean(errors.overrideReason)}
                      aria-describedby={describedBy('overrideReason')}
                      onChange={(event) => update('overrideReason', event.target.value)}
                    />
                    {fieldError('overrideReason')}
                  </label>
                )}
              </div>
            )}
            <fieldset className={styles.fieldset}>
              <legend>Payment</legend>
              <ul className={styles.choices}>
                <li>
                  <label className={styles.choice}>
                    <input
                      type="radio"
                      name={`${id}-payment`}
                      checked={draft.payment === 'CASH_NOW'}
                      onChange={() => update('payment', 'CASH_NOW')}
                    />
                    <strong className={styles.choiceTitle}>Cash received now</strong>
                    <span>
                      {info.required > 0
                        ? `${peso.format(info.required / 100)} confirms the booking at once.`
                        : 'Recorded with an acknowledgment receipt.'}
                    </span>
                  </label>
                </li>
                <li>
                  <label className={styles.choice}>
                    <input
                      type="radio"
                      name={`${id}-payment`}
                      checked={draft.payment === 'LATER'}
                      onChange={() => update('payment', 'LATER')}
                    />
                    <strong className={styles.choiceTitle}>Pay later</strong>
                    <span>
                      {info.approves
                        ? `The date is held for ${options.paymentDeadlineDays} days; the client gets the payment details by email.`
                        : 'The request waits for review first.'}
                    </span>
                  </label>
                </li>
              </ul>
            </fieldset>
            {draft.payment === 'CASH_NOW' ? (
              <div className={desk.fields}>
                <label className={desk.field} htmlFor={fieldId('cashAmount')}>
                  Cash received (PHP)
                  <input
                    id={fieldId('cashAmount')}
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    value={draft.cashAmount}
                    aria-invalid={Boolean(errors.cashAmount)}
                    aria-describedby={describedBy('cashAmount')}
                    onChange={(event) => update('cashAmount', event.target.value)}
                  />
                  {fieldError('cashAmount')}
                </label>
                <label className={desk.field} htmlFor={fieldId('receiptNumber')}>
                  Receipt number
                  <input
                    id={fieldId('receiptNumber')}
                    value={draft.receiptNumber}
                    maxLength={80}
                    autoComplete="off"
                    aria-invalid={Boolean(errors.receiptNumber)}
                    aria-describedby={describedBy('receiptNumber')}
                    onChange={(event) => update('receiptNumber', event.target.value)}
                  />
                  <span className={desk.hint}>From the paper receipt book.</span>
                  {fieldError('receiptNumber')}
                </label>
                <label className={`${desk.field} ${desk.wide}`}>
                  Payment note (optional)
                  <input
                    value={draft.cashNote}
                    maxLength={1000}
                    onChange={(event) => update('cashNote', event.target.value)}
                  />
                </label>
              </div>
            ) : (
              <label className={desk.field}>
                How the client plans to pay
                <select
                  value={draft.laterMethod}
                  onChange={(event) =>
                    update('laterMethod', event.target.value as BookingPaymentMethod)
                  }
                >
                  {BOOKING_PAYMENT_METHODS.filter((method) =>
                    options.paymentMethods.includes(method.value),
                  ).map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
                {options.onlinePayments && (
                  <span className={desk.hint}>
                    A GCash or bank screenshot can be uploaded on the client&apos;s payment page,
                    even here at the desk, once the booking is saved.
                  </span>
                )}
              </label>
            )}
          </>
        )}

        <div className={desk.actions}>
          {step > 0 && (
            <Button type="button" variant="secondary" onClick={() => goTo(step - 1)}>
              Back
            </Button>
          )}
          <Button type="submit" variant="primary" loading={sending} loadingLabel="Saving…">
            {step < STEPS.length - 1 ? 'Continue' : 'Save the booking'}
          </Button>
        </div>
      </form>
      <Summary options={options} draft={draft} />
    </div>
  );
}

/**
 * Walk-in booking at the Front desk (plan section 16.2, docs/walk-ins.md): the client, the event
 * priced like the website, the client's consent, and cash now or payment later. The server checks
 * every rule again when the booking is saved.
 */
export default function WalkInBooking({
  visitId,
  bookingId,
}: {
  visitId: string | null;
  bookingId: string | null;
}) {
  const [result, setResult] = useState<{ booking: WalkInResult; email: string } | null>(null);
  const [round, setRound] = useState(0);
  const options = useSWR<WalkInOptions>(`${ENDPOINT}?walk-in=options`, load, {
    shouldRetryOnError: false,
    revalidateOnFocus: false,
  });
  const prefillKey = visitId
    ? `${ENDPOINT}?walk-in=prefill&visit=${encodeURIComponent(visitId)}`
    : bookingId
      ? `${ENDPOINT}?walk-in=prefill&booking=${encodeURIComponent(bookingId)}`
      : null;
  const prefill = useSWR<WalkInPrefill>(round === 0 ? prefillKey : null, load, {
    shouldRetryOnError: false,
    revalidateOnFocus: false,
  });
  const loadError = options.error ?? prefill.error;
  const ready = options.data && (!prefillKey || round > 0 || prefill.data || prefill.error);
  return (
    <section className={`${desk.panel} ${styles.walkIn}`} aria-labelledby="walk-in-title">
      <header className={desk.header}>
        <div>
          <h1 id="walk-in-title">Walk-in booking</h1>
        </div>
        <div className={desk.headerActions}>
          <ButtonLink variant="secondary" href="/admin/front-desk">
            Back to the Front desk
          </ButtonLink>
        </div>
      </header>
      {loadError instanceof Error && (
        <p className={desk.alert} role="alert">
          {loadError.message}
        </p>
      )}
      {!ready && !loadError && (
        <p className={desk.loading} role="status">
          <LoaderCircle size={20} aria-hidden="true" className={desk.spin} />
          Loading packages and dates…
        </p>
      )}
      {result ? (
        <Outcome
          result={result.booking}
          email={result.email}
          onlinePayments={options.data?.onlinePayments ?? false}
          onAnother={() => {
            setResult(null);
            setRound((value) => value + 1);
          }}
        />
      ) : (
        ready &&
        options.data && (
          <WalkInForm
            key={round}
            options={options.data}
            prefill={round === 0 ? (prefill.data ?? null) : null}
            onDone={(booking, email) => {
              setResult({ booking, email });
              void options.mutate();
            }}
          />
        )
      )}
    </section>
  );
}
