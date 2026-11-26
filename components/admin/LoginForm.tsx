'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import ZentraWordmark from '@/components/shared/ZentraWordmark';
import styles from './admin.module.css';
import { Button } from '@/components/shared/Button';
export default function LoginForm({
  localAccessToken = null,
}: {
  localAccessToken?: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const localAccessStarted = useRef(false);

  useEffect(() => {
    function openLocalWorkspace() {
      const match = /^#local-access=([\w-]{43})$/.exec(window.location.hash);
      const token = match?.[1] || localAccessToken;
      if (!token || localAccessStarted.current) return;
      localAccessStarted.current = true;
      // The fragment keeps the temporary access token out of server URL logs.
      window.history.replaceState(null, '', window.location.pathname);
      void signIn('credentials', {
        localAccessToken: token,
        redirect: false,
      })
        .then((result) => {
          if (result?.error) {
            setError('Temporary local access is unavailable or has expired.');
            return;
          }
          router.replace('/admin/dashboard');
          router.refresh();
        })
        .catch(() => {
          setError('Unable to open the local workspace. Check the development server.');
        });
    }
    openLocalWorkspace();
    window.addEventListener('hashchange', openLocalWorkspace);
    return () => window.removeEventListener('hashchange', openLocalWorkspace);
  }, [router, localAccessToken]);

  if (localAccessToken) {
    return (
      <main id="main-content" tabIndex={-1} className={`${styles.root} ${styles.login}`}>
        <div className={styles.loginCard}>
          <ZentraWordmark subtitle="Admin" size="md" className={styles.loginWordmark} />
          <h1>{error ? 'Unable to open admin' : 'Opening admin panel…'}</h1>
          <p role={error ? 'alert' : 'status'}>
            {error || 'Your workspace will be ready in a moment.'}
          </p>
          {error && (
            <Button type="button" variant="primary" onClick={() => window.location.reload()}>
              Try again
            </Button>
          )}
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" tabIndex={-1} className={`${styles.root} ${styles.login}`}>
      <div className={styles.loginCard}>
        <ZentraWordmark subtitle="Admin" size="md" className={styles.loginWordmark} />
        <h1>Sign in</h1>
        <p>Use your administrator account for venue operations.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            const f = new FormData(e.currentTarget);
            try {
              const result = await signIn('credentials', {
                email: f.get('email'),
                password: f.get('password'),
                redirect: false,
              });
              if (result?.error)
                setError(
                  'Unable to sign in. Check your credentials or contact the account owner. Too many attempts are temporarily limited.',
                );
              else {
                router.replace('/admin/dashboard');
                router.refresh();
              }
            } catch {
              setError('Sign-in is unavailable. Check authentication and database setup.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Email or username
            <input
              name="email"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              maxLength={255}
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
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
            loadingLabel="Signing in…"
            iconEnd={<ArrowRight aria-hidden="true" />}
          >
            Sign in securely
          </Button>
        </form>
        <p className={styles.loginNote}>
          <ShieldCheck size={16} aria-hidden="true" />
          Authorized venue staff only. No public registration; ask the venue owner for access.
        </p>
        <Link href="/" className={styles.loginBack}>
          ← Back to the website
        </Link>
      </div>
    </main>
  );
}
