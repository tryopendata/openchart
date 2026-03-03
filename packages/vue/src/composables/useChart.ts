/**
 * useChart: composable for manual chart lifecycle control.
 *
 * Provides a template ref to attach to a container div. The chart
 * mounts automatically and updates when the spec changes.
 */

import type { ChartLayout, DarkMode, ThemeConfig, VizSpec } from '@opendata-ai/openchart-core';
import { type ChartInstance, createChart, type MountOptions } from '@opendata-ai/openchart-vanilla';
import { onMounted, onUnmounted, type Ref, ref, type ShallowRef, shallowRef, watch } from 'vue';

export interface UseChartOptions {
  /** Theme overrides. */
  theme?: ThemeConfig;
  /** Dark mode setting. */
  darkMode?: DarkMode;
  /** Data point click handler. */
  onDataPointClick?: MountOptions['onDataPointClick'];
  /** Enable responsive resizing. Defaults to true. */
  responsive?: boolean;
}

export interface UseChartReturn {
  /** Template ref to attach to the container div. */
  containerRef: Ref<HTMLDivElement | null>;
  /** The chart instance (null until mounted). */
  chart: ShallowRef<ChartInstance | null>;
  /** The current compiled layout (null until mounted). */
  layout: ShallowRef<ChartLayout | null>;
}

/**
 * Composable for manual chart lifecycle control.
 *
 * Attach the returned containerRef to a container div via `ref="containerRef"`.
 * The chart mounts automatically and updates when the spec changes.
 */
export function useChart(spec: Ref<VizSpec>, options?: UseChartOptions): UseChartReturn {
  const containerRef = ref<HTMLDivElement | null>(null);
  const chart = shallowRef<ChartInstance | null>(null);
  const layout = shallowRef<ChartLayout | null>(null);

  function mount() {
    const container = containerRef.value;
    if (!container) return;

    const mountOpts: MountOptions = {
      theme: options?.theme,
      darkMode: options?.darkMode,
      onDataPointClick: options?.onDataPointClick,
      responsive: options?.responsive,
    };

    const instance = createChart(container, spec.value, mountOpts);
    chart.value = instance;
    layout.value = instance.layout;
  }

  function destroy() {
    chart.value?.destroy();
    chart.value = null;
    layout.value = null;
  }

  onMounted(() => {
    mount();
  });

  onUnmounted(() => {
    destroy();
  });

  // Update on spec change
  watch(spec, (newSpec) => {
    const instance = chart.value;
    if (!instance) return;
    instance.update(newSpec);
    layout.value = instance.layout;
  });

  return {
    containerRef,
    chart,
    layout,
  };
}
