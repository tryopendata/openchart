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

/**
 * Hide every `[data-key]` element (marks and anything else drawn per key) whose key belongs
 * to a hidden series, and show the rest. Only `style.display` is touched; the frame writer
 * never writes it, so hiding holds through playback.
 */
export function applySeriesHiding(
  svg: SVGElement,
  base: ChartLayout,
  spec: ChartSpec,
  hiddenSeries: readonly string[],
): void {
  const field = colorField(spec);
  if (!field) return;
  const hidden = new Set(hiddenSeries);
  const series = seriesByKey(base, field);
  for (const element of svg.querySelectorAll<SVGElement>('[data-key]')) {
    const value = series.get(element.getAttribute('data-key') as string);
    element.style.display = value !== undefined && hidden.has(value) ? 'none' : '';
  }
}
