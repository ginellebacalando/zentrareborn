'use client';

import { useId, useState } from 'react';
import {
  ChartDataTable as DataTable,
  ExtrudedBars,
  ExtrudedDonut,
  CashArea,
  chartTones as tones,
  chartCount as count,
} from './ChartPrimitives';
import type {
  DashboardInsights,
  DashboardMonth,
  ReservationSlice,
} from '@/lib/admin/dashboard-types';
import { money } from '@/lib/admin/domain';
import styles from './DashboardCharts.module.css';
import admin from './admin.module.css';

function ActivityChart({ months }: { months: DashboardMonth[] }) {
  const titleId = useId();
  const bookings = months.reduce((total, month) => total + month.bookings, 0);
  const inquiries = months.reduce((total, month) => total + month.inquiries, 0);
  return (
    <article
      className={`${admin.card} ${styles.card} ${styles.activity}`}
      aria-labelledby={titleId}
    >
      <div className={styles.cardHeading}>
        <div>
          <h3 id={titleId}>Booking activity</h3>
        </div>
        <span className={styles.total}>
          {count(bookings)}
          <small className={admin.srOnly}>booking requests</small>
        </span>
      </div>
      <div className={styles.legend}>
        <span>
          <i className={`${styles.swatch} ${styles.oak}`} />
          Booking requests
        </span>
        <span>
          <i className={`${styles.swatch} ${styles.rose}`} />
          Business inquiries
        </span>
      </div>
      <ExtrudedBars
        points={months.map((month) => ({
          key: month.key,
          label: month.label,
          values: [month.bookings, month.inquiries],
        }))}
        series={['booking requests', 'inquiries']}
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

function ReservationChart({ reservations }: { reservations: ReservationSlice[] }) {
  const titleId = useId();
  const total = reservations.reduce((sum, item) => sum + item.count, 0);
  const slices = reservations.map((item, index) => ({
    ...item,
    tone: tones[index % tones.length],
  }));
  return (
    <article className={`${admin.card} ${styles.card}`} aria-labelledby={titleId}>
      <div className={styles.cardHeading}>
        <div>
          <h3 id={titleId}>Reservation mix</h3>
          <span className={styles.scope}>All-time</span>
        </div>
      </div>
      <ExtrudedDonut
        slices={reservations}
        label={`${count(total)} total booking requests. Counts and percentages follow.`}
        center={new Intl.NumberFormat('en-PH', {
          notation: 'compact',
          maximumFractionDigits: 1,
        }).format(total)}
        caption={total ? 'bookings' : 'No bookings yet'}
      />
      <ul className={styles.reservationLegend}>
        {slices.map((slice) => (
          <li key={slice.key}>
            <span>
              <i className={`${styles.swatch} ${slice.tone}`} />
              {slice.label}
            </span>
            <strong>
              {count(slice.count)}{' '}
              <small>{total ? `${((slice.count / total) * 100).toFixed(1)}%` : '0%'}</small>
            </strong>
          </li>
        ))}
      </ul>
      <DataTable caption="All-time booking requests by current reservation status">
        <thead>
          <tr>
            <th scope="col">Status</th>
            <th scope="col">Bookings</th>
            <th scope="col">Share</th>
          </tr>
        </thead>
        <tbody>
          {slices.map((slice) => (
            <tr key={slice.key}>
              <th scope="row">{slice.label}</th>
              <td>{count(slice.count)}</td>
              <td>{total ? `${((slice.count / total) * 100).toFixed(1)}%` : '0%'}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </article>
  );
}

function CashChart({ months }: { months: DashboardMonth[] }) {
  const titleId = useId();
  const total = months.reduce((sum, month) => sum + month.cashCents, 0);
  return (
    <article className={`${admin.card} ${styles.card} ${styles.cash}`} aria-labelledby={titleId}>
      <div className={styles.cardHeading}>
        <div>
          <h3 id={titleId}>Cash collected</h3>
        </div>
        <span className={styles.total}>{money(total)}</span>
      </div>
      <CashArea
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

export default function DashboardCharts({ insights }: { insights: DashboardInsights }) {
  const [period, setPeriod] = useState(6);
  const months = insights.months.slice(-period);
  return (
    <section className={styles.section} aria-label="Dashboard charts">
      <div className={styles.sectionHeading}>
        <div>
          <h2>Venue insights</h2>
          <span className={styles.scope}>
            {months[0].label} – {months.at(-1)!.label}
          </span>
        </div>
        <label className={styles.period}>
          Chart period
          <select value={period} onChange={(event) => setPeriod(Number(event.target.value))}>
            <option value="6">Last 6 months</option>
            <option value="12">Last 12 months</option>
          </select>
        </label>
      </div>
      <div className={styles.grid}>
        <ActivityChart months={months} />
        <ReservationChart reservations={insights.reservations} />
        <CashChart months={months} />
      </div>
    </section>
  );
}
