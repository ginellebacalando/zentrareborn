import { Fragment } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import type { DashboardKpi, DashboardKpis as Summary } from '@/lib/admin/dashboard-kpi-types';
import { changePercent } from '@/lib/admin/analytics-math';
import { compactReportCash, reportDates, reportTimestamp } from '@/lib/admin/analytics-export';
import { money } from '@/lib/admin/domain';
import admin from './admin.module.css';
import styles from './DashboardKpis.module.css';

const count = (value: number) => value.toLocaleString('en-PH');
const number = (value: number, cash: boolean) => (cash ? money(value) : count(value));
const compactNumber = (value: number, cash: boolean) =>
  cash && value >= 1_000_000 ? compactReportCash(value) : number(value, cash);

function percentage(value: number | null) {
  if (value === null) return 'New';
  if (value !== 0 && Math.abs(value) < 0.1) return '<0.1%';
  return `${Math.abs(value).toLocaleString('en-PH', { maximumFractionDigits: 1 })}%`;
}

function ExactMoney({ cents }: { cents: number }) {
  return (
    <>
      {money(cents)
        .split(',')
        .map((part, index, parts) => (
          <Fragment key={index}>
            {part}
            {index < parts.length - 1 && (
              <>
                ,<wbr />
              </>
            )}
          </Fragment>
        ))}
    </>
  );
}

function changeDescription(
  metric: DashboardKpi,
  cash: boolean,
  complete: boolean,
  pending: boolean,
) {
  if (!complete) return 'Comparison unavailable · incomplete history';
  const delta = metric.current - metric.previous;
  const percent = changePercent(metric.current, metric.previous);
  const direction =
    delta > 0
      ? pending
        ? 'More unresolved'
        : 'Up'
      : delta < 0
        ? pending
          ? 'Fewer unresolved'
          : 'Down'
        : 'No change';
  const percentLabel = percent === null ? 'new activity; no prior baseline' : percentage(percent);
  return `${direction} · ${delta > 0 ? '+' : delta < 0 ? '−' : ''}${number(Math.abs(delta), cash)} (${percentLabel})`;
}

function ChangeBadge({
  metric,
  complete,
  pending,
}: {
  metric: DashboardKpi;
  complete: boolean;
  pending: boolean;
}) {
  const delta = metric.current - metric.previous;
  const Icon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus;
  const improving = complete && (pending ? delta < 0 : delta > 0);
  return (
    <span className={`${styles.badge} ${improving ? styles.improving : ''}`}>
      {complete && <Icon size={14} aria-hidden="true" />}
      {complete ? percentage(changePercent(metric.current, metric.previous)) : '—'}
    </span>
  );
}

