'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { CircleAlert, MailCheck } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import { BRAND } from '@/config/brand';
import shared from '../../_components/BookingRequest.module.css';
import styles from './FindPaymentPage.module.css';

type Field = 'reference' | 'email';
type Problems = Partial<Record<Field, string>>;

const REFERENCE_PROBLEM = 'Enter your booking reference, for example ZION-2026-AB12CD34.';

/** The same checks the server makes, so most mistakes show next to the field at once. */
function problemsOf(reference: string, email: string): Problems {
  const problems: Problems = {};
  const compact = reference.replace(/\s+/g, '');
  if (compact.length < 6 || compact.length > 40 || !/^[a-z0-9-]+$/i.test(compact))
    problems.reference = REFERENCE_PROBLEM;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    problems.email = 'Enter the email you used for the booking.';
  return problems;
}

/**
 * The "Find my payment page" form (/booking/pay): the booking reference and email; the link is
 * emailed to the address on the booking. The confirmation reads the same whether or not the
 * details matched (services/payment-link-requests.ts).
 */
export default function FindPaymentPage() {
  const id = useId();
  const ids = { reference: `${id}-reference`, email: `${id}-email` };
  const [reference, setReference] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [problems, setProblems] = useState<Problems>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const sentRef = useRef<HTMLHeadingElement>(null);
  const referenceRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  /** Set when the confirmation replaces the form or the form comes back, to move focus there. */
  const switched = useRef(false);

  // After the switch has rendered: the confirmation's heading, or the first field again.
  useEffect(() => {
    if (!switched.current) return;
    switched.current = false;
    (sentTo ? sentRef : referenceRef).current?.focus();
  }, [sentTo]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = problemsOf(reference, email);
    setProblems(found);
    setSubmitError(null);
    // The first field with a problem takes focus, so its message is read out with it.
    if (found.reference || found.email) {
      (found.reference ? referenceRef : emailRef).current?.focus();
      return;
    }
    setSending(true);
    try {
      const response = await fetch('/api/client/payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference, email, website }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setSubmitError(body?.error ?? 'We could not send the link right now. Please try again.');
        return;
      }
      // The confirmation replaces the form; its heading takes focus so it is read out.
      switched.current = true;
      setSentTo(email.trim());
    } catch {
      setSubmitError(
        'We could not reach Zion Events Place. Check your connection, then try again.',
      );
    } finally {
      setSending(false);
    }
  }

  const describedBy = (field: Field, hint?: string) =>
    [hint, problems[field] ? `${ids[field]}-error` : null].filter(Boolean).join(' ') || undefined;
  const fieldError = (field: Field) =>
    problems[field] ? (
      <p id={`${ids[field]}-error`} className={shared.fieldError}>
        <CircleAlert aria-hidden="true" className={shared.inlineIcon} />
        {problems[field]}
      </p>
    ) : null;

  return (
    <div className={shared.page}>
      <section className={`${shared.done} ${styles.card}`} aria-labelledby={`${id}-title`}>
        {sentTo ? (
          <>
            <MailCheck aria-hidden="true" className={styles.sentIcon} />
            <h1 id={`${id}-title`} ref={sentRef} tabIndex={-1} className={shared.doneTitle}>
              Check your email
            </h1>
            <p className={styles.status} role="status">
              If that booking reference and <strong>{sentTo}</strong> match a booking, the link to
              its payment page is on its way. It can take a few minutes; check your spam folder too.
            </p>
            <p className={shared.muted}>
              Still nothing? Call {BRAND.contact.phone} or email {BRAND.contact.email} and mention
              your booking reference.
            </p>
            <div className={styles.actions}>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={() => {
                  switched.current = true;
                  setSentTo(null);
                }}
              >
                Use different details
              </Button>
            </div>
          </>
        ) : (
          <>
            <h1 id={`${id}-title`} className={shared.doneTitle}>
              Find my payment page
            </h1>
            <p className={styles.lead}>
              Enter your booking reference and the email you used. We email you the link to your
              private payment page, where you see what to pay and by when, how to pay, and where to
              upload your receipt.
            </p>
            <form className={styles.form} onSubmit={submit} noValidate aria-busy={sending}>
              <div className={shared.field}>
                <label className={shared.label} htmlFor={ids.reference}>
                  Booking reference
                </label>
                <input
                  ref={referenceRef}
                  id={ids.reference}
                  className={shared.input}
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  aria-invalid={problems.reference ? true : undefined}
                  aria-describedby={describedBy('reference', `${ids.reference}-hint`)}
                />
                <p id={`${ids.reference}-hint`} className={shared.hint}>
                  It starts with ZION-, for example ZION-2026-AB12CD34. It is in your booking emails
                  and on the screen after your request.
                </p>
                {fieldError('reference')}
              </div>
              <div className={shared.field}>
                <label className={shared.label} htmlFor={ids.email}>
                  Email
                </label>
                <input
                  ref={emailRef}
                  id={ids.email}
                  className={shared.input}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={problems.email ? true : undefined}
                  aria-describedby={describedBy('email', `${ids.email}-hint`)}
                />
                <p id={`${ids.email}-hint`} className={shared.hint}>
                  The email on your booking. The link is sent only there.
                </p>
                {fieldError('email')}
              </div>
              <div className={shared.honeypot} aria-hidden="true">
                <label htmlFor={`${id}-website`}>Website</label>
                <input
                  id={`${id}-website`}
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                />
              </div>
              {submitError && (
                <p className={shared.submitError} role="alert">
                  <CircleAlert aria-hidden="true" className={shared.inlineIcon} />
                  {submitError}
                </p>
              )}
              <div className={styles.actions}>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={sending}
                  loadingLabel="Sending…"
                >
                  Email me the link
                </Button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
