import { useId } from 'react';
import Link from 'next/link';
import {
  displayStatusDescriptions,
  displayStatusLabels,
  displayStatuses,
} from '@/lib/admin/dashboard-status';
import type { DashboardInsights } from '@/lib/admin/dashboard-types';
import { StatusDot } from './BookingStatus';
import admin from './admin.module.css';
import styles from './DashboardKpis.module.css';

/**
 * This month's bookings in one card: the month is named once, and each status cell (dot, label,
 * count) opens Bookings filtered to that status. Counts are real: bookings whose event starts in the
 * current Manila month, grouped by display status (lib/admin/dashboard-status.ts).
 */
export default function DashboardStatusCards({ month }: { month: DashboardInsights['thisMonth'] }) {
  const headingId = useId();
  return (
    <section className={`${admin.card} ${styles.month}`} aria-labelledby={headingId}>
      <div className={styles.monthHeading}>
        <h3 id={headingId}>Bookings this month</h3>
        <span>{month.label}</span>
      </div>
      <ul className={styles.statusCards}>
        {displayStatuses.map((status) => {
          const value = month.statuses[status];
          return (
            <li key={status}>
              <Link
                href={`/admin/bookings?status=${status}`}
                className={styles.statusCard}
                aria-label={`${displayStatusLabels[status]}: ${value.toLocaleString('en-PH')} ${value === 1 ? 'booking' : 'bookings'} with events in ${month.label}. ${displayStatusDescriptions[status]}. Show in Bookings.`}
              >
                <span className={styles.statusLabel}>
                  <StatusDot status={status} />
                  {displayStatusLabels[status]}
                </span>
                <strong className={styles.statusValue}>{value.toLocaleString('en-PH')}</strong>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
