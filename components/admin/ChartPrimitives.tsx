'use client';

import { useId, type CSSProperties, type ReactNode } from 'react';
import { chartMaximum, donutWedgePath } from '@/lib/admin/dashboard-chart-math';
import { money } from '@/lib/admin/domain';
import styles from './DashboardCharts.module.css';
import admin from './admin.module.css';

export const chartTones = [styles.oak, styles.rose, styles.taupe, styles.peach, styles.ink];
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
export function ExtrudedBars({
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
          <path className={styles.floor} d="M0 220H588L600 232H12Z" />
          {points.map((point, index) => {
            const group = 600 / points.length;
            const width = Math.min(point.values.length === 1 ? 32 : 26, group * 0.23);
            return (
              <g key={point.key}>
                {point.values.map((value, n) => {
                  if (!value) return null;
                  const height = (value / maximum) * 204;
                  const x =
                    group * (index + 0.5) +
                    (point.values.length === 1 ? -width / 2 : n === 0 ? -width - 5 : 5) -
                    4;
                  const y = 220 - height;
                  return (
                    <g
                      className={
                        chartTones[
                          point.values.length === 1
                            ? index % chartTones.length
                            : n % chartTones.length
                        ]
                      }
                      key={n}
                    >
                      <title>
                        {point.label}: {chartCount(value)} {series[n]}
                      </title>
                      <path
                        className={styles.barSide}
                        d={`M${x + width} ${y}l8 -8v${height}l-8 8Z`}
                      />
                      <rect className={styles.barFront} x={x} y={y} width={width} height={height} />
                      <path className={styles.barTop} d={`M${x} ${y}l8 -8h${width}l-8 8Z`} />
                    </g>
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

export function CashArea({
  points,
  label,
}: {
  points: { key: string; label: string; value: number }[];
  label: string;
}) {
  const id = `cash-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const values = points.map((point) => point.value);
  const total = values.reduce((sum, value) => sum + value, 0);
  const maximum = total ? chartMaximum(values) : 100000;
  const coordinates = points.map((point, index) => ({
    x: points.length === 1 ? 300 : 18 + (index / (points.length - 1)) * 564,
    y: 220 - (point.value / maximum) * 204,
  }));
  const line = coordinates
    .map((point, index) => `${index ? 'L' : 'M'}${point.x} ${point.y}`)
    .join(' ');
  const area = points.length === 1 ? `M18 220V${coordinates[0].y}H582V220Z` : `${line}L582 220H18Z`;
  return (
    <>
      <ChartPlot maximum={maximum} cash>
        <svg viewBox="0 0 600 240" preserveAspectRatio="none" role="img" aria-label={label}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" className={styles.cashGradientStart} />
              <stop offset="1" className={styles.cashGradientEnd} />
            </linearGradient>
          </defs>
          <GridLines />
          <path className={styles.floor} d="M18 220H582L594 232H30Z" />
          {!!total && (
            <>
              <path className={styles.areaSide} d={area} transform="translate(0 10)" />
              <path d={area} fill={`url(#${id})`} />
            </>
          )}
          <path className={styles.cashLine} d={line} />
          {coordinates.map((point, index) => (
            <circle
              key={points[index].key}
              className={styles.cashPoint}
              cx={point.x}
              cy={point.y}
              r="4"
            >
              <title>
                {points[index].label}: {money(points[index].value)}
              </title>
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

export function ExtrudedDonut({
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
        path: slice.count ? donutWedgePath(start, start + (slice.count / total) * Math.PI * 2) : '',
      };
    })
    .filter((slice) => slice.count);
  const empty = donutWedgePath(0, Math.PI * 2);
  return (
    <div className={styles.donutScene}>
      <svg viewBox="0 0 320 224" role="img" aria-label={label}>
        <ellipse className={styles.donutShadow} cx="160" cy="170" rx="128" ry="30" />
        {[18, 15, 12, 9, 6, 3].map((depth) => (
          <g key={depth} transform={`translate(0 ${depth})`}>
            {total ? (
              paths.map((slice) => (
                <path
                  key={slice.key}
                  className={`${slice.tone} ${styles.donutSide}`}
                  d={slice.path}
                />
              ))
            ) : (
              <path className={styles.emptyRingSide} d={empty} />
            )}
          </g>
        ))}
        {total ? (
          paths.map((slice) => (
            <path key={slice.key} className={`${slice.tone} ${styles.donutTop}`} d={slice.path}>
              <title>{slice.label}</title>
            </path>
          ))
        ) : (
          <path className={styles.emptyRingTop} d={empty} />
        )}
      </svg>
      <div className={styles.donutCenter} aria-hidden="true">
        <strong>{center}</strong>
        <span>{caption}</span>
      </div>
    </div>
  );
}
