'use client';
import { useEffect, useRef, useState } from 'react';
import { X, Download, ShieldCheck, ChevronDown } from 'lucide-react';
import { money, paidTotal, paymentStatus, confirmationError } from '@/lib/admin/domain';
import { Badge } from './AdminBadge';
import type { Booking, Mutate, Policy } from './types';
import styles from './admin.module.css';
import { useAdminDate } from './AdminPreferencesProvider';
export function manilaInput(date: Date = new Date()) {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 16);
}
export default function BookingDetail({
  booking: b,
  owner,
  busy,
  focus,
  policy,
  mutate,
  onClose,
}: {
  booking: Booking;
  owner: boolean;
  busy: boolean;
  focus: string;
  policy?: Policy;
  mutate: Mutate;
  onClose: () => void;
}) {
  const eventDate = useAdminDate();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  useEffect(() => {
    detailRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    headingRef.current?.focus({ preventScroll: true });
  }, [b.id]);
  const [action, setAction] = useState('VERIFY');
  const paid = paidTotal(b.payments),
    closed = ['CANCELLED', 'COMPLETED'].includes(b.reservation);
  const confirmHint =
    b.reservation !== 'REQUESTED'
      ? null
      : policy && b.policyVersion !== policy.version
        ? 'Re-review this request under the current venue policy, then approve it again.'
        : confirmationError(b, paid, policy?.reviewed ?? false);
  async function submitReceipt(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form);
    try {
      await mutate('payments', {
        op: 'cash-receipt',
        id: b.id,
        revision: b.revision,
        amountCents: Math.round(Number(f.get('amount')) * 100),
        receiptNumber: f.get('receipt'),
        receivedAt: new Date(`${f.get('receivedAt')}:00+08:00`).toISOString(),
        note: f.get('note'),
      });
      form.reset();
    } catch {}
  }
  return (
    <section
      ref={detailRef}
      className={`${styles.card} ${styles.detail}`}
      aria-label={`Booking ${b.reference}`}
    >
      <div className={styles.cardHeading}>
        <div>
          <p className={styles.eyebrow}>{b.reference}</p>
          <h2 ref={headingRef} tabIndex={-1} aria-label={`Booking ${b.reference}: ${b.clientName}`}>
            {b.clientName}
          </h2>
          <p>
            {b.eventType} · {b.packageName}
          </p>
        </div>
        <button className={styles.secondary} onClick={onClose} aria-label="Close booking detail">
          <X size={18} />
          Close
        </button>
      </div>
      <div className={styles.statusGrid}>
        <div>
          <small>APPROVAL</small>
          <Badge value={b.approval} />
        </div>
        <div>
          <small>RESERVATION</small>
          <Badge value={b.reservation} />
        </div>
        <div>
          <small>CASH PAYMENT</small>
          <Badge value={paymentStatus(b.totalCents, paid)} />
        </div>
      </div>
      <div className={styles.detailGrid}>
        <dl>
          <dt>Client contact</dt>
          <dd>
            {b.email}
            <br />
            {b.phone}
          </dd>
          <dt>Schedule · Manila</dt>
          <dd>
            {eventDate(b.startsAt)}
            <br />
            to {eventDate(b.endsAt)}
          </dd>
          <dt>Venue / guests</dt>
          <dd>
            {b.venue} · {b.guests} guests
          </dd>
        </dl>
        <dl>
          <dt>Contract price / received / balance</dt>
          <dd>
            {money(b.totalCents)} / {money(paid)} / {money(b.totalCents - paid)}
          </dd>
          <dt>Confirmation rule</dt>
          <dd>
            {b.paymentRule.replaceAll('_', ' ')}
            {b.paymentRule === 'DEPOSIT_REQUIRED' && ` · ${money(b.depositCents)}`}
          </dd>
          <dt>Contact verification</dt>
          <dd>
            <Badge value={b.verification} />
            <p>
              {b.verificationNote ||
                (b.verification === 'UNREVIEWED'
                  ? 'Contact has not been verified by staff.'
                  : 'No note was recorded for this verification status.')}
            </p>
          </dd>
        </dl>
      </div>
      {b.notes && <div className={styles.notice}>Staff notes: {b.notes}</div>}
      {!closed && focus !== 'contracts' && focus !== 'payments' && (
        <div className={styles.subsection}>
          <h3>
            <ShieldCheck size={17} />
            Review and reservation actions
          </h3>
          <p>
            Record how contact was verified and why the decision was made. Only confirmation secures
            the venue date.
          </p>
          {confirmHint && <p className={styles.help}>Confirmation check: {confirmHint}</p>}
          <form
            className={styles.inlineForm}
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await mutate('bookings', {
                  op: 'booking-action',
                  id: b.id,
                  revision: b.revision,
                  action,
                  reason: f.get('reason'),
                });
              } catch {}
            }}
          >
            <label>
              Action
              <select value={action} onChange={(e) => setAction(e.target.value)}>
                <option value="VERIFY">Verify client contact</option>
                <option value="FLAG">Flag suspicious request</option>
                <option value="APPROVE">Approve request (not confirmation)</option>
                <option value="REJECT">Reject request</option>
                <option value="REVIEW_POLICY">Re-review under current venue policy</option>
                <option value="CONFIRM">Confirm reservation</option>
                <option value="CANCEL">Cancel reservation</option>
                <option value="COMPLETE">Complete past event</option>
              </select>
            </label>
            <label className={styles.grow}>
              Verification or decision note
              <input
                name="reason"
                required
                minLength={5}
                maxLength={2000}
                placeholder="Contact method, result, or reason…"
              />
            </label>
            <button className={styles.primary} disabled={busy}>
              {busy ? 'Saving…' : 'Record action'}
            </button>
          </form>
        </div>
      )}
      {(focus === 'payments' || focus === 'bookings') && (
        <details className={styles.sectionDisclosure} open={focus === 'payments'}>
          <summary>
            <span>
              Cash receipts
              <small>
                {b.payments.length} recorded · {money(paid)} received
              </small>
            </span>
            <ChevronDown size={18} aria-hidden="true" />
          </summary>
          <p>
            Only cash actually received is recorded here. Receipts do not automatically confirm a
            reservation.
          </p>
          <ul className={styles.receiptList}>
            {b.payments.map((p) => (
              <li key={p.id}>
                <div className={styles.receiptHeading}>
                  <div>
                    <strong>{p.receiptNumber}</strong>
                    <small>{eventDate(p.receivedAt)}</small>
                  </div>
                  <div>
                    <strong>{money(p.amountCents)}</strong>
                    <Badge value={p.voidedAt ? 'VOIDED' : 'RECORDED'} />
                  </div>
                </div>
                {p.note && <p>{p.note}</p>}
                {p.voidedAt && <p className={styles.help}>Correction: {p.voidReason}</p>}
                {owner && !p.voidedAt && (
                  <details className={styles.receiptCorrection}>
                    <summary aria-label={`Correct receipt ${p.receiptNumber}`}>
                      Correct this receipt
                    </summary>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        if (
                          !window.confirm(
                            'Void this receipt? The original record will remain in history.',
                          )
                        )
                          return;
                        try {
                          await mutate('payments', {
                            op: 'void-receipt',
                            id: b.id,
                            paymentId: p.id,
                            revision: b.revision,
                            reason: f.get('reason'),
                          });
                        } catch {}
                      }}
                    >
                      <label>
                        Reason for correction
                        <input
                          name="reason"
                          aria-label={`Reason for voiding ${p.receiptNumber}`}
                          placeholder="Correction reason"
                          required
                          minLength={5}
                        />
                      </label>
                      <button
                        className={`${styles.secondary} ${styles.dangerAction}`}
                        disabled={busy}
                      >
                        Void receipt
                      </button>
                    </form>{' '}
                  </details>
                )}
              </li>
            ))}
          </ul>
          {!b.payments.length && <p>No cash received.</p>}
          {b.approval === 'APPROVED' && !closed && paid < b.totalCents && (
            <form className={styles.inlineForm} onSubmit={submitReceipt}>
              <label>
                Receipt number
                <input name="receipt" required minLength={3} maxLength={80} />
              </label>
              <label>
                Cash amount · PHP
                <input
                  name="amount"
                  type="number"
                  required
                  min="0.01"
                  max={(b.totalCents - paid) / 100}
                  step="0.01"
                />
              </label>
              <label>
                Received at · Manila
                <input
                  name="receivedAt"
                  type="datetime-local"
                  defaultValue={manilaInput()}
                  required
                />
              </label>
              <label>
                Note
                <input name="note" maxLength={1000} />
              </label>
              <button className={styles.primary} disabled={busy}>
                Record cash
              </button>
            </form>
          )}
        </details>
      )}
      {(focus === 'contracts' || focus === 'bookings') && (
        <details className={styles.sectionDisclosure} open={focus === 'contracts'}>
          <summary>
            <span>
              Agreements
              <small>
                {b.contracts.length} version{b.contracts.length === 1 ? '' : 's'} · review, issue
                and download
              </small>
            </span>
            <ChevronDown size={18} aria-hidden="true" />
          </summary>
          <div className={styles.cardHeading}>
            <div>
              <p>
                Prepared from a reviewed booking snapshot. No automatic signature or fabricated
                contract details.
              </p>
            </div>
            <button
              className={styles.secondary}
              disabled={busy || closed || b.approval !== 'APPROVED'}
              onClick={() =>
                void mutate('contracts', {
                  op: 'create-contract',
                  id: b.id,
                  revision: b.revision,
                }).catch(() => {})
              }
            >
              Prepare review draft
            </button>
          </div>
          {b.contracts.map((c) => (
            <details className={styles.contract} key={c.id}>
              <summary>
                <strong>Agreement v{c.version}</strong>
                <Badge value={c.status} />
                {c.bookingRevision !== b.revision && (
                  <span className={styles.help}>Historical snapshot</span>
                )}
              </summary>
              <pre className={styles.preview}>{c.body}</pre>
              <div className={styles.actions}>
                <button
                  className={styles.secondary}
                  onClick={() => {
                    const url = URL.createObjectURL(
                      new Blob([c.body], { type: 'text/plain;charset=utf-8' }),
                    );
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `${b.reference}-agreement-v${c.version}.txt`;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  }}
                >
                  <Download size={16} />
                  Download agreement (.txt)
                </button>
                {c.status === 'DRAFT' && (
                  <button
                    className={styles.primary}
                    disabled={busy || closed || c.bookingRevision !== b.revision}
                    onClick={() => {
                      if (
                        window.confirm(
                          'Confirm the agreement details and terms have been reviewed before issuing.',
                        )
                      )
                        void mutate('contracts', {
                          op: 'contract-action',
                          id: b.id,
                          revision: b.revision,
                          contractId: c.id,
                          action: 'ISSUE',
                        }).catch(() => {});
                    }}
                  >
                    Issue reviewed agreement
                  </button>
                )}
              </div>
              {c.status === 'ISSUED' && !closed && (
                <form
                  className={styles.inlineForm}
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    try {
                      await mutate('contracts', {
                        op: 'contract-action',
                        id: b.id,
                        revision: b.revision,
                        contractId: c.id,
                        action: 'SIGN',
                        signer: f.get('signer'),
                        reference: f.get('reference'),
                      });
                    } catch {}
                  }}
                >
                  <label>
                    Physical document signed by
                    <input name="signer" required minLength={2} maxLength={180} />
                  </label>
                  <label>
                    Signed document reference
                    <input
                      name="reference"
                      required
                      minLength={3}
                      maxLength={180}
                      placeholder="Filed document / record reference"
                    />
                  </label>
                  <button
                    className={styles.primary}
                    disabled={busy || c.bookingRevision !== b.revision}
                  >
                    Record physical signature
                  </button>
                </form>
              )}
              {c.signedAt && (
                <p>
                  Signed by {c.signedBy} · {eventDate(c.signedAt)} · {c.signedReference}
                </p>
              )}
            </details>
          ))}
          {!b.contracts.length && <p>No agreement prepared.</p>}
        </details>
      )}
    </section>
  );
}
