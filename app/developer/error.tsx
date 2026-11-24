'use client';
import styles from '@/components/developer/developer.module.css';
export default function DeveloperError({ reset }: { reset: () => void }) {
  return (
    <main className={styles.login}>
      <section className={styles.loginCard}>
        <p className={styles.eyebrow}>DEVELOPER WORKSPACE</p>
        <h1>Workspace unavailable</h1>
        <p>Check the developer schema and server configuration, then try again.</p>
        <button onClick={reset}>Try again</button>
      </section>
    </main>
  );
}