export default function DashboardKpis({ summary }: { summary?: Summary }) {
  if (!summary)
    return (
      <div className={admin.card} role="status">
        Loading business overview…
      </div>
    );
  const { year, quality } = summary;
  const previousYear = year - 1;
  const dated = quality.undatedSecuredBookings === 0;
  const linked = quality.untrackedSecuredBookings === 0 || summary.pending.value === 0;
  const cards = [
    {
      key: 'sales',
      label: 'Total Revenue',
      metric: summary.sales,
      cash: true,
      complete: dated,
      scope: `${year} year to date · secured contract value`,
      activity: `Prior year, same elapsed period: ${money(summary.sales.previous)}`,
      href: '/admin/analytics',
    },
    {
      key: 'bookings',
      label: 'Total Bookings',
      metric: summary.bookings,
      cash: false,
      complete: dated,
      scope: 'All confirmed & completed bookings',
      activity: `Newly secured · ${year} YTD: ${count(summary.bookings.current)} · ${previousYear} YTD: ${count(summary.bookings.previous)}`,
      href: '/admin/bookings',
    },
    {
      key: 'upcoming',
      label: 'Upcoming Events',
      metric: summary.upcoming,
      cash: false,
      complete: true,
      scope: 'Confirmed · starting now or later',
      activity: `Scheduled dates · next 30 days: ${count(summary.upcoming.current)} · previous 30: ${count(summary.upcoming.previous)}`,
      href: '/admin/calendar',
    },
    {
      key: 'pending',
      label: 'Pending Inquiries',
      metric: summary.pending,
      cash: false,
      complete: linked,
      scope: 'Open inquiries without a secured booking',
      activity: `Unresolved intake · ${year} YTD: ${count(summary.pending.current)} · ${previousYear} YTD: ${count(summary.pending.previous)}`,
      href: '/admin/inquiries',
    },
  ];
  return (
    <section aria-labelledby="dashboard-kpi-title" className={styles.section}>
      <h2 id="dashboard-kpi-title" className={admin.srOnly}>
        Business overview
      </h2>
      <div className={`${admin.metrics} ${styles.grid}`}>
        {cards.map((card) => {
          const unavailable = card.key === 'sales' && !dated;
          const upperBound = card.key === 'pending' && !linked;
          return (
            <Link
              key={card.key}
              href={card.href}
              className={`${styles.card} ${card.key === 'sales' ? styles.sales : ''}`}
              aria-label={`${card.label}: ${unavailable ? `annual total unavailable; known dated value ${money(card.metric.value)}` : `${upperBound ? 'up to ' : ''}${number(card.metric.value, card.cash)}`}. ${card.scope}. ${card.activity}. ${changeDescription(card.metric, card.cash, card.complete, card.key === 'pending')}`}
            >
              <span className={styles.label}>{card.label}</span>
              <div className={styles.amountRow}>
                <div className={styles.value}>
                  {upperBound && <span className={styles.qualifier}>Up to</span>}
                  <strong>{unavailable ? '—' : compactNumber(card.metric.value, card.cash)}</strong>
                </div>
                <ChangeBadge
                  metric={card.metric}
                  complete={card.complete}
                  pending={card.key === 'pending'}
                />
              </div>
              {!dated && (card.key === 'sales' || card.key === 'bookings') && (
                <p className={styles.quality}>Confirmation history incomplete</p>
              )}
              {upperBound && <p className={styles.quality}>Inquiry links incomplete</p>}
            </Link>
          );
        })}
      </div>
      <div className={admin.srOnly}>
        <h3>Metric definitions</h3>
        <p>As of {reportTimestamp(summary.asOf)} · Manila time</p>
        <dl>
          {cards.map((card) => (
            <Fragment key={card.key}>
              <dt>{card.label}</dt>
              <dd>
                {card.key === 'sales' && !dated
                  ? 'Annual total unavailable; known dated value: '
                  : card.key === 'pending' && !linked
                    ? 'Up to '
                    : ''}
                {card.cash ? <ExactMoney cents={card.metric.value} /> : count(card.metric.value)}.{' '}
                {card.scope}. {card.activity}.{' '}
                {changeDescription(card.metric, card.cash, card.complete, card.key === 'pending')}.
              </dd>
            </Fragment>
          ))}
          <dt>Annual comparison</dt>
          <dd>
            {reportDates(summary.annual.current)} versus {reportDates(summary.annual.comparison)}.
          </dd>
          <dt>Revenue & total bookings</dt>
          <dd>
            Revenue accumulates secured contract value in the current calendar year. Annual activity
            uses the first recorded confirmation date of currently confirmed/completed bookings;
            cancelled bookings are excluded. Total bookings is the current all-time secured count.
          </dd>
          <dt>Pending inquiries</dt>
          <dd>
            Closed/spam inquiries and inquiries with a verified secured booking link are excluded.
            Year-to-date figures compare received inquiry cohorts using their current outcomes, not
            historical backlog snapshots. More unresolved inquiries indicates review workload, not
            proof of business growth.
          </dd>
          <dt>Upcoming comparison</dt>
          <dd>
            {reportDates(summary.outlook.current)} versus {reportDates(summary.outlook.comparison)}.
            Future confirmed dates are compared with booked dates in the preceding 30 days,
            including completed bookings. The main total includes all future confirmed bookings.
          </dd>
        </dl>
      </div>
    </section>
  );
}
