/**
 * Turns a demo's spec into the spec a wall tile draws. A tile is a few hundred
 * pixels wide and its name is printed under it, so the chart drops its chrome
 * (eyebrow, title, subtitle, source): the docs page it links to shows the full
 * figure. Everything else, data and encoding included, is the demo as written.
 */
import type { VizSpec } from "@opendata-ai/openchart-core";

/**
 * The size the static tile SVG lays out at, in px, and the narrowest a live tile
 * chart lays out at. CSS scales both to the cell, which keeps this 4:3 shape.
 */
export const TILE_SVG_SIZE = { width: 240, height: 180 } as const;

/** The demo's spec without its chrome. */
export function tileSpec(spec: VizSpec): VizSpec {
  if (!("chrome" in spec)) return spec;
  const { chrome: _chrome, ...rest } = spec as VizSpec & { chrome?: unknown };
  return rest as VizSpec;
}
