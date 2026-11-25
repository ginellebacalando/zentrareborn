import styles from './admin.module.css';

/** A stored enum value in sentence case for display: "PENDING_REVIEW" becomes "Pending review". */
export function enumLabel(value: string) {
  const words = value.replaceAll('_', ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

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
  return <span className={`${styles.badge} ${tone}`}>{enumLabel(value)}</span>;
}
