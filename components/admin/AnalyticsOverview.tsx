'use client';

import { useState, type CSSProperties, type FormEvent } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Minus,
  TrendingUp,
  TrendingDown,
  Activity,
} from 'lucide-react';
import { useReducedMotion } from '@/components/shared/useReducedMotion';
import type { AnalyticsReport, ReportKind } from '@/lib/admin/analytics-types';
import { reportKinds } from '@/lib/admin/analytics-types';
import {
  analyticsCsv,
  compactReportCash,
  conversionRate,
  reportDates,
  reportTimestamp,
} from '@/lib/admin/analytics-export';
import { money } from '@/lib/admin/domain';
import AnalyticsCharts from './AnalyticsCharts';
import { ChartDataTable, Sparkline } from './ChartPrimitives';
import { enumLabel } from './AdminBadge';
import styles from './AnalyticsOverview.module.css';
import admin from './admin.module.css';
import type { AdminData } from './types';
import { useAdminRole } from './AdminRoleContext';
import { Button, IconButton } from '@/components/shared/Button';

const periodNames: Record<ReportKind, string> = {
  week: 'Weekly',
  month: 'Monthly',
  quarter: 'Quarterly',
  year: 'Yearly',
};
const count = (value: number) => value.toLocaleString('en-PH');

function ReportControls({
  report,
  busy,
  onChange,
}: {
  report: AnalyticsReport;
  busy: boolean;
  onChange: (kind: ReportKind, date: string) => void;
}) {
  const [kind, setKind] = useState(report.range.kind);
  const [anchor, setAnchor] = useState(report.range.anchor);
  function navigate(date: string) {
    if (busy || date < '1900-01-01' || date > report.range.today) return;
    setKind(report.range.kind);
    setAnchor(date);
    onChange(report.range.kind, date);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    onChange(kind, anchor);
  }
  return (
    <form className={styles.controls} onSubmit={submit} aria-label="Choose analytics report period">
      <label>
        Report period
        <select value={kind} onChange={(event) => setKind(event.target.value as ReportKind)}>
          {reportKinds.map((value) => (
            <option key={value} value={value}>
              {periodNames[value]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Date within period
        <input
          type="date"
          required
          min="1900-01-01"
          max={report.range.today}
          value={anchor}
          onChange={(event) => setAnchor(event.target.value)}
        />
      </label>
      <Button variant="primary" aria-disabled={busy} type="submit">
        Apply period
      </Button>
      <div className={styles.navigation}>
        <IconButton
          variant="secondary"
          type="button"
          label="Previous report period"
          icon={<ChevronLeft aria-hidden="true" />}
          aria-disabled={busy || undefined}
          disabledReason={report.range.previousAnchor < '1900-01-01' ? 'No earlier periods' : null}
          onClick={() => navigate(report.range.previousAnchor)}
        />
        <Button
          variant="secondary"
          type="button"
          aria-disabled={busy}
          onClick={() => navigate(report.range.today)}
        >
          Current period
        </Button>
        <IconButton
          variant="secondary"
          type="button"
          label="Next report period"
          tooltipAlign="end"
          icon={<ChevronRight aria-hidden="true" />}
          aria-disabled={busy || undefined}
          disabledReason={report.range.canNext ? null : 'This is the latest period'}
          onClick={() => navigate(report.range.nextAnchor)}
        />
      </div>
    </form>
  );
}

function Delta({
  value,
  percent,
  cash = false,
  limited = false,
}: {
  value: number;
  percent: number | null;
  cash?: boolean;
  limited?: boolean;
}) {
  const Icon = limited ? Minus : value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  return (
    <span
      className={styles.delta}
      role="img"
      aria-label={
        limited
          ? 'Comparison unavailable; confirmation history incomplete'
          : `${value > 0 ? 'Up' : value < 0 ? 'Down' : 'No change'} ${cash ? money(Math.abs(value)) : count(Math.abs(value))}; ${percent === null ? 'no prior baseline' : `${percent.toFixed(1)} percent`}`
      }
    >
      <Icon size={20} aria-hidden="true" />
      {limited ? '—' : percent === null ? 'New' : `${percent > 0 ? '+' : ''}${percent.toFixed(1)}%`}
    </span>
  );
}

export default function AnalyticsOverview({
  report,
  busy,
  failed,
  onChange,
  portfolio,
}: {
  report: AnalyticsReport;
  busy: boolean;
  failed: boolean;
  onChange: (kind: ReportKind, date: string) => void;
  portfolio?: AdminData['analytics'];
}) {
  const reduced = useReducedMotion();
  const { can } = useAdminRole();
  const [exported, setExported] = useState('');
  const { range, current: c, comparison: p, snapshot: s, trajectory: t, quality: q } = report;
  const rate = conversionRate(c, q.currentAttributionComplete);
  const HealthIcon =
    t.state === 'attention'
      ? TrendingDown
      : ['improving', 'new'].includes(t.state)
        ? TrendingUp
        : Activity;
  const statusTone =
    t.state === 'attention'
      ? styles.attention
      : ['mixed', 'limited'].includes(t.state)
        ? styles.caution
        : styles.positive;
  function download() {
    const blob = new Blob([analyticsCsv(report)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `zion-analytics-${range.kind}-${range.anchor}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExported(report.asOf);
  }
  // Teal KPI cards (Figma). Only cash income has a matching per-bucket series for a trend line.
  const metrics = [
    {
      label: 'Cash income',
      value: compactReportCash(c.cashCents),
      period: range.current.label,
      detail: 'Selected interval · actual cash received',
      sub: `Overall income: ${money(s.allTimeCashCents)} all-time`,
      trend: report.buckets.length > 1 ? report.buckets.map((bucket) => bucket.cashCents) : null,
    },
    {
      label: 'Pending balance',
      value: compactReportCash(s.outstandingCents),
      period: 'Current snapshot',
      detail: 'Current snapshot · all secured bookings',
      sub: `${money(s.outstandingCents)} across ${count(s.outstandingBookings)} bookings`,
      trend: null,
    },
    {
      label: 'New secured bookings',
      value: count(c.newSecuredBookings),
      period: range.current.label,
      detail: 'First confirmation in selected interval',
      sub: q.confirmationHistoryComplete
        ? 'Currently confirmed or completed; cancellations excluded'
        : 'Dated records only · confirmation history incomplete',
      trend: null,
    },
    {
      label: 'Inquiry conversion',
      value: rate === null ? '—' : `${rate.toFixed(1)}%`,
      period: range.current.label,
      detail: 'Selected inquiry cohort · current outcome',
      sub:
        rate === null
          ? !c.inquiries
            ? 'No inquiries in this interval'
            : 'Tracking incomplete · verified counts below'
          : `${count(c.convertedInquiries)} of ${count(c.inquiries)} inquiries secured`,
      trend: null,
    },
  ];
  return (
    <section
      className={`${styles.report} ${reduced ? '' : styles.motion}`}
      aria-label="Business analytics report"
    >
      <ReportControls report={report} busy={busy} onChange={onChange} />
      <div className={styles.reportHeading}>
        <div>
          <p className={admin.overline}>Performance overview</p>
          <h2>{range.current.label}</h2>
          <span className={styles.scope}>{range.partial ? 'To date' : 'Full period'}</span>
          <p className={admin.srOnly}>
            {reportDates(range.current)} · Manila time. Compared with{' '}
            {reportDates(range.comparison)}
            {range.partial ? ' (equivalent elapsed period)' : ''}
          </p>
        </div>
        {/* Data exports are a super administrator action (lib/admin/permissions.ts). */}
        {can('export-data') && (
          <Button variant="secondary" onClick={download} disabled={busy || failed}>
            <Download size={16} aria-hidden="true" />
            Export CSV
          </Button>
        )}
      </div>
      <p className={admin.srOnly}>
        As of {reportTimestamp(report.asOf)} Manila. Balances and booking outcomes reflect current
        records.
      </p>
      <p className={styles.feedback} role="status">
        {busy
          ? 'Updating report… Displayed figures remain from the range above.'
          : failed
            ? 'Report could not be updated. The last successful report is displayed; use Refresh to retry.'
            : exported === report.asOf
              ? 'CSV downloaded for the displayed report.'
              : ''}
      </p>
      <div key={`${range.kind}-${range.anchor}`} className={styles.reportBody} aria-busy={busy}>
        <article
          className={`${styles.health} ${statusTone}`}
          aria-labelledby="analytics-health-title"
        >
          <div className={styles.healthTitle}>
            <div>
              <p className={styles.overline}>Business trend</p>
              <h2 id="analytics-health-title">{t.label}</h2>
            </div>
            <HealthIcon size={20} className={styles.healthMark} aria-hidden="true" />
          </div>
          <p className={admin.srOnly}>{t.detail}</p>
          <div className={styles.comparisons}>
            <div>
              <strong>Cash income</strong>
              <span>{compactReportCash(c.cashCents)}</span>
              <Delta value={t.cashChangeCents} percent={t.cashChangePercent} cash />
            </div>
            <div>
              <strong>New secured bookings</strong>
              <span>{count(c.newSecuredBookings)}</span>
              <Delta
                value={t.bookingChange}
                percent={t.bookingChangePercent}
                limited={!q.confirmationHistoryComplete}
              />
            </div>
          </div>
          <p className={admin.srOnly}>
            Based on income and bookings in the comparison ranges above. Expenses are not recorded;
            this is not a profit or loss result.
          </p>
        </article>
        <div className={styles.metrics}>
          {metrics.map((metric) => (
            <article
              className={styles.metric}
              key={metric.label}
              aria-label={`${metric.label}: ${metric.value}. ${metric.detail}. ${metric.sub}${metric.trend ? `. Trend by ${range.bucketUnit}: ${metric.trend.map((value) => money(value)).join(', ')}` : ''}`}
            >
              <h3>{metric.label}</h3>
              <strong>{metric.value}</strong>
              <span className={styles.metricPeriod}>{metric.period}</span>
              {metric.trend && (
                <span className={styles.metricTrend}>
                  <Sparkline values={metric.trend} />
                </span>
              )}
            </article>
          ))}
        </div>
        {(s.pastEventBalanceCents > 0 ||
          s.overpaidBookings > 0 ||
          !q.confirmationHistoryComplete) && (
          <aside className={styles.notice} aria-label="Items to review">
            <h2>Needs review</h2>
            {s.pastEventBalanceCents > 0 && (
              <p>
                <strong>{money(s.pastEventBalanceCents)} unpaid</strong> across{' '}
                {s.pastEventBalanceBookings} past event{s.pastEventBalanceBookings === 1 ? '' : 's'}
                .
              </p>
            )}
            {s.overpaidBookings > 0 && (
              <p>
                {s.overpaidBookings} booking{s.overpaidBookings === 1 ? ' has' : 's have'} cash
                above contract value.
              </p>
            )}
            {!q.confirmationHistoryComplete && (
              <p>
                {s.undatedConfirmations} booking{s.undatedConfirmations === 1 ? '' : 's'} missing
                confirmation dates · trajectory unavailable
              </p>
            )}
          </aside>
        )}
        <AnalyticsCharts report={report} />
        <article className={styles.card} aria-labelledby="analytics-summary-title">
          <div className={styles.reportHeading}>
            <div>
              <h2 id="analytics-summary-title">Activity</h2>
            </div>
          </div>
          <div className={styles.summaryTiles}>
            <div>
              <strong aria-label={money(s.pipelineCents)}>
                {compactReportCash(s.pipelineCents)}
              </strong>
              <span>Current approved pipeline · {s.pipelineRequests}</span>
              <small className={admin.srOnly}>
                Prospective contract value; separate from income and receivables.
              </small>
            </div>
            <div>
              <strong>{c.requests}</strong>
              <span>Requests</span>
              <small className={admin.srOnly}>
                {c.cancellations} distinct bookings cancelled during this interval.
              </small>
            </div>
          </div>
          <ChartDataTable
            caption={`Comparison: ${reportDates(range.current)} versus ${reportDates(range.comparison)}`}
          >
            <thead>
              <tr>
                <th scope="col">Measure</th>
                <th scope="col">Selected</th>
                <th scope="col">Previous</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Cash income (PHP)', money(c.cashCents), money(p.cashCents)],
                [
                  'New secured bookings' + (!q.confirmationHistoryComplete ? ' (dated only)' : ''),
                  c.newSecuredBookings,
                  p.newSecuredBookings,
                ],
                ['Requests received', c.requests, p.requests],
                ['Inquiries received', c.inquiries, p.inquiries],
                ['Inquiries with linked requests (verified)', c.linkedInquiries, p.linkedInquiries],
                [
                  'Inquiries with solid bookings (verified)',
                  c.convertedInquiries,
                  p.convertedInquiries,
                ],
                [
                  'Inquiry conversion',
                  rate === null ? 'Unavailable' : `${rate.toFixed(1)}%`,
                  conversionRate(p, q.comparisonAttributionComplete) === null
                    ? 'Unavailable'
                    : `${conversionRate(p, q.comparisonAttributionComplete)!.toFixed(1)}%`,
                ],
                ['Secured event dates', c.securedEvents, p.securedEvents],
                ['Completed events', c.completedEvents, p.completedEvents],
                ['Cancellations recorded', c.cancellations, p.cancellations],
              ].map((row) => (
                <tr key={row[0]}>
                  <th scope="row">{row[0]}</th>
                  <td>{row[1]}</td>
                  <td>{row[2]}</td>
                </tr>
              ))}
            </tbody>
          </ChartDataTable>
          <div className={admin.srOnly}>
            <h3>Report definitions</h3>
            <p>
              Cash uses non-voided receipts by received date. New secured bookings use the first
              recorded confirmation date and current confirmed/completed status. Events use their
              start date; completed events are a subset of secured dates.
            </p>
            <p>
              Inquiry conversion uses explicit, verified links from the “Review as booking request”
              workflow. Historical bookings without structured origins are never matched using
              names, emails, or notes.{' '}
              {q.trackingSince
                ? `Structured tracking began ${reportTimestamp(q.trackingSince)} Manila.`
                : 'Structured attribution has not started yet.'}
            </p>
            <p>
              Pending balances and collection progress are current snapshots of all secured
              bookings, regardless of the chosen interval. Inquiry outcomes are current as of report
              time. Historical reports may change when records are updated. Weeks start Monday;
              quarters follow the calendar year.
            </p>
          </div>
        </article>
        {portfolio && (
          <article className={styles.card} aria-labelledby="analytics-portfolio-title">
            <h2 id="analytics-portfolio-title">All-time booking mix</h2>
            <div className={styles.summaryTiles}>
              <div>
                <h3>Reservation status</h3>
                <dl className={styles.breakdown}>
                  {portfolio.reservations.map((row) => (
                    <div
                      key={row.label}
                      style={
                        {
                          '--share': `${portfolio.totalBookings ? (row.count / portfolio.totalBookings) * 100 : 0}%`,
                        } as CSSProperties
                      }
                    >
                      <dt>{enumLabel(row.label)}</dt>
                      <dd>{count(row.count)}</dd>
                    </div>
                  ))}
                </dl>
                {!portfolio.reservations.length && <p>No bookings recorded yet.</p>}
              </div>
              <div>
                <h3>Top event types</h3>
                <dl className={styles.breakdown}>
                  {portfolio.eventTypes.map((row) => (
                    <div
                      key={row.label}
                      style={
                        {
                          '--share': `${(row.count / Math.max(1, ...portfolio.eventTypes.map((event) => event.count))) * 100}%`,
                        } as CSSProperties
                      }
                    >
                      <dt>{row.label}</dt>
                      <dd>{count(row.count)}</dd>
                    </div>
                  ))}
                </dl>
                {!portfolio.eventTypes.length && <p>No event types</p>}
              </div>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}
