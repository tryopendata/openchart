/**
 * React Chart component: thin wrapper around the vanilla adapter.
 *
 * Mounts a chart instance on render, updates when spec changes,
 * and cleans up on unmount. All heavy lifting is done by the vanilla
 * createChart() function.
 */

import type {
  ChartEventHandlers,
  ChartSpec,
  DarkMode,
  GraphSpec,
  ThemeConfig,
} from '@opendata-ai/openchart-core';
import { type ChartInstance, createChart, type MountOptions } from '@opendata-ai/openchart-vanilla';
import { type CSSProperties, useCallback, useEffect, useRef } from 'react';
import { useVizDarkMode, useVizTheme } from './ThemeContext';

export interface ChartProps extends ChartEventHandlers {
  /** The visualization spec to render. */
  spec: ChartSpec | GraphSpec;
  /** Theme overrides. */
  theme?: ThemeConfig;
  /** Dark mode: "auto", "force", or "off". */
  darkMode?: DarkMode;
  /** Callback when a data point is clicked. @deprecated Use onMarkClick instead. */
  onDataPointClick?: (data: Record<string, unknown>) => void;
  /** CSS class name for the wrapper div. */
  className?: string;
  /** Inline styles for the wrapper div. */
  style?: CSSProperties;
}

/**
 * React component that renders a visualization from a spec.
 *
 * Uses the vanilla adapter internally. The spec is compiled and rendered
 * as SVG inside a wrapper div. Spec changes trigger re-renders via the
 * vanilla adapter's update() method.
 */
export function Chart({
  spec,
  theme: themeProp,
  darkMode,
  onDataPointClick,
  onMarkClick,
  onMarkHover,
  onMarkLeave,
  onLegendToggle,
  onAnnotationClick,
  onAnnotationEdit,
  onEdit,
  className,
  style,
}: ChartProps) {
  const contextTheme = useVizTheme();
  const contextDarkMode = useVizDarkMode();
  const theme = themeProp ?? contextTheme;
  const resolvedDarkMode = darkMode ?? contextDarkMode;
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ChartInstance | null>(null);
  const specRef = useRef<string>('');

  // Store event handlers in refs so they don't trigger chart recreation.
  // Inline arrow functions create new references every render, which would
  // destroy and recreate the entire chart instance without this pattern.
  const handlersRef = useRef<{
    onDataPointClick?: ChartProps['onDataPointClick'];
    onMarkClick?: ChartProps['onMarkClick'];
    onMarkHover?: ChartProps['onMarkHover'];
    onMarkLeave?: ChartProps['onMarkLeave'];
    onLegendToggle?: ChartProps['onLegendToggle'];
    onAnnotationClick?: ChartProps['onAnnotationClick'];
    onAnnotationEdit?: ChartProps['onAnnotationEdit'];
    onEdit?: ChartProps['onEdit'];
  }>({});
  handlersRef.current = {
    onDataPointClick,
    onMarkClick,
    onMarkHover,
    onMarkLeave,
    onLegendToggle,
    onAnnotationClick,
    onAnnotationEdit,
    onEdit,
  };

  // Stable callback wrappers that read from refs
  const stableOnDataPointClick = useCallback(
    (data: Record<string, unknown>) => handlersRef.current.onDataPointClick?.(data),
    [],
  );
  const stableOnMarkClick = useCallback(
    (event: import('@opendata-ai/openchart-core').MarkEvent) =>
      handlersRef.current.onMarkClick?.(event),
    [],
  );
  const stableOnMarkHover = useCallback(
    (event: import('@opendata-ai/openchart-core').MarkEvent) =>
      handlersRef.current.onMarkHover?.(event),
    [],
  );
  const stableOnMarkLeave = useCallback(() => handlersRef.current.onMarkLeave?.(), []);
  const stableOnLegendToggle = useCallback(
    (series: string, visible: boolean) => handlersRef.current.onLegendToggle?.(series, visible),
    [],
  );
  const stableOnAnnotationClick = useCallback(
    (annotation: import('@opendata-ai/openchart-core').Annotation, event: MouseEvent) =>
      handlersRef.current.onAnnotationClick?.(annotation, event),
    [],
  );
  const stableOnAnnotationEdit = useCallback(
    (
      annotation: import('@opendata-ai/openchart-core').TextAnnotation,
      updatedOffset: import('@opendata-ai/openchart-core').AnnotationOffset,
    ) => handlersRef.current.onAnnotationEdit?.(annotation, updatedOffset),
    [],
  );
  const stableOnEdit = useCallback(
    (edit: import('@opendata-ai/openchart-core').ElementEdit) => handlersRef.current.onEdit?.(edit),
    [],
  );

  // Mount chart and recreate when theme/darkMode change.
  // Event handlers use stable refs so they don't trigger recreation.
  // biome-ignore lint/correctness/useExhaustiveDependencies: spec intentionally excluded - spec changes handled via update() in Effect 2
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const options: MountOptions = {
      theme,
      darkMode: resolvedDarkMode,
      onDataPointClick: stableOnDataPointClick,
      onMarkClick: stableOnMarkClick,
      onMarkHover: stableOnMarkHover,
      onMarkLeave: stableOnMarkLeave,
      onLegendToggle: stableOnLegendToggle,
      onAnnotationClick: stableOnAnnotationClick,
      // Only include editing callbacks when the consumer provides them.
      // The stable wrappers are always truthy, so gating on handlersRef
      // avoids adding unstable prop references to the effect deps.
      ...(handlersRef.current.onAnnotationEdit ? { onAnnotationEdit: stableOnAnnotationEdit } : {}),
      ...(handlersRef.current.onEdit ? { onEdit: stableOnEdit } : {}),
      responsive: true,
    };

    chartRef.current = createChart(container, spec, options);
    specRef.current = JSON.stringify(spec);

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
    // Only recreate when theme or darkMode change. Event handlers use stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    theme,
    resolvedDarkMode,
    stableOnAnnotationClick,
    stableOnDataPointClick,
    stableOnEdit,
    stableOnLegendToggle,
    stableOnMarkClick,
    stableOnMarkHover,
    stableOnMarkLeave,
    stableOnAnnotationEdit,
  ]);

  // Update chart when spec changes
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const specString = JSON.stringify(spec);
    if (specString !== specRef.current) {
      specRef.current = specString;
      chart.update(spec);
    }
  }, [spec]);

  return (
    <div
      ref={containerRef}
      className={className ? `viz-chart-root ${className}` : 'viz-chart-root'}
      style={style}
    />
  );
}
