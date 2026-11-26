import type { ReactNode } from 'react';
import styles from './admin.module.css';

/**
 * The header every admin page shares (docs/admin-design.md): the page title, at most one short
 * status line with facts staff need, and the page's actions on the right, with at most one
 * primary button. Filters or a toolbar come next on the page, then the content. The dashboard
 * greets instead of showing its title (`intro`); the title stays for screen readers.
 */
export default function AdminPageHeader({
  title,
  titleId,
  status,
  actions,
  intro,
}: {
  title: string;
  titleId?: string;
  status?: ReactNode;
  actions?: ReactNode;
  intro?: ReactNode;
}) {
  return (
    <div className={styles.pageHeading}>
      <div className={styles.pageIntro}>
        <h1 id={titleId} className={intro ? styles.srOnly : styles.pageTitle}>
          {title}
        </h1>
        {intro}
        {status ? <p className={styles.pageContext}>{status}</p> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
}
