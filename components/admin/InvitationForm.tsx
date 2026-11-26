'use client';

import { useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import ZentraWordmark from '@/components/shared/ZentraWordmark';
import type { InvitationView } from '@/lib/admin/invitations';
import styles from './admin.module.css';
import { Button, ButtonLink } from '@/components/shared/Button';

const ENDED: Record<Exclude<InvitationView['state'], 'valid'>, { title: string; text: string }> = {
  expired: {
    title: 'This invitation has expired',
    text: 'Invitation links work for three days. Ask a super administrator to send you a new one.',
  },
  used: {
    title: 'This invitation was already used',
    text: 'Your account is set up. Sign in with your email address and password.',
  },
  invalid: {
    title: 'This link is not valid',
    text: 'Check that you opened the whole link from your invitation email, or ask for a new one.',
  },
};

/** The invited administrator chooses a password, then signs in (lib/admin/invitations.ts). */
export default function InvitationForm({
  token,
  invitation,
}: {
  token: string;
  invitation: InvitationView;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (invitation.state !== 'valid' || done) {
    const copy = done
      ? {
          title: 'Your account is ready',
          text: 'Sign in with your email address and the password you just chose.',
        }
      : ENDED[invitation.state as keyof typeof ENDED];
    return (
      <main id="main-content" tabIndex={-1} className={`${styles.root} ${styles.login}`}>
        <div className={styles.loginCard}>
          <ZentraWordmark subtitle="Admin" size="md" className={styles.loginWordmark} />
          <h1>{copy.title}</h1>
          <p role={done ? 'status' : undefined}>{copy.text}</p>
          <ButtonLink href="/admin" variant="primary" iconEnd={<ArrowRight aria-hidden="true" />}>
            Go to sign in
          </ButtonLink>
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" tabIndex={-1} className={`${styles.root} ${styles.login}`}>
      <div className={styles.loginCard}>
        <ZentraWordmark subtitle="Admin" size="md" className={styles.loginWordmark} />
        <h1>Set up your account</h1>
        <p>
          Welcome, {invitation.fullName}. You were invited as {invitation.roleLabel} for{' '}
          {invitation.email}. Choose a password to finish.
        </p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const password = String(form.get('password') ?? '');
            if (password !== String(form.get('confirm') ?? '')) {
              setError('The two passwords do not match.');
              return;
            }
            setBusy(true);
            setError('');
            try {
              const response = await fetch('/api/admin/invitation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
              });
              const payload = (await response.json().catch(() => ({}))) as { error?: string };
              if (!response.ok) setError(payload.error || 'Account setup failed. Try again.');
              else setDone(true);
            } catch {
              setError('Account setup is unavailable right now. Try again later.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            New password
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              aria-describedby="invitation-password-rule"
            />
          </label>
          <p id="invitation-password-rule" className={styles.loginHint}>
            At least 12 characters. A short phrase is easier to remember.
          </p>
          <label>
            Confirm password
            <input
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
            />
          </label>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            variant="primary"
            block
            loading={busy}
            loadingLabel="Saving…"
            iconEnd={<ArrowRight aria-hidden="true" />}
          >
            Create my password
          </Button>
        </form>
        <p className={styles.loginNote}>
          <ShieldCheck size={16} aria-hidden="true" />
          The link works once and expires on{' '}
          {new Intl.DateTimeFormat('en-PH', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'Asia/Manila',
          }).format(new Date(invitation.expiresAt))}
          .
        </p>
      </div>
    </main>
  );
}
