'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Fingerprint,
  GitBranch,
  LockKeyhole,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import styles from './developer.module.css';

export default function DeveloperLogin() {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <main className={styles.login}>
      <div className={styles.loginStory}>
        <div className={styles.wordmark}>
          <span>
            <Terminal size={23} />
          </span>
          <div>
            ZION<span>DEVELOPER SYSTEMS</span>
          </div>
        </div>
        <p className={styles.eyebrow}>PRIVATE CONTROL PLANE</p>
        <h1>
          One workspace.
          <br />
          Every connection.
        </h1>
        <p>Orchestration, approved knowledge, and the infrastructure behind every experience.</p>
        <div className={styles.network} aria-hidden="true">
          <span>
            <Terminal />
            Client
          </span>
          <i />
          <span>
            <GitBranch />
            Orchestration
          </span>
          <i />
          <span>
            <ShieldCheck />
            Admin
          </span>
        </div>
        <div className={styles.loginFoot}>
          <ShieldCheck size={17} /> Independently authenticated. Explicitly authorized.
        </div>
      </div>
      <section className={styles.loginCard} aria-labelledby="developer-signin">
        <div className={styles.largeIcon}>
          <Fingerprint size={30} />
        </div>
        <p className={styles.eyebrow}>RESTRICTED ACCESS</p>
        <h2 id="developer-signin">Developer sign-in</h2>
        <p>Use your provisioned developer credentials and authenticator.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            const f = new FormData(e.currentTarget);
            try {
              const r = await fetch('/api/developer/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: f.get('email'),
                  password: f.get('password'),
                  code: f.get('code'),
                }),
              });
              const result = (await r.json()) as { error?: string };
              if (!r.ok) throw new Error(result.error || 'Unable to sign in.');
              router.replace('/developer');
              router.refresh();
            } catch (reason) {
              setError(reason instanceof Error ? reason.message : 'Unable to sign in.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Developer email
            <input
              type="email"
              name="email"
              autoComplete="username"
              maxLength={254}
              required
              placeholder="you@your-team.com"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              maxLength={128}
              required
            />
          </label>
          <label>
            Authenticator code
            <input
              type="text"
              name="code"
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
              placeholder="6-digit code"
            />
          </label>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <button className={styles.primary} disabled={busy}>
            {busy ? 'Verifying access…' : 'Enter command center'}
            <ArrowRight size={17} />
          </button>
        </form>
        <p className={styles.loginNote}>
          <LockKeyhole size={15} />
          Access is provisioned by a system operator. Admin and client accounts cannot sign in here.
        </p>
      </section>
    </main>
  );
}
