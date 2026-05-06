/**
 * React Chart component: thin wrapper around the vanilla adapter.
 *
 * Mounts a chart instance on render, updates when spec changes,
 * and cleans up on unmount. All heavy lifting is done by the vanilla
 * createChart() function.
 */
// biome-ignore-all lint/correctness/useHookAtTopLevel: Biome doesn't recognize overloaded function declarations as React components; hooks are correctly at the top level of ChartInner

import type {
  ChartEventHandlers,
  ChartSpec,
  DarkMode,
  DataRow,
  ElementRef,
  GraphSpec,
  LayerSpec,
  ThemeConfig,
} from '@opendata-ai/openchart-core';
import { type ChartInstance, createChart, type MountOptions } from '@opendata-ai/openchart-vanilla';
import {
  type CSSProperties,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { useVizDarkMode, useVizTheme } from './ThemeContext';

export interface ChartHandle {
  /** Get the currently selected element, or null if none. */
  getSelectedElement(): ElementRef | null;
  /** Programmatically select an element. */
  select(ref: ElementRef): void;
  /** Deselect the current element. */
  deselect(): void;
  /** The underlying chart instance (null until mounted). */
  readonly instance: ChartInstance | null;
}

export interface ChartProps<TData extends DataRow = DataRow> extends ChartEventHandlers {
  /** The visualization spec to render. */
  spec: ChartSpec<TData> | LayerSpec<TData> | GraphSpec;
  /** Theme overrides. */
  theme?: ThemeConfig;
  /** Dark mode: "auto", "force", or "off". */
  darkMode?: DarkMode;
  /** Callback when a data point is clicked. @deprecated Use onMarkClick instead. */
  onDataPointClick?: (data: Record<string, unknown>) => void;
  /** The currently selected element (controlled). */
  selectedElement?: ElementRef;
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
 *
 * Pass a typed data row as the generic to get field autocomplete:
 * ```tsx
 * type SalesRow = { date: string; revenue: number };
 * <Chart<SalesRow> spec={{ mark: 'line', data: rows, encoding: { x: { field: 'date', ... } } }} />
 * ```
 */
// forwardRef doesn't support generics natively in TypeScript, so we use the
// inner function + cast pattern to preserve the generic on the public API.
function ChartInner<TData extends DataRow = DataRow>(
  props: ChartProps<TData> & React.RefAttributes<ChartHandle>,
  ref: React.Ref<ChartHandle>,
): React.ReactElement | null;
function ChartInner(
  props: ChartProps & { ref?: React.Ref<ChartHandle> },
  ref: React.Ref<ChartHandle>,
): React.ReactElement | null;
function ChartInner(
  {
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
    onSelect,
    onDeselect,
    onTextEdit,
    selectedElement: selectedElementProp,
    className,
    style,
  }: ChartProps,
  ref: React.Ref<ChartHandle>,
) {
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
    onSelect?: ChartProps['onSelect'];
    onDeselect?: ChartProps['onDeselect'];
    onTextEdit?: ChartProps['onTextEdit'];
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
    onSelect,
    onDeselect,
    onTextEdit,
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
  const stableOnSelect = useCallback(
    (element: ElementRef) => handlersRef.current.onSelect?.(element),
    [],
  );
  const stableOnDeselect = useCallback(
    (element: ElementRef) => handlersRef.current.onDeselect?.(element),
    [],
  );
  const stableOnTextEdit = useCallback(
    (element: ElementRef, oldText: string, newText: string) =>
      handlersRef.current.onTextEdit?.(element, oldText, newText),
    [],
  );

  // Expose imperative handle for ref-based control
  useImperativeHandle(
    ref,
    () => ({
      getSelectedElement() {
        return chartRef.current?.getSelectedElement() ?? null;
      },
      select(elementRef: ElementRef) {
        chartRef.current?.select(elementRef);
      },
      deselect() {
        chartRef.current?.deselect();
      },
      get instance() {
        return chartRef.current;
      },
    }),
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
      ...(handlersRef.current.onSelect ? { onSelect: stableOnSelect } : {}),
      ...(handlersRef.current.onDeselect ? { onDeselect: stableOnDeselect } : {}),
      ...(handlersRef.current.onTextEdit ? { onTextEdit: stableOnTextEdit } : {}),
      ...(selectedElementProp ? { selectedElement: selectedElementProp } : {}),
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
    stableOnSelect,
    stableOnDeselect,
    stableOnTextEdit,
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

  // Handle selectedElement prop changes separately (like Vue/Svelte adapters)
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !chart.select) return;

    if (selectedElementProp) {
      chart.select(selectedElementProp);
    } else if (chart.getSelectedElement?.()) {
      chart.deselect();
    }
  }, [selectedElementProp]);

  return (
    <div
      ref={containerRef}
      className={className ? `oc-chart-root ${className}` : 'oc-chart-root'}
      style={style}
    />
  );
}

/**
 * Generic Chart component with field autocomplete support.
 *
 * Pass your data row type to get compile-time field validation:
 * ```tsx
 * type SalesRow = { date: string; revenue: number; region: string };
 * <Chart<SalesRow> spec={{ mark: 'line', data: rows, encoding: { x: { field: 'date', type: 'temporal' } } }} />
 * ```
 *
 * Without a type parameter, behaves identically to before — no migration needed.
 */
export const Chart = forwardRef(ChartInner) as <TData extends DataRow = DataRow>(
  props: ChartProps<TData> & { ref?: React.Ref<ChartHandle> },
) => React.ReactElement | null;
// Restore display name lost by the forwardRef + cast pattern
(Chart as React.FC).displayName = 'Chart';
