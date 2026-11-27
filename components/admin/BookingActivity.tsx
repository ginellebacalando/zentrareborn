'use client';
import useSWR from 'swr';
import { useAdminDate } from './AdminPreferencesProvider';
import LoadingSkeleton from './LoadingSkeleton';
import type { Log } from './types';
import styles from './admin.module.css';
import page from './BookingDetail.module.css';

/**
 * The booking page's Activity tab: Activity log entries that name this booking's reference
 * (decisions, payments, emails, calendar changes), newest first. Only super administrators can
 * read the Activity log, so the tab is offered to them alone.
 */
export default function BookingActivity({ reference }: { reference: string }) {
  const eventDate = useAdminDate();
  const { data, error, isLoading } = useSWR<{ logs: Log[] }>(
    `/api/admin/logs?q=${encodeURIComponent(reference)}`,
    async (url: string) => {
      const response = await fetch(url, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to load the activity.');
      return body;
    },
  );
  if (isLoading) return <LoadingSkeleton label="Loading activity…" />;
  if (error)
    return (
      <p className={styles.error} role="alert">
        {error instanceof Error ? error.message : 'Unable to load the activity.'}
      </p>
    );
  const logs = data?.logs ?? [];
  if (!logs.length) return <p className={page.quiet}>No activity recorded for this booking yet.</p>;
  return (
    <ol className={page.activity} aria-label={`Activity for ${reference}`}>
      {logs.map((log) => (
        <li key={log.id}>
          <time dateTime={log.timestamp}>{eventDate(log.timestamp)}</time>
          <p>{log.description}</p>
          <small>
            {log.userName} · {log.module}
          </small>
        </li>
      ))}
    </ol>
  );
}
