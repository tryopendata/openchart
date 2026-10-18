/**
 * Runtime legend-toggle state for a chart mount. Toggles layer over the
 * authored `hiddenSeries`: a runtime hide adds to it, a runtime show of an
 * authored-hidden series overrides it. A new spec clears both.
 */

import type { Annotation, ChartSpec, LayerSpec } from '@opendata-ai/openchart-core';
import { isLayerSpec } from '@opendata-ai/openchart-core';

type MountSpec = ChartSpec | LayerSpec;

export interface SeriesVisibility {
  /** The spec with runtime toggles applied (text annotations drop while any series is hidden). */
  apply<T extends { hiddenSeries?: string[]; annotations?: Annotation[] }>(spec: T): T;
  /**
   * Toggle one series. Returns whether it is now hidden, or null when the
   * toggle was refused because it would hide the last visible series.
   */
  toggle(spec: MountSpec, series: string): boolean | null;
  /** Drop every runtime toggle. */
  clear(): void;
}

export function createSeriesVisibility(): SeriesVisibility {
  const runtimeHiddenSeries = new Set<string>();
  const runtimeShownSeries = new Set<string>();

  function apply<T extends { hiddenSeries?: string[]; annotations?: Annotation[] }>(spec: T): T {
    if (runtimeHiddenSeries.size === 0 && runtimeShownSeries.size === 0) return spec;
    const userHidden = spec.hiddenSeries ?? [];
    const finalHidden = new Set<string>(userHidden);
    for (const s of runtimeHiddenSeries) finalHidden.add(s);
    for (const s of runtimeShownSeries) finalHidden.delete(s);
    const out: T = { ...spec, hiddenSeries: Array.from(finalHidden) };
    if (finalHidden.size > 0 && spec.annotations) {
      const filtered = spec.annotations.filter((a) => a.type !== 'text');
      out.annotations = filtered.length > 0 ? filtered : undefined;
    }
    return out;
  }

  function isHidden(spec: MountSpec, series: string): boolean {
    if (runtimeShownSeries.has(series)) return false;
    if (runtimeHiddenSeries.has(series)) return true;
    const userHidden = (spec as { hiddenSeries?: string[] }).hiddenSeries ?? [];
    return userHidden.includes(series);
  }

  function toggle(spec: MountSpec, series: string): boolean | null {
    const wasHidden = isHidden(spec, series);
    const field = wasHidden ? undefined : seriesField(spec);
    if (field) {
      const userHidden = new Set((spec as { hiddenSeries?: string[] }).hiddenSeries ?? []);
      let visibleAfter = 0;
      const allSeries = new Set<string>();
      for (const row of (spec as ChartSpec).data ?? []) {
        allSeries.add(String((row as Record<string, unknown>)[field]));
      }
      for (const s of allSeries) {
        if (s === series) continue;
        if (runtimeShownSeries.has(s)) {
          visibleAfter++;
          continue;
        }
        if (runtimeHiddenSeries.has(s)) continue;
        if (!userHidden.has(s)) visibleAfter++;
      }
      if (visibleAfter === 0) return null;
    }
    if (wasHidden) {
      runtimeHiddenSeries.delete(series);
      const userHidden = (spec as { hiddenSeries?: string[] }).hiddenSeries ?? [];
      if (userHidden.includes(series)) runtimeShownSeries.add(series);
    } else {
      runtimeShownSeries.delete(series);
      runtimeHiddenSeries.add(series);
    }
    return !wasHidden;
  }

  function clear(): void {
    runtimeHiddenSeries.clear();
    runtimeShownSeries.clear();
  }

  return { apply, toggle, clear };
}

/**
 * The field the legend toggles: a categorical color field, or the strokeDash
 * field on a color-less line. Mirrors the engine's `seriesField`, which picks
 * the rows `hiddenSeries` filters.
 */
function seriesField(spec: MountSpec): string | undefined {
  if (isLayerSpec(spec)) return undefined;
  const { encoding, mark } = spec as ChartSpec;
  const color = encoding?.color;
  if (color && !('condition' in color) && 'field' in color && color.type !== 'quantitative')
    return color.field || undefined;
  const markType = typeof mark === 'string' ? mark : mark?.type;
  if (markType !== 'line') return undefined;
  const dash = encoding?.strokeDash;
  return dash && 'field' in dash ? dash.field || undefined : undefined;
}
