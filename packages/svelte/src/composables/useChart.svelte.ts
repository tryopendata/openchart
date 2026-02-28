/**
 * useChart: composable for manual chart lifecycle control.
 *
 * Returns a Svelte action function for use with `use:chart` directive
 * and exposes the chart instance and compiled layout.
 *
 * Usage:
 * ```svelte
 * <script>
 *   const { action, chart, layout } = useChart(spec);
 * </script>
 * <div use:action></div>
 * ```
 *
 * Uses .svelte.ts extension so runes ($state, $effect) work outside
 * .svelte components.
 */

import type { ChartLayout, VizSpec } from '@openchart/core';
import { type ChartInstance, createChart, type MountOptions } from '@openchart/vanilla';

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
  /** Svelte action to attach to a container div. */
  action: (node: HTMLElement) => { destroy: () => void };
  /** The chart instance (null until mounted). */
  readonly chart: ChartInstance | null;
  /** The current compiled layout (null until mounted). */
  readonly layout: ChartLayout | null;
}

export function useChart(
  spec: () => VizSpec,
  options?: () => UseChartOptions | undefined,
): UseChartReturn {
  let chart = $state<ChartInstance | null>(null);
  let layout = $state<ChartLayout | null>(null);

  function action(node: HTMLElement) {
    $effect(() => {
      const currentSpec = spec();
      const opts = options?.();

      const mountOpts: MountOptions = {
        theme: opts?.theme,
        darkMode: opts?.darkMode,
        onDataPointClick: opts?.onDataPointClick,
        responsive: opts?.responsive ?? true,
      };

      const instance = createChart(node, currentSpec, mountOpts);
      chart = instance;
      layout = instance.layout;

      return () => {
        instance.destroy();
        chart = null;
        layout = null;
      };
    });

    return {
      destroy() {
        // $effect cleanup handles teardown
      },
    };
  }

  return {
    action,
    get chart() {
      return chart;
    },
    get layout() {
      return layout;
    },
  };
}
