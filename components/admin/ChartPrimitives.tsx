'use client';

import { useId, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import type { Chart, ChartConfiguration, ChartType, TooltipModel } from 'chart.js';
import { smoothLinePath } from '@/lib/admin/dashboard-chart-math';
import { money } from '@/lib/admin/domain';
import {
  areaFill,
  cartesianScales,
  focusFill,
  focusTransitions,
  motion,
  prefersReducedMotion,
  refocus,
  tooltipState,
  type ChartColor,
  type ChartTokens,
  type TooltipState,
} from './chart-engine';
import { useChartJs, type LiveTooltip } from './useChartJs';
import styles from './DashboardCharts.module.css';
import admin from './admin.module.css';

/*
 * Interactive ZENTRA charts (docs/admin-design.md): Chart.js marks in the admin tokens, an HTML
 * tooltip that follows the pointer, legends that show or hide a series, and motion that respects
 * reduced-motion settings. Every chart keeps an exact-value table for assistive technology; colour
 * is never the only carrier of a value (legends, totals and tables accompany each chart).
 */
const colorClass: Record<ChartColor, string> = {
  series1: styles.series1,
  series2: styles.series2,
  series3: styles.series3,
  series4: styles.series4,
  series5: styles.series5,
  confirmed: styles.confirmedTone,
  cancelled: styles.cancelledTone,
  line: styles.lineTone,
};
export const seriesColors: ChartColor[] = ['series1', 'series2', 'series3', 'series4', 'series5'];
/** Swatch classes for HTML legends, in series order. */
export const chartTones = seriesColors.map((color) => colorClass[color]);
export const chartCount = (value: number) => Math.round(value).toLocaleString('en-PH');
const compact = (value: number, cash: boolean) =>
  new Intl.NumberFormat('en-PH', {
    notation: 'compact',
    maximumFractionDigits: 1,
    ...(cash ? { style: 'currency', currency: 'PHP' } : {}),
  }).format(cash ? value / 100 : value);
const compactCount = (value: number) => compact(value, false);
const compactCash = (value: number) => compact(value, true);

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

/** Decorative: the same values are in the chart's data table and accessible name. */
function ChartTooltip({ state }: { state: LiveTooltip }) {
  return (
    <div
      className={styles.tooltip}
      data-visible={state.visible}
      data-moving={state.moving}
      data-below={state.below}
      style={{ '--tip-x': `${state.x}px`, '--tip-y': `${state.y}px` } as CSSProperties}
      aria-hidden="true"
    >
      <strong>{state.title}</strong>
      <ul>
        {state.rows.map((row) => (
          <li key={row.key}>
            <i style={{ '--tip-color': row.color } as CSSProperties} />
            {row.label}
            <b>{row.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChartFrame({
  canvasRef,
  label,
  tooltip,
  empty,
  tall = false,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  label: string;
  tooltip: LiveTooltip;
  empty: string;
  tall?: boolean;
}) {
  return (
    <div className={`${styles.chartFrame} ${tall ? styles.chartTall : ''}`}>
      <canvas ref={canvasRef} role="img" aria-label={label} />
      <ChartTooltip state={tooltip} />
      {empty && (
        <div className={styles.emptyPlot}>
          <strong>{empty}</strong>
        </div>
      )}
    </div>
  );
}

type LegendItem = { name: string; color: ChartColor; total?: string };

/** Series legend: each entry shows or hides its series (aria-pressed), keeping one visible. */
function SeriesLegend({
  items,
  hidden,
  onToggle,
}: {
  items: LegendItem[];
  hidden: boolean[];
  onToggle: (index: number) => void;
}) {
  return (
    <ul className={styles.legend} aria-label="Show or hide a series">
      {items.map((item, index) => (
        <li key={item.name}>
          <button
            type="button"
            className={styles.legendButton}
            aria-pressed={!hidden[index]}
            onClick={() => onToggle(index)}
          >
            <i className={`${styles.swatch} ${colorClass[item.color]}`} aria-hidden="true" />
            {item.name}
            {item.total !== undefined && (
              <>
                {' '}
                <strong>{item.total}</strong>
              </>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Legend state plus Chart.js' own show/hide transition. */
function useSeriesToggle(count: number) {
  const [hidden, setHidden] = useState<boolean[]>(() => Array.from({ length: count }, () => false));
  const toggle = (
    index: number,
    chart: { hide: (i: number) => void; show: (i: number) => void },
  ) => {
    const next = hidden.map((value, n) => (n === index ? !value : value));
    if (next.every(Boolean)) return;
    if (next[index]) chart.hide(index);
    else chart.show(index);
    setHidden(next);
  };
  return { hidden, toggle };
}

type Point = { key: string; label: string };

/** Chart.js' own legend and canvas tooltip are off; the HTML tooltip takes their place. */
function tooltipPlugin<T extends ChartType>(
  tokens: ChartTokens,
  showTooltip: (state: TooltipState) => void,
  title: (index: number) => string,
  row: (
    datasetIndex: number,
    index: number,
    value: number,
  ) => { label: string; value: string; color: ChartColor },
) {
  return {
    legend: { display: false },
    tooltip: {
      enabled: false,
      // Chart.js would animate its own caret position and report the previous spot; the HTML
      // tooltip glides with CSS instead, so the model must jump straight to the hovered point.
      animation: false as const,
      external: ({ chart, tooltip }: { chart: Chart; tooltip: TooltipModel<T> }) =>
        showTooltip(
          tooltipState(chart.width, tooltip, title, (datasetIndex, index, value) => {
            const item = row(datasetIndex, index, value);
            return {
              key: `${datasetIndex}-${index}`,
              color: tokens.colors[item.color],
              label: item.label,
              value: item.value,
            };
          }),
        ),
    },
  };
}

/** Smooth lines over soft fills, for two or more count series (bookings trend). */
export function TrendChart({
  points,
  series,
  label,
  empty,
}: {
  points: Point[];
  series: (LegendItem & { values: number[] })[];
  label: string;
  empty: string;
}) {
  const { hidden, toggle } = useSeriesToggle(series.length);
  const labels = points.map((point) => point.label);
  const populated = series.some((item) => item.values.some(Boolean));
  const { canvasRef, chartRef, tooltip } = useChartJs<'line'>(
    (tokens, showTooltip): ChartConfiguration<'line'> => ({
      type: 'line',
      data: {
        labels,
        datasets: series.map((item, index) => {
          const color = tokens.colors[item.color];
          return {
            label: item.name,
            data: item.values,
            hidden: hidden[index],
            borderColor: color,
            backgroundColor: areaFill(color, 0.22),
            fill: 'origin',
            borderWidth: 2.5,
            tension: 0.4,
            cubicInterpolationMode: 'monotone',
            pointRadius: labels.length > 8 ? 0 : 3,
            pointHoverRadius: 6,
            pointHitRadius: 14,
            pointBackgroundColor: tokens.card,
            pointBorderColor: color,
            pointBorderWidth: 2,
            pointHoverBackgroundColor: tokens.card,
            pointHoverBorderColor: color,
            pointHoverBorderWidth: 3,
          };
        }),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: motion(false),
        transitions: focusTransitions(),
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 8, right: 8 } },
        scales: cartesianScales(tokens, compactCount, labels),
        plugins: tooltipPlugin<'line'>(
          tokens,
          showTooltip,
          (index) => labels[index] ?? '',
          (datasetIndex, _index, value) => ({
            label: series[datasetIndex].name,
            value: chartCount(value),
            color: series[datasetIndex].color,
          }),
        ),
      },
    }),
    JSON.stringify([labels, series.map((item) => item.values)]),
  );
  return (
    <>
      {series.length > 1 && (
        <SeriesLegend
          items={series}
          hidden={hidden}
          onToggle={(index) => chartRef.current && toggle(index, chartRef.current)}
        />
      )}
      <ChartFrame
        canvasRef={canvasRef}
        label={label}
        tooltip={tooltip}
        empty={populated ? '' : empty}
      />
    </>
  );
}

/** One money series as a smooth line over a gradient (cash by month or report interval). */
export function AreaChart({
  points,
  label,
  name = 'Cash received',
  tall = false,
}: {
  points: (Point & { value: number })[];
  label: string;
  name?: string;
  tall?: boolean;
}) {
  const labels = points.map((point) => point.label);
  const values = points.map((point) => point.value);
  const total = values.reduce((sum, value) => sum + value, 0);
  const { canvasRef, tooltip } = useChartJs<'line'>(
    (tokens, showTooltip): ChartConfiguration<'line'> => ({
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: name,
            data: values,
            borderColor: tokens.colors.line,
            backgroundColor: areaFill(tokens.colors.line, 0.3),
            fill: 'origin',
            borderWidth: 2.5,
            tension: 0.4,
            cubicInterpolationMode: 'monotone',
            pointRadius: labels.length > 8 ? 0 : 3.5,
            pointHoverRadius: 6,
            pointHitRadius: 14,
            pointBackgroundColor: tokens.card,
            pointBorderColor: tokens.colors.line,
            pointBorderWidth: 2,
            pointHoverBackgroundColor: tokens.card,
            pointHoverBorderColor: tokens.colors.line,
            pointHoverBorderWidth: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: motion(false),
        transitions: focusTransitions(),
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 8, right: 8 } },
        scales: cartesianScales(tokens, compactCash, labels),
        plugins: tooltipPlugin<'line'>(
          tokens,
          showTooltip,
          (index) => labels[index] ?? '',
          (_datasetIndex, _index, value) => ({ label: name, value: money(value), color: 'line' }),
        ),
      },
    }),
    JSON.stringify([labels, values]),
  );
  return (
    <ChartFrame
      canvasRef={canvasRef}
      label={label}
      tooltip={tooltip}
      empty={total ? '' : 'No cash recorded'}
      tall={tall}
    />
  );
}

type BarPoint = Point & { values: number[] };

/**
 * Rounded bars that rise one after another. Several series form groups with a legend; a single
 * series takes one colour per bar (for example the stages of inquiry conversion).
 */
export function BarChart({
  points,
  series,
  label,
  empty,
}: {
  points: BarPoint[];
  series: { name: string; total?: string }[];
  label: string;
  empty: string;
}) {
  const { hidden, toggle } = useSeriesToggle(series.length);
  const labels = points.map((point) => point.label);
  const single = series.length === 1;
  const populated = points.some((point) => point.values.some(Boolean));
  const legend = series.map((item, index) => ({
    ...item,
    color: seriesColors[index % seriesColors.length],
  }));
  const { canvasRef, chartRef, tooltip } = useChartJs<'bar'>(
    (tokens, showTooltip): ChartConfiguration<'bar'> => {
      const palette = seriesColors.map((color) => tokens.colors[color]);
      let lastHover = '';
      return {
        type: 'bar',
        data: {
          labels,
          datasets: series.map((item, n) => {
            const color = single
              ? labels.map((_, index) => palette[index % palette.length])
              : palette[n % palette.length];
            return {
              label: item.name,
              data: points.map((point) => point.values[n] ?? 0),
              hidden: hidden[n],
              backgroundColor: focusFill<'bar'>(color),
              hoverBackgroundColor: color,
              borderRadius: 6,
              borderSkipped: 'start',
              maxBarThickness: 30,
              categoryPercentage: 0.62,
              barPercentage: single ? 0.7 : 0.86,
            };
          }),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: motion(true),
          transitions: focusTransitions(),
          interaction: { mode: 'index', intersect: false },
          layout: { padding: { top: 8 } },
          scales: cartesianScales(tokens, compactCount, labels),
          // Re-resolve colours when the hovered group changes, so the other bars dim smoothly.
          onHover: (_event, elements, chart) => {
            const hover = elements.map((element) => element.index).join();
            if (hover === lastHover) return;
            lastHover = hover;
            refocus(chart);
          },
          plugins: tooltipPlugin<'bar'>(
            tokens,
            showTooltip,
            (index) => labels[index] ?? '',
            (datasetIndex, index, value) => ({
              label: series[datasetIndex].name,
              value: chartCount(value),
              color: single
                ? seriesColors[index % seriesColors.length]
                : seriesColors[datasetIndex % seriesColors.length],
            }),
          ),
        },
      };
    },
    JSON.stringify([labels, points.map((point) => point.values)]),
  );
  return (
    <>
      {!single && (
        <SeriesLegend
          items={legend}
          hidden={hidden}
          onToggle={(index) => chartRef.current && toggle(index, chartRef.current)}
        />
      )}
      <ChartFrame
        canvasRef={canvasRef}
        label={label}
        tooltip={tooltip}
        empty={populated ? '' : empty}
      />
    </>
  );
}

type Slice = { key: string; label: string; count: number; value?: string };

/**
 * A ring with its total in the centre. Pointing at a slice, or at its legend row, lifts the slice,
 * dims the others and shows that slice's share in the centre.
 */
export function DonutChart({
  slices,
  label,
  center,
  caption,
}: {
  slices: Slice[];
  label: string;
  center: string;
  caption: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  const share = (count: number) => (total ? `${((count / total) * 100).toFixed(1)}%` : '0%');
  const { canvasRef, chartRef } = useChartJs<'doughnut'>(
    (tokens): ChartConfiguration<'doughnut'> => {
      const palette = slices.map(
        (_, index) => tokens.colors[seriesColors[index % seriesColors.length]],
      );
      const reduced = prefersReducedMotion();
      let lastHover: number | null = null;
      return {
        type: 'doughnut',
        data: {
          labels: slices.map((slice) => slice.label),
          datasets: [
            {
              data: total ? slices.map((slice) => slice.count) : [1],
              backgroundColor: total ? focusFill<'doughnut'>(palette) : [tokens.divider],
              hoverBackgroundColor: total ? palette : [tokens.divider],
              borderColor: tokens.card,
              borderWidth: 3,
              borderRadius: 4,
              hoverOffset: total ? 10 : 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '70%',
          layout: { padding: 12 },
          transitions: focusTransitions(),
          animation: reduced
            ? false
            : { duration: 1000, easing: 'easeOutQuart', animateRotate: true, animateScale: false },
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          onHover: (_event, elements, chart) => {
            const index = total && elements.length ? elements[0].index : null;
            if (index === lastHover) return;
            lastHover = index;
            refocus(chart);
            setActive(index);
          },
        },
      };
    },
    JSON.stringify(slices.map((slice) => slice.count)),
  );
  const highlight = (index: number | null) => {
    const chart = chartRef.current;
    if (!chart || !total) return;
    chart.setActiveElements(index === null ? [] : [{ datasetIndex: 0, index }]);
    refocus(chart);
    setActive(index);
  };
  const shown = active === null ? null : slices[active];
  return (
    <>
      <div className={styles.donutScene}>
        <canvas ref={canvasRef} role="img" aria-label={label} />
        <div className={styles.donutCenter} aria-hidden="true">
          {/* Keys re-mount the text so it fades in when the pointed-at slice changes. */}
          <strong key={`value-${active ?? 'total'}`}>{shown ? share(shown.count) : center}</strong>
          <span key={`label-${active ?? 'total'}`}>{shown ? shown.label : caption}</span>
        </div>
      </div>
      <ul className={styles.reservationLegend}>
        {slices.map((slice, index) => (
          <li
            key={slice.key}
            data-active={active === index}
            onMouseEnter={() => highlight(index)}
            onMouseLeave={() => highlight(null)}
          >
            <span>
              <i className={`${styles.swatch} ${chartTones[index % chartTones.length]}`} />
              {slice.label}
            </span>
            <strong>
              {slice.value ?? chartCount(slice.count)} <small>{share(slice.count)}</small>
            </strong>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Decorative trend line for KPI cards; the card's accessible name carries the values. */
export function Sparkline({ values }: { values: number[] }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const maximum = Math.max(1, ...values);
  const points = values.map((value, index) => ({
    x: values.length === 1 ? 50 : 2 + (index / (values.length - 1)) * 96,
    y: 29 - (value / maximum) * 25,
  }));
  const line = smoothLinePath(points);
  const area =
    points.length > 1 ? `${line} L${points[points.length - 1].x} 32 L${points[0].x} 32 Z` : '';
  return (
    <svg
      className={styles.sparkline}
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.24" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-reveal`}>
          <rect className={styles.sparklineReveal} x="0" y="-4" width="100" height="40" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-reveal)`}>
        {area && <path d={area} fill={`url(#${id}-fill)`} />}
        <path className={styles.sparklineLine} d={line} />
      </g>
    </svg>
  );
}
