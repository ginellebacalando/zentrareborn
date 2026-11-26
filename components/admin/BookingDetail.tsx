'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { X, Download, FileText, ShieldCheck, ChevronDown, Package, Pencil } from 'lucide-react';
import { balanceDueDate } from '@/lib/admin/booking-rules';
import { money, paidTotal, paymentStatus, confirmationError } from '@/lib/admin/domain';
import { displayStatus, displayStatusLabels } from '@/lib/admin/dashboard-status';
import { onlinePaymentMethods, PAYMENT_METHOD_LABELS } from '@/lib/admin/payment-accounts';
import {
  chosenOnlineMethod,
  onlineMethodName,
  preferredPaymentMethod,
} from '@/lib/booking-payment-choice';
import { Badge } from './AdminBadge';
import { StatusDot, statusTone } from './BookingStatus';
import { BookingForm } from './Forms';
import PaymentProofReview from './PaymentProofReview';
import { manilaInput } from './datetime';
import type { Booking, Mutate, Policy } from './types';
import styles from './admin.module.css';
import { useAdminDate, useAdminPreferences } from './AdminPreferencesProvider';
import { Button, ButtonLink } from '@/components/shared/Button';

type BookingAction =
  | 'VERIFY'
  | 'FLAG'
  | 'APPROVE'
  | 'REJECT'
  | 'REVIEW_POLICY'
  | 'CONFIRM'
  | 'CANCEL'
  | 'COMPLETE'
  | 'EXTEND_HOLD';
type ActionOption = {
  action: BookingAction;
  label: string;
  tone: 'primary' | 'secondary' | 'danger';
  /** Why the server would refuse the action right now; the button is disabled with this note. */
  blocked?: string | null;
};

/**
 * The booking automation's actions (docs/booking-automation.md) mapped onto the server's state
 * machine (lib/admin/service.ts). Under review: approve (which holds the date until the payment
 * deadline) or reject. Waiting for payment: record the payment below, which confirms the booking by
 * itself, or extend the deadline. Confirm remains for bookings that need no payment. The server
 * re-checks every rule; the client only hides actions the server would always refuse and explains
 * the ones that are temporarily blocked.
 */
function bookingActions(
  b: Booking,
  paid: number,
  policy: Policy | undefined,
  confirmHint: string | null,
): { main: ActionOption[]; more: ActionOption[] } {
  if (['CANCELLED', 'COMPLETED'].includes(b.reservation)) return { main: [], more: [] };
  const requested = b.reservation === 'REQUESTED';
  const approved = b.approval === 'APPROVED';
  const flagged = b.verification === 'FLAGGED';
  const main: ActionOption[] = [];
  const more: ActionOption[] = [];
  if (requested && !approved)
    main.push({
      action: 'APPROVE',
      label: 'Approve request',
      tone: 'primary',
      blocked: flagged
        ? 'This request is flagged as suspicious. Clear the flag first.'
        : b.totalCents < 1
          ? 'Set the price with Edit details first.'
          : null,
    });
  if (requested && b.approval === 'PENDING')
    main.push({ action: 'REJECT', label: 'Reject request', tone: 'danger' });
  if (requested && approved && b.holdExpiresAt)
    main.push({ action: 'EXTEND_HOLD', label: 'Extend payment deadline', tone: 'secondary' });
  if (requested && approved && !confirmHint)
    main.push({ action: 'CONFIRM', label: 'Confirm', tone: 'primary' });
  if (b.reservation === 'CONFIRMED')
    main.push({
      action: 'COMPLETE',
      label: 'Complete event',
      tone: 'primary',
      blocked:
        new Date(b.endsAt) > new Date()
          ? 'Available after the event has ended.'
          : paid < b.totalCents
            ? 'Settle the cash balance before completing the event.'
            : null,
    });
  main.push({ action: 'CANCEL', label: 'Cancel booking', tone: 'danger' });
  if (b.reservation !== 'CONFIRMED' && flagged)
    more.push({ action: 'VERIFY', label: 'Clear flag (contact verified)', tone: 'secondary' });
  if (b.reservation !== 'CONFIRMED' && !flagged)
    more.push({ action: 'FLAG', label: 'Flag as suspicious', tone: 'danger' });
  if (requested && policy && b.policyVersion !== policy.version)
    more.push({
      action: 'REVIEW_POLICY',
      label: 'Re-review under current policy',
      tone: 'secondary',
      blocked: !policy.reviewed ? 'Review the venue policy in Settings first.' : null,
    });
  return { main, more };
}

