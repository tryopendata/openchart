/**
 * Graph renderer registry.
 *
 * `createGraph()` builds the shared shell (wrapper, chrome, legend element,
 * tooltip manager, resize wiring) and then hands off to a renderer. The 2D
 * Canvas renderer is built in. The 3D WebGL renderer lives on the
 * `@opendata-ai/openchart-vanilla/graph-3d` subpath and registers itself here
 * as a side effect of being imported, so three.js never enters the default
 * bundle. `createGraph()` never dynamically imports a renderer: mount is
 * synchronous because every framework wrapper assumes it is.
 */

import type { GraphSpec } from '@opendata-ai/openchart-core';
import type { GraphCompilation } from '@opendata-ai/openchart-engine';
import type { GraphInstance, GraphMountOptions } from '../graph-mount';
import type { TooltipManager } from '../tooltip';

/**
 * Everything a renderer needs from the shared mount shell. The shell owns the
 * DOM wrapper and its chrome/legend/tooltip children; the renderer owns the
 * surface it mounts between the chrome and the legend (a `<canvas>` for 2D,
 * the 3d-force-graph scene container for 3D) plus all simulation, camera and
 * interaction state.
 */
export interface GraphShell {
  /** The consumer's container element. */
  container: HTMLElement;
  /** `.oc-graph-wrapper` (carries `oc-dark` and the theme custom properties). */
  wrapper: HTMLElement;
  /** `.oc-graph-chrome` (title/subtitle HTML). */
  chromeEl: HTMLElement;
  /** `.oc-graph-legend`, or null when `options.legend === false`. */
  legendEl: HTMLElement | null;
  /** Shared DOM tooltip manager, or null when `options.tooltip === false`. */
  tooltipManager: TooltipManager | null;
  /** Resolved dark-mode flag used when the wrapper was built. */
  isDark: boolean;
  /**
   * Insert the renderer's surface element into the wrapper between the chrome
   * and the legend. Call exactly once.
   */
  mountSurface(el: HTMLElement): void;
  /** Re-render chrome HTML from the current compilation (after `update()`). */
  renderChrome(compilation: GraphCompilation): void;
  /** Re-measure the chrome and update the inset custom property. */
  syncChromeInset(): void;
  /** Current container size (width/height in CSS px, height floored at 200). */
  getSize(): { width: number; height: number };
  /**
   * Subscribe to container resizes. Honours `options.responsive === false`
   * (returns a no-op disconnect). The ResizeObserver fires once on first
   * layout, so renderers must tolerate an immediate callback.
   */
  observeResize(callback: () => void): () => void;
  /** Warn-once sink (`options.onWarn`, default `console.warn`). */
  warn(message: string): void;
  /** Remove the wrapper from the container and release the tooltip manager. */
  destroy(): void;
}

export interface GraphRendererContext {
  shell: GraphShell;
  spec: GraphSpec;
  compilation: GraphCompilation;
  options: GraphMountOptions | undefined;
  /** Recompile a spec with the mount's compile options (theme, darkMode, onWarn). */
  compile(spec: GraphSpec): GraphCompilation;
}

export type GraphRendererFactory = (ctx: GraphRendererContext) => GraphInstance;

const registry = new Map<2 | 3, GraphRendererFactory>();

/** Register a renderer for a dimension count. Later registrations replace earlier ones. */
export function registerGraphRenderer(dimensions: 3, factory: GraphRendererFactory): void {
  registry.set(dimensions, factory);
}

/** The registered renderer for a dimension count, or undefined. */
export function getGraphRenderer(dimensions: 2 | 3): GraphRendererFactory | undefined {
  return registry.get(dimensions);
}

/** Test hook: drop all registrations. */
export function resetGraphRendererRegistry(): void {
  registry.clear();
}

export const GRAPH_3D_NOT_REGISTERED_ERROR =
  'createGraph: dimensions: 3 requires import "@opendata-ai/openchart-vanilla/graph-3d"';
