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
import { ChartDataTable } from './ChartPrimitives';
import styles from './AnalyticsOverview.module.css';
import admin from './admin.module.css';
import type { AdminData } from './types';

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
      <button className={admin.primary} aria-disabled={busy} type="submit">
        Apply period
      </button>
      <div className={styles.navigation}>
        <button
          className={admin.secondary}
          type="button"
          aria-label="Previous report period"
          aria-disabled={busy || report.range.previousAnchor < '1900-01-01'}
          onClick={() => navigate(report.range.previousAnchor)}
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <button
          className={admin.secondary}
          type="button"
          aria-disabled={busy}
          onClick={() => navigate(report.range.today)}
        >
          Current period
        </button>
        <button
          className={admin.secondary}
          type="button"
          aria-label="Next report period"
          aria-disabled={busy || !report.range.canNext}
          onClick={() => navigate(report.range.nextAnchor)}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
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
      <Icon size={18} aria-hidden="true" />
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
  const metrics = [
    {
      label: 'Cash income',
      value: compactReportCash(c.cashCents),
      detail: 'Selected interval · actual cash received',
      sub: `Overall income: ${money(s.allTimeCashCents)} all-time`,
      tone: styles.oak,
    },
    {
      label: 'Current pending balance',
      value: compactReportCash(s.outstandingCents),
      detail: 'Current snapshot · all secured bookings',
      sub: `${money(s.outstandingCents)} across ${count(s.outstandingBookings)} bookings`,
      tone: styles.peach,
    },
    {
      label: 'New secured bookings',
      value: count(c.newSecuredBookings),
      detail: 'First confirmation in selected interval',
      sub: q.confirmationHistoryComplete
        ? 'Currently confirmed or completed; cancellations excluded'
        : 'Dated records only · confirmation history incomplete',
      tone: styles.taupe,
    },
    {
      label: 'Inquiry conversion',
      value: rate === null ? '—' : `${rate.toFixed(1)}%`,
      detail: 'Selected inquiry cohort · current outcome',
      sub:
        rate === null
          ? !c.inquiries
            ? 'No inquiries in this interval'
            : 'Tracking incomplete · verified counts below'
          : `${count(c.convertedInquiries)} of ${count(c.inquiries)} inquiries secured`,
      tone: styles.rose,
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
          <h2>{range.current.label}</h2>
          <span className={styles.scope}>{range.partial ? 'To date' : 'Full period'}</span>
          <p className={admin.srOnly}>
            {reportDates(range.current)} · Manila time. Compared with{' '}
            {reportDates(range.comparison)}
            {range.partial ? ' (equivalent elapsed period)' : ''}
          </p>
        </div>
        <button className={admin.secondary} onClick={download} disabled={busy || failed}>
          <Download size={16} aria-hidden="true" />
          Export CSV
        </button>
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
            <HealthIcon size={36} className={styles.healthMark} aria-hidden="true" />
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
              className={`${styles.metric} ${metric.tone}`}
              key={metric.label}
              aria-label={`${metric.label}: ${metric.value}. ${metric.detail}. ${metric.sub}`}
            >
              <h3>{metric.label}</h3>
              <strong>{metric.value}</strong>
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
                      <dt>{row.label.replaceAll('_', ' ')}</dt>
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