/** Whether a moment is already in the past; kept outside render so the component stays pure. */
function hasPassed(moment: Date) {
  return moment.getTime() <= Date.now();
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
  const { settings } = useAdminPreferences();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const noteId = useId();
  const id = useId();
  const [editing, setEditing] = useState(false);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const restoreEditFocus = useRef(false);
  useEffect(() => {
    detailRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    headingRef.current?.focus({ preventScroll: true });
  }, [b.id]);
  useEffect(() => {
    if (editing || !restoreEditFocus.current) return;
    restoreEditFocus.current = false;
    editButtonRef.current?.focus();
  }, [editing]);
  const paid = paidTotal(b.payments),
    closed = ['CANCELLED', 'COMPLETED'].includes(b.reservation);
  const status = displayStatus(b);
  const confirmHint =
    b.reservation !== 'REQUESTED'
      ? null
      : policy && b.policyVersion !== policy.version
        ? 'Re-review this request under the current venue policy, then approve it again.'
        : confirmationError(b, paid, policy?.reviewed ?? false);
  const actions = bookingActions(b, paid, policy, confirmHint);
  const blocked = [...actions.main, ...actions.more].filter((option) => option.blocked);
  const paidShare = b.totalCents ? Math.min(100, (paid / b.totalCents) * 100) : 0;
  // Mirrors the server's edit-booking rules: requested bookings without an issued/signed agreement.
  const lockedByAgreement = b.contracts.some(
    (contract) => contract.status === 'ISSUED' || contract.status === 'SIGNED',
  );
  const canEdit = b.reservation === 'REQUESTED' && !lockedByAgreement && !!policy;
  const holding = b.reservation === 'REQUESTED' && b.approval === 'APPROVED';
  const deadline = holding && b.holdExpiresAt ? new Date(b.holdExpiresAt) : null;
  const deadlinePassed = deadline !== null && hasPassed(deadline);
  // A screenshot the client sent that staff have not decided on. It never counts as received or
  // lowers the balance until Verify payment records it; while it waits, the hold is never
  // released automatically.
  const waitingProof = (b.paymentProofs ?? []).find((proof) => proof.status === 'SUBMITTED');
  const screenshotWaiting = waitingProof !== undefined;
  const reviewShown = focus === 'payments' || focus === 'bookings';
  const screenshotsId = `payment-screenshots-${b.id}`;
  // Clients can send screenshots only while a GCash or bank account is set up in Settings.
  const onlineMethods = onlinePaymentMethods(settings.admin.paymentAccounts);
  const onlinePayment = onlineMethods.length > 0;
  // A client who chose GCash or bank transfer pays by attaching the receipt, not in cash.
  const transferChoice = chosenOnlineMethod(preferredPaymentMethod(b.notes), onlineMethods);
  // Zion's terms ask for full payment a set number of days before the event (Settings).
  const balanceDue =
    b.reservation === 'CONFIRMED' && paid < b.totalCents
      ? balanceDueDate(new Date(b.startsAt), settings.admin.bookingRules.balanceDueDays)
      : null;
  const balanceOverdue = balanceDue !== null && hasPassed(balanceDue);
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
  async function submitAction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const action = submitter instanceof HTMLButtonElement ? submitter.value : '';
    if (!action) return;
    if (
      action === 'CANCEL' &&
      !window.confirm(
        'Cancel this booking? The record and its history are kept, and the date is released.',
      )
    )
      return;
    try {
      await mutate('bookings', {
        op: 'booking-action',
        id: b.id,
        revision: b.revision,
        action,
        reason: new FormData(form).get('reason'),
      });
      form.reset();
    } catch {}
  }
  function actionButton(option: ActionOption) {
    return (
      <Button
        key={option.action}
        type="submit"
        name="action"
        value={option.action}
        variant={
          option.tone === 'primary'
            ? 'primary'
            : option.tone === 'danger'
              ? 'destructive'
              : 'secondary'
        }
        disabled={busy || !!option.blocked}
        aria-describedby={option.blocked ? `${id}-${option.action}` : undefined}
      >
        {option.label}
      </Button>
    );
  }
  return (
    <section
      ref={detailRef}
      className={`${styles.card} ${styles.detail} ${statusTone[status]}`}
      aria-label={`Booking ${b.reference}`}
    >
      <div className={styles.detailHeader}>
        <div>
          <p className={styles.detailStatus}>
            <StatusDot status={status} />
            <span>{displayStatusLabels[status]}</span>
            <span aria-hidden="true">·</span>
            <span>{b.reference}</span>
          </p>
          <h2 ref={headingRef} tabIndex={-1} aria-label={`Booking ${b.reference}: ${b.clientName}`}>
            {b.clientName}
          </h2>
          <p>
            {b.eventType} · {b.packageName}
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          icon={<X aria-hidden="true" />}
          onClick={onClose}
          aria-label="Close booking detail"
        >
          Close
        </Button>
      </div>
      <div className={styles.statusGrid}>
        <div>
          <small>Approval</small>
          <Badge value={b.approval} />
        </div>
        <div>
          <small>Reservation</small>
          <Badge value={b.reservation} />
        </div>
        <div>
          <small>Payment</small>
          <Badge value={paymentStatus(b.totalCents, paid)} />
        </div>
        <div>
          <small>Contact</small>
          <Badge value={b.verification} />
        </div>
      </div>
      <div className={styles.detailPanels}>
        <section className={styles.detailPanel} aria-labelledby={`${id}-client`}>
          <h3 id={`${id}-client`}>Client profile</h3>
          <div className={styles.clientIdentity}>
            <span className={styles.profileAvatar} aria-hidden="true">
              {b.clientName.trim().charAt(0).toUpperCase()}
            </span>
            <div>
              <strong>{b.clientName}</strong>
              <small>{b.guests} guests</small>
            </div>
          </div>
          <dl>
            <dt>Email</dt>
            <dd>{b.email}</dd>
            <dt>Phone</dt>
            <dd>{b.phone}</dd>
            <dt>Contact verification</dt>
            <dd>
              <Badge value={b.verification} />
              <span className={styles.detailNote}>
                {b.verificationNote ||
                  (b.verification === 'UNREVIEWED'
                    ? 'Contact has not been verified by staff.'
                    : 'No note was recorded for this verification status.')}
              </span>
            </dd>
          </dl>
        </section>
        <section className={styles.detailPanel} aria-labelledby={`${id}-details`}>
          <h3 id={`${id}-details`}>Booking details</h3>
          <dl>
            <dt>ID</dt>
            <dd>{b.reference}</dd>
            <dt>Event</dt>
            <dd>
              {b.eventType} · {b.packageName}
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
        </section>
        <section className={styles.detailPanel} aria-labelledby={`${id}-payment`}>
          <h3 id={`${id}-payment`}>Payment status</h3>
          <div className={styles.paymentSummary}>
            <Badge value={paymentStatus(b.totalCents, paid)} />
            <strong>{money(paid)}</strong>
            <small>received of {money(b.totalCents)}</small>
          </div>
          <span className={styles.paymentBar} aria-hidden="true">
            <span style={{ inlineSize: `${paidShare}%` }} />
          </span>
          <dl>
            {waitingProof && (
              <>
                <dt>Waiting to verify</dt>
                <dd>
                  {money(waitingProof.amountCents)} · {PAYMENT_METHOD_LABELS[waitingProof.method]} ·
                  Ref {waitingProof.referenceNumber} · sent {eventDate(waitingProof.createdAt)}
                  {reviewShown && (
                    <span className={styles.detailNote}>
                      <a href={`#${screenshotsId}`} className={styles.panelLink}>
                        Review the screenshot below
                      </a>
                    </span>
                  )}
                </dd>
              </>
            )}
            <dt>Balance</dt>
            <dd>{money(b.totalCents - paid)}</dd>
            {deadline && (
              <>
                <dt>Pay by</dt>
                <dd>{eventDate(deadline)}</dd>
              </>
            )}
            {balanceDue && (
              <>
                <dt>Full payment due</dt>
                <dd>
                  {eventDate(balanceDue)}
                  {balanceOverdue && <span className={styles.detailNote}>Overdue</span>}
                </dd>
              </>
            )}
            <dt>Confirmation rule</dt>
            <dd>
              {b.paymentRule.replaceAll('_', ' ').toLowerCase()}
              {b.paymentRule === 'DEPOSIT_REQUIRED' && ` · ${money(b.depositCents)}`}
            </dd>
          </dl>
        </section>
      </div>
      {deadline && (
        <p className={styles.notice} role="status">
          {screenshotWaiting
            ? `The client sent a payment screenshot. Check it against your records below, then verify or reject it. The date stays held until you decide${deadlinePassed ? ', even though the deadline has passed' : ''}.`
            : deadlinePassed
              ? paid > 0
                ? `The payment deadline (${eventDate(deadline)}) passed with a partial payment. Extend the deadline or cancel the booking.`
                : `The payment deadline (${eventDate(deadline)}) passed. The date is released automatically within a few minutes unless you extend the deadline.`
              : `Waiting for payment until ${eventDate(deadline)}. ${onlinePayment ? 'A GCash or bank screenshot from the client appears below to verify; record cash in Payments received.' : 'Record cash in Payments received.'} The booking confirms itself once the payment is recorded. If no payment arrives by then, the date is released automatically.`}
        </p>
      )}
      {b.notes && <div className={styles.notice}>Staff notes: {b.notes}</div>}
      {reviewShown && (
        <PaymentProofReview booking={b} busy={busy} mutate={mutate} headingId={screenshotsId} />
      )}
      {editing && canEdit && policy && (
        <BookingForm
          key={`edit-${b.id}-${b.revision}`}
          policy={policy}
          booking={b}
          busy={busy}
          mutate={mutate}
          onClose={() => {
            restoreEditFocus.current = true;
            setEditing(false);
          }}
        />
      )}
      {!closed && !(editing && canEdit) && focus !== 'contracts' && focus !== 'payments' && (
        <form className={styles.subsection} onSubmit={submitAction}>
          <h3>
            <ShieldCheck size={16} aria-hidden="true" />
            Actions
          </h3>
          <p>
            Record why you made a decision. Approving a request holds its date until the payment
            deadline; recording the payment confirms the booking automatically.
          </p>
          <label htmlFor={noteId}>
            Decision note (required)
            <textarea
              id={noteId}
              name="reason"
              required
              minLength={5}
              maxLength={2000}
              rows={2}
              placeholder="For example: checked the details with the client by phone"
            />
          </label>
          <div className={styles.detailActions}>
            {actions.main.map(actionButton)}
            <ButtonLink href="/admin/services" variant="secondary">
              <Package size={16} aria-hidden="true" />
              View packages
            </ButtonLink>
            {canEdit && (
              <Button
                type="button"
                ref={editButtonRef}
                variant="secondary"
                onClick={() => setEditing(true)}
              >
                <Pencil size={16} aria-hidden="true" />
                Edit details
              </Button>
            )}
          </div>
          {actions.more.length > 0 && (
            <div className={styles.detailActions} role="group" aria-label="Other actions">
              {actions.more.map(actionButton)}
            </div>
          )}
          {busy && (
            <p className={styles.help} role="status">
              Saving…
            </p>
          )}
          {blocked.length > 0 && (
            <ul className={styles.actionNotes}>
              {blocked.map((option) => (
                <li key={option.action} id={`${id}-${option.action}`}>
                  <strong>{option.label}:</strong> {option.blocked}
                </li>
              ))}
            </ul>
          )}
          {b.reservation === 'CONFIRMED' && (
            <p className={styles.help}>
              Confirmed bookings cannot be edited. To change agreed details, cancel this booking and
              create a new request.
            </p>
          )}
          {b.reservation === 'REQUESTED' && lockedByAgreement && (
            <p className={styles.help}>
              Details are locked because an agreement was issued or signed. To change agreed
              details, cancel this booking and create a new request.
            </p>
          )}
        </form>
      )}
      {(focus === 'payments' || focus === 'bookings') && (
        <details className={styles.sectionDisclosure} open={focus === 'payments'}>
          <summary>
            <span>
              Payments received
              <small>
                {b.payments.length} recorded · {money(paid)} received
              </small>
            </span>
            <ChevronDown size={20} aria-hidden="true" />
          </summary>
          <p>
            Only money actually received is recorded here: cash at the venue, and GCash or bank
            transfers verified from the client&apos;s screenshot. When the payments reach the
            confirmation rule (the reservation fee or the full amount), the booking is confirmed
            automatically.
          </p>
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
                    </small>
                    {p.acknowledgmentNumber && (
                      <small>Acknowledgment {p.acknowledgmentNumber}</small>
                    )}
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
                      <Button variant="destructive" disabled={busy}>
                        Void receipt
                      </Button>
                    </form>{' '}
                  </details>
                )}
              </li>
            ))}
          </ul>
          {!b.payments.length && <p>No payment received.</p>}
          {b.approval === 'APPROVED' && !closed && paid < b.totalCents && transferChoice && (
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
              <Button variant="primary" disabled={busy}>
                Record cash
              </Button>
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
            <ChevronDown size={20} aria-hidden="true" />
          </summary>
          <div className={styles.cardHeading}>
            <div>
              <p>
                Prepared from a reviewed booking snapshot. No automatic signature or fabricated
                contract details.
              </p>
            </div>
            <Button
              variant="secondary"
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
            </Button>
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
                <Button
                  variant="secondary"
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
                  <Download size={16} aria-hidden="true" />
                  Download agreement (.txt)
                </Button>
                {c.status === 'DRAFT' && (
                  <Button
                    variant="primary"
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
                  </Button>
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
                  <Button variant="primary" disabled={busy || c.bookingRevision !== b.revision}>
                    Record physical signature
                  </Button>
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
