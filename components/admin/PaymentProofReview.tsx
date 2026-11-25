'use client';
import { useId, useState } from 'react';
import Link from 'next/link';
import { Download, ImageIcon, TriangleAlert } from 'lucide-react';
import { money, paidTotal } from '@/lib/admin/domain';
import { onlinePaymentMethods, PAYMENT_METHOD_LABELS } from '@/lib/admin/payment-accounts';
import type { PaymentRejectionReason } from '@/lib/payment-page-types';
import { Badge } from './AdminBadge';
import { manilaInput } from './datetime';
import { useAdminDate, useAdminPreferences } from './AdminPreferencesProvider';
import type { Booking, Mutate, PaymentProof } from './types';
import styles from './admin.module.css';
import review from './PaymentProofReview.module.css';

/** Staff wording for each reason; the client reads the matching sentence in PAYMENT_REJECTION_REASONS. */
const REJECTION_LABELS: Record<PaymentRejectionReason, string> = {
  AMOUNT_MISMATCH: 'The amount does not match our records',
  UNREADABLE: 'The screenshot is unclear or cut off',
  WRONG_ACCOUNT: 'The payment went to another account',
  NOT_RECEIVED: 'We cannot find the payment in our records',
  DUPLICATE: 'The screenshot or reference was already used',
  OTHER: 'Another reason (explain in the note)',
};

function fileSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function paidOnLabel(isoDate: string) {
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', dateStyle: 'medium' }).format(
    new Date(`${isoDate}T00:00:00Z`),
  );
}

/**
 * Whether the client can send a screenshot now: for the reservation fee of a held date, or for
 * the balance of a confirmed booking (phase 3). Mirrors services/payment-proofs.ts.
 */
function acceptsScreenshots(b: Booking) {
  return (
    (b.reservation === 'REQUESTED' && b.approval === 'APPROVED') ||
    (b.reservation === 'CONFIRMED' && paidTotal(b.payments) < b.totalCents)
  );
}

/** What the client still owes to confirm the booking under its payment rule. */
function amountDue(b: Booking) {
  const required = b.paymentRule === 'FULL_PAYMENT_REQUIRED' ? b.totalCents : b.depositCents;
  return Math.max(0, required - paidTotal(b.payments));
}

