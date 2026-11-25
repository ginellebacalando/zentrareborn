'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Chart, type ChartConfiguration, type ChartType } from 'chart.js';
import {
  hiddenTooltip,
  readChartTokens,
  rememberTokens,
  type ChartTokens,
  type TooltipState,
} from './chart-engine';

/** The HTML tooltip, plus whether it was already showing (only then does it glide). */
export type LiveTooltip = TooltipState & { moving: boolean };

type Builder<T extends ChartType> = (
  tokens: ChartTokens,
  showTooltip: (state: TooltipState) => void,
) => ChartConfiguration<T>;

/**
 * Creates a Chart.js chart on the returned canvas and destroys it on unmount. When `signature`
 * (a summary of the data) changes, the chart animates to the new values; when the admin theme
 * switches, it re-reads the colour tokens. Escape hides a visible tooltip (WCAG 1.4.13).
 */
export function useChartJs<T extends ChartType>(build: Builder<T>, signature: string) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart<T> | null>(null);
  const drawnSignature = useRef<string | null>(null);
  const [tooltip, setTooltip] = useState<LiveTooltip>({ ...hiddenTooltip, moving: false });

  const showTooltip = useEffectEvent((state: TooltipState) =>
    setTooltip((previous) =>
      state.visible
        ? { ...state, moving: previous.visible }
        : previous.visible
          ? { ...previous, visible: false, moving: false }
          : previous,
    ),
  );
  const currentSignature = useEffectEvent(() => signature);
  const configure = useEffectEvent((canvas: HTMLCanvasElement) => {
    const tokens = readChartTokens(canvas);
    return { tokens, config: build(tokens, (state) => showTooltip(state)) };
  });
  const redraw = useEffectEvent((chart: Chart<T>, canvas: HTMLCanvasElement, animate: boolean) => {
    const next = configure(canvas);
    rememberTokens(chart as unknown as Chart, next.tokens);
    chart.data = next.config.data;
    if (next.config.options) chart.options = next.config.options;
    chart.update(animate ? undefined : 'none');
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { tokens, config } = configure(canvas);
    const chart = new Chart(canvas, config);
    rememberTokens(chart as unknown as Chart, tokens);
    chartRef.current = chart;
    drawnSignature.current = currentSignature();
    // Theme switches change the tokens under the chart; redraw in place without animation.
    const scope = canvas.closest('[data-admin-theme]');
    const observer = new MutationObserver(() => redraw(chart, canvas, false));
    if (scope) observer.observe(scope, { attributes: true, attributeFilter: ['data-admin-theme'] });
    return () => {
      observer.disconnect();
      chart.destroy();
      chartRef.current = null;
      drawnSignature.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    const canvas = canvasRef.current;
    if (!chart || !canvas || drawnSignature.current === signature) return;
    drawnSignature.current = signature;
    redraw(chart, canvas, true);
  }, [signature]);

  useEffect(() => {
    if (!tooltip.visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const chart = chartRef.current;
      if (chart) {
        chart.setActiveElements([]);
        chart.tooltip?.setActiveElements([], { x: 0, y: 0 });
        chart.update('none');
      }
      setTooltip((previous) => ({ ...previous, visible: false, moving: false }));
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [tooltip.visible]);

  return { canvasRef, chartRef, tooltip };
}
