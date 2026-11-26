import { Lock } from 'lucide-react';
import styles from '@/components/admin/admin.module.css';
import { ButtonLink } from '@/components/shared/Button';

/**
 * Shown, with a 403 status, when a role opens an admin page it may not use (forbidden() in
 * lib/admin/page-access.ts). The sidebar stays, so the way back is in view.
 */
export default function Forbidden() {
  return (
    <section className={styles.card} aria-labelledby="no-access-title">
      <div className={styles.empty}>
        <Lock size={20} aria-hidden="true" />
        <h1 id="no-access-title" className={styles.noAccessTitle}>
          You don&apos;t have access
        </h1>
        <p>
          This page is for super administrators. If you need it for your work, ask one of them to
          change your access.
        </p>
        <ButtonLink href="/admin/dashboard" variant="primary">
          Go to the dashboard
        </ButtonLink>
      </div>
    </section>
  );
}
