/**
 * Series visibility on a playback chart: toggled series hide their keys' elements by style,
 * so axes, scales and color slots stay frozen, as in Gapminder.
 */
import type { ChartLayout, ChartSpec } from '@opendata-ai/openchart-core';

/** The color field a legend toggle hides by, if the spec has one. */
function colorField(spec: ChartSpec): string | undefined {
  const channel = spec.encoding.color;
  if (!channel || typeof channel !== 'object' || !('field' in channel)) return undefined;
  return typeof channel.field === 'string' ? channel.field : undefined;
}

/** Each base key's series value, read from its mark's data row. */
function seriesByKey(base: ChartLayout, field: string): Map<string, string> {
  const series = new Map<string, string>();
  for (const mark of base.marks) {
    if (mark.key === undefined || !('data' in mark)) continue;
    const row = Array.isArray(mark.data) ? mark.data[0] : mark.data;
    const value = (row as Record<string, unknown> | undefined)?.[field];
    if (value != null) series.set(String(mark.key), String(value));
  }
  return series;
}

/** The base keys whose series is hidden. Empty when the spec has no color field. */
export function hiddenSeriesKeys(
  base: ChartLayout,
  spec: ChartSpec,
  hiddenSeries: readonly string[],
): Set<string> {
  const field = colorField(spec);
  const keys = new Set<string>();
  if (!field || hiddenSeries.length === 0) return keys;
  const hidden = new Set(hiddenSeries);
  for (const [key, value] of seriesByKey(base, field)) if (hidden.has(value)) keys.add(key);
  return keys;
}

/**
 * Hide every element drawn for a key in `hiddenKeys` (its `[data-key]` marks and its
 * `[data-trail-key]` trail) and show the rest. Only `style.display` is touched; the frame
 * and trail writers never write it, so hiding holds through playback.
 */
export function applySeriesHiding(svg: SVGElement, hiddenKeys: ReadonlySet<string>): void {
  for (const element of svg.querySelectorAll<SVGElement>('[data-key], [data-trail-key]')) {
    const key = element.getAttribute('data-key') ?? element.getAttribute('data-trail-key');
    element.style.display = key !== null && hiddenKeys.has(key) ? 'none' : '';
  }
}
