'use client';
import { useEffect, useRef } from 'react';
import { money, paymentRules } from '@/lib/admin/domain';
import { manilaInput } from './BookingDetail';
import type { AdminData, Inquiry, Mutate, Policy } from './types';
import styles from './admin.module.css';
import Image from 'next/image';
import { LockKeyhole, Mail, Phone, Save, ShieldCheck, UserRound, ChevronDown } from 'lucide-react';
import { BRAND } from '@/config/brand';
import AdminAvatar from './AdminAvatar';
export function BookingForm({
  policy,
  inquiry,
  busy,
  mutate,
}: {
  policy: Policy;
  inquiry?: Inquiry;
  busy: boolean;
  mutate: Mutate;
}) {
  const clientNameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    clientNameRef.current?.focus();
  }, []);
  return (
    <section className={styles.card} key={inquiry?.inquiryReference || 'new-request'}>
      <h2>New staff-entered request</h2>
      <p>
        This creates a pending request, not a confirmed booking. Contact verification and policy
        checks follow.
      </p>
      {inquiry && (
        <div className={styles.notice}>
          Inquiry {inquiry.inquiryReference}: {inquiry.message}
        </div>
      )}
      <form
        className={styles.formGrid}
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget),
            text = (k: string) => String(f.get(k) || '');
          try {
            await mutate('bookings', {
              op: 'create-booking',
              sourceInquiryId: inquiry?.id,
              booking: {
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
              },
            });
          } catch {}
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
                defaultValue={inquiry?.fullName}
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
                defaultValue={inquiry?.email}
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
                defaultValue={inquiry?.phoneNumber || ''}
              />
            </label>
          </div>
        </fieldset>
        <fieldset className={`${styles.full} ${styles.formSection}`}>
          <legend>Event details</legend>
          <div className={styles.formGrid}>
            <label>
              Event type
              <select name="eventType" defaultValue={inquiry?.eventInterest || 'Wedding'}>
                {[
                  'Wedding',
                  'Birthday',
                  'Debut',
                  'Christening',
                  'Christmas party',
                  'Gender reveal',
                  'Corporate event',
                  'Other',
                ].map((v) => (
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
                defaultValue={inquiry?.packageInterest || ''}
                placeholder="Use the agreed package name"
              />
            </label>
            <label>
              Guest count
              <input name="guests" type="number" min={1} max={10000} required />
            </label>
            <label>
              Start · Manila
              <input name="startsAt" type="datetime-local" required min={manilaInput()} />
            </label>
            <label>
              End · Manila
              <input name="endsAt" type="datetime-local" required min={manilaInput()} />
            </label>
          </div>
        </fieldset>
        <fieldset className={`${styles.full} ${styles.formSection}`}>
          <legend>Agreement & cash policy</legend>
          <div className={styles.formGrid}>
            <label>
              Agreed contract price · PHP
              <input name="total" type="number" min="0.01" max="20000000" step="0.01" required />
            </label>
            <label>
              Agreed reservation fee · PHP
              <input
                name="deposit"
                type="number"
                min={policy.paymentRule === 'DEPOSIT_REQUIRED' ? '0.01' : '0'}
                step="0.01"
                required
                defaultValue={policy.paymentRule === 'NO_PAYMENT_REQUIRED' ? 0 : undefined}
              />
            </label>
            <div className={styles.notice}>
              Venue: Zion Events Place
              <br />
              Policy: {policy.paymentRule.replaceAll('_', ' ')}
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
              inquiry ? `From inquiry ${inquiry.inquiryReference}. ${inquiry.message || ''}` : ''
            }
          />
        </label>
        <div className={styles.full}>
          <button className={styles.primary} disabled={busy}>
            Create pending request
          </button>
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
            Reservation & cash policy <ChevronDown size={18} aria-hidden="true" />
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
                    {v.replaceAll('_', ' ')}
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
            {owner && <button className={styles.primary}>Save reviewed policy</button>}
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
            <ChevronDown size={18} aria-hidden="true" />
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
            operationally available; client-visible controls public display. Client Panel Controls
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
          <Image src={BRAND.logo.src} alt="Zion Events Place" width={96} height={96} />
        </div>
        <div className={styles.profileSummaryBody}>
          <AdminAvatar user={user} size="profile" />
          <h2>{displayName}</h2>
          <span className={styles.profileRoleBadge}>
            <ShieldCheck size={13} />
            {roleLabel}
          </span>
          <dl>
            <div>
              <dt>
                <Mail size={14} />
                Email address
              </dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>
                <Phone size={14} />
                Contact number
              </dt>
              <dd>{user.contactNumber || 'Not provided'}</dd>
            </div>
            <div>
              <dt>
                <UserRound size={14} />
                Username
              </dt>
              <dd>{user.username}</dd>
            </div>
            <div>
              <dt>
                <ShieldCheck size={14} />
                Account status
              </dt>
              <dd>
                <span
                  className={`${styles.badge} ${user.status === 'ACTIVE' ? styles.good : styles.neutral}`}
                >
                  {user.status.replaceAll('_', ' ')}
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
            <span>
              <UserRound size={20} strokeWidth={1.65} />
            </span>
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
            <span>
              <LockKeyhole size={20} strokeWidth={1.65} />
            </span>
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
              <button className={styles.primary} disabled={busy}>
                <Save size={15} />
                {busy ? 'Saving…' : 'Save my profile'}
              </button>
            </div>
          </div>
        </section>
      </form>
    </div>
  );
}
