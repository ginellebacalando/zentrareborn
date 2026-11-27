'use client';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, CircleHelp, Copy, TriangleAlert } from 'lucide-react';
import { balanceDueDate } from '@/lib/admin/booking-rules';
import { confirmationError, money, paidTotal } from '@/lib/admin/domain';
import { PAYMENT_METHOD_LABELS } from '@/lib/admin/payment-accounts';
import { Button, IconButton } from '@/components/shared/Button';
import ActionDialog from './ActionDialog';
import { Badge } from './AdminBadge';
import { useAdminDate, useAdminDateParts, useAdminPreferences } from './AdminPreferencesProvider';
import { useAdminRole } from './AdminRoleContext';
import BookingActivity from './BookingActivity';
import BookingAgreements from './BookingAgreements';
import BookingPayments from './BookingPayments';
import { StatusChip } from './BookingStatus';
import { BookingForm } from './Forms';
import MoreMenu, { type MoreMenuItem } from './MoreMenu';
import type { BookingTab } from './booking-links';
import {
  bookingOffer,
  bookingStatus,
  guestsLabel,
  hasPassed,
  nextStep,
  packageShortName,
  type DecisionAction,
  type MainAction,
} from './booking-view';
import type { Booking, Mutate, Policy } from './types';
import styles from './admin.module.css';
import page from './BookingDetail.module.css';

const TABS: { id: BookingTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'payments', label: 'Payments' },
  { id: 'agreements', label: 'Agreements' },
  { id: 'activity', label: 'Activity' },
];

/** "5:00–11:00 PM" when both times share AM or PM; otherwise both in full. */
function timeRange(start: string, end: string) {
  const suffix = /\s?(AM|PM)$/i;
  const startSuffix = start.match(suffix)?.[1];
  return startSuffix && startSuffix === end.match(suffix)?.[1]
    ? `${start.replace(suffix, '')}–${end}`
    : `${start}–${end}`;
}

/**
 * One booking on its own page (/admin/bookings/[reference], docs/admin-design.md): a sticky header
 * with the client, reference, one status and the action for that status; a one-line summary and
 * next step; the Overview with the event, client and payment side by side; and tabs for Payments,
 * Agreements and Activity. Decisions ask for their note in a dialog. The server re-checks every
 * rule; this page only offers what applies.
 */
