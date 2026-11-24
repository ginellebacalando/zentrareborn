import Link from 'next/link';
import {
  displayStatusDescriptions,
  displayStatusLabels,
  displayStatuses,
} from '@/lib/admin/dashboard-status';
import type { DashboardInsights } from '@/lib/admin/dashboard-types';
import { StatusDot, statusTone } from './BookingStatus';
import styles from './DashboardKpis.module.css';

/**
 * Figma's white KPI cards: status-coloured border and dot, uppercase label, large number and the
 * period. Counts are real: bookings whose event starts in the current Manila month, grouped by
 * display status (lib/admin/dashboard-status.ts).
 */
export default function DashboardStatusCards({ month }: { month: DashboardInsights['thisMonth'] }) {
  return (
    <ul className={styles.statusCards} aria-label={`Bookings with events in ${month.label}`}>
      {displayStatuses.map((status) => {
        const value = month.statuses[status];
        return (
          <li key={status}>
            <Link
              href={`/admin/bookings?status=${status}`}
              className={`${styles.statusCard} ${statusTone[status]}`}
              aria-label={`${displayStatusLabels[status]}: ${value.toLocaleString('en-PH')} ${value === 1 ? 'booking' : 'bookings'} with events in ${month.label}. ${displayStatusDescriptions[status]}. Show in Bookings.`}
            >
              <span className={styles.statusLabel}>
                <StatusDot status={status} />
                {displayStatusLabels[status]}
              </span>
              <strong className={styles.statusValue}>{value.toLocaleString('en-PH')}</strong>
              <span className={styles.period}>{month.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
