'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { BRAND } from '@/config/brand';
import styles from './admin.module.css';
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
      <main id="main-content" tabIndex={-1} className={`${styles.root} ${styles.localOpening}`}>
        <div className={styles.loginCard}>
          <Image src={BRAND.logo.src} alt="Zion Events Place" width={70} height={70} />
          <h2>{error ? 'Unable to open admin' : 'Opening admin panel…'}</h2>
          <p role={error ? 'alert' : 'status'}>
            {error || 'Your workspace will be ready in a moment.'}
          </p>
          {error && (
            <button
              type="button"
              className={styles.primary}
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
          )}
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" tabIndex={-1} className={`${styles.root} ${styles.login}`}>
      <div className={styles.loginStory}>
        <Image src={BRAND.logo.src} alt="Zion Events Place" width={90} height={90} />
        <h1>
          Every celebration,
          <br />
          carefully managed.
        </h1>
        <p>A focused workspace for your bookings, agreements, schedule, and cash payments.</p>
        <div>
          <ShieldCheck size={20} /> Authorized venue staff only
        </div>
      </div>
      <div className={styles.loginCard}>
        <p className={styles.eyebrow}>VENUE OPERATIONS</p>
        <h2>Welcome back</h2>
        <p>Sign in with your administrator account.</p>
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
            Email address
            <input name="email" type="email" autoComplete="username" required maxLength={255} />
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
          <button className={styles.primary} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in securely'}
            <ArrowRight size={16} />
          </button>
        </form>
        <p className={styles.help}>No public registration. Ask the venue owner for access.</p>
        <Link href="/">← Back to the client website</Link>
      </div>
    </main>
  );
}