function WaitingProof({
  booking: b,
  proof,
  busy,
  mutate,
}: {
  booking: Booking;
  proof: PaymentProof;
  busy: boolean;
  mutate: Mutate;
}) {
  const eventDate = useAdminDate();
  const id = useId();
  const [reason, setReason] = useState<PaymentRejectionReason>('NOT_RECEIVED');
  const url = `/api/admin/payment-proofs/${encodeURIComponent(proof.id)}`;
  const pdf = proof.contentType === 'application/pdf';
  const closed = ['CANCELLED', 'COMPLETED'].includes(b.reservation);
  const canVerify = b.approval === 'APPROVED' && !closed;
  const balance = b.totalCents - paidTotal(b.payments);
  const due = amountDue(b);
  const notes = [
    ...proof.warnings,
    ...(b.reservation === 'REQUESTED' && due > 0 && proof.amountCents < due
      ? [`The amount is less than the ${money(due)} still due to confirm the booking.`]
      : []),
    ...(proof.amountCents > balance
      ? [`The amount is more than the balance of ${money(balance)}.`]
      : []),
  ];

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    try {
      await mutate('payments', {
        op: 'verify-proof',
        id: b.id,
        revision: b.revision,
        proofId: proof.id,
        amountCents: Math.round(Number(f.get('amount')) * 100),
        referenceNumber: f.get('reference'),
        receivedAt: new Date(`${f.get('receivedAt')}:00+08:00`).toISOString(),
        note: f.get('note'),
        checkedRecords: f.get('checked') === 'yes',
      });
    } catch {}
  }

  async function reject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    try {
      await mutate('payments', {
        op: 'reject-proof',
        id: b.id,
        revision: b.revision,
        proofId: proof.id,
        reason,
        note: f.get('note'),
      });
    } catch {}
  }

  return (
    <div className={review.waiting}>
      <div className={review.layout}>
        <figure className={review.figure}>
          {pdf ? (
            <a className={styles.secondary} href={url} download>
              <Download size={16} aria-hidden="true" />
              Download the PDF receipt
            </a>
          ) : (
            <a href={url} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element -- A private file for signed-in staff: the image optimizer must not fetch or cache it. */}
              <img
                src={url}
                alt={`Payment screenshot sent by ${b.clientName}`}
                className={review.image}
              />
            </a>
          )}
          <figcaption className={styles.help}>
            {pdf ? 'PDF' : 'Image'} · {fileSize(proof.sizeBytes)}
            {!pdf && ' · Select the image to open it full size in a new tab.'}
          </figcaption>
        </figure>
        <div className={review.facts}>
          <p className={review.lead}>
            Check this against your own {PAYMENT_METHOD_LABELS[proof.method]} records before you
            verify it. A screenshot alone is not proof that the money arrived.
          </p>
          <dl>
            <dt>Method</dt>
            <dd>{PAYMENT_METHOD_LABELS[proof.method]}</dd>
            <dt>Reference number</dt>
            <dd>{proof.referenceNumber}</dd>
            <dt>Amount the client entered</dt>
            <dd>{money(proof.amountCents)}</dd>
            <dt>Date paid (client)</dt>
            <dd>{paidOnLabel(proof.paidOn)}</dd>
            <dt>Sent</dt>
            <dd>{eventDate(proof.createdAt)}</dd>
          </dl>
          {notes.length > 0 && (
            <ul className={review.warnings} aria-label="Check before verifying">
              {notes.map((note) => (
                <li key={note}>
                  <TriangleAlert size={16} aria-hidden="true" />
                  {note}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {canVerify ? (
        <form className={review.form} onSubmit={verify} aria-labelledby={`${id}-verify`}>
          <h4 id={`${id}-verify`}>Verify payment</h4>
          <div className={styles.inlineForm}>
            <label>
              Amount received · PHP
              <input
                name="amount"
                type="number"
                required
                min="0.01"
                max={balance / 100}
                step="0.01"
                defaultValue={(Math.min(proof.amountCents, balance) / 100).toFixed(2)}
              />
            </label>
            <label>
              Reference number
              <input
                name="reference"
                required
                minLength={4}
                maxLength={40}
                defaultValue={proof.referenceNumber}
                autoComplete="off"
              />
            </label>
            <label className={review.wideField}>
              Received at · Manila
              <input
                name="receivedAt"
                type="datetime-local"
                required
                max={manilaInput()}
                defaultValue={manilaInput(new Date(proof.createdAt))}
              />
            </label>
            <label>
              Note
              <input name="note" maxLength={1000} />
            </label>
          </div>
          <label className={styles.checkbox}>
            <input type="checkbox" name="checked" value="yes" required />I found this payment in our{' '}
            {PAYMENT_METHOD_LABELS[proof.method]} records, with this amount and reference.
          </label>
          <p className={styles.help}>
            {b.reservation === 'CONFIRMED'
              ? 'The payment is recorded toward the balance, and the client gets an acknowledgment receipt by email.'
              : `The payment is recorded with the booking, and the client gets an acknowledgment receipt by email. When it covers the ${b.paymentRule === 'FULL_PAYMENT_REQUIRED' ? 'full amount' : 'reservation fee'}, the booking is confirmed and the client gets the confirmation and calendar invitation.`}
          </p>
          <div className={styles.detailActions}>
            <button className={styles.primary} disabled={busy}>
              Verify payment
            </button>
          </div>
        </form>
      ) : (
        <p className={styles.help}>
          {closed
            ? 'This booking is closed, so the payment cannot be recorded here. Reject the screenshot and settle any refund with the client directly.'
            : 'Approve the request before recording a payment for it.'}
        </p>
      )}
      <form className={review.form} onSubmit={reject} aria-labelledby={`${id}-reject`}>
        <h4 id={`${id}-reject`}>Reject screenshot</h4>
        <div className={styles.inlineForm}>
          <label>
            Reason
            <select
              name="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value as PaymentRejectionReason)}
            >
              {(Object.keys(REJECTION_LABELS) as PaymentRejectionReason[]).map((key) => (
                <option key={key} value={key}>
                  {REJECTION_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Note to the client{reason === 'OTHER' ? ' (required)' : ' (optional)'}
            <input
              name="note"
              maxLength={500}
              required={reason === 'OTHER'}
              minLength={reason === 'OTHER' ? 5 : undefined}
              aria-describedby={`${id}-reject-help`}
            />
          </label>
        </div>
        <p id={`${id}-reject-help`} className={styles.help}>
          {!acceptsScreenshots(b)
            ? 'The screenshot is closed without emailing the client.'
            : b.reservation === 'REQUESTED'
              ? 'The client is emailed the reason and asked for a clearer or the correct screenshot. The date stays held for at least another day.'
              : 'The client is emailed the reason and asked for a clearer or the correct screenshot.'}
        </p>
        <div className={styles.detailActions}>
          <button className={`${styles.secondary} ${styles.dangerAction}`} disabled={busy}>
            Reject screenshot
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Payment screenshots in the booking detail (booking automation phase 2): the one waiting for
 * review with Verify and Reject, then earlier decisions. Staff decide every screenshot; nothing
 * here is automatic.
 */
export default function PaymentProofReview({
  booking: b,
  busy,
  mutate,
}: {
  booking: Booking;
  busy: boolean;
  mutate: Mutate;
}) {
  const eventDate = useAdminDate();
  const { settings } = useAdminPreferences();
  const id = useId();
  const proofs = b.paymentProofs ?? [];
  const waitingForPayment = acceptsScreenshots(b);
  // Shown on every booking waiting for payment, so staff always know where a screenshot arrives.
  if (!proofs.length && !waitingForPayment) return null;
  const online = onlinePaymentMethods(settings.admin.paymentAccounts).length > 0;
  const waiting = proofs.find((proof) => proof.status === 'SUBMITTED');
  const reviewed = proofs.filter((proof) => proof.status !== 'SUBMITTED');
  return (
    <section className={styles.subsection} aria-labelledby={`${id}-heading`}>
      <h3 id={`${id}-heading`}>
        <ImageIcon size={17} strokeWidth={1.5} aria-hidden="true" />
        Payment screenshots
      </h3>
      {waiting ? (
        <WaitingProof booking={b} proof={waiting} busy={busy} mutate={mutate} />
      ) : !waitingForPayment ? (
        <p>No screenshot is waiting for review.</p>
      ) : online ? (
        <p>
          No screenshot yet. When the client sends a GCash or bank transfer screenshot from their
          payment page, it appears here with Verify payment.
        </p>
      ) : (
        <p className={review.note}>
          No screenshot yet. Clients can send a GCash or bank transfer screenshot only after an
          account is set up in{' '}
          <Link href="/admin/settings" className={review.textLink}>
            Settings → Online payments
          </Link>
          ; until then their payment page shows how to pay in cash.
        </p>
      )}
      {reviewed.length > 0 && (
        <ul className={styles.receiptList} aria-label="Reviewed screenshots">
          {reviewed.map((proof) => (
            <li key={proof.id}>
              <div className={styles.receiptHeading}>
                <div>
                  <strong>
                    {PAYMENT_METHOD_LABELS[proof.method]} · {proof.referenceNumber}
                  </strong>
                  <small>
                    Sent {eventDate(proof.createdAt)}
                    {proof.reviewedAt && ` · reviewed ${eventDate(proof.reviewedAt)}`}
                  </small>
                </div>
                <div>
                  <strong>{money(proof.amountCents)}</strong>
                  <Badge value={proof.status} />
                </div>
              </div>
              {proof.status === 'REJECTED' && proof.reviewReason && (
                <p className={styles.help}>Reason given to the client: {proof.reviewReason}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
