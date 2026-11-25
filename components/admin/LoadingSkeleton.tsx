import styles from './admin.module.css';

/**
 * A calm placeholder in the shape of what is loading (a card, or the row of KPI cards). Screen
 * readers hear the label once through the status role; the bars are decorative.
 */
export default function LoadingSkeleton({
  label,
  variant = 'card',
}: {
  label: string;
  variant?: 'card' | 'metrics';
}) {
  if (variant === 'metrics')
    return (
      <div className={styles.skeletonMetrics} role="status">
        <span className={styles.srOnly}>{label}</span>
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className={styles.skeletonCard} aria-hidden="true">
            <span className={styles.skeletonLine} data-size="medium" />
            <span className={styles.skeletonLine} data-size="tall" />
            <span className={styles.skeletonLine} data-size="short" />
          </div>
        ))}
      </div>
    );
  return (
    <div className={`${styles.card} ${styles.skeletonCard}`} role="status">
      <span className={styles.srOnly}>{label}</span>
      <span className={styles.skeletonLine} data-size="short" aria-hidden="true" />
      <span className={styles.skeletonLine} aria-hidden="true" />
      <span className={styles.skeletonLine} data-size="medium" aria-hidden="true" />
      <span className={styles.skeletonLine} aria-hidden="true" />
    </div>
  );
}
