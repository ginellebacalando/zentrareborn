import { ArrowUpRight } from 'lucide-react';
import type { AdminData } from './types';
import styles from './admin.module.css';
import { enumLabel } from './AdminBadge';
import { useAdminDate } from './AdminPreferencesProvider';
import { Button, ButtonLink } from '@/components/shared/Button';

export default function AdminOverviewSections({
  section,
  data,
  loading,
  onPage,
}: {
  section: string;
  data: AdminData;
  loading: boolean;
  onPage: (page: number) => void;
}) {
  const eventDate = useAdminDate();
  const page = data.page ?? 1;
  const total = data.total ?? 0;
  const recordLabel = total === 1 ? 'inquiry' : 'inquiries';
  return (
    <div className={styles.card}>
      <div className={styles.cardHeading}>
        <h2>Inbox</h2>
        <span>
          {total} {recordLabel}
        </span>
      </div>
      {section === 'inquiries' && (
        <>
          {data.inquiries?.map((inquiry) => (
            <details key={inquiry.id} className={styles.noticeRow}>
              <summary>
                <span>
                  <strong>{inquiry.fullName}</strong>
                  <small>
                    {inquiry.inquiryReference} · {inquiry.eventInterest || 'General inquiry'}
                  </small>
                </span>
                <span className={`${styles.badge} ${styles.neutral}`}>
                  {inquiry.status ? enumLabel(inquiry.status) : ''}
                </span>
              </summary>
              <dl>
                <dt>Contact</dt>
                <dd>
                  {inquiry.email}
                  {inquiry.phoneNumber ? ` · ${inquiry.phoneNumber}` : ''}
                </dd>
                <dt>Event / package</dt>
                <dd>
                  {inquiry.eventInterest || 'Not specified'} ·{' '}
                  {inquiry.packageInterest || 'No package selected'}
                </dd>
                {inquiry.requestedEventDate && (
                  <>
                    <dt>Requested date</dt>
                    <dd>{eventDate(inquiry.requestedEventDate)}</dd>
                  </>
                )}
                {inquiry.submittedAt && (
                  <>
                    <dt>Received</dt>
                    <dd>{eventDate(inquiry.submittedAt)}</dd>
                  </>
                )}
              </dl>
              <p>{inquiry.message}</p>
              <ButtonLink
                variant="secondary"
                href={`/admin/bookings?inquiry=${encodeURIComponent(inquiry.id || '')}`}
              >
                Review as booking request
                <ArrowUpRight size={16} aria-hidden="true" />
              </ButtonLink>
            </details>
          ))}
          {!data.inquiries?.length && (
            <div className={styles.empty}>
              <h3>Nothing in the inbox yet</h3>
              <p>Messages sent from the website contact form appear here.</p>
            </div>
          )}
        </>
      )}
      {total > 50 && (
        <div className={styles.pagination}>
          <span>
            Page {page} of {Math.ceil(total / 50)}
          </span>
          <Button
            type="button"
            variant="secondary"
            disabled={page <= 1 || loading}
            onClick={() => onPage(page - 1)}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={page * 50 >= total || loading}
            onClick={() => onPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
