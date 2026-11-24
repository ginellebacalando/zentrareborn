import { displayStatusLabels, type DisplayStatus } from '@/lib/admin/dashboard-status';
import styles from './admin.module.css';

/** Sets the --status, --status-soft and --status-ink custom properties for a display status. */
export const statusTone: Record<DisplayStatus, string> = {
  request: styles.toneRequest,
  pending: styles.tonePending,
  confirmed: styles.toneConfirmed,
  cancelled: styles.toneCancelled,
};

/** Decorative colour cue; always render the status text next to it. */
export function StatusDot({ status }: { status: DisplayStatus }) {
  return <span className={`${styles.statusDot} ${statusTone[status]}`} aria-hidden="true" />;
}

export function StatusChip({ status }: { status: DisplayStatus }) {
  return (
    <span className={`${styles.statusChip} ${statusTone[status]}`}>
      <StatusDot status={status} />
      {displayStatusLabels[status]}
    </span>
  );
}
