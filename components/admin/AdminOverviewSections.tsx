import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { AdminData } from './types';
import styles from './admin.module.css';
import { Badge } from './AdminBadge';
import { useAdminDate } from './AdminPreferencesProvider';

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
  const recordLabel =
    section === 'team'
      ? total === 1
        ? 'member'
        : 'members'
      : total === 1
        ? 'inquiry'
        : 'inquiries';
  return (
    <div className={styles.card}>
      <div className={styles.cardHeading}>
        <h2>{section === 'team' ? 'Admin directory' : 'Business inquiries'}</h2>
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
                <span className={styles.badge}>{inquiry.status?.replaceAll('_', ' ')}</span>
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
              <Link
                className={styles.secondary}
                href={`/admin/bookings?inquiry=${encodeURIComponent(inquiry.id || '')}`}
              >
                Review as booking request
                <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </details>
          ))}
          {!data.inquiries?.length && <p>No business inquiries yet.</p>}
        </>
      )}
      {section === 'team' && (
        <>
          <ul className={styles.directoryGrid}>
            {data.team?.map((member) => (
              <li key={member.id}>
                <h3>{member.fullName || member.username}</h3>
                <small>{member.username}</small>
                <p>{member.email}</p>
                <dl>
                  <dt>Role</dt>
                  <dd>{member.role === 'SUPERADMIN' ? 'Super administrator' : 'Administrator'}</dd>
                  <dt>Status</dt>
                  <dd>
                    <Badge value={member.status} />
                  </dd>
                </dl>
              </li>
            ))}
          </ul>
          {!data.team?.length && <p>No administrators found.</p>}
        </>
      )}
      {total > 50 && (
        <div className={styles.pagination}>
          <span>
            Page {page} of {Math.ceil(total / 50)}
          </span>
          <button
            className={styles.secondary}
            disabled={page <= 1 || loading}
            onClick={() => onPage(page - 1)}
          >
            Previous
          </button>
          <button
            className={styles.secondary}
            disabled={page * 50 >= total || loading}
            onClick={() => onPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
