'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  CalendarDays,
  Check,
  CircleAlert,
  Clock,
  Info,
  Landmark,
  Mail,
  Phone,
  Smartphone,
  Users,
  type LucideIcon,
} from 'lucide-react';
import ZionDatePicker, { type ZionDateStatus } from '@/components/client/ZionDatePicker';
import { useReducedMotion } from '@/components/shared/useReducedMotion';
import { BRAND } from '@/config/brand';
import { packageQuote } from '@/lib/booking-quote';
import {
  BOOKING_EXTRAS,
  BOOKING_PAYMENT_METHODS,
  BOOKING_REQUEST_RULES,
  bookingTimeOptions,
  type BookingPaymentMethod,
} from '@/config/booking';
import type {
  BookingAvailability,
  BookingCategory,
  BookingInitialChoices,
  BookingPackage,
} from './booking-types';
import styles from './BookingRequest.module.css';

type FormState = {
  category: string;
  /** A package id, 'custom' for a custom proposal, or '' before choosing. */
  packageId: string;
  date: string;
  startTime: string;
  endTime: string;
  guests: string;
  extras: string[];
  fullName: string;
  email: string;
  phone: string;
  facebook: string;
  notes: string;
  paymentMethod: BookingPaymentMethod | '';
  accepted: boolean;
  /** Honeypot; stays empty for people. */
  website: string;
};

type FieldName = keyof FormState;
type FieldErrors = Partial<Record<FieldName, string>>;

const EMPTY_FORM: FormState = {
  category: '',
  packageId: '',
  date: '',
  startTime: '',
  endTime: '',
  guests: '',
  extras: [],
  fullName: '',
  email: '',
  phone: '',
  facebook: '',
  notes: '',
  paymentMethod: '',
  accepted: false,
  website: '',
};

const STEPS = ['Event', 'Package', 'Your details', 'Review'] as const;
const STEP_TITLES = [
  'Your event',
  'Choose a package',
  'Your contact details',
  'Review and send',
] as const;

/** Where each field's error links to (the field itself, or the first option of a group). */
const FIELD_IDS: Partial<Record<FieldName, string>> = {
  category: 'booking-category-first',
  date: 'booking-date',
  startTime: 'booking-start',
  endTime: 'booking-end',
  guests: 'booking-guests',
  packageId: 'booking-package-first',
  fullName: 'booking-name',
  email: 'booking-email',
  phone: 'booking-phone',
  paymentMethod: 'booking-payment-first',
  accepted: 'booking-accept',
};

