'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { money, paymentRules } from '@/lib/admin/domain';
import { manilaInput } from './datetime';
import type { AdminData, Booking, Inquiry, Mutate, Policy } from './types';
import styles from './admin.module.css';
import { Mail, Phone, Save, ShieldCheck, UserRound, ChevronDown } from 'lucide-react';
import ZentraWordmark from '@/components/shared/ZentraWordmark';
import AdminAvatar from './AdminAvatar';
import { enumLabel } from './AdminBadge';
import { Button } from '@/components/shared/Button';
const eventTypes = [
  'Wedding',
  'Birthday',
  'Debut',
  'Christening',
  'Christmas party',
  'Gender reveal',
  'Corporate event',
  'Other',
];

/**
 * Creates a staff-entered request, or (with `booking`) edits a requested booking through the
 * 'edit-booking' operation. Edits need a reason, use the booking's current revision and show
 * server errors in place; the server re-checks every rule.
 */
export function BookingForm({
  policy,
  inquiry,
  booking,
  busy,
  mutate,
  onClose,
}: {
  policy: Policy;
  inquiry?: Inquiry;
  booking?: Booking;
  busy: boolean;
  mutate: Mutate;
  onClose?: () => void;
}) {
  const headingId = useId();
  const clientNameRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const Heading = booking ? 'h3' : 'h2';
  const types =
    booking && !eventTypes.includes(booking.eventType)
      ? [booking.eventType, ...eventTypes]
      : eventTypes;
  useEffect(() => {
    clientNameRef.current?.focus();
  }, []);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  return (
    <section
      className={booking ? styles.editPanel : styles.card}
      key={inquiry?.inquiryReference || 'new-request'}
      aria-labelledby={headingId}
    >
      <Heading id={headingId}>{booking ? 'Edit details' : 'New staff-entered request'}</Heading>
      <p>
        {booking
          ? 'Update the request as agreed with the client. Saving keeps its history in the activity log.'
          : 'This creates a pending request, not a confirmed booking. Contact verification and policy checks follow.'}
      </p>
      {booking && (
        <div className={styles.notice}>
          Changing the email or phone resets contact verification. Changing the schedule, package,
          guests, price, reservation fee, event type or contact returns an approved request to
          Pending. No email is sent for an edit.
        </div>
      )}
      {inquiry && (
        <div className={styles.notice}>
          Inquiry {inquiry.inquiryReference}: {inquiry.message}
        </div>
      )}
      {error && (
        <div className={styles.error} role="alert" ref={errorRef} tabIndex={-1}>
          {error}
        </div>
      )}
      <form
        className={styles.formGrid}
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget),
            text = (k: string) => String(f.get(k) || '');
          const details = {
            clientName: text('clientName'),
            email: text('email'),
            phone: text('phone'),
            eventType: text('eventType'),
            packageName: text('packageName'),
            venue: 'Zion Events Place',
            startsAt: new Date(`${text('startsAt')}:00+08:00`).toISOString(),
            endsAt: new Date(`${text('endsAt')}:00+08:00`).toISOString(),
            guests: Number(f.get('guests')),
            totalCents: Math.round(Number(f.get('total')) * 100),
            depositCents: Math.round(Number(f.get('deposit')) * 100),
            paymentRule: policy.paymentRule,
            notes: text('notes'),
          };
          setError('');
          try {
            if (booking) {
              await mutate(
                'bookings',
                {
                  op: 'edit-booking',
                  id: booking.id,
                  revision: booking.revision,
                  booking: details,
                  reason: text('reason'),
                },
                { inlineErrors: true },
              );
              onClose?.();
            } else
              await mutate('bookings', {
                op: 'create-booking',
                sourceInquiryId: inquiry?.id,
                booking: details,
              });
          } catch (failure) {
            if (booking)
              setError(failure instanceof Error ? failure.message : 'Unable to save the changes.');
          }
        }}
      >
        <fieldset className={`${styles.full} ${styles.formSection}`}>
          <legend>Client details</legend>
          <div className={styles.formGrid}>
            <label>
              Client name
              <input
                name="clientName"
                ref={clientNameRef}
                placeholder="Full client name"
                autoComplete="name"
                required
                minLength={2}
                maxLength={180}
                defaultValue={booking?.clientName ?? inquiry?.fullName}
              />
            </label>
            <label>
              Email address
              <input
                name="email"
                type="email"
                required
                placeholder="client@example.com"
                autoComplete="email"
                defaultValue={booking?.email ?? inquiry?.email}
              />
            </label>
            <label>
              Contact number
              <input
                name="phone"
                placeholder="09XX XXX XXXX"
                autoComplete="tel"
                type="tel"
                required
                maxLength={40}
                defaultValue={booking?.phone ?? (inquiry?.phoneNumber || '')}
              />
            </label>
          </div>
        </fieldset>
        <fieldset className={`${styles.full} ${styles.formSection}`}>
          <legend>Event details</legend>
          <div className={styles.formGrid}>
            <label>
              Event type
              <select
                name="eventType"
                defaultValue={booking?.eventType ?? (inquiry?.eventInterest || 'Wedding')}
              >
                {types.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Reviewed package / service
              <input
                name="packageName"
                required
                minLength={2}
                maxLength={180}
                defaultValue={booking?.packageName ?? (inquiry?.packageInterest || '')}
                placeholder="Use the agreed package name"
              />
            </label>
            <label>
              Guest count
              <input
                name="guests"
                type="number"
                min={1}
                max={10000}
                required
                defaultValue={booking?.guests}
              />
            </label>
            <label>
              Start · Manila
              <input
                name="startsAt"
                type="datetime-local"
                required
                min={manilaInput()}
                defaultValue={booking ? manilaInput(new Date(booking.startsAt)) : undefined}
              />
            </label>
            <label>
              End · Manila
              <input
                name="endsAt"
                type="datetime-local"
                required
                min={manilaInput()}
                defaultValue={booking ? manilaInput(new Date(booking.endsAt)) : undefined}
              />
            </label>
          </div>
        </fieldset>
        <fieldset className={`${styles.full} ${styles.formSection}`}>
          <legend>Agreement & cash policy</legend>
          <div className={styles.formGrid}>
            <label>
              Agreed contract price · PHP
              <input
                name="total"
                type="number"
                min="0.01"
                max="20000000"
                step="0.01"
                required
                defaultValue={booking ? booking.totalCents / 100 : undefined}
              />
            </label>
            <label>
              Agreed reservation fee · PHP
              <input
                name="deposit"
                type="number"
                min={policy.paymentRule === 'DEPOSIT_REQUIRED' ? '0.01' : '0'}
                step="0.01"
                required
                defaultValue={
                  booking
                    ? booking.depositCents / 100
                    : policy.paymentRule === 'NO_PAYMENT_REQUIRED'
                      ? 0
                      : undefined
                }
              />
            </label>
            <div className={styles.notice}>
              Venue: Zion Events Place
              <br />
              Policy: {enumLabel(policy.paymentRule)}
              <br />
              {policy.cashInstructions}
              <br />
              {!policy.reviewed &&
                'Owner review is required before any reservation can be confirmed.'}
            </div>
          </div>
        </fieldset>
        <label className={styles.full}>
          Staff notes
          <textarea
            name="notes"
            maxLength={3000}
            defaultValue={
              booking
                ? booking.notes
                : inquiry
                  ? `From inquiry ${inquiry.inquiryReference}. ${inquiry.message || ''}`
                  : ''
            }
          />
        </label>
        {booking && (
          <label className={styles.full}>
            Reason for the change (required)
            <textarea
              name="reason"
              required
              minLength={3}
              maxLength={1000}
              rows={2}
              placeholder="What changed and who asked for it"
            />
          </label>
        )}
        <div className={`${styles.full} ${styles.actions}`}>
          <Button type="submit" variant="primary" loading={busy} loadingLabel="Saving…">
            {booking ? 'Save changes' : 'Create pending request'}
          </Button>
          {booking && onClose && (
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}
export function SettingsForm({
  policy: p,
  owner,
  configured,
  busy,
  mutate,
}: {
  policy: Policy;
  owner: boolean;
  configured: boolean;
  busy: boolean;
  mutate: Mutate;
}) {
  return (
    <>
      <details className={`${styles.card} ${styles.policyDisclosure}`} open={!p.reviewed}>
        <summary>
          <h2>
            Reservation & cash policy <ChevronDown size={20} aria-hidden="true" />
            <small>
              {p.reviewed ? 'Reviewed policy' : 'Owner review required before confirmation'}
            </small>
          </h2>
        </summary>
        <p>
          Policy version {p.version}.{' '}
          {owner
            ? 'Super administrator review is required.'
            : 'Read-only for administrators; ask the owner to change policy.'}{' '}
          No online payment gateway is enabled.
        </p>
        <div className={styles.notice}>
          Existing published terms list Classic {money(3000000)}, Premium {money(4000000)}, and
          Ultimate {money(5000000)} reservation fees. Verify the applicable amount with the venue
          for each booking. Changing policy requires re-review of pending bookings; it does not
          rewrite the client website.
        </div>
        <form
          key={p.version}
          className={styles.formGrid}
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            try {
              await mutate('settings', {
                op: 'settings',
                version: p.version,
                reviewed: f.get('reviewed') === 'on',
                paymentRule: f.get('paymentRule'),
                cashInstructions: f.get('cashInstructions'),
                contractTerms: f.get('contractTerms'),
              });
            } catch {}
          }}
        >
          <fieldset disabled={!owner || busy} className={styles.full}>
            <label>
              Payment required before confirmation
              <select name="paymentRule" defaultValue={p.paymentRule}>
                {paymentRules.map((v) => (
                  <option key={v} value={v}>
                    {enumLabel(v)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cash payment instructions: when, where, and deadline
              <textarea
                name="cashInstructions"
                required
                minLength={20}
                maxLength={3000}
                defaultValue={p.cashInstructions}
              />
            </label>
            <label>
              Reviewed venue agreement terms
              <textarea
                className={styles.termsEditor}
                name="contractTerms"
                required
                minLength={100}
                maxLength={30000}
                defaultValue={p.contractTerms}
              />
            </label>
            <label className={styles.checkbox}>
              <input name="reviewed" type="checkbox" defaultChecked={p.reviewed} />
              The venue has reviewed this reservation rule and the cash instructions and contract
              terms are accurate.
            </label>
            {owner && <Button variant="primary">Save reviewed policy</Button>}
          </fieldset>
        </form>
      </details>
      <section className={styles.card}>
        <h2>Notifications and automation</h2>
        <p>
          {configured
            ? 'Email delivery is configured. The outbox shows the actual result of each send.'
            : 'Email delivery is not configured. Automatically prepared messages remain queued, not sent.'}
        </p>
        <details className={styles.sectionDisclosure}>
          <summary>
            <span>How notices are processed</span>
            <ChevronDown size={20} aria-hidden="true" />
          </summary>
          <p>
            Every request, decision, and cash receipt creates a standardized notice containing
            separate approval, reservation, and payment states. A protected dispatcher processes the
            queue; failed or interrupted sends are held for review.
          </p>
          <p>
            Contact verification is manual. Confirmation safeguards and contract preparation are
            automatic server checks, not automatic business approval.
          </p>
          <p className={styles.help}>
            Timezone: Asia/Manila · Currency: PHP · Payment method: Cash only. Active services are
            operationally available; client-visible controls public display. Client website controls
            manage public access separately from service availability.
          </p>
        </details>
      </section>
    </>
  );
}
export function ProfileForm({
  user,
  busy,
  mutate,
}: {
  user: NonNullable<AdminData['user']>;
  busy: boolean;
  mutate: Mutate;
}) {
  const displayName = user.fullName?.trim() || user.username;
  const roleLabel = user.role === 'SUPERADMIN' ? 'Super Administrator' : 'Administrator';
  return (
    <div className={styles.profileWorkspace}>
      <aside className={styles.profileSummary} aria-label="Your account details">
        <div className={styles.profileCover}>
          <ZentraWordmark size="sm" />
        </div>
        <div className={styles.profileSummaryBody}>
          <AdminAvatar user={user} size="profile" />
          <h2>{displayName}</h2>
          <span className={styles.profileRoleBadge}>
            <ShieldCheck size={16} />
            {roleLabel}
          </span>
          <dl>
            <div>
              <dt>
                <Mail size={16} />
                Email address
              </dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>
                <Phone size={16} />
                Contact number
              </dt>
              <dd>{user.contactNumber || 'Not provided'}</dd>
            </div>
            <div>
              <dt>
                <UserRound size={16} />
                Username
              </dt>
              <dd>{user.username}</dd>
            </div>
            <div>
              <dt>
                <ShieldCheck size={16} />
                Account status
              </dt>
              <dd>
                <span
                  className={`${styles.badge} ${user.status === 'ACTIVE' ? styles.good : styles.neutral}`}
                >
                  {enumLabel(user.status)}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </aside>
      <form
        className={styles.profileEditor}
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          try {
            await mutate('profile', {
              op: 'profile',
              fullName: f.get('fullName'),
              contactNumber: f.get('contactNumber'),
              currentPassword: f.get('currentPassword'),
              newPassword: f.get('newPassword'),
            });
          } catch {}
        }}
      >
        <section className={`${styles.card} ${styles.profileEditCard}`}>
          <div className={styles.profileSectionHeading}>
            <div>
              <h2>Contact details</h2>
              <p>Keep your name and contact number up to date.</p>
            </div>
          </div>
          <div className={styles.formGrid}>
            <label>
              Full name
              <input
                name="fullName"
                required
                minLength={2}
                maxLength={180}
                defaultValue={user.fullName || user.username}
              />
            </label>
            <label>
              Contact number
              <input
                name="contactNumber"
                type="tel"
                maxLength={20}
                defaultValue={user.contactNumber || ''}
              />
            </label>
          </div>
        </section>
        <section className={`${styles.card} ${styles.profileEditCard}`}>
          <div className={styles.profileSectionHeading}>
            <div>
              <h2>Account security</h2>
              <p>Choose a strong password to protect your account.</p>
            </div>
          </div>
          <div className={styles.formGrid}>
            <label>
              Current password
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                maxLength={128}
              />
            </label>
            <label>
              New password
              <input
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
              />
            </label>
            <p className={`${styles.full} ${styles.help}`}>
              Leave both password fields blank to keep your current password. A new password needs
              at least 12 characters. Changing it signs you out of existing sessions.
            </p>
            <div className={styles.full}>
              <Button
                type="submit"
                variant="primary"
                icon={<Save aria-hidden="true" />}
                loading={busy}
                loadingLabel="Saving…"
              >
                Save my profile
              </Button>
            </div>
          </div>
        </section>
      </form>
    </div>
  );
}
