'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  Star,
  Trash2,
} from 'lucide-react';
import { displayStatus } from '@/lib/admin/dashboard-status';
import { TESTIMONY_HOLD_ANCHOR } from '@/lib/admin/website-activity-feed';
import { StatusChip } from './BookingStatus';
import DashboardCharts from './DashboardCharts';
import DashboardKpis from './DashboardKpis';
import DashboardStatusCards from './DashboardStatusCards';
import WebsiteActivity, { refreshWebsiteActivity } from './WebsiteActivity';
import { useAdminDate } from './AdminPreferencesProvider';
import type { AdminData, Mutate } from './types';
import styles from './admin.module.css';

export default function DashboardOverview({
  data,
  busy,
  mutate,
}: {
  data: AdminData;
  busy: boolean;
  mutate: Mutate;
}) {
  const eventDate = useAdminDate();
  const heldTestimonies = data.heldTestimonies ?? [];
  const [actingId, setActingId] = useState<string | null>(null);
  const insights = data.dashboardInsights;

  const handleTestimonyDecision = async (id: string, action: 'ALLOW' | 'DELETE') => {
    setActingId(id);
    try {
      await mutate('dashboard', { op: 'testimony-action', id, action });
      // A moderated testimony leaves the Website activity list too.
      void refreshWebsiteActivity();
    } catch {
      // The workspace shows the error; the item stays on hold.
    } finally {
      setActingId(null);
    }
  };
  return (
    <>
      <section className={styles.overview} aria-labelledby="performance-title">
        <h2 id="performance-title" className={styles.srOnly}>
          Overview
        </h2>
        <DashboardKpis summary={data.dashboardKpis} months={insights?.months} />
        {insights && <DashboardStatusCards month={insights.thisMonth} />}
      </section>
      <div className={styles.dashboardGrid}>
        <div className={styles.dashboardColumn}>
          <WebsiteActivity />
          <div className={styles.card}>
            <div className={styles.cardHeading}>
              {/* Target of the Website activity links; focusable so keyboard focus can land here. */}
              <h2 id={TESTIMONY_HOLD_ANCHOR} tabIndex={-1}>
                Testimonies on hold
              </h2>
              <span
                className={
                  heldTestimonies.length > 0
                    ? styles.testimonyHoldCountRed
                    : styles.testimonyHoldCountClear
                }
              >
                {heldTestimonies.length > 0
                  ? `${heldTestimonies.length} flagged on hold`
                  : 'All clear'}
              </span>
            </div>
            {heldTestimonies.length > 0 ? (
              <div className={styles.testimonyHoldList}>
                {heldTestimonies.map((item) => {
                  const isItemBusy = busy || actingId === item.id;
                  return (
                    <article className={styles.testimonyHoldItem} key={item.id}>
                      <div className={styles.testimonyHoldTop}>
                        <div className={styles.grow}>
                          <div className={styles.testimonyHoldTitleRow}>
                            <strong>{item.clientName}</strong>
                            <span className={styles.testimonyRedTag}>
                              <ShieldAlert size={13} aria-hidden="true" />
                              Red · On Hold
                            </span>
                          </div>
                          <small>
                            {item.eventType} · {eventDate(item.eventDate)} ·{' '}
                            <span className={styles.testimonyRatingInline}>
                              <Star size={12} aria-hidden="true" />
                              {item.overallRating}/5
                            </span>
                          </small>
                        </div>
                      </div>

                      <div className={styles.testimonyReasonRow}>
                        {item.flagReasons.map((reason) => (
                          <span className={styles.testimonyReasonChip} key={reason}>
                            {reason}
                          </span>
                        ))}
                      </div>

                      <p className={styles.testimonyHoldComment}>&ldquo;{item.comment}&rdquo;</p>

                      {item.photoUrl && (
                        <div className={styles.testimonyPhotoPreview}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.photoUrl}
                            alt={`Attachment from ${item.clientName}`}
                            className={styles.testimonyPhotoThumb}
                          />
                          <a
                            href={item.photoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.testimonyPhotoLink}
                          >
                            Inspect attached image
                            <ArrowUpRight size={13} aria-hidden="true" />
                          </a>
                        </div>
                      )}

                      <div className={styles.testimonyHoldActions}>
                        <button
                          type="button"
                          className={styles.testimonyAllowBtn}
                          disabled={isItemBusy}
                          aria-label={`Allow and publish testimony from ${item.clientName}`}
                          onClick={() => void handleTestimonyDecision(item.id, 'ALLOW')}
                        >
                          <CheckCircle2 size={15} aria-hidden="true" />
                          Allow &amp; Publish
                        </button>
                        <button
                          type="button"
                          className={styles.testimonyDeleteBtn}
                          disabled={isItemBusy}
                          aria-label={`Delete testimony from ${item.clientName}`}
                          onClick={() => void handleTestimonyDecision(item.id, 'DELETE')}
                        >
                          <Trash2 size={15} aria-hidden="true" />
                          Delete
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className={styles.quietNote}>
                <ShieldCheck size={16} aria-hidden="true" />
                Clean testimonies publish automatically; flagged ones wait here for your decision.
              </p>
            )}
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardHeading}>
            <h2>Coming up at Zion</h2>
            <Link href="/admin/calendar">
              View calendar <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </div>
          {data.upcoming?.map((b) => (
            <Link
              className={`${styles.row} ${styles.rowInteractive}`}
              key={b.id}
              href={`/admin/bookings?booking=${encodeURIComponent(b.id)}`}
            >
              <div className={styles.dateBlock}>
                {new Date(b.startsAt).toLocaleDateString('en-PH', {
                  timeZone: 'Asia/Manila',
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
              <div className={styles.grow}>
                <strong>
                  {b.eventType} · {b.clientName}
                </strong>
                <small>
                  {eventDate(b.startsAt)} · {b.guests} guests
                </small>
              </div>
              <StatusChip status={displayStatus(b)} />
              <ChevronRight size={16} className={styles.rowArrow} aria-hidden="true" />
            </Link>
          ))}
          {!data.upcoming?.length && (
            <div className={styles.empty}>
              <h3>No upcoming events</h3>
              <p>Confirmed reservations appear here.</p>
            </div>
          )}
        </div>
      </div>
      {insights && <DashboardCharts insights={insights} />}
    </>
  );
}
