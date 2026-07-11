/**
 * Resolves data-coordinate camera targets (`{ x: [a, b], y: [c, d] }`) to
 * viewBox-space `CameraTarget` rects using the compiled chart's axis ticks.
 *
 * There is no raw d3 scale on `ChartLayout` (by design -- the compiled
 * layout is the public surface, not engine internals), so resolution works
 * off `AxisTick[]`, which pairs each tick's raw data `value` with its pixel
 * `position`:
 *   - Exact tick match (ordinal/categorical values, or a quantitative value
 *     that happens to land on a tick): use that tick's position directly.
 *   - Otherwise linear interpolation between the two nearest ticks by data
 *     value. Works for quantitative and temporal axes (temporal values are
 *     compared as timestamps). Ordinal axes with no exact match have no
 *     well-ordered "between" and fall back to the nearest tick.
 */

import type { AxisLayout, AxisTick, ChartLayout } from '@opendata-ai/openchart-core';
import type { CameraTarget } from './camera-math';
import type { StoryDataCameraTarget } from './types';

const DEFAULT_PADDING = 24;

/** Coerce a tick value (string, number, Date, ISO string) to a comparable number. */
function toComparable(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const asDate = Date.parse(value);
    if (!Number.isNaN(asDate)) return asDate;
  }
  return null;
}

/** Resolve one data value to a pixel position along an axis, or null if unresolvable. */
function resolveOnAxis(axis: AxisLayout, target: unknown): number | null {
  const ticks = axis.ticks;
  if (ticks.length === 0) return null;

  const exact = ticks.find((t) => t.value === target);
  if (exact) return exact.position;

  const targetNum = toComparable(target);
  if (targetNum === null) return null;

  // Ticks with comparable numeric values, sorted by data value.
  const numeric: Array<{ tick: AxisTick; value: number }> = [];
  for (const tick of ticks) {
    const v = toComparable(tick.value);
    if (v !== null) numeric.push({ tick, value: v });
  }
  if (numeric.length === 0) return null;
  numeric.sort((a, b) => a.value - b.value);

  if (targetNum <= numeric[0]!.value) return numeric[0]!.tick.position;
  const last = numeric.at(-1)!;
  if (targetNum >= last.value) return last.tick.position;

  for (let i = 0; i < numeric.length - 1; i++) {
    const lo = numeric[i]!;
    const hi = numeric[i + 1]!;
    if (targetNum >= lo.value && targetNum <= hi.value) {
      const span = hi.value - lo.value;
      const t = span === 0 ? 0 : (targetNum - lo.value) / span;
      return lo.tick.position + t * (hi.tick.position - lo.tick.position);
    }
  }
  return null;
}

/**
 * Resolve a data-coordinate camera target to viewBox space. Falls back to
 * the full chart area (padded) for axes that are missing or unresolvable,
 * so a malformed target degrades to "camera does nothing" rather than
 * throwing mid-scroll.
 */
export function resolveCameraTarget(
  layout: ChartLayout,
  target: StoryDataCameraTarget,
): CameraTarget {
  const area = layout.area;
  const padding = target.padding ?? DEFAULT_PADDING;

  let x1 = area.x;
  let x2 = area.x + area.width;
  if (target.x && layout.axes.x) {
    const a = resolveOnAxis(layout.axes.x, target.x[0]);
    const b = resolveOnAxis(layout.axes.x, target.x[1]);
    if (a !== null && b !== null) {
      x1 = Math.min(a, b);
      x2 = Math.max(a, b);
    }
  }

  let y1 = area.y;
  let y2 = area.y + area.height;
  if (target.y && layout.axes.y) {
    const a = resolveOnAxis(layout.axes.y, target.y[0]);
    const b = resolveOnAxis(layout.axes.y, target.y[1]);
    if (a !== null && b !== null) {
      y1 = Math.min(a, b);
      y2 = Math.max(a, b);
    }
  }

  return {
    x: x1,
    y: y1,
    width: Math.max(x2 - x1, 1),
    height: Math.max(y2 - y1, 1),
    padding,
  };
}

/** Type guard: a camera step given in data coordinates vs. raw viewBox `CameraTarget`. */
export function isDataCameraTarget(
  value: StoryDataCameraTarget | CameraTarget,
): value is StoryDataCameraTarget {
  return !('width' in value) && !('height' in value);
}