const PAYMENT_ICONS: Record<BookingPaymentMethod, LucideIcon> = {
  BANK_TRANSFER: Landmark,
  GCASH: Smartphone,
  CASH: Banknote,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[\d\s()-]{7,30}$/;
const TIMES = bookingTimeOptions();
const NOTES_LIMIT = 2000;

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

function minutesOf(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function timeLabel(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  const suffix = hours < 12 ? 'AM' : 'PM';
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

/** A payment deadline as Manila time, for example "Nov 28, 2026, 5:49 PM". */
function deadlineLabel(iso: string) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

function dateLabel(iso: string) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${iso}T00:00:00Z`));
}

/** The server and the Front desk price bookings with the same function (lib/booking-quote.ts). */
function estimateFor(pkg: BookingPackage | null, guests: number) {
  if (!pkg) return null;
  const quote = packageQuote(pkg, guests);
  return {
    extraGuests: quote.extraGuests,
    extraCost: quote.extraCents / 100,
    total: quote.totalCents / 100,
    reservationFee: quote.depositCents / 100,
  };
}

function validate(
  step: number,
  form: FormState,
  limits: { earliest: string; latest: string; booked: Set<string> },
): FieldErrors {
  const errors: FieldErrors = {};
  if (step === 0) {
    if (!form.category) errors.category = 'Choose the type of event.';
    if (!form.date) errors.date = 'Choose your event date.';
    else if (form.date < limits.earliest || form.date > limits.latest)
      errors.date = 'Choose a date from tomorrow up to two years ahead.';
    else if (limits.booked.has(form.date))
      errors.date = 'This date is already booked. Please choose another date.';
    if (!form.startTime) errors.startTime = 'Choose a start time.';
    if (!form.endTime) errors.endTime = 'Choose an end time.';
    else if (
      form.startTime &&
      minutesOf(form.endTime) - minutesOf(form.startTime) < BOOKING_REQUEST_RULES.minDurationMinutes
    )
      errors.endTime = 'The event must end at least one hour after it starts.';
    const guests = Number(form.guests);
    if (!form.guests.trim()) errors.guests = 'Enter the number of guests.';
    else if (
      !Number.isInteger(guests) ||
      guests < BOOKING_REQUEST_RULES.minGuests ||
      guests > BOOKING_REQUEST_RULES.maxGuests
    )
      errors.guests = `Enter between ${BOOKING_REQUEST_RULES.minGuests} and ${BOOKING_REQUEST_RULES.maxGuests} guests.`;
  }
  if (step === 1 && !form.packageId)
    errors.packageId = 'Choose a package, or ask for a custom proposal.';
  if (step === 2) {
    if (form.fullName.trim().length < 2) errors.fullName = 'Enter your full name.';
    if (!EMAIL_PATTERN.test(form.email.trim()))
      errors.email = 'Enter a valid email address, for example name@gmail.com.';
    if (!PHONE_PATTERN.test(form.phone.trim()))
      errors.phone = 'Enter a valid mobile number, for example 0917 123 4567.';
  }
  if (step === 3) {
    if (!form.paymentMethod) errors.paymentMethod = 'Choose how you prefer to pay.';
    if (!form.accepted) errors.accepted = 'Please confirm that you have read the policies.';
  }
  return errors;
}

type BookingRequestFormProps = {
  categories: BookingCategory[];
  availability: BookingAvailability;
  earliest: string;
  latest: string;
  pausedMessage: string | null;
  loadFailed: boolean;
  /** Choices pre-filled from the link (for example a Zeni "Book this date" button). */
  initial: BookingInitialChoices;
};

/**
 * The booking request flow (team plan section 19.3, without visitor accounts): event, package,
 * contact details, then review. Sending saves a Request that staff review in the admin; the date
 * is confirmed only after approval and a verified reservation payment.
 */
export default function BookingRequestForm({
  categories,
  availability,
  earliest,
  latest,
  pausedMessage,
  loadFailed,
  initial,
}: BookingRequestFormProps) {
  const [form, setForm] = useState<FormState>(() => ({
    ...EMPTY_FORM,
    category: initial.category,
    packageId: initial.packageId,
    date: initial.date,
    startTime: TIMES.includes(initial.startTime) ? initial.startTime : '',
    endTime: TIMES.includes(initial.endTime) ? initial.endTime : '',
    guests: initial.guests,
  }));
  const [step, setStep] = useState(0);
  // Which way the steps move, so the new step slides in from the matching side.
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const reducedMotion = useReducedMotion();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [newlyBooked, setNewlyBooked] = useState<string[]>([]);
  const fromZeni = initial.fromZeni;
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [reference, setReference] = useState('');
  // Set when the booking automation approved the request and holds the date until a deadline.
  const [hold, setHold] = useState<{
    expiresAt: string;
    amountDueCents: number | null;
    paymentPath: string | null;
    /** The payment page takes GCash or bank transfer screenshots (an account is set up). */
    onlinePayment: boolean;
  } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const movedRef = useRef(false);

  const booked = useMemo(
    () => new Set([...availability.booked, ...newlyBooked]),
    [availability.booked, newlyBooked],
  );
  const inquired = useMemo(() => new Set(availability.inquired), [availability.inquired]);
  const category = categories.find((candidate) => candidate.slug === form.category) ?? null;
  const pkg = category?.packages.find((candidate) => candidate.id === form.packageId) ?? null;
  const guests = Number(form.guests);
  const estimate = estimateFor(pkg, guests);

  // Move focus to the new step's heading, so keyboard and screen-reader users start there, and
  // bring it into view (gently, unless reduced motion is set).
  useEffect(() => {
    if (!movedRef.current) return;
    const heading = headingRef.current;
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'nearest' });
  }, [step, reducedMotion]);

  useEffect(() => {
    if (reference) doneRef.current?.focus();
  }, [reference]);

  const update = <K extends FieldName>(field: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const chooseCategory = (slug: string) => {
    setForm((current) => ({
      ...current,
      category: slug,
      // A package belongs to one event type, so changing the event clears it.
      packageId: current.category === slug ? current.packageId : '',
    }));
    setErrors((current) => ({ ...current, category: undefined }));
  };

  const goTo = (next: number) => {
    movedRef.current = true;
    setDirection(next >= step ? 'forward' : 'back');
    setStep(next);
    setSubmitError('');
  };

  const showErrors = (found: FieldErrors) => {
    setErrors(found);
    window.requestAnimationFrame(() => summaryRef.current?.focus());
  };

  const dateStatus = (iso: string): ZionDateStatus => {
    if (iso < earliest || iso > latest) return 'unavailable';
    if (booked.has(iso)) return 'booked';
    if (inquired.has(iso)) return 'inquired';
    return 'available';
  };

  const submit = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const response = await fetch('/api/client/booking-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventCategory: form.category,
          packageId: form.packageId === 'custom' ? null : form.packageId,
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime,
          guests: Number(form.guests),
          extras: form.extras,
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          facebook: form.facebook.trim(),
          notes: form.notes.trim(),
          paymentMethod: form.paymentMethod,
          acceptedPolicies: form.accepted,
          fromZeni,
          website: form.website,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        reference?: string;
        holdExpiresAt?: string | null;
        amountDueCents?: number | null;
        paymentPath?: string | null;
        onlinePayment?: boolean;
        error?: string;
      } | null;
      if (response.ok && payload?.reference) {
        setHold(
          payload.holdExpiresAt
            ? {
                expiresAt: payload.holdExpiresAt,
                amountDueCents: payload.amountDueCents ?? null,
                // Only this site's payment page is ever linked from here.
                paymentPath: payload.paymentPath?.startsWith('/booking/pay/')
                  ? payload.paymentPath
                  : null,
                onlinePayment: payload.onlinePayment === true,
              }
            : null,
        );
        setReference(payload.reference);
        return;
      }
      const message = payload?.error ?? 'We could not send your request. Please try again.';
      if (response.status === 409 && /date/i.test(message)) {
        setNewlyBooked((current) => [...current, form.date]);
        goTo(0);
        setErrors({ date: message });
        return;
      }
      setSubmitError(message);
    } catch {
      setSubmitError(
        'We could not reach Zion Events Place. Check your connection, then try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = validate(step, form, { earliest, latest, booked });
    if (Object.keys(found).length) {
      showErrors(found);
      return;
    }
    if (step < STEPS.length - 1) goTo(step + 1);
    else void submit();
  };

  const errorList = Object.entries(errors).filter(([, message]) => Boolean(message)) as [
    FieldName,
    string,
  ][];
  const fieldError = (field: FieldName) =>
    errors[field] ? (
      <p id={`${FIELD_IDS[field] ?? field}-error`} className={styles.fieldError}>
        <CircleAlert aria-hidden="true" className={styles.inlineIcon} />
        {errors[field]}
      </p>
    ) : null;
  const describedBy = (field: FieldName, hint?: string) =>
    [hint, errors[field] ? `${FIELD_IDS[field] ?? field}-error` : null].filter(Boolean).join(' ') ||
    undefined;

  if (pausedMessage || loadFailed || !categories.length) {
    return (
      <div className={styles.page}>
        <header className={styles.intro}>
          <h1 className={styles.title}>Book your event</h1>
        </header>
        <div className={styles.notice} role="status">
          <Info aria-hidden="true" className={styles.noticeIcon} />
          <div>
            <p className={styles.noticeTitle}>Online booking requests are unavailable right now.</p>
            <p>
              {pausedMessage ??
                'Please contact us and our team will help you book your date directly.'}
            </p>
            <ContactLinks />
          </div>
        </div>
      </div>
    );
  }

  if (reference) {
    const firstName = form.fullName.trim().split(/\s+/)[0];
    return (
      <div className={styles.page}>
        <section className={styles.done} aria-labelledby="booking-done-title">
          <svg className={styles.doneIcon} viewBox="0 0 52 52" aria-hidden="true" focusable="false">
            <circle className={styles.doneCircle} cx="26" cy="26" r="24" pathLength={1} />
            <path className={styles.doneTick} d="M15 27.5l7.5 7.5L37.5 19" pathLength={1} />
          </svg>
          <h1 id="booking-done-title" ref={doneRef} tabIndex={-1} className={styles.doneTitle}>
            {hold ? 'Your date is on hold' : 'Booking request sent'}
          </h1>
          <p className={styles.lead}>
            {hold
              ? `Thank you${firstName ? `, ${firstName}` : ''}. Your booking is approved and your date is held for you until ${deadlineLabel(hold.expiresAt)} (Manila time).`
              : `Thank you${firstName ? `, ${firstName}` : ''}. Your request is now with our team.`}
          </p>
          <p className={styles.reference}>
            Booking reference <strong>{reference}</strong>
          </p>
          <h2 className={styles.subheading}>What happens next</h2>
          {hold ? (
            <ol className={styles.nextSteps}>
              <li>
                Pay{' '}
                {hold.amountDueCents
                  ? `the ${peso.format(hold.amountDueCents / 100)} reservation fee`
                  : 'the reservation fee'}{' '}
                by {deadlineLabel(hold.expiresAt)}.{' '}
                {hold.paymentPath
                  ? `See how to pay on your payment page below; the link is also in the email we sent to ${form.email.trim()}.`
                  : `How to pay is in the email we sent to ${form.email.trim()}.`}
              </li>
              <li>
                We check your payment with our records and confirm your date.
                {hold.onlinePayment &&
                  ' For GCash or bank transfers, send the screenshot on your payment page.'}
              </li>
              <li>You receive a confirmation email with a calendar invitation.</li>
            </ol>
          ) : (
            <ol className={styles.nextSteps}>
              <li>We review your request, usually within one to two days.</li>
              <li>
                We contact you at {form.email.trim()} or {form.phone.trim()} with the reservation
                fee details.
              </li>
              <li>We confirm your date once your payment is verified.</li>
            </ol>
          )}
          <p className={styles.muted}>
            {hold
              ? 'If we do not receive your payment by the deadline, the hold ends and the date opens to other clients. Keep your booking reference for any questions.'
              : 'Your date is not reserved until Zion confirms it. Keep your booking reference for any questions.'}
          </p>
          <div className={styles.actions}>
            <Link href="/" className={styles.secondaryButton}>
              Back to home
            </Link>
            {hold?.paymentPath ? (
              <Link href={hold.paymentPath} className={styles.primaryButton}>
                See how to pay
              </Link>
            ) : (
              <Link href="/contact" className={styles.primaryButton}>
                Contact us
              </Link>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={`${styles.intro} ${styles.hero}`}>
        <div className={styles.heroText}>
          <h1 className={styles.title}>Book your event</h1>
          <p className={styles.lead}>
            Tell us about your celebration in four short steps. You pay nothing to send a request.
          </p>
          <p className={styles.heroLink}>
            Not ready yet?{' '}
            <Link href="/visit" className={styles.introLink}>
              Schedule an ocular visit
            </Link>{' '}
            to see the venue first.
          </p>
        </div>
        <ol className={styles.howItWorks} aria-label="How booking works">
          <li className={styles.howItem}>
            <strong>Choose your date and package.</strong> Only confirmed events block a date.
          </li>
          <li className={styles.howItem}>
            <strong>Most requests are approved right away.</strong> Custom proposals are reviewed by
            our team first.
          </li>
          <li className={styles.howItem}>
            <strong>Your date is held while you pay.</strong> The reservation fee confirms your
            booking.
          </li>
        </ol>
      </header>

      <ol className={styles.stepper} aria-label="Booking steps">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={styles.stepperItem}
            data-state={index < step ? 'done' : index === step ? 'current' : 'next'}
            aria-current={index === step ? 'step' : undefined}
          >
            <span className={styles.stepperNumber} aria-hidden="true">
              {index < step ? (
                <Check className={styles.stepperCheck} strokeWidth={2.5} />
              ) : (
                index + 1
              )}
            </span>
            <span className={styles.stepperLabel}>
              <span className={styles.visuallyHidden}>
                Step {index + 1} of {STEPS.length}
                {index < step ? ', completed' : ''}:{' '}
              </span>
              {label}
            </span>
          </li>
        ))}
      </ol>

      <div className={styles.layout}>
        <form className={styles.panel} onSubmit={onSubmit} noValidate>
          <div key={step} className={styles.stepBody} data-direction={direction}>
            <div className={styles.stepHead}>
              <p className={styles.stepEyebrow} aria-hidden="true">
                Step {step + 1} of {STEPS.length}
              </p>
              <h2 ref={headingRef} tabIndex={-1} className={styles.stepTitle}>
                {STEP_TITLES[step]}
              </h2>
            </div>

            {errorList.length ? (
              <div ref={summaryRef} tabIndex={-1} className={styles.errorSummary} role="alert">
                <p className={styles.errorSummaryTitle}>
                  <CircleAlert aria-hidden="true" className={styles.inlineIcon} />
                  Please check {errorList.length === 1 ? 'this detail' : 'these details'}:
                </p>
                <ul>
                  {errorList.map(([field, message]) => (
                    <li key={field}>
                      <a href={`#${FIELD_IDS[field] ?? field}`}>{message}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {step === 0 ? (
              <>
                <fieldset
                  className={styles.fieldset}
                  aria-describedby={errors.category ? 'booking-category-first-error' : undefined}
                >
                  <legend className={styles.legend}>Type of event</legend>
                  <div className={styles.eventGrid}>
                    {categories.map((item, index) => (
                      <label key={item.slug} className={styles.eventOption}>
                        <input
                          id={index === 0 ? 'booking-category-first' : undefined}
                          type="radio"
                          name="category"
                          value={item.slug}
                          checked={form.category === item.slug}
                          onChange={() => chooseCategory(item.slug)}
                          className={styles.optionInput}
                        />
                        <span className={styles.eventMedia}>
                          {item.imageUrl ? (
                            <Image
                              src={item.imageUrl}
                              alt=""
                              fill
                              sizes="(min-width: 64rem) 16rem, (min-width: 40rem) 30vw, 45vw"
                            />
                          ) : null}
                        </span>
                        <span className={styles.eventName}>
                          {item.name}
                          <Check
                            aria-hidden="true"
                            className={styles.optionCheck}
                            strokeWidth={2.5}
                          />
                        </span>
                      </label>
                    ))}
                  </div>
                  {fieldError('category')}
                </fieldset>

                <div className={styles.fieldGrid}>
                  <div className={styles.field}>
                    <label htmlFor="booking-date" className={styles.label}>
                      <CalendarDays aria-hidden="true" className={styles.labelIcon} />
                      Event date
                    </label>
                    <ZionDatePicker
                      id="booking-date"
                      value={form.date}
                      minDate={earliest}
                      maxDate={latest}
                      placeholder="Choose a date"
                      getDateStatus={dateStatus}
                      onChange={(value) => update('date', value)}
                    />
                    {form.date && !errors.date && inquired.has(form.date) ? (
                      <p className={styles.hint}>
                        Another guest has asked about this date. Send your request and we will
                        confirm what is available.
                      </p>
                    ) : null}
                    {fieldError('date')}
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="booking-guests" className={styles.label}>
                      <Users aria-hidden="true" className={styles.labelIcon} />
                      Number of guests
                    </label>
                    <input
                      id="booking-guests"
                      className={styles.input}
                      type="number"
                      inputMode="numeric"
                      min={BOOKING_REQUEST_RULES.minGuests}
                      max={BOOKING_REQUEST_RULES.maxGuests}
                      value={form.guests}
                      onChange={(event) => update('guests', event.target.value)}
                      aria-invalid={Boolean(errors.guests)}
                      aria-describedby={describedBy('guests', 'booking-guests-hint')}
                    />
                    <p id="booking-guests-hint" className={styles.hint}>
                      Between {BOOKING_REQUEST_RULES.minGuests} and{' '}
                      {BOOKING_REQUEST_RULES.maxGuests} guests.
                    </p>
                    {fieldError('guests')}
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="booking-start" className={styles.label}>
                      <Clock aria-hidden="true" className={styles.labelIcon} />
                      Start time
                    </label>
                    <select
                      id="booking-start"
                      className={styles.input}
                      value={form.startTime}
                      onChange={(event) => update('startTime', event.target.value)}
                      aria-invalid={Boolean(errors.startTime)}
                      aria-describedby={describedBy('startTime')}
                    >
                      <option value="">Choose a time</option>
                      {TIMES.slice(0, -1).map((value) => (
                        <option key={value} value={value}>
                          {timeLabel(value)}
                        </option>
                      ))}
                    </select>
                    {fieldError('startTime')}
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="booking-end" className={styles.label}>
                      <Clock aria-hidden="true" className={styles.labelIcon} />
                      End time
                    </label>
                    <select
                      id="booking-end"
                      className={styles.input}
                      value={form.endTime}
                      onChange={(event) => update('endTime', event.target.value)}
                      aria-invalid={Boolean(errors.endTime)}
                      aria-describedby={describedBy('endTime')}
                    >
                      <option value="">Choose a time</option>
                      {TIMES.slice(1).map((value) => (
                        <option key={value} value={value}>
                          {timeLabel(value)}
                        </option>
                      ))}
                    </select>
                    {fieldError('endTime')}
                  </div>
                </div>
              </>
            ) : null}

            {step === 1 && category ? (
              <>
                <fieldset
                  className={styles.fieldset}
                  aria-describedby={errors.packageId ? 'booking-package-first-error' : undefined}
                >
                  <legend className={styles.legend}>{category.name} packages</legend>
                  <div className={styles.packageList}>
                    {category.packages.map((item, index) => {
                      const itemEstimate = estimateFor(item, guests);
                      return (
                        <label key={item.id} className={styles.packageOption}>
                          <input
                            id={index === 0 ? 'booking-package-first' : undefined}
                            type="radio"
                            name="package"
                            value={item.id}
                            checked={form.packageId === item.id}
                            onChange={() => update('packageId', item.id)}
                            className={styles.optionInput}
                          />
                          <span className={styles.packageHeader}>
                            <span className={styles.packageName}>{item.name}</span>
                            <span className={styles.packagePrice}>{peso.format(item.price)}</span>
                            <Check
                              aria-hidden="true"
                              className={styles.optionCheck}
                              strokeWidth={2.5}
                            />
                          </span>
                          <span className={styles.packageFacts}>
                            <span>Good for {item.paxIncluded} guests</span>
                            {item.excessPaxFee > 0 ? (
                              <span>{peso.format(item.excessPaxFee)} per extra guest</span>
                            ) : null}
                            {item.checkInTime && item.checkOutTime ? (
                              <span>
                                {item.checkInTime} to {item.checkOutTime}
                              </span>
                            ) : null}
                          </span>
                          {item.inclusions.length ? (
                            <span className={styles.inclusions}>
                              {item.inclusions.slice(0, 6).map((inclusion) => (
                                <span key={inclusion} className={styles.inclusion}>
                                  <Check aria-hidden="true" className={styles.inclusionIcon} />
                                  {inclusion}
                                </span>
                              ))}
                            </span>
                          ) : null}
                          {itemEstimate && itemEstimate.extraGuests > 0 ? (
                            <span className={styles.packageNote}>
                              For {guests} guests: about {peso.format(itemEstimate.total)}
                            </span>
                          ) : null}
                        </label>
                      );
                    })}
                    <label className={styles.packageOption}>
                      <input
                        id={category.packages.length ? undefined : 'booking-package-first'}
                        type="radio"
                        name="package"
                        value="custom"
                        checked={form.packageId === 'custom'}
                        onChange={() => update('packageId', 'custom')}
                        className={styles.optionInput}
                      />
                      <span className={styles.packageHeader}>
                        <span className={styles.packageName}>Custom proposal</span>
                        <Check
                          aria-hidden="true"
                          className={styles.optionCheck}
                          strokeWidth={2.5}
                        />
                      </span>
                      <span className={styles.packageFacts}>
                        <span>
                          Not sure yet, or need something different? Our team will prepare a quote
                          for you.
                        </span>
                      </span>
                    </label>
                  </div>
                  {fieldError('packageId')}
                </fieldset>

                <fieldset className={styles.fieldset}>
                  <legend className={styles.legend}>
                    Also ask us about <span className={styles.optional}>(optional)</span>
                  </legend>
                  <div className={styles.checkList}>
                    {BOOKING_EXTRAS.map((extra) => (
                      <label key={extra} className={styles.checkRow}>
                        <input
                          type="checkbox"
                          checked={form.extras.includes(extra)}
                          onChange={(event) =>
                            update(
                              'extras',
                              event.target.checked
                                ? [...form.extras, extra]
                                : form.extras.filter((item) => item !== extra),
                            )
                          }
                        />
                        {extra}
                      </label>
                    ))}
                  </div>
                  <p className={styles.hint}>Our team quotes these separately.</p>
                </fieldset>
              </>
            ) : null}

            {step === 2 ? (
              <div className={styles.fieldGrid}>
                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <label htmlFor="booking-name" className={styles.label}>
                    Full name
                  </label>
                  <input
                    id="booking-name"
                    className={styles.input}
                    autoComplete="name"
                    value={form.fullName}
                    onChange={(event) => update('fullName', event.target.value)}
                    aria-invalid={Boolean(errors.fullName)}
                    aria-describedby={describedBy('fullName')}
                  />
                  {fieldError('fullName')}
                </div>
                <div className={styles.field}>
                  <label htmlFor="booking-phone" className={styles.label}>
                    <Phone aria-hidden="true" className={styles.labelIcon} />
                    Mobile number
                  </label>
                  <input
                    id="booking-phone"
                    className={styles.input}
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    value={form.phone}
                    onChange={(event) => update('phone', event.target.value)}
                    aria-invalid={Boolean(errors.phone)}
                    aria-describedby={describedBy('phone')}
                  />
                  {fieldError('phone')}
                </div>
                <div className={styles.field}>
                  <label htmlFor="booking-email" className={styles.label}>
                    <Mail aria-hidden="true" className={styles.labelIcon} />
                    Email
                  </label>
                  <input
                    id="booking-email"
                    className={styles.input}
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(event) => update('email', event.target.value)}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={describedBy('email')}
                  />
                  {fieldError('email')}
                </div>
                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <label htmlFor="booking-facebook" className={styles.label}>
                    Facebook name or link <span className={styles.optional}>(optional)</span>
                  </label>
                  <input
                    id="booking-facebook"
                    className={styles.input}
                    value={form.facebook}
                    onChange={(event) => update('facebook', event.target.value)}
                  />
                </div>
                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <label htmlFor="booking-notes" className={styles.label}>
                    Notes and special requests <span className={styles.optional}>(optional)</span>
                  </label>
                  <textarea
                    id="booking-notes"
                    className={`${styles.input} ${styles.textarea}`}
                    rows={5}
                    maxLength={NOTES_LIMIT}
                    value={form.notes}
                    onChange={(event) => update('notes', event.target.value)}
                    aria-describedby="booking-notes-hint"
                  />
                  <p id="booking-notes-hint" className={styles.hint}>
                    For example the celebrant&apos;s name, a theme or setup ideas.{' '}
                    {NOTES_LIMIT - form.notes.length} characters left.
                  </p>
                </div>
                <div className={styles.honeypot} aria-hidden="true">
                  <label htmlFor="booking-website">Website</label>
                  <input
                    id="booking-website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={form.website}
                    onChange={(event) => update('website', event.target.value)}
                  />
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <>
                <dl className={styles.reviewList}>
                  <ReviewRow label="Event" value={category?.name ?? ''} onEdit={() => goTo(0)} />
                  <ReviewRow
                    label="Date and time"
                    value={
                      form.date
                        ? `${dateLabel(form.date)}, ${timeLabel(form.startTime)} to ${timeLabel(form.endTime)}`
                        : ''
                    }
                    onEdit={() => goTo(0)}
                  />
                  <ReviewRow label="Guests" value={form.guests} onEdit={() => goTo(0)} />
                  <ReviewRow
                    label="Package"
                    value={pkg?.name ?? 'Custom proposal'}
                    onEdit={() => goTo(1)}
                  />
                  {form.extras.length ? (
                    <ReviewRow
                      label="Also asking about"
                      value={form.extras.join(', ')}
                      onEdit={() => goTo(1)}
                    />
                  ) : null}
                  <ReviewRow
                    label="Contact"
                    value={`${form.fullName.trim()}\n${form.phone.trim()}\n${form.email.trim()}`}
                    onEdit={() => goTo(2)}
                  />
                  {form.notes.trim() ? (
                    <ReviewRow label="Notes" value={form.notes.trim()} onEdit={() => goTo(2)} />
                  ) : null}
                </dl>

                <fieldset
                  className={styles.fieldset}
                  aria-describedby={describedBy('paymentMethod', 'booking-payment-hint')}
                >
                  <legend className={styles.legend}>How do you prefer to pay?</legend>
                  <p id="booking-payment-hint" className={styles.hint}>
                    You pay nothing now. After we approve your request we send the reservation fee
                    details.
                  </p>
                  <div className={styles.paymentGrid}>
                    {BOOKING_PAYMENT_METHODS.map((method, index) => {
                      const Icon = PAYMENT_ICONS[method.value];
                      return (
                        <label key={method.value} className={styles.paymentOption}>
                          <input
                            id={index === 0 ? 'booking-payment-first' : undefined}
                            type="radio"
                            name="paymentMethod"
                            value={method.value}
                            checked={form.paymentMethod === method.value}
                            onChange={() => update('paymentMethod', method.value)}
                            className={styles.optionInput}
                          />
                          <Icon aria-hidden="true" className={styles.paymentIcon} />
                          <span>{method.label}</span>
                          <Check
                            aria-hidden="true"
                            className={styles.optionCheck}
                            strokeWidth={2.5}
                          />
                        </label>
                      );
                    })}
                  </div>
                  {fieldError('paymentMethod')}
                </fieldset>

                <div className={styles.nextBox}>
                  <h3 className={styles.subheading}>What happens next</h3>
                  <ol className={styles.nextSteps}>
                    <li>
                      Most bookings are approved right away, and your date is held for a few days
                      while you pay the reservation fee. Custom proposals and some larger events are
                      reviewed by our team first.
                    </li>
                    <li>We confirm your date as soon as your payment is received.</li>
                    <li>You receive a confirmation email with a calendar invitation.</li>
                  </ol>
                </div>

                <div className={styles.field}>
                  <label className={styles.checkRow} htmlFor="booking-accept">
                    <input
                      id="booking-accept"
                      type="checkbox"
                      checked={form.accepted}
                      onChange={(event) => update('accepted', event.target.checked)}
                      aria-invalid={Boolean(errors.accepted)}
                      aria-describedby={describedBy('accepted')}
                    />
                    <span>
                      I have read the{' '}
                      <Link href="/terms" target="_blank">
                        Terms and Conditions
                      </Link>
                      ,{' '}
                      <Link href="/policies" target="_blank">
                        Event Policies
                      </Link>{' '}
                      and{' '}
                      <Link href="/privacy" target="_blank">
                        Privacy Notice
                      </Link>{' '}
                      (each opens in a new tab).
                    </span>
                  </label>
                  {fieldError('accepted')}
                </div>

                {submitError ? (
                  <p className={styles.submitError} role="alert">
                    <CircleAlert aria-hidden="true" className={styles.inlineIcon} />
                    {submitError}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>

          <div className={styles.actions}>
            {step > 0 ? (
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => goTo(step - 1)}
              >
                <ArrowLeft aria-hidden="true" className={styles.buttonIcon} />
                Back
              </button>
            ) : (
              <span />
            )}
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={submitting}
              aria-busy={submitting || undefined}
            >
              {step < STEPS.length - 1 ? (
                <>
                  Continue
                  <ArrowRight aria-hidden="true" className={styles.buttonIcon} />
                </>
              ) : submitting ? (
                <>
                  <span className={styles.spinner} aria-hidden="true" />
                  Sending…
                </>
              ) : (
                <>
                  Send booking request
                  <ArrowRight aria-hidden="true" className={styles.buttonIcon} />
                </>
              )}
            </button>
          </div>
        </form>

        <aside className={styles.summary} aria-labelledby="booking-summary-title">
          <h2 id="booking-summary-title" className={styles.summaryTitle}>
            Your booking
          </h2>
          <dl className={styles.summaryList}>
            <SummaryRow label="Event" value={category?.name} />
            <SummaryRow label="Date" value={form.date ? dateLabel(form.date) : undefined} />
            <SummaryRow
              label="Time"
              value={
                form.startTime && form.endTime
                  ? `${timeLabel(form.startTime)} to ${timeLabel(form.endTime)}`
                  : undefined
              }
            />
            <SummaryRow label="Guests" value={form.guests || undefined} />
            <SummaryRow
              label="Package"
              value={form.packageId === 'custom' ? 'Custom proposal' : pkg?.name}
            />
          </dl>
          {estimate ? (
            <div className={styles.estimate}>
              <div className={styles.estimateRow}>
                <span>Package</span>
                <span>{peso.format(pkg?.price ?? 0)}</span>
              </div>
              {estimate.extraGuests > 0 ? (
                <div className={styles.estimateRow}>
                  <span>{estimate.extraGuests} extra guests</span>
                  <span>{peso.format(estimate.extraCost)}</span>
                </div>
              ) : null}
              <div className={`${styles.estimateRow} ${styles.estimateTotal}`}>
                <span>Estimated total</span>
                <span>{peso.format(estimate.total)}</span>
              </div>
              {estimate.reservationFee > 0 ? (
                <div className={styles.estimateRow}>
                  <span>Reservation fee (after approval)</span>
                  <span>{peso.format(estimate.reservationFee)}</span>
                </div>
              ) : null}
              <p className={styles.muted}>
                An estimate only. Zion confirms the final price with you.
              </p>
            </div>
          ) : form.packageId === 'custom' ? (
            <p className={styles.muted}>Our team will prepare a quote for your event.</p>
          ) : null}
          <div className={styles.summaryHelp}>
            <p className={styles.summaryHelpTitle}>Questions?</p>
            <ContactLinks />
          </div>
        </aside>
      </div>
    </div>
  );
}

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className={styles.reviewRow}>
      <dt>{label}</dt>
      <dd>{value}</dd>
      <dd className={styles.reviewEdit}>
        <button type="button" className={styles.linkButton} onClick={onEdit}>
          Edit <span className={styles.visuallyHidden}>{label.toLowerCase()}</span>
        </button>
      </dd>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className={styles.summaryRow} data-filled={value ? 'true' : 'false'}>
      <dt>{label}</dt>
      {/* The key re-mounts the value when it changes, replaying its short highlight. */}
      <dd key={value ?? 'empty'} className={value ? styles.summaryValue : undefined}>
        {value ?? <span className={styles.muted}>Not chosen yet</span>}
      </dd>
    </div>
  );
}

function ContactLinks() {
  return (
    <p className={styles.contactLinks}>
      <a href={BRAND.contact.phoneHref}>
        <Phone aria-hidden="true" className={styles.inlineIcon} />
        {BRAND.contact.phone}
      </a>
      <a href={BRAND.contact.emailHref}>
        <Mail aria-hidden="true" className={styles.inlineIcon} />
        {BRAND.contact.email}
      </a>
    </p>
  );
}