export default function BookingDetail({
  booking: b,
  policy,
  owner,
  busy,
  mutate,
  initialTab,
  back,
  notice,
}: {
  booking: Booking;
  policy?: Policy;
  owner: boolean;
  busy: boolean;
  mutate: Mutate;
  initialTab: BookingTab;
  back: { href: string; onClick: (event: MouseEvent<HTMLAnchorElement>) => void };
  /** The last save's outcome, shown under the header. */
  notice: { kind: 'error' | 'success'; text: string } | null;
}) {
  const id = useId();
  const when = useAdminDate();
  const { day, time, zoneNote } = useAdminDateParts();
  const { settings } = useAdminPreferences();
  const { canOpen } = useAdminRole();
  const tabs = TABS.filter((tab) => tab.id !== 'activity' || canOpen('logs'));
  const [tab, setTab] = useState<BookingTab>(
    tabs.some((candidate) => candidate.id === initialTab) ? initialTab : 'overview',
  );
  const [editing, setEditing] = useState(false);
  const [asking, setAsking] = useState<DecisionAction | null>(null);
  const [askError, setAskError] = useState('');
  const [copied, setCopied] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const screenshotsId = `payment-screenshots-${b.id}`;

  const paid = paidTotal(b.payments);
  const closed = ['CANCELLED', 'COMPLETED'].includes(b.reservation);
  const status = bookingStatus(b);
  const confirmHint =
    b.reservation !== 'REQUESTED'
      ? null
      : policy && b.policyVersion !== policy.version
        ? 'Re-review this request under the current venue policy, then approve it again.'
        : confirmationError(b, paid, policy?.reviewed ?? false);
  const offer = bookingOffer(b, policy, confirmHint);
  const lockedByAgreement = b.contracts.some(
    (contract) => contract.status === 'ISSUED' || contract.status === 'SIGNED',
  );
  const canEdit = b.reservation === 'REQUESTED' && !lockedByAgreement && !!policy;
  const deadline =
    b.reservation === 'REQUESTED' && b.approval === 'APPROVED' && b.holdExpiresAt
      ? new Date(b.holdExpiresAt)
      : null;
  const balanceDue =
    b.reservation === 'CONFIRMED' && paid < b.totalCents
      ? balanceDueDate(new Date(b.startsAt), settings.admin.bookingRules.balanceDueDays)
      : null;
  const step = nextStep(b, when, balanceDue);
  const waitingProof = (b.paymentProofs ?? []).find((proof) => proof.status === 'SUBMITTED');
  const noFee = b.paymentRule === 'DEPOSIT_REQUIRED' && b.depositCents < 1 && !closed;
  const paidShare = b.totalCents ? Math.min(100, (paid / b.totalCents) * 100) : 0;
  const canMarkVerified =
    !closed && b.reservation !== 'CONFIRMED' && b.verification === 'UNREVIEWED';

  // The tab lives in the address, so a reload or a shared link opens the same tab.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (tab === 'overview') params.delete('tab');
    else params.set('tab', tab);
    const search = params.toString();
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${search ? `?${search}` : ''}`,
    );
  }, [tab]);

  function showPayments(target: 'screenshots' | 'cash') {
    setTab('payments');
    requestAnimationFrame(() => {
      const element = document.getElementById(
        target === 'cash' ? `${screenshotsId}-cash` : screenshotsId,
      );
      element?.scrollIntoView({ block: 'start' });
      element?.focus({ preventScroll: true });
    });
  }

  function runMain(main: MainAction) {
    if (main.kind === 'payments')
      return showPayments(main.label === 'Verify payment' ? 'screenshots' : 'cash');
    if (!main.decision.unavailable) setAsking(main.decision);
  }

  async function decide(note: string) {
    if (!asking) return;
    setAskError('');
    try {
      await mutate(
        'bookings',
        {
          op: 'booking-action',
          id: b.id,
          revision: b.revision,
          action: asking.action,
          reason: note,
        },
        { inlineErrors: true },
      );
      setAsking(null);
    } catch (error) {
      setAskError(error instanceof Error ? error.message : 'Unable to save.');
    }
  }

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(b.reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the reference stays visible to copy by hand.
    }
  }

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    const index = tabs.findIndex((candidate) => candidate.id === tab);
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? tabs.length - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    setTab(tabs[next].id);
    tabRefs.current[next]?.focus();
  }

  const moreItems: MoreMenuItem[] = closed
    ? [{ label: 'View packages', href: '/admin/services' }]
    : [
        {
          label: 'Edit details',
          unavailable: canEdit
            ? null
            : b.reservation === 'CONFIRMED'
              ? 'Confirmed bookings cannot be edited; cancel and create a new request instead.'
              : lockedByAgreement
                ? 'Locked by an issued or signed agreement.'
                : 'Not available yet.',
          onSelect: () => {
            setTab('overview');
            setEditing(true);
          },
        },
        { label: 'View packages', href: '/admin/services' },
        ...offer.more.map((option) => ({
          label: option.label,
          destructive: option.destructive,
          unavailable: option.unavailable,
          onSelect: () => setAsking(option),
        })),
      ];

  function mainButton(main: MainAction, className?: string) {
    const label = main.kind === 'payments' ? main.label : main.decision.label;
    const unavailable = main.kind === 'decision' ? main.decision.unavailable : null;
    return (
      <Button
        type="button"
        variant="primary"
        className={className}
        disabled={busy}
        aria-disabled={unavailable ? true : undefined}
        data-tip={unavailable ?? undefined}
        aria-describedby={unavailable ? `${id}-unavailable` : undefined}
        onClick={() => runMain(main)}
      >
        {label}
      </Button>
    );
  }

  return (
    <article className={page.page} aria-labelledby={`${id}-name`}>
      <header className={page.header}>
        <div className={page.headerTop}>
          <Link href={back.href} onClick={back.onClick} className={page.back}>
            <ArrowLeft size={16} aria-hidden="true" />
            Bookings
          </Link>
          <span className={page.zone}>{zoneNote}</span>
        </div>
        <div className={page.titleRow}>
          <div className={page.identity}>
            <h1 id={`${id}-name`}>{b.clientName}</h1>
            <span className={page.reference}>
              {b.reference}
              <IconButton
                type="button"
                size="sm"
                label={copied ? 'Copied' : 'Copy reference'}
                icon={<Copy aria-hidden="true" />}
                onClick={() => void copyReference()}
              />
              <span className={styles.srOnly} role="status">
                {copied ? 'Reference copied' : ''}
              </span>
            </span>
            <StatusChip status={status} />
          </div>
          <div className={page.actions}>
            {offer.secondary && (
              <Button
                type="button"
                variant="secondary"
                className={page.desktopOnly}
                disabled={busy}
                onClick={() => offer.secondary && setAsking(offer.secondary)}
              >
                {offer.secondary.label}
              </Button>
            )}
            {offer.main && mainButton(offer.main, page.desktopOnly)}
            <MoreMenu items={moreItems} />
          </div>
        </div>
        <p className={page.summary}>
          {[
            b.eventType,
            day(b.startsAt),
            day(b.startsAt) === day(b.endsAt)
              ? timeRange(time(b.startsAt), time(b.endsAt))
              : `${time(b.startsAt)} to ${day(b.endsAt)} · ${time(b.endsAt)}`,
            b.venue,
            `${b.guests} ${b.guests === 1 ? 'guest' : 'guests'}`,
            packageShortName(b.packageName),
          ].join(' · ')}
        </p>
      </header>
      {offer.main?.kind === 'decision' && offer.main.decision.unavailable && (
        <span id={`${id}-unavailable`} className={styles.srOnly}>
          {offer.main.decision.unavailable}
        </span>
      )}

      {notice && (
        <p
          className={notice.kind === 'error' ? styles.error : styles.success}
          role={notice.kind === 'error' ? 'alert' : 'status'}
        >
          {notice.text}
        </p>
      )}

      <p className={page.nextStep}>
        <span>{step.line}</span>
        <IconButton
          type="button"
          size="sm"
          variant="ghost"
          label={step.help}
          tooltipAlign="end"
          icon={<CircleHelp aria-hidden="true" />}
        />
      </p>

      <div role="tablist" aria-label="Booking sections" className={page.tabs}>
        {tabs.map((candidate, index) => (
          <button
            key={candidate.id}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${candidate.id}`}
            aria-selected={tab === candidate.id}
            aria-controls={`${id}-panel`}
            tabIndex={tab === candidate.id ? 0 : -1}
            className={page.tab}
            onClick={() => setTab(candidate.id)}
            onKeyDown={onTabKey}
          >
            {candidate.label}
            {candidate.id === 'payments' && waitingProof && (
              <span className={page.tabNote}>1 to verify</span>
            )}
          </button>
        ))}
      </div>

      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${tab}`}
        className={page.panelArea}
      >
        {tab === 'overview' &&
          (editing && canEdit && policy ? (
            <BookingForm
              key={`edit-${b.id}-${b.revision}`}
              policy={policy}
              booking={b}
              busy={busy}
              mutate={mutate}
              onClose={() => setEditing(false)}
            />
          ) : (
            <div className={page.columns}>
              <div className={page.mainColumn}>
                <section className={page.panel} aria-labelledby={`${id}-event`}>
                  <h2 id={`${id}-event`}>Event</h2>
                  <dl className={page.facts}>
                    <dt>Event</dt>
                    <dd>{b.eventType}</dd>
                    <dt>Date</dt>
                    <dd>{day(b.startsAt)}</dd>
                    <dt>Time</dt>
                    <dd>
                      {day(b.startsAt) === day(b.endsAt)
                        ? timeRange(time(b.startsAt), time(b.endsAt))
                        : `${time(b.startsAt)} to ${when(b.endsAt)}`}
                    </dd>
                    <dt>Venue</dt>
                    <dd>{b.venue}</dd>
                    <dt>Guests</dt>
                    <dd>{guestsLabel(b)}</dd>
                    <dt>Package</dt>
                    <dd>{b.packageName}</dd>
                  </dl>
                </section>
                <section className={page.panel} aria-labelledby={`${id}-client`}>
                  <h2 id={`${id}-client`}>Client</h2>
                  <dl className={page.facts}>
                    <dt>Name</dt>
                    <dd>{b.clientName}</dd>
                    <dt>Email</dt>
                    <dd>
                      <a href={`mailto:${b.email}`} className={page.textLink}>
                        {b.email}
                      </a>
                    </dd>
                    <dt>Phone</dt>
                    <dd className={page.inlineValue}>
                      <a href={`tel:${b.phone}`} className={page.textLink}>
                        {b.phone}
                      </a>
                      <Badge value={b.verification} />
                      {canMarkVerified && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            setAsking({
                              action: 'VERIFY',
                              label: 'Mark as verified',
                              summary:
                                'Record how you checked the phone number or email with the client.',
                            })
                          }
                        >
                          Mark as verified
                        </Button>
                      )}
                    </dd>
                    {b.verificationNote && (
                      <>
                        <dt>Contact note</dt>
                        <dd>{b.verificationNote}</dd>
                      </>
                    )}
                  </dl>
                </section>
                {b.notes && (
                  <section className={page.panel} aria-labelledby={`${id}-notes`}>
                    <h2 id={`${id}-notes`}>Staff notes</h2>
                    <p className={page.notes}>{b.notes}</p>
                  </section>
                )}
              </div>
              <aside className={page.sideColumn} aria-labelledby={`${id}-payment`}>
                <section className={page.panel}>
                  <h2 id={`${id}-payment`}>Payment</h2>
                  <p className={page.paid}>
                    <strong>{money(paid)}</strong> paid of {money(b.totalCents)}
                  </p>
                  <span className={styles.paymentBar} aria-hidden="true">
                    <span style={{ inlineSize: `${paidShare}%` }} />
                  </span>
                  <dl className={page.facts}>
                    <dt>Balance</dt>
                    <dd>{money(Math.max(0, b.totalCents - paid))}</dd>
                    {deadline && (
                      <>
                        <dt>Pay by</dt>
                        <dd>{when(deadline)}</dd>
                      </>
                    )}
                    {balanceDue && (
                      <>
                        <dt>Full payment</dt>
                        <dd>
                          {day(balanceDue)}
                          {hasPassed(balanceDue) && ' · overdue'}
                        </dd>
                      </>
                    )}
                    {!noFee && (
                      <>
                        <dt>To confirm</dt>
                        <dd>
                          {b.paymentRule === 'FULL_PAYMENT_REQUIRED'
                            ? 'Full payment'
                            : b.paymentRule === 'NO_PAYMENT_REQUIRED'
                              ? 'No payment needed'
                              : `Reservation fee ${money(b.depositCents)}`}
                        </dd>
                      </>
                    )}
                  </dl>
                  {noFee && (
                    <p className={page.warning}>
                      <TriangleAlert size={16} aria-hidden="true" />
                      <span>
                        This package has no reservation fee set.{' '}
                        <Link href="/admin/services" className={page.textLink}>
                          Set it in Packages
                        </Link>
                      </span>
                    </p>
                  )}
                  {waitingProof && (
                    <div className={page.proof}>
                      <p>
                        <strong>Waiting to verify</strong>
                        {money(waitingProof.amountCents)} ·{' '}
                        {PAYMENT_METHOD_LABELS[waitingProof.method]} · Ref{' '}
                        {waitingProof.referenceNumber} · sent {when(waitingProof.createdAt)}
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => showPayments('screenshots')}
                      >
                        Review screenshot
                      </Button>
                    </div>
                  )}
                </section>
              </aside>
            </div>
          ))}
        {tab === 'payments' && (
          <BookingPayments
            booking={b}
            owner={owner}
            busy={busy}
            mutate={mutate}
            screenshotsId={screenshotsId}
          />
        )}
        {tab === 'agreements' && <BookingAgreements booking={b} busy={busy} mutate={mutate} />}
        {tab === 'activity' && <BookingActivity reference={b.reference} />}
      </div>

      {(offer.main || offer.secondary) && (
        <div className={page.mobileBar}>
          {offer.secondary && (
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => offer.secondary && setAsking(offer.secondary)}
            >
              {offer.secondary.label}
            </Button>
          )}
          {offer.main && mainButton(offer.main)}
        </div>
      )}

      {asking && (
        <ActionDialog
          title={asking.label}
          summary={asking.summary}
          confirmLabel={asking.label}
          destructive={asking.destructive}
          busy={busy}
          error={askError}
          onConfirm={decide}
          onClose={() => {
            setAsking(null);
            setAskError('');
          }}
        />
      )}
    </article>
  );
}
