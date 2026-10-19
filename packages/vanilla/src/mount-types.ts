/** Public types for chart mounts: options, update options, and the instance API. */

import type {
  ChartEventHandlers,
  ChartLayout,
  ChartSpec,
  DarkMode,
  ElementRef,
  LayerSpec,
  ThemeConfig,
} from '@opendata-ai/openchart-core';
import type { JPGExportOptions, SVGExportOptions } from './export';
import type { GIFExportOptions } from './export-gif';
import type { TransitionHandle } from './transition';

/**
 * What a chart lets the reader do with its elements.
 *
 * - `'read'`: no selection or editing; arrow keys navigate data points.
 * - `'select'`: click/Tab selection with `onSelect`/`onDeselect`; arrow keys
 *   still navigate data. No drags, nudges, text editing, or delete.
 * - `'edit'`: selection plus every edit gesture, emitted through `onEdit`.
 *   Arrow keys nudge the selection instead of navigating data.
 */
export type InteractionMode = 'read' | 'select' | 'edit';

/**
 * Resolve the interaction mode a mount runs in. An explicit `interaction`
 * wins; otherwise `onEdit` implies `'edit'`, `onSelect`/`onDeselect` imply
 * `'select'`, and no callbacks means `'read'`.
 */
export function resolveInteractionMode(opts?: {
  interaction?: InteractionMode;
  onEdit?: unknown;
  onSelect?: unknown;
  onDeselect?: unknown;
}): InteractionMode {
  if (opts?.interaction) return opts.interaction;
  if (opts?.onEdit) return 'edit';
  if (opts?.onSelect || opts?.onDeselect) return 'select';
  return 'read';
}

export interface MountOptions extends ChartEventHandlers {
  /** Quiet row inspection for simple horizontal bars. Runtime only; omitted by default. */
  rowHover?: boolean;
  /**
   * Interaction mode. When omitted it is inferred once from the callbacks:
   * `onEdit` -> `'edit'`, `onSelect`/`onDeselect` -> `'select'`, else `'read'`.
   * See {@link InteractionMode}.
   */
  interaction?: InteractionMode;
  /** Theme overrides. */
  theme?: ThemeConfig;
  /** Dark mode setting: "auto" (system pref), "force", or "off". */
  darkMode?: DarkMode;
  /**
   * Rendering backend for point marks (mirrors vega-embed's `renderer`
   * option). `'auto'` (default) promotes dense scatters (>1,000 points) to a
   * canvas mark layer; `'svg'`/`'canvas'` force a backend. Ignored with a
   * console warning for non-point marks and faceted/layered/sparkline charts.
   */
  renderer?: 'auto' | 'svg' | 'canvas';
  /** Observe container resizing. Defaults to true. */
  autoResize?: boolean;
  /** Show the OpenData watermark. Defaults to true. */
  watermark?: boolean;
  /** Initial selected element. */
  selectedElement?: ElementRef;
}

export interface UpdateOptions {
  /** Source revision for subsequent edit transactions. */
  revision?: string | number;
  /** Override the selected element after update. When omitted, preserves current selection. */
  selectedElement?: ElementRef;
}

export interface ExportOptions extends JPGExportOptions {
  // Extensible for future formats (extends JPGExportOptions which extends PNGExportOptions)
}

export interface ChartInstance {
  /** Re-compile and re-render with a new spec. */
  update(spec: ChartSpec | LayerSpec, options?: UpdateOptions): void;
  /**
   * Re-render with a new spec and start a MANUAL update transition the caller
   * drives via `handle.step(elapsedMs)`, with no rAF clock. Returns the handle,
   * or null when no transition applies (the render already swapped instantly).
   * For headless frame capture (e.g. GIF export of a spec-swap stepper).
   */
  beginManualUpdate(spec: ChartSpec | LayerSpec): TransitionHandle | null;
  /** Re-compile at current container dimensions. */
  resize(): void;
  /** Geometry currently visible, sampled on demand for reader hit testing. */
  sampleLayout(): ChartLayout;
  /** Export the chart. */
  export(format: 'svg'): string;
  export(format: 'svg-with-fonts', options?: SVGExportOptions): Promise<string>;
  export(format: 'png', options?: ExportOptions): Promise<Blob>;
  export(format: 'jpg', options?: ExportOptions): Promise<Blob>;
  export(format: 'gif', options?: GIFExportOptions): Promise<Blob>;
  export(format: 'csv'): string;
  export(
    format: 'svg' | 'svg-with-fonts' | 'png' | 'jpg' | 'gif' | 'csv',
    options?: ExportOptions | GIFExportOptions,
  ): string | Promise<Blob> | Promise<string>;
  /** Remove all DOM elements and disconnect observers. */
  destroy(): void;
  /** The current compiled layout (for hooks / debugging). */
  readonly layout: ChartLayout;
  /** Get the currently selected element, or null if none. */
  getSelectedElement(): ElementRef | null;
  /** Programmatically select an element. Silent no-op if element not found. */
  select(ref: ElementRef): void;
  /** Deselect the current element. */
  deselect(): void;
  /** Whether inline text editing (the annotation/chrome text overlay) is active. */
  readonly isTextEditing: boolean;
  /** Set highlight values on the color encoding and re-render. Pass null to clear. */
  setHighlight(values: string[] | null): void;
  /**
   * Reset a "you draw it" (`youDrawIt`) drawing: clears the reader's guess and
   * returns to the drawing state. No-op when youDrawIt isn't enabled.
   */
  resetDrawing(): void;
  /**
   * Reveal a "you draw it" drawing programmatically (equivalent to the
   * skip-to-reveal button). No-op when youDrawIt isn't enabled.
   */
  revealDrawing(): void;
}
