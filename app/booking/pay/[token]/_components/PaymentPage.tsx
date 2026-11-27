'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { CircleAlert, FileText } from 'lucide-react';
import ClientPhotoCapture from '@/components/client-photo/ClientPhotoCapture';
import { Button, ButtonLink } from '@/components/shared/Button';
import { BRAND } from '@/config/brand';
import { PAYMENT_METHOD_LABELS, type OnlinePaymentMethod } from '@/lib/admin/payment-accounts';
import type { PaymentPageView } from '@/lib/payment-page-types';
import shared from '../../../_components/BookingRequest.module.css';
import styles from './PaymentPage.module.css';

type View = Exclude<PaymentPageView, { state: 'invalid' }>;
type Field = 'method' | 'referenceNumber' | 'amount' | 'paidOn' | 'file';

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2,
});
const moment = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  dateStyle: 'medium',
  timeStyle: 'short',
});
const fullDate = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'full' });
const clock = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', timeStyle: 'short' });

const UPLOAD_LIMIT_BYTES = 4 * 1024 * 1024;
/** Phone photos above this size are scaled down in the browser to fit the upload limit. */
const SHRINK_ABOVE_BYTES = 3.5 * 1024 * 1024;
const LONGEST_SIDE = 2400;

async function shrinkPhoto(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= SHRINK_ABOVE_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, LONGEST_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85),
    );
    return blob ? new File([blob], 'payment-proof.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

/** Whether a moment is already past; kept outside render so the components stay pure. */
function hasPassed(iso: string) {
  return new Date(iso).getTime() <= Date.now();
}

/** Today's date in Manila, the latest date a payment can have been made. */
function manilaToday() {
  return new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10);
}

function ProofStatus({ view }: { view: View }) {
  const proof = view.proof;
  if (!view.paying || !proof) return null;
  const method = PAYMENT_METHOD_LABELS[proof.method];
  // The amount, method, reference and time are listed above as "Waiting to verify".
  if (proof.status === 'SUBMITTED')
    return (
      <p className={styles.status} role="status">
        We are checking this {method} payment against our records and will email you. It counts as
        paid once we verify it.
        {view.paying === 'fee' && ' Your date stays on hold until we decide.'} If you sent the wrong
        file, you can send another one below.
      </p>
    );
  if (proof.status === 'REJECTED')
    return (
      <p className={`${styles.status} ${styles.statusProblem}`} role="status">
        We could not verify your last screenshot. {proof.reviewReason} Please send a clearer or the
        correct one below, or contact us.
      </p>
    );
  return (
    <p className={`${styles.status} ${styles.statusSuccess}`} role="status">
      We verified your payment of {peso.format(proof.amountCents / 100)}. Thank you!
    </p>
  );
}

