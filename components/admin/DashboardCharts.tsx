'use client';

import { useId, useState } from 'react';
import {
  ChartDataTable as DataTable,
  BarChart,
  AreaChart,
  TrendChart,
  chartCount as count,
} from './ChartPrimitives';
import type { DashboardInsights, DashboardMonth } from '@/lib/admin/dashboard-types';
import { money } from '@/lib/admin/domain';
import styles from './DashboardCharts.module.css';
import admin from './admin.module.css';

/** The main chart (Metis' "Revenue overview"): cash received by receipt date, month by month. */
function CashChart({ months }: { months: DashboardMonth[] }) {
  const titleId = useId();
  const total = months.reduce((sum, month) => sum + month.cashCents, 0);
  return (
    <article className={`${admin.card} ${styles.card}`} aria-labelledby={titleId}>
      <div className={styles.cardHeading}>
        <div>
          <h3 id={titleId}>Cash collected</h3>
          <span className={styles.scope}>By receipt date, voided receipts excluded</span>
        </div>
        <span className={styles.total}>{money(total)}</span>
      </div>
      <AreaChart
        tall
        points={months.map((month) => ({
          key: month.key,
          label: month.label,
          value: month.cashCents,
        }))}
        label={`${money(total)} non-voided cash collected by receipt date. Exact monthly amounts follow in an accessible table.`}
      />
      <DataTable caption="Monthly non-voided cash receipts in Philippine pesos">
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Cash received</th>
          </tr>
        </thead>
        <tbody>
          {months.map((month) => (
            <tr key={month.key}>
              <th scope="row">{month.label}</th>
              <td>{money(month.cashCents)}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </article>
  );
}

function PastThirtyDays({ activity }: { activity: DashboardInsights['last30'] }) {
  const titleId = useId();
  const rows = [
    { label: 'Booking requests', value: count(activity.requests) },
    { label: 'Confirmations', value: count(activity.confirmed) },
    { label: 'Cancellations', value: count(activity.cancelled) },
    { label: 'Inquiries', value: count(activity.inquiries) },
    { label: 'Cash received', value: money(activity.cashCents) },
  ];
  return (
    <article className={styles.recent} aria-labelledby={titleId}>
      <h3 id={titleId}>For the past 30 days</h3>
      <dl>
        {rows.map(({ label, value }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p>Cancellations include rejected requests. Cash excludes voided receipts.</p>
    </article>
  );
}

/** Recorded confirmations and cancellations per month. */
function BookingsTrend({ months }: { months: DashboardMonth[] }) {
  const titleId = useId();
  const confirmed = months.reduce((total, month) => total + month.confirmed, 0);
  const cancelled = months.reduce((total, month) => total + month.cancelled, 0);
  return (
    <article className={`${admin.card} ${styles.card}`} aria-labelledby={titleId}>
      <div className={styles.cardHeading}>
        <div>
          <h3 id={titleId}>Bookings trend</h3>
          <span className={styles.scope}>By confirmation or cancellation date</span>
        </div>
      </div>
      <TrendChart
        points={months}
        series={[
          {
            name: 'Confirmed',
            color: 'confirmed',
            total: count(confirmed),
            values: months.map((month) => month.confirmed),
          },
          {
            name: 'Cancelled',
            color: 'cancelled',
            total: count(cancelled),
            values: months.map((month) => month.cancelled),
          },
        ]}
        label={`${count(confirmed)} bookings confirmed and ${count(cancelled)} cancelled or rejected. Exact monthly values follow in an accessible table.`}
        empty="No confirmations or cancellations yet"
      />
      <DataTable caption="Monthly confirmations and cancellations (cancellations include rejected requests)">
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Confirmed</th>
            <th scope="col">Cancelled</th>
          </tr>
        </thead>
        <tbody>
          {months.map((month) => (
            <tr key={month.key}>
              <th scope="row">{month.label}</th>
              <td>{count(month.confirmed)}</td>
              <td>{count(month.cancelled)}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </article>
  );
}

function ActivityChart({ months }: { months: DashboardMonth[] }) {
  const titleId = useId();
  const bookings = months.reduce((total, month) => total + month.bookings, 0);
  const inquiries = months.reduce((total, month) => total + month.inquiries, 0);
  return (
    <article className={`${admin.card} ${styles.card}`} aria-labelledby={titleId}>
      <div className={styles.cardHeading}>
        <div>
          <h3 id={titleId}>Booking activity</h3>
          <span className={styles.scope}>Requests and inquiries received</span>
        </div>
      </div>
      <BarChart
        points={months.map((month) => ({
          key: month.key,
          label: month.label,
          values: [month.bookings, month.inquiries],
        }))}
        series={[
          { name: 'Booking requests', total: count(bookings) },
          { name: 'Inquiries', total: count(inquiries) },
        ]}
        label={`${count(bookings)} booking requests and ${count(inquiries)} inquiries. Exact monthly values follow in an accessible table.`}
        empty="No activity yet"
      />
      <DataTable caption="Monthly booking requests and business inquiries">
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Requests</th>
            <th scope="col">Inquiries</th>
          </tr>
        </thead>
        <tbody>
          {months.map((month) => (
            <tr key={month.key}>
              <th scope="row">{month.label}</th>
              <td>{count(month.bookings)}</td>
              <td>{count(month.inquiries)}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </article>
  );
}

const PERIODS = [
  { months: 6, label: '6 months' },
  { months: 12, label: '12 months' },
];

export default function DashboardCharts({ insights }: { insights: DashboardInsights }) {
  const headingId = useId();
  const [period, setPeriod] = useState(6);
  const months = insights.months.slice(-period);
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <div className={styles.sectionHeading}>
        <div>
          <h2 id={headingId}>Trends</h2>
          <span className={styles.scope}>
            {months[0].label} – {months.at(-1)!.label}
          </span>
        </div>
        <div className={styles.segmented} role="group" aria-label="Chart period">
          {PERIODS.map((option) => (
            <button
              key={option.months}
              type="button"
              aria-pressed={period === option.months}
              onClick={() => setPeriod(option.months)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.trendRow}>
        <CashChart months={months} />
        <PastThirtyDays activity={insights.last30} />
      </div>
      <div className={styles.grid}>
        <BookingsTrend months={months} />
        <ActivityChart months={months} />
      </div>
    </section>
  );
}
