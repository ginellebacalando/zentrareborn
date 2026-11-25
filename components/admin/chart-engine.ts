/*
 * Admin charts on Chart.js (docs/admin-design.md): the interactive, animated look of the Metis
 * template in ZENTRA colours. Colours are read at runtime from the --admin-* tokens of the chart's
 * own subtree, so the light and dark themes both apply and no colour is written in code. Every chart
 * also keeps an exact-value table for assistive technology (ChartPrimitives.tsx).
 */
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartType,
  type Plugin,
  type UpdateMode,
  type ScriptableContext,
  type TooltipModel,
} from 'chart.js';

export type ChartColor =
  'series1' | 'series2' | 'series3' | 'series4' | 'series5' | 'confirmed' | 'cancelled' | 'line';

export type ChartTokens = {
  ink: string;
  muted: string;
  divider: string;
  border: string;
  card: string;
  font: string;
  colors: Record<ChartColor, string>;
};

/** What the HTML tooltip shows; the chart's data table carries the same values for screen readers. */
export type TooltipRow = { key: string; color: string; label: string; value: string };
export type TooltipState = {
  visible: boolean;
  x: number;
  y: number;
  below: boolean;
  title: string;
  rows: TooltipRow[];
};
export const hiddenTooltip: TooltipState = {
  visible: false,
  x: 0,
  y: 0,
  below: false,
  title: '',
  rows: [],
};

const tokensByChart = new WeakMap<Chart, ChartTokens>();

/** A dashed vertical guide at the hovered month on line charts. */
const crosshair: Plugin = {
  id: 'zentraCrosshair',
  afterDatasetsDraw(chart) {
    const tokens = tokensByChart.get(chart);
    const active = chart.getActiveElements();
    if (!tokens || !active.length || (chart.config as { type?: string }).type !== 'line') return;
    const { ctx, chartArea } = chart;
    const x = active[0].element.x;
    ctx.save();
    ctx.strokeStyle = tokens.border;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.stroke();
    ctx.restore();
  },
};

Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  crosshair,
);

export function readChartTokens(element: Element): ChartTokens {
  const style = getComputedStyle(element);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return {
    ink: token('--admin-ink'),
    muted: token('--admin-muted'),
    divider: token('--admin-divider'),
    border: token('--admin-border'),
    card: token('--admin-surface-card'),
    font: style.fontFamily,
    colors: {
      series1: token('--admin-series-1'),
      series2: token('--admin-series-2'),
      series3: token('--admin-series-3'),
      series4: token('--admin-series-4'),
      series5: token('--admin-series-5'),
      confirmed: token('--admin-status-confirmed'),
      cancelled: token('--admin-status-cancelled'),
      line: token('--admin-chart-line'),
    },
  };
}

export function rememberTokens(chart: Chart, tokens: ChartTokens) {
  tokensByChart.set(chart, tokens);
}

/** A token colour with transparency (#rrggbb becomes #rrggbbaa); other formats pass through. */
export function withAlpha(color: string, alpha: number) {
  const hex = /^#([\da-f]{6})$/i.exec(color)?.[1];
  if (!hex) return color;
  const byte = Math.round(Math.min(1, Math.max(0, alpha)) * 255);
  return `#${hex}${byte.toString(16).padStart(2, '0')}`;
}

/** A soft top-to-bottom fill under a line, fading into the card. */
export function areaFill(color: string, strength = 0.3) {
  return (context: ScriptableContext<'line'>) => {
    const { chart } = context;
    const area = chart.chartArea;
    if (!area) return withAlpha(color, strength / 2);
    const gradient = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
    gradient.addColorStop(0, withAlpha(color, strength));
    gradient.addColorStop(1, withAlpha(color, 0));
    return gradient;
  };
}

/** Dims every bar or slice except the hovered one, so the eye lands on what the pointer is on. */
export function focusFill<T extends 'bar' | 'doughnut'>(color: string | string[]) {
  return (context: ScriptableContext<T>) => {
    const base = Array.isArray(color) ? color[context.dataIndex % color.length] : color;
    const anyActive = context.chart.getActiveElements().length > 0;
    return anyActive && !context.active ? withAlpha(base, 0.35) : base;
  };
}

/**
 * Hover focus: a short, separate transition. Only the hovered bar or slice resolves its hover style
 * (full colour, lifted); the rest resolve their normal style, which dims while something is hovered.
 * Chart.js supports custom transition modes; its types list only the built-in ones.
 */
const FOCUS = 'focus' as UpdateMode;
export function focusTransitions() {
  // Hover changes are instant under reduced motion (Chart.js' own hover transition included).
  const duration = prefersReducedMotion() ? 0 : 260;
  return {
    [FOCUS]: { animation: { duration, easing: 'easeOutQuad' as const } },
    active: { animation: { duration: prefersReducedMotion() ? 0 : 400 } },
  };
}
export function refocus(chart: { update: (mode?: UpdateMode) => void }) {
  chart.update(FOCUS);
}

export function prefersReducedMotion() {
  return typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

/** Shared motion: a quick ease-out, bars and points arriving one after another. */
export function motion(stagger: boolean) {
  if (prefersReducedMotion()) return false as const;
  return {
    duration: 900,
    easing: 'easeOutQuart' as const,
    delay: stagger
      ? (context: { type: string; mode: string; dataIndex: number; datasetIndex: number }) =>
          context.type === 'data' && context.mode === 'default'
            ? context.dataIndex * 45 + context.datasetIndex * 90
            : 0
      : undefined,
  };
}

/** Builds the HTML tooltip state from Chart.js' tooltip model, kept inside the chart's width. */
export function tooltipState<T extends ChartType>(
  width: number,
  tooltip: TooltipModel<T>,
  title: (index: number) => string,
  row: (datasetIndex: number, index: number, value: number) => TooltipRow | null,
): TooltipState {
  if (!tooltip.opacity || !tooltip.dataPoints?.length) return { ...hiddenTooltip };
  const index = tooltip.dataPoints[0].dataIndex;
  const rows = tooltip.dataPoints
    .map((point) => row(point.datasetIndex, point.dataIndex, Number(point.raw) || 0))
    .filter((item): item is TooltipRow => item !== null);
  const margin = 84;
  return {
    visible: true,
    x: Math.min(Math.max(tooltip.caretX, margin), Math.max(margin, width - margin)),
    y: tooltip.caretY,
    below: tooltip.caretY < 88,
    title: title(index),
    rows,
  };
}

/** Axis ticks and grid in the ZENTRA admin style: dashed hairlines, muted 12px labels. */
export function cartesianScales(
  tokens: ChartTokens,
  formatTick: (value: number) => string,
  labels: string[],
) {
  const font = { family: tokens.font, size: 12 };
  return {
    x: {
      grid: { display: false },
      border: { display: false },
      ticks: {
        color: tokens.muted,
        font,
        maxRotation: 0,
        autoSkipPadding: 12,
        callback: (_value: unknown, index: number) => labels[index]?.split(' ')[0] ?? '',
      },
    },
    y: {
      beginAtZero: true,
      grace: '8%',
      // In Chart.js 4 the border's dash also dashes the grid lines (Metis' dashed guides).
      border: { display: false, dash: [4, 4] },
      grid: { color: tokens.divider, drawTicks: false },
      ticks: {
        color: tokens.muted,
        font,
        padding: 10,
        maxTicksLimit: 5,
        precision: 0,
        callback: (value: string | number) => formatTick(Number(value)),
      },
    },
  };
}
