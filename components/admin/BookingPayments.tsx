'use client';
import type { FormEvent } from 'react';
import { FileText } from 'lucide-react';
import { money, paidTotal } from '@/lib/admin/domain';
import { onlinePaymentMethods, PAYMENT_METHOD_LABELS } from '@/lib/admin/payment-accounts';
import {
  chosenOnlineMethod,
  onlineMethodName,
  preferredPaymentMethod,
} from '@/lib/booking-payment-choice';
import { Button } from '@/components/shared/Button';
import { Badge } from './AdminBadge';
import PaymentProofReview from './PaymentProofReview';
import { manilaInput } from './datetime';
import { useAdminDate, useAdminPreferences } from './AdminPreferencesProvider';
import type { Booking, Mutate } from './types';
import styles from './admin.module.css';
import page from './BookingDetail.module.css';

/**
 * The booking page's Payments tab: GCash and bank screenshots to verify, the payments received
 * with their acknowledgment receipts, and Record cash. Unchanged rules: only money actually
 * received is recorded, and the payment that meets the confirmation rule confirms the booking.
 */
export default function BookingPayments({
  booking: b,
  owner,
  busy,
  mutate,
  screenshotsId,
}: {
  booking: Booking;
  owner: boolean;
  busy: boolean;
  mutate: Mutate;
  /** The screenshot review's heading ("Verify payment"); `-cash` names the Record cash form. */
  screenshotsId: string;
}) {
  const eventDate = useAdminDate();
  const { settings } = useAdminPreferences();
  const paid = paidTotal(b.payments);
  const closed = ['CANCELLED', 'COMPLETED'].includes(b.reservation);
  const takesCash = b.approval === 'APPROVED' && !closed && paid < b.totalCents;
  // A client who chose GCash or bank transfer pays by attaching the receipt, not in cash.
  const transferChoice = chosenOnlineMethod(
    preferredPaymentMethod(b.notes),
    onlinePaymentMethods(settings.admin.paymentAccounts),
  );

  async function submitReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const f = new FormData(form);
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
    } catch {
      // The page shows the server's message.
    }
  }

  async function voidReceipt(event: FormEvent<HTMLFormElement>, paymentId: string) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    if (!window.confirm('Void this receipt? The original record will remain in history.')) return;
    try {
      await mutate('payments', {
        op: 'void-receipt',
        id: b.id,
        paymentId,
        revision: b.revision,
        reason: f.get('reason'),
      });
    } catch {
      // The page shows the server's message.
    }
  }

  return (
    <div className={page.tabStack}>
      <PaymentProofReview booking={b} busy={busy} mutate={mutate} headingId={screenshotsId} />
      <section className={styles.subsection} aria-labelledby={`${screenshotsId}-received`}>
        <h3 id={`${screenshotsId}-received`}>
          Payments received
          <span className={page.headingMeta}>
            {b.payments.length} recorded · {money(paid)} of {money(b.totalCents)}
          </span>
        </h3>
        {b.payments.length > 0 ? (
          <ul className={styles.receiptList}>
            {b.payments.map((p) => (
              <li key={p.id}>
                <div className={styles.receiptHeading}>
                  <div>
                    <strong>{p.receiptNumber}</strong>
                    <small>
                      {eventDate(p.receivedAt)} ·{' '}
                      {PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS] ??
                        p.method}
                      {p.acknowledgmentNumber && ` · Acknowledgment ${p.acknowledgmentNumber}`}
                    </small>
                  </div>
                  <div>
                    <strong>{money(p.amountCents)}</strong>
                    <Badge value={p.voidedAt ? 'VOIDED' : 'RECORDED'} />
                  </div>
                </div>
                {p.acknowledgmentNumber && (
                  <a
                    className={styles.receiptDownload}
                    href={`/api/admin/receipts/${encodeURIComponent(p.id)}`}
                    download
                  >
                    <FileText size={16} aria-hidden="true" />
                    Download receipt (PDF)
                    <span className={styles.srOnly}> {p.acknowledgmentNumber}</span>
                  </a>
                )}
                {p.note && <p>{p.note}</p>}
                {p.voidedAt && <p className={styles.help}>Correction: {p.voidReason}</p>}
                {owner && !p.voidedAt && (
                  <details className={styles.receiptCorrection}>
                    <summary aria-label={`Correct receipt ${p.receiptNumber}`}>
                      Correct this receipt
                    </summary>
                    <form onSubmit={(event) => void voidReceipt(event, p.id)}>
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
                      <Button variant="destructive" size="sm" disabled={busy}>
                        Void receipt
                      </Button>
                    </form>
                  </details>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className={page.quiet}>No payment received yet.</p>
        )}
        {takesCash && (
          <>
            {transferChoice && (
              <p className={styles.help}>
                {b.clientName} chose to pay by {onlineMethodName(transferChoice)}. Record cash only
                for cash received at the venue; a {onlineMethodName(transferChoice)} payment is
                recorded when you verify the client&apos;s receipt under{' '}
                <a href={`#${screenshotsId}`} className={styles.panelLink}>
                  Payment screenshots
                </a>
                .
              </p>
            )}
            <form
              id={`${screenshotsId}-cash`}
              tabIndex={-1}
              className={`${styles.inlineForm} ${page.cashForm}`}
              onSubmit={submitReceipt}
              aria-label="Record cash"
            >
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
              <Button variant="primary" disabled={busy}>
                Record cash
              </Button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
