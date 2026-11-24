import styles from './admin.module.css';

export function Badge({ value }: { value: string }) {
  const tone = [
    'CONFIRMED',
    'APPROVED',
    'VERIFIED',
    'PAID',
    'SIGNED',
    'SUCCESS',
    'ACCEPTED',
  ].includes(value)
    ? styles.good
    : ['FLAGGED', 'REJECTED', 'CANCELLED', 'FAILED', 'REVIEW_REQUIRED'].includes(value)
      ? styles.bad
      : styles.neutral;
  return <span className={`${styles.badge} ${tone}`}>{value.replaceAll('_', ' ')}</span>;
}
