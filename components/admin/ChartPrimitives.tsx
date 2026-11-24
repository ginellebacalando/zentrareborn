'use client';

import { useId, type CSSProperties, type ReactNode } from 'react';
import { chartMaximum, ringWedgePath } from '@/lib/admin/dashboard-chart-math';
import { money } from '@/lib/admin/domain';
import styles from './DashboardCharts.module.css';
import admin from './admin.module.css';

/*
 * Flat ZENTRA chart marks: native SVG, hairline grids, deep green / teal series and status hues for
 * booking states. Every chart keeps an exact-value table for assistive technology; colour is
 * never the only carrier of a value (legends, totals and tables accompany each chart).
 */
export const chartTones = [
  styles.series1,
  styles.series2,
  styles.series3,
  styles.series4,
  styles.series5,
];
export const chartCount = (value: number) => value.toLocaleString('en-PH');
const compact = (value: number, cash: boolean) =>
  new Intl.NumberFormat('en-PH', {
    notation: 'compact',
    maximumFractionDigits: 1,
    ...(cash ? { style: 'currency', currency: 'PHP' } : {}),
  }).format(cash ? value / 100 : value);

export function ChartDataTable({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className={admin.srOnly}>
      <table>
        <caption>{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function ChartLabels({ points }: { points: { key: string; label: string }[] }) {
  return (
    <div className={styles.labelsInset}>
      <ol
        className={`${styles.monthLabels} ${points.length > 8 ? styles.fullYear : ''}`}
        style={{ '--month-count': points.length } as CSSProperties}
        aria-hidden="true"
      >
        {points.map((point) => (
          <li key={point.key}>
            <abbr title={point.label}>{point.label.split(' ')[0]}</abbr>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ChartPlot({
  maximum,
  cash = false,
  children,
}: {
  maximum: number;
  cash?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={styles.plotLayout}>
      <div className={styles.axis} aria-hidden="true">
        {[4, 3, 2, 1, 0].map((step) => (
          <span key={step}>{compact((maximum * step) / 4, cash)}</span>
        ))}
      </div>
      <div className={styles.plot}>{children}</div>
    </div>
  );
}

function GridLines() {
  return (
    <g className={styles.gridLines} aria-hidden="true">
      {[16, 67, 118, 169, 220].map((y) => (
        <line key={y} x1="0" x2="600" y1={y} y2={y} />
      ))}
    </g>
  );
}

type BarPoint = { key: string; label: string; values: number[] };
export function BarChart({
  points,
  series,
  label,
  empty,
}: {
  points: BarPoint[];
  series: string[];
  label: string;
  empty: string;
}) {
  const maximum = chartMaximum(points.flatMap((point) => point.values));
  const populated = points.some((point) => point.values.some(Boolean));
  return (
    <>
      <ChartPlot maximum={maximum}>
        <svg viewBox="0 0 600 240" preserveAspectRatio="none" role="img" aria-label={label}>
          <GridLines />
          <line className={styles.baseline} x1="0" x2="600" y1="220" y2="220" />
          {points.map((point, index) => {
            const group = 600 / points.length;
            const width = Math.min(point.values.length === 1 ? 36 : 24, group * 0.28);
            return (
              <g key={point.key}>
                {point.values.map((value, n) => {
                  if (!value) return null;
                  const height = (value / maximum) * 204;
                  const x =
                    group * (index + 0.5) +
                    (point.values.length === 1 ? -width / 2 : n === 0 ? -width - 3 : 3);
                  return (
                    <rect
                      key={n}
                      className={`${styles.bar} ${
                        chartTones[
                          point.values.length === 1
                            ? index % chartTones.length
                            : n % chartTones.length
                        ]
                      }`}
                      x={x}
                      y={220 - height}
                      width={width}
                      height={height}
                      rx="3"
                    >
                      <title>{`${point.label}: ${chartCount(value)} ${series[n]}`}</title>
                    </rect>
                  );
                })}
              </g>
            );
          })}
        </svg>
        {!populated && (
          <div className={styles.emptyPlot}>
            <strong>{empty}</strong>
          </div>
        )}
      </ChartPlot>
      <ChartLabels points={points} />
    </>
  );
}

function coordinatesFor(values: number[], maximum: number) {
  return values.map((value, index) => ({
    x: values.length === 1 ? 300 : 18 + (index / (values.length - 1)) * 564,
    y: 220 - (value / maximum) * 204,
  }));
}
function linePath(points: { x: number; y: number }[]) {
  return points.map((point, index) => `${index ? 'L' : 'M'}${point.x} ${point.y}`).join(' ');
}
function areaPath(points: { x: number; y: number }[]) {
  return points.length === 1
    ? `M18 220V${points[0].y}H582V220Z`
    : `${linePath(points)}L582 220H18Z`;
}

/** Single-series area (cash by month or report bucket). */
export function AreaChart({
  points,
  label,
}: {
  points: { key: string; label: string; value: number }[];
  label: string;
}) {
  const id = `area-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const values = points.map((point) => point.value);
  const total = values.reduce((sum, value) => sum + value, 0);
  const maximum = total ? chartMaximum(values) : 100000;
  const coordinates = coordinatesFor(values, maximum);
  return (
    <>
      <ChartPlot maximum={maximum} cash>
        <svg viewBox="0 0 600 240" preserveAspectRatio="none" role="img" aria-label={label}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" className={styles.areaGradientStart} />
              <stop offset="1" className={styles.areaGradientEnd} />
            </linearGradient>
          </defs>
          <GridLines />
          <line className={styles.baseline} x1="0" x2="600" y1="220" y2="220" />
          {!!total && <path d={areaPath(coordinates)} fill={`url(#${id})`} />}
          <path className={styles.areaLine} d={linePath(coordinates)} />
          {coordinates.map((point, index) => (
            <circle
              key={points[index].key}
              className={styles.areaPoint}
              cx={point.x}
              cy={point.y}
              r="4"
            >
              <title>{`${points[index].label}: ${money(points[index].value)}`}</title>
            </circle>
          ))}
        </svg>
        {!total && (
          <div className={styles.emptyPlot}>
            <strong>No cash recorded</strong>
          </div>
        )}
      </ChartPlot>
      <ChartLabels points={points} />
    </>
  );
}

/** Two or more count series drawn as soft areas with lines (Figma's bookings trend). */
export function TrendChart({
  points,
  series,
  label,
  empty,
}: {
  points: { key: string; label: string }[];
  series: { name: string; tone: string; values: number[] }[];
  label: string;
  empty: string;
}) {
  const maximum = chartMaximum(series.flatMap((item) => item.values));
  const populated = series.some((item) => item.values.some(Boolean));
  return (
    <>
      <ChartPlot maximum={maximum}>
        <svg viewBox="0 0 600 240" preserveAspectRatio="none" role="img" aria-label={label}>
          <GridLines />
          <line className={styles.baseline} x1="0" x2="600" y1="220" y2="220" />
          {series.map((item) => {
            const coordinates = coordinatesFor(item.values, maximum);
            return (
              <g key={item.name} className={item.tone}>
                {populated && <path className={styles.trendArea} d={areaPath(coordinates)} />}
                <path className={styles.trendLine} d={linePath(coordinates)} />
                {coordinates.map((point, index) => (
                  <circle
                    key={points[index].key}
                    className={styles.trendPoint}
                    cx={point.x}
                    cy={point.y}
                    r="3.5"
                  >
                    <title>{`${points[index].label}: ${chartCount(item.values[index])} ${item.name}`}</title>
                  </circle>
                ))}
              </g>
            );
          })}
        </svg>
        {!populated && (
          <div className={styles.emptyPlot}>
            <strong>{empty}</strong>
          </div>
        )}
      </ChartPlot>
      <ChartLabels points={points} />
    </>
  );
}

export function DonutChart({
  slices,
  label,
  center,
  caption,
}: {
  slices: { key: string; label: string; count: number }[];
  label: string;
  center: string;
  caption: string;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  const paths = slices
    .map((slice, index) => {
      const before = slices.slice(0, index).reduce((sum, item) => sum + item.count, 0);
      const start = -Math.PI / 2 + (total ? (before / total) * Math.PI * 2 : 0);
      return {
        ...slice,
        tone: chartTones[index % chartTones.length],
        path: slice.count ? ringWedgePath(start, start + (slice.count / total) * Math.PI * 2) : '',
      };
    })
    .filter((slice) => slice.count);
  return (
    <div className={styles.donutScene}>
      <svg viewBox="0 0 200 200" role="img" aria-label={label}>
        {total ? (
          paths.map((slice) => (
            <path key={slice.key} className={`${slice.tone} ${styles.donutSlice}`} d={slice.path}>
              <title>{slice.label}</title>
            </path>
          ))
        ) : (
          <path className={styles.emptyRing} d={ringWedgePath(0, Math.PI * 2)} />
        )}
      </svg>
      <div className={styles.donutCenter} aria-hidden="true">
        <strong>{center}</strong>
        <span>{caption}</span>
      </div>
    </div>
  );
}

/** Decorative trend line for KPI cards; the card's accessible name carries the values. */
export function Sparkline({ values }: { values: number[] }) {
  const maximum = Math.max(1, ...values);
  const points = values.map((value, index) => ({
    x: values.length === 1 ? 50 : 2 + (index / (values.length - 1)) * 96,
    y: 30 - (value / maximum) * 26,
  }));
  return (
    <svg
      className={styles.sparkline}
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path className={styles.sparklineLine} d={linePath(points)} />
    </svg>
  );
}
