'use client';
import styles from '@/components/admin/admin.module.css';
import { Button } from '@/components/shared/Button';

export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <section role="alert" className={styles.card}>
      <h1>Admin workspace unavailable</h1>
      <p>
        Check the database connection and administrator authentication configuration. No client data
        was changed.
      </p>
      <Button type="button" variant="primary" onClick={reset}>
        Try again
      </Button>
    </section>
  );
}
