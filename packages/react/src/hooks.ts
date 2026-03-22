/**
 * React hooks for chart lifecycle and dark mode resolution.
 *
 * useChart: manual control over a chart instance (for advanced usage).
 * useDarkMode: resolves the DarkMode preference to a boolean.
 */

import type {
  ChartLayout,
  ChartSpec,
  DarkMode,
  GraphSpec,
  LayerSpec,
} from '@opendata-ai/openchart-core';
import { type ChartInstance, createChart, type MountOptions } from '@opendata-ai/openchart-vanilla';
import { useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// useChart
// ---------------------------------------------------------------------------

export interface UseChartOptions {
  /** Theme overrides. */
  theme?: MountOptions['theme'];
  /** Dark mode setting. */
  darkMode?: MountOptions['darkMode'];
  /** Data point click handler. */
  onDataPointClick?: MountOptions['onDataPointClick'];
  /** Enable responsive resizing. Defaults to true. */
  responsive?: boolean;
}

export interface UseChartReturn {
  /** Ref to attach to the container div. */
  ref: React.RefObject<HTMLDivElement | null>;
  /** The chart instance (null until mounted). */
  chart: ChartInstance | null;
  /** The current compiled layout (null until mounted). */
  layout: ChartLayout | null;
}

/**
 * Hook for manual chart lifecycle control.
 *
 * Attach the returned ref to a container div. The chart mounts
 * automatically and updates when the spec changes.
 *
 * @param spec - The visualization spec.
 * @param options - Mount options.
 * @returns { ref, chart, layout }
 */
export function useChart(
  spec: ChartSpec | LayerSpec | GraphSpec,
  options?: UseChartOptions,
): UseChartReturn {
  const ref = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ChartInstance | null>(null);
  const [layout, setLayout] = useState<ChartLayout | null>(null);
  const specRef = useRef<string>('');

  // Mount / unmount
  // biome-ignore lint/correctness/useExhaustiveDependencies: spec intentionally excluded - spec changes handled via update() in the update effect
  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const mountOpts: MountOptions = {
      theme: options?.theme,
      darkMode: options?.darkMode,
      onDataPointClick: options?.onDataPointClick,
      responsive: options?.responsive,
    };

    const chart = createChart(container, spec, mountOpts);
    chartRef.current = chart;
    setLayout(chart.layout);
    specRef.current = JSON.stringify(spec);

    return () => {
      chart.destroy();
      chartRef.current = null;
      setLayout(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options?.theme, options?.darkMode, options?.onDataPointClick, options?.responsive]);

  // Update on spec change
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const specString = JSON.stringify(spec);
    if (specString !== specRef.current) {
      specRef.current = specString;
      chart.update(spec);
      setLayout(chart.layout);
    }
  }, [spec]);

  return {
    ref,
    chart: chartRef.current,
    layout,
  };
}

// ---------------------------------------------------------------------------
// useDarkMode
// ---------------------------------------------------------------------------

/**
 * Resolve a DarkMode preference to a boolean.
 *
 * - "force" -> true
 * - "off" -> false
 * - "auto" -> matches system preference (reactive to changes)
 *
 * @param mode - The dark mode preference.
 * @returns Whether dark mode is active.
 */
export function useDarkMode(mode?: DarkMode): boolean {
  const [isDark, setIsDark] = useState(() => resolveInitial(mode));

  useEffect(() => {
    if (mode !== 'auto') {
      setIsDark(mode === 'force');
      return;
    }

    if (typeof window === 'undefined' || !window.matchMedia) {
      setIsDark(false);
      return;
    }

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDark(mq.matches);

    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mode]);

  return isDark;
}

function resolveInitial(mode?: DarkMode): boolean {
  if (mode === 'force') return true;
  if (mode === 'off' || mode === undefined) return false;
  // "auto"
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}
