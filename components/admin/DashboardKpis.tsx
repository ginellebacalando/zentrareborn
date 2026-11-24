import { Fragment } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import type { DashboardKpi, DashboardKpis as Summary } from '@/lib/admin/dashboard-kpi-types';
import type { DashboardMonth } from '@/lib/admin/dashboard-types';
import { changePercent } from '@/lib/admin/analytics-math';
import { compactReportCash, reportDates, reportTimestamp } from '@/lib/admin/analytics-export';
import { money } from '@/lib/admin/domain';
import { Sparkline } from './ChartPrimitives';
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

function ChangeBadge({ metric, complete }: { metric: DashboardKpi; complete: boolean }) {
  const delta = metric.current - metric.previous;
  const Icon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus;
  return (
    <span className={styles.badge}>
      {complete && <Icon size={14} aria-hidden="true" />}
      {complete ? percentage(changePercent(metric.current, metric.previous)) : '—'}
    </span>
  );
}

/**
 * Teal KPI cards with small trend lines (Figma). Values and comparisons are the existing KPI
 * contract (docs/dashboard-kpi-contract.md). Trend lines use the closest real monthly series and
 * name it, because a monthly series is not always the same measure as the card's total.
 */
export default function DashboardKpis({
  summary,
  months = [],
}: {
  summary?: Summary;
  months?: DashboardMonth[];
}) {
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
  const recent = months.slice(-6);
  const trend = (label: string, values: number[]) =>
    recent.length > 1 ? { label, values } : undefined;
  const cards = [
    {
      key: 'sales',
      label: 'Total revenue',
      metric: summary.sales,
      cash: true,
      complete: dated,
      period: `${year} · Year to date`,
      scope: `${year} year to date · secured contract value`,
      activity: `Prior year, same elapsed period: ${money(summary.sales.previous)}`,
      href: '/admin/analytics',
      trend: trend(
        'Cash received by month',
        recent.map((month) => month.cashCents),
      ),
    },
    {
      key: 'bookings',
      label: 'Total bookings',
      metric: summary.bookings,
      cash: false,
      complete: dated,
      period: 'All time',
      scope: 'All confirmed & completed bookings',
      activity: `Newly secured · ${year} YTD: ${count(summary.bookings.current)} · ${previousYear} YTD: ${count(summary.bookings.previous)}`,
      href: '/admin/bookings',
      trend: trend(
        'Confirmations by month',
        recent.map((month) => month.confirmed),
      ),
    },
    {
      key: 'upcoming',
      label: 'Upcoming events',
      metric: summary.upcoming,
      cash: false,
      complete: true,
      period: 'From today',
      scope: 'Confirmed · starting now or later',
      activity: `Scheduled dates · next 30 days: ${count(summary.upcoming.current)} · previous 30: ${count(summary.upcoming.previous)}`,
      href: '/admin/calendar',
      trend: undefined,
    },
    {
      key: 'pending',
      label: 'Pending inquiries',
      metric: summary.pending,
      cash: false,
      complete: linked,
      period: 'Open now',
      scope: 'Open inquiries without a secured booking',
      activity: `Unresolved intake · ${year} YTD: ${count(summary.pending.current)} · ${previousYear} YTD: ${count(summary.pending.previous)}`,
      href: '/admin/inquiries',
      trend: trend(
        'Inquiries received by month',
        recent.map((month) => month.inquiries),
      ),
    },
  ];
  return (
    <section aria-labelledby="dashboard-kpi-title" className={styles.section}>
      <h3 id="dashboard-kpi-title" className={admin.srOnly}>
        Business totals
      </h3>
      <div className={styles.grid}>
        {cards.map((card) => {
          const unavailable = card.key === 'sales' && !dated;
          const upperBound = card.key === 'pending' && !linked;
          const trendText = card.trend
            ? ` Trend, ${card.trend.label.toLowerCase()}, last ${recent.length} months: ${card.trend.values
                .map((value) => (card.cash ? money(value) : count(value)))
                .join(', ')}.`
            : '';
          return (
            <Link
              key={card.key}
              href={card.href}
              className={styles.kpi}
              aria-label={`${card.label}: ${unavailable ? `annual total unavailable; known dated value ${money(card.metric.value)}` : `${upperBound ? 'up to ' : ''}${number(card.metric.value, card.cash)}`}. ${card.scope}. ${card.activity}. ${changeDescription(card.metric, card.cash, card.complete, card.key === 'pending')}.${trendText}`}
            >
              <span className={styles.label}>{card.label}</span>
              <span className={styles.value}>
                {upperBound && <span className={styles.qualifier}>Up to</span>}
                <strong>{unavailable ? '—' : compactNumber(card.metric.value, card.cash)}</strong>
              </span>
              <span className={styles.period}>{card.period}</span>
              <span className={styles.footer}>
                <ChangeBadge metric={card.metric} complete={card.complete} />
                {card.trend ? (
                  <span className={styles.trend}>
                    <Sparkline values={card.trend.values} />
                    <span>{card.trend.label}</span>
                  </span>
                ) : (
                  <span className={styles.trend}>
                    <span>Next 30 days: {count(summary.upcoming.current)}</span>
                  </span>
                )}
              </span>
              {!dated && (card.key === 'sales' || card.key === 'bookings') && (
                <span className={styles.quality}>Confirmation history incomplete</span>
              )}
              {upperBound && <span className={styles.quality}>Inquiry links incomplete</span>}
            </Link>
          );
        })}
      </div>
      <div className={admin.srOnly}>
        <h4>Metric definitions</h4>
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
