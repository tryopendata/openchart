/**
 * Graph interaction resolver.
 *
 * Resolves `GraphInteractionConfig` into a flat, defaulted shape the vanilla
 * adapter consumes. Category sets for `'category'` hover mode and
 * `highlight({ category })` derive from the compilation's sort-resolved domains
 * (not raw node data), so `getLegend()` and `highlight()` always agree.
 */

import type { GraphInteractionConfig } from '@opendata-ai/openchart-core';

/** Hover emphasis behavior. */
export type GraphHoverMode = 'neighbors' | 'category' | 'node' | 'none';

/** Fully resolved graph interaction config. */
export interface ResolvedGraphInteraction {
  /** Hover emphasis mode. Default `'neighbors'`. */
  hoverMode: GraphHoverMode;
  /** Node dim tier during hover/focus. Default 0.15. */
  dimOpacity: number;
  /** Whether selecting a node flies the camera to it. Default false. */
  selectFlyTo: boolean;
  /** Cursor repulsion config, or null if disabled. */
  cursorRepulsion: { radius: number; strength: number } | null;
  /** Whether springy node drag is enabled. Default false. */
  springyDrag: boolean;
}

const DEFAULT_DIM_OPACITY = 0.15;
const DEFAULT_CURSOR_RADIUS = 80;
const DEFAULT_CURSOR_STRENGTH = 30;

/**
 * Resolve a GraphInteractionConfig into a defaulted shape.
 * Reduced-motion gating of cursor repulsion is applied at the mount, not here.
 */
export function resolveGraphInteraction(
  cfg: GraphInteractionConfig | undefined,
): ResolvedGraphInteraction {
  const hover = cfg?.hover;
  const cursor = cfg?.cursorRepulsion;

  let cursorRepulsion: { radius: number; strength: number } | null = null;
  if (cursor === true) {
    cursorRepulsion = { radius: DEFAULT_CURSOR_RADIUS, strength: DEFAULT_CURSOR_STRENGTH };
  } else if (cursor && typeof cursor === 'object') {
    cursorRepulsion = {
      radius: cursor.radius ?? DEFAULT_CURSOR_RADIUS,
      strength: cursor.strength ?? DEFAULT_CURSOR_STRENGTH,
    };
  }

  return {
    hoverMode: hover?.mode ?? 'neighbors',
    dimOpacity: hover?.dimOpacity ?? DEFAULT_DIM_OPACITY,
    selectFlyTo: cfg?.select?.flyTo ?? false,
    cursorRepulsion,
    springyDrag: cfg?.springyDrag ?? false,
  };
}