/** Each payment Zion recorded, with its acknowledgment receipt to download (phase 3). */
function PaymentsReceived({ view, token }: { view: View; token: string }) {
  if (!view.payments.length) return null;
  return (
    <section aria-labelledby="payment-received">
      <h2 id="payment-received" className={shared.subheading}>
        Payments received
      </h2>
      <ul className={styles.payments}>
        {view.payments.map((payment) => (
          <li key={payment.id}>
            <p>
              <strong>{peso.format(payment.amountCents / 100)}</strong>{' '}
              {PAYMENT_METHOD_LABELS[payment.method]} ·{' '}
              {moment.format(new Date(payment.receivedAt))}
            </p>
            {payment.acknowledgmentNumber && (
              <a
                className={styles.receiptLink}
                href={`/booking/pay/${encodeURIComponent(token)}/receipts/${encodeURIComponent(payment.id)}`}
                download
              >
                <FileText aria-hidden="true" className={shared.inlineIcon} />
                Download receipt (PDF)
                <span className={shared.visuallyHidden}> {payment.acknowledgmentNumber}</span>
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function HowToPay({ view }: { view: View }) {
  const { accounts, methods } = view;
  return (
    <section aria-labelledby="payment-how">
      <h2 id="payment-how" className={shared.subheading}>
        How to pay
      </h2>
      <div className={styles.accounts}>
        {/* In the order of `methods`: the way the client chose when booking comes first. */}
        {methods.map((method) =>
          method === 'GCASH' ? (
            <div key={method} className={styles.account}>
              <h3>GCash</h3>
              <p>
                Account name: <strong>{accounts.gcash.accountName}</strong>
              </p>
              <p>
                Number: <strong>{accounts.gcash.number}</strong>
              </p>
            </div>
          ) : (
            <div key={method} className={styles.account}>
              <h3>Bank transfer</h3>
              <p>
                Bank: <strong>{accounts.bank.bankName}</strong>
              </p>
              <p>
                Account name: <strong>{accounts.bank.accountName}</strong>
              </p>
              <p>
                Account number: <strong>{accounts.bank.accountNumber}</strong>
              </p>
            </div>
          ),
        )}
        <div className={styles.account}>
          <h3>Cash at the venue</h3>
          <p>
            {view.cashInstructions || 'Pay in cash at Zion Events Place; staff give you a receipt.'}
          </p>
        </div>
      </div>
      {methods.length > 0 && (
        <p className={shared.hint}>
          Write your booking reference <strong>{view.reference}</strong> in the transfer note, then
          send us the screenshot below.
        </p>
      )}
    </section>
  );
}

function UploadForm({ view, token }: { view: View; token: string }) {
  const router = useRouter();
  const id = useId();
  const [method, setMethod] = useState<OnlinePaymentMethod | ''>(
    view.chosenMethod ?? (view.methods.length === 1 ? view.methods[0] : ''),
  );
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<{ field: Field | null; message: string } | null>(null);
  const [sent, setSent] = useState(false);
  const sentRef = useRef<HTMLParagraphElement>(null);
  const fields: Record<Field, string> = {
    method: `${id}-method`,
    referenceNumber: `${id}-reference`,
    amount: `${id}-amount`,
    paidOn: `${id}-paid-on`,
    file: `${id}-file`,
  };
  const invalid = (field: Field) => (problem?.field === field ? true : undefined);
  const describedBy = (field: Field, hint?: string) =>
    [hint, problem?.field === field ? `${id}-problem` : null].filter(Boolean).join(' ') ||
    undefined;

  function fail(field: Field | null, message: string) {
    setProblem({ field, message });
    if (field) document.getElementById(fields[field])?.focus();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get('file');
    if (!method) return fail('method', 'Choose how you paid.');
    if (!String(form.get('referenceNumber') ?? '').trim())
      return fail('referenceNumber', 'Enter the reference number from your receipt.');
    if (!(Number(form.get('amount')) > 0)) return fail('amount', 'Enter the amount you paid.');
    if (!form.get('paidOn')) return fail('paidOn', 'Enter the date you paid.');
    if (!(file instanceof File) || !file.size)
      return fail('file', 'Choose the screenshot of your payment.');
    const upload = await shrinkPhoto(file);
    if (upload.size > UPLOAD_LIMIT_BYTES)
      return fail('file', 'The file is too large. Upload a screenshot under 4 MB.');
    form.set('file', upload);
    form.set('method', method);
    form.set('token', token);
    setProblem(null);
    setSending(true);
    try {
      const response = await fetch('/api/client/payment-proofs', { method: 'POST', body: form });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok)
        return fail(null, payload?.error ?? 'We could not send your screenshot. Please try again.');
      setSent(true);
      requestAnimationFrame(() => sentRef.current?.focus());
      router.refresh();
    } catch {
      fail(null, 'We could not reach Zion Events Place. Check your connection, then try again.');
    } finally {
      setSending(false);
    }
  }

  if (sent)
    return (
      <div className={styles.form}>
        <p
          ref={sentRef}
          tabIndex={-1}
          className={`${styles.status} ${styles.statusSuccess}`}
          role="status"
        >
          Thank you! We received your screenshot and will verify it with our records. You will get
          an email when we are done.
        </p>
        <div className={shared.actions}>
          {/* A newer screenshot replaces the one waiting for review. */}
          <Button type="button" variant="secondary" size="lg" onClick={() => setSent(false)}>
            Send a different screenshot
          </Button>
        </div>
      </div>
    );

  return (
    <form className={styles.form} onSubmit={submit} noValidate aria-busy={sending}>
      <h2 className={shared.subheading}>Send your payment screenshot</h2>
      <fieldset
        className={shared.fieldset}
        aria-invalid={invalid('method')}
        aria-describedby={describedBy('method')}
      >
        <legend className={shared.label} id={fields.method}>
          How did you pay?
        </legend>
        <div className={styles.methods}>
          {view.methods.map((value) => (
            <label key={value} className={styles.method}>
              <input
                type="radio"
                name="method"
                value={value}
                checked={method === value}
                onChange={() => setMethod(value)}
              />
              {PAYMENT_METHOD_LABELS[value]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className={styles.formRow}>
        <div className={shared.field}>
          <label className={shared.label} htmlFor={fields.referenceNumber}>
            Reference number
          </label>
          <input
            id={fields.referenceNumber}
            name="referenceNumber"
            className={shared.input}
            autoComplete="off"
            maxLength={40}
            required
            aria-invalid={invalid('referenceNumber')}
            aria-describedby={describedBy('referenceNumber', `${id}-reference-hint`)}
          />
          <p id={`${id}-reference-hint`} className={shared.hint}>
            The reference or transaction number on your GCash or bank receipt.
          </p>
        </div>
        <div className={shared.field}>
          <label className={shared.label} htmlFor={fields.amount}>
            Amount paid (PHP)
          </label>
          <input
            id={fields.amount}
            name="amount"
            className={shared.input}
            type="number"
            inputMode="decimal"
            min={1}
            step="0.01"
            defaultValue={view.amountDueCents ? (view.amountDueCents / 100).toFixed(2) : ''}
            required
            aria-invalid={invalid('amount')}
            aria-describedby={describedBy('amount')}
          />
        </div>
      </div>
      <div className={styles.formRow}>
        <div className={shared.field}>
          <label className={shared.label} htmlFor={fields.paidOn}>
            Date paid
          </label>
          <input
            id={fields.paidOn}
            name="paidOn"
            className={shared.input}
            type="date"
            max={manilaToday()}
            defaultValue={manilaToday()}
            required
            aria-invalid={invalid('paidOn')}
            aria-describedby={describedBy('paidOn')}
          />
        </div>
        <div className={shared.field}>
          <label className={shared.label} htmlFor={fields.file}>
            Screenshot or receipt
          </label>
          <input
            id={fields.file}
            name="file"
            className={shared.input}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            required
            aria-invalid={invalid('file')}
            aria-describedby={describedBy('file', `${id}-file-hint`)}
          />
          <p id={`${id}-file-hint`} className={shared.hint}>
            JPG, PNG, WebP or PDF, up to 4 MB. Make sure the amount, date and reference are clear.
          </p>
        </div>
      </div>
      <input
        className={shared.honeypot}
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        defaultValue=""
      />
      {problem && (
        <p id={`${id}-problem`} className={shared.submitError} role="alert">
          <CircleAlert aria-hidden="true" className={shared.inlineIcon} />
          {problem.message}
        </p>
      )}
      <div className={shared.actions}>
        <Button type="submit" variant="primary" size="lg" loading={sending} loadingLabel="Sending…">
          Send screenshot
        </Button>
      </div>
    </form>
  );
}

/**
 * A client's private payment page (booking automation phase 2): what to pay and by when, how to
 * pay, and the screenshot upload. Staff verify every screenshot against Zion's own records; the
 * page never confirms a booking by itself.
 */
export default function PaymentPage({ view, token }: { view: View; token: string }) {
  // A screenshot staff have not checked yet: listed on its own, never subtracted from what is due.
  const waitingProof = view.paying && view.proof?.status === 'SUBMITTED' ? view.proof : null;
  const title =
    view.state === 'waiting'
      ? view.proof?.status === 'SUBMITTED'
        ? 'We are checking your payment'
        : 'Pay your reservation fee'
      : {
          review: 'Your request is being reviewed',
          confirmed: 'Your reservation is confirmed',
          closed: 'This booking is no longer on hold',
        }[view.state];
  return (
    <div className={shared.page}>
      <section className={`${shared.done} ${styles.card}`} aria-labelledby="payment-title">
        <h1 id="payment-title" className={shared.doneTitle}>
          {title}
        </h1>
        <p className={shared.reference}>
          Booking reference <strong>{view.reference}</strong>
        </p>
        <dl className={styles.details}>
          <dt>Event</dt>
          <dd>
            {view.eventType} · {view.packageName}
          </dd>
          <dt>Date</dt>
          <dd>{fullDate.format(new Date(view.startsAt))}</dd>
          <dt>Time</dt>
          <dd>
            {clock.format(new Date(view.startsAt))} to {clock.format(new Date(view.endsAt))}
          </dd>
          {view.paying === 'fee' && (
            <>
              <dt>Amount to pay now</dt>
              <dd>{peso.format(view.amountDueCents / 100)}</dd>
              {view.deadline && (
                <>
                  <dt>Pay by</dt>
                  <dd>{moment.format(new Date(view.deadline))} (Manila time)</dd>
                </>
              )}
            </>
          )}
          {view.paying === 'balance' && (
            <>
              <dt>Remaining balance</dt>
              <dd>{peso.format(view.amountDueCents / 100)}</dd>
              {view.balanceDueAt && (
                <>
                  <dt>Full payment due</dt>
                  <dd>
                    {hasPassed(view.balanceDueAt)
                      ? `Now (it was due on ${fullDate.format(new Date(view.balanceDueAt))})`
                      : fullDate.format(new Date(view.balanceDueAt))}
                  </dd>
                </>
              )}
            </>
          )}
          {waitingProof && (
            <>
              <dt>Waiting to verify</dt>
              <dd>
                {peso.format(waitingProof.amountCents / 100)} ·{' '}
                {PAYMENT_METHOD_LABELS[waitingProof.method]} · Ref {waitingProof.referenceNumber} ·
                sent {moment.format(new Date(waitingProof.submittedAt))}
              </dd>
            </>
          )}
        </dl>
        {view.state === 'review' && (
          <p className={styles.status}>
            Our team is reviewing your request. We will email you the payment details once it is
            approved.
          </p>
        )}
        {view.state === 'confirmed' && (
          <p className={`${styles.status} ${styles.statusSuccess}`}>
            Thank you! Your date is secured. We sent the confirmation and a calendar invitation to
            your email.
            {view.paying === 'balance' &&
              ' Please pay the remaining balance by the date above. The ways to pay are below.'}
          </p>
        )}
        {view.state === 'closed' && (
          <p className={styles.status}>
            This booking is no longer on hold, so it cannot be paid here. If you still want a date,
            send a new booking request or contact us.
          </p>
        )}
        <ProofStatus view={view} />
        <PaymentsReceived view={view} token={token} />
        {view.paying && <HowToPay view={view} />}
        {view.paying && view.methods.length > 0 && view.amountDueCents > 0 && (
          <UploadForm view={view} token={token} />
        )}
        {view.photo && (view.photo.canAdd || view.photo.photoUrl) && (
          <ClientPhotoCapture photo={view.photo} />
        )}
        <p className={shared.hint}>
          Questions? Call{' '}
          <a href={`tel:${BRAND.contact.phone.replace(/\s+/g, '')}`}>{BRAND.contact.phone}</a> or
          email <a href={`mailto:${BRAND.contact.email}`}>{BRAND.contact.email}</a> and mention your
          booking reference.
        </p>
        <div className={shared.actions}>
          <ButtonLink href="/" variant="secondary" size="lg">
            Back to home
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
