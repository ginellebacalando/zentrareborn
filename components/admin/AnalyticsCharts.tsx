'use client';

import type { AnalyticsReport } from '@/lib/admin/analytics-types';
import { compactReportCash, conversionRate, reportDates } from '@/lib/admin/analytics-export';
import { money } from '@/lib/admin/domain';
import { AreaChart, ChartDataTable, BarChart, DonutChart, chartCount } from './ChartPrimitives';
import chart from './DashboardCharts.module.css';
import styles from './AnalyticsOverview.module.css';
import admin from './admin.module.css';

export default function AnalyticsCharts({ report }: { report: AnalyticsReport }) {
  const { current: c, snapshot: s, range, quality: q, buckets } = report;
  const rate = conversionRate(c, q.currentAttributionComplete);
  const stages = [
    { key: 'received', label: 'Received', value: c.inquiries, detail: 'Inquiries received' },
    { key: 'linked', label: 'Linked', value: c.linkedInquiries, detail: 'With booking requests' },
    { key: 'secured', label: 'Solid', value: c.convertedInquiries, detail: 'With solid bookings' },
  ];
  const collection = [
    {
      key: 'collected',
      label: 'Cash applied',
      count: s.paidOnSecuredCents,
      value: money(s.paidOnSecuredCents),
    },
    {
      key: 'pending',
      label: 'Pending balance',
      count: s.outstandingCents,
      value: money(s.outstandingCents),
    },
  ];
  return (
    <div className={styles.chartGrid}>
      <article className={styles.card} aria-labelledby="analytics-cash-title">
        <div className={chart.cardHeading}>
          <div>
            <h2 id="analytics-cash-title">Income trend</h2>
            <span className={chart.scope}>PHP</span>
          </div>
          <strong className={chart.total}>{compactReportCash(c.cashCents)}</strong>
        </div>
        <div className={styles.model}>
          <AreaChart
            name="Cash income"
            points={buckets.map((b) => ({ key: b.key, label: b.label, value: b.cashCents }))}
            label={`${money(c.cashCents)} cash income by ${range.bucketUnit}. Exact values follow in an accessible table.`}
          />
        </div>
        <p className={admin.srOnly}>
          {reportDates(range.current)}. Voided receipts excluded.{' '}
          {range.partial
            ? 'The final bucket is in progress; future buckets are not plotted.'
            : 'Completed calendar period.'}
        </p>
        <ChartDataTable caption="Cash income in Philippine pesos by receipt date">
          <thead>
            <tr>
              <th scope="col">Interval</th>
              <th scope="col">Cash income</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b.key}>
                <th scope="row">{b.label}</th>
                <td>{money(b.cashCents)}</td>
              </tr>
            ))}
          </tbody>
        </ChartDataTable>
      </article>
      <article className={styles.card} aria-labelledby="analytics-collection-title">
        <div className={chart.cardHeading}>
          <div>
            <h2 id="analytics-collection-title">Collection progress</h2>
            <span className={chart.scope}>Current</span>
          </div>
        </div>
        <div className={styles.model}>
          <DonutChart
            slices={collection}
            label={`${money(s.paidOnSecuredCents)} applied and ${money(s.outstandingCents)} pending out of ${money(s.securedContractCents)} secured contract value.`}
            center={
              s.securedContractCents
                ? `${((s.paidOnSecuredCents / s.securedContractCents) * 100).toFixed(1)}%`
                : '—'
            }
            caption={s.securedContractCents ? 'collected' : 'No secured value'}
          />
        </div>
        <p className={admin.srOnly}>
          Secured contract value: {money(s.securedContractCents)}. Applied cash is capped at each
          booking’s value; actual income remains the full recorded cash.
        </p>
        <ChartDataTable caption="Current collection across CONFIRMED and COMPLETED bookings">
          <thead>
            <tr>
              <th scope="col">Measure</th>
              <th scope="col">PHP</th>
            </tr>
          </thead>
          <tbody>
            {collection.map((slice) => (
              <tr key={slice.key}>
                <th scope="row">{slice.label}</th>
                <td>{money(slice.count)}</td>
              </tr>
            ))}
          </tbody>
        </ChartDataTable>
      </article>
      <article className={styles.card} aria-labelledby="analytics-events-title">
        <div className={chart.cardHeading}>
          <div>
            <h2 id="analytics-events-title">Events in this period</h2>
          </div>
          <strong className={chart.total}>
            {chartCount(c.completedEvents)}
            <small>completed</small>
          </strong>
        </div>
        <div className={styles.model}>
          <BarChart
            points={buckets.map((b) => ({
              key: b.key,
              label: b.label,
              values: [b.securedEvents, b.completedEvents],
            }))}
            series={[
              { name: 'Secured event dates', total: chartCount(c.securedEvents) },
              { name: 'Completed events', total: chartCount(c.completedEvents) },
            ]}
            label={`${c.securedEvents} secured event dates by start date, including ${c.completedEvents} completed events. Exact values follow.`}
            empty="No events"
          />
        </div>
        <p className={admin.srOnly}>
          Completed events are included in secured dates. {s.upcomingEvents} upcoming confirmed
          event{s.upcomingEvents === 1 ? '' : 's'} in the selected calendar period.
        </p>
        <ChartDataTable caption="Event activity by start date; secured includes completed">
          <thead>
            <tr>
              <th scope="col">Interval</th>
              <th scope="col">Secured</th>
              <th scope="col">Completed</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b.key}>
                <th scope="row">{b.label}</th>
                <td>{b.securedEvents}</td>
                <td>{b.completedEvents}</td>
              </tr>
            ))}
          </tbody>
        </ChartDataTable>
      </article>
      <article className={styles.card} aria-labelledby="analytics-conversion-title">
        <div className={chart.cardHeading}>
          <div>
            <h2 id="analytics-conversion-title">Inquiry conversion</h2>
          </div>
          <strong className={chart.total}>
            {rate === null ? '—' : `${rate.toFixed(1)}%`}
            {rate === null && <small>Unavailable</small>}
          </strong>
        </div>
        <div className={styles.model}>
          <BarChart
            points={stages.map((stage) => ({
              key: stage.key,
              label: stage.label,
              values: [stage.value],
            }))}
            series={[{ name: 'Inquiries' }]}
            label={`${c.inquiries} inquiries received, ${c.linkedInquiries} with linked requests, ${c.convertedInquiries} with solid bookings. Verified links only.`}
            empty="No inquiries"
          />
        </div>
        <p className={admin.srOnly}>
          Distinct inquiries, counted once at each stage. Solid = currently confirmed or completed.
          Recent inquiries may still be under review.
        </p>
        {!q.currentAttributionComplete && (
          <p className={styles.warning}>
            Tracking incomplete · {c.unattributedOrigins} untracked booking
            {c.unattributedOrigins === 1 ? '' : 's'}
          </p>
        )}
        <ChartDataTable caption="Verified inquiry cohort outcomes as of report time">
          <thead>
            <tr>
              <th scope="col">Stage</th>
              <th scope="col">Inquiries</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((stage) => (
              <tr key={stage.key}>
                <th scope="row">{stage.detail}</th>
                <td>{stage.value}</td>
              </tr>
            ))}
          </tbody>
        </ChartDataTable>
      </article>
    </div>
  );
}
