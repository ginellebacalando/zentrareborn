/*
 * Admin charts on Chart.js (docs/admin-design.md): the interactive, animated look of the Metis
 * template in ZENTRA colours. Colours are read at runtime from the --admin-* tokens of the chart's
 * own subtree, so the light and dark themes both apply and no colour is written in code. Every chart
 * also keeps an exact-value table for assistive technology (ChartPrimitives.tsx).
 */
import {
  animator,
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
  type ChartOptions,
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

/** How long a line chart takes to draw in: the KPI sparklines' reveal (sparkReveal), 1.1 s. */
const REVEAL_MS = 1100;
type Reveal = {
  start: number;
  ease: (progress: number) => number;
  clipped: boolean;
  frame: number;
};
const reveals = new WeakMap<object, Reveal>();

/**
 * A CSS cubic-bezier() as a function of progress, so canvas motion keeps the page's own curve;
 * anything else falls back to an ease-out.
 */
function cssEasing(value: string): (progress: number) => number {
  const points = /cubic-bezier\(([^)]*)\)/.exec(value)?.[1].split(',').map(Number) ?? [];
  if (points.length !== 4 || !points.every(Number.isFinite)) {
    return (progress) => 1 - (1 - progress) ** 3;
  }
  const [x1, y1, x2, y2] = points;
  const curve = (a: number, b: number, t: number) =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (progress) => {
    // x grows with t on every CSS curve, so halving the range finds the t for this moment.
    let low = 0;
    let high = 1;
    for (let step = 0; step < 20; step++) {
      const middle = (low + high) / 2;
      if (curve(x1, x2, middle) < progress) low = middle;
      else high = middle;
    }
    return curve(y1, y2, (low + high) / 2);
  };
}

/**
 * Chart.js redraws only while its own animations run, so the reveal asks for frames until the line
 * is out. While Chart.js still animates it draws each frame itself; the check runs again next frame
 * rather than trusting that draw, because Chart.js can finish its animations in that very frame
 * without drawing, which would leave the line stuck short of its end.
 */
function keepDrawing(chart: Chart, reveal: Reveal) {
  cancelAnimationFrame(reveal.frame);
  reveal.frame = requestAnimationFrame(() => {
    if (animator.running(chart)) keepDrawing(chart, reveal);
    else chart.draw();
  });
}

/**
 * Line charts draw themselves in from left to right the first time they appear, on the sparklines'
 * duration and --motion-ease curve, so the dashboard's lines move together. Only the series are
 * uncovered; the axes are there from the start. Nothing moves under reduced motion.
 */
const lineReveal: Plugin = {
  id: 'zentraLineReveal',
  beforeDatasetsDraw(chart) {
    if ((chart.config as { type?: string }).type !== 'line') return;
    const now = performance.now();
    let reveal = reveals.get(chart);
    if (!reveal) {
      const ease = cssEasing(getComputedStyle(chart.canvas).getPropertyValue('--motion-ease'));
      reveal = { start: now, ease, clipped: false, frame: 0 };
      reveals.set(chart, reveal);
    }
    const progress = prefersReducedMotion() ? 1 : Math.min(1, (now - reveal.start) / REVEAL_MS);
    reveal.clipped = progress < 1;
    if (!reveal.clipped) return;
    const { ctx, chartArea } = chart;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, chartArea.left + chartArea.width * reveal.ease(progress), chart.height);
    ctx.clip();
    keepDrawing(chart, reveal);
  },
  afterDatasetsDraw(chart) {
    if (reveals.get(chart)?.clipped) chart.ctx.restore();
  },
  afterDestroy(chart) {
    cancelAnimationFrame(reveals.get(chart)?.frame ?? 0);
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
  // The reveal restores its clip before the crosshair draws, so a guide is never cut off.
  lineReveal,
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

/**
 * A line chart's first draw is uncovered by `lineReveal` at its final shape, as the sparklines are,
 * instead of rising from the baseline; afterwards each data change glides from where the line was.
 */
export function lineAnimations(): ChartOptions<'line'>['animations'] {
  return {
    y: {
      from: (context: ScriptableContext<'line'>) => {
        if (context.type !== 'data' || reveals.has(context.chart)) return undefined;
        const value = context.parsed.y;
        // A month without data (null) keeps Chart.js' own placement.
        if (value === null || !Number.isFinite(value)) return undefined;
        return context.chart.scales.y?.getPixelForValue(value);
      },
    },
  };
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
