import type { ChartSpec } from '@opendata-ai/openchart-core';
import { compileChart } from '@opendata-ai/openchart-engine';

/** Read actual rendered colors, including authored ranges and theme strategies. */
export function seriesColors(chart: ChartSpec): Map<string, string> {
  const result = new Map<string, string>();
  const color = chart.encoding.color;
  if (!color || !('field' in color)) return result;
  try {
    const layout = compileChart(chart, { width: 1280, height: 720, onWarn: () => {} });
    for (const mark of layout.marks) {
      const datum = Array.isArray(mark.data) ? mark.data[0] : mark.data;
      const value = mark.type === 'line' ? mark.stroke : 'fill' in mark ? mark.fill : undefined;
      if (datum && typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value))
        result.set(String(datum[color.field] ?? ''), value);
    }
    if ('entries' in layout.legend)
      for (const entry of layout.legend.entries) {
        if (!result.has(entry.label) && /^#[0-9a-f]{6}$/i.test(entry.color))
          result.set(entry.label, entry.color);
      }
  } catch {
    /* The preview reports compilation errors; never invent a swatch. */
  }
  return result;
}
/** Freeze the current mapping before changing a swatch; other series do not move. */
export function changeSeriesColor(
  chart: ChartSpec,
  colors: Map<string, string>,
  name: string,
  value: string,
): ChartSpec {
  const color = chart.encoding.color;
  if (!color || !('field' in color)) return chart;
  const domain = [...new Set([...(color.scale?.domain ?? []).map(String), ...colors.keys()])];
  const range = domain.map((key) =>
    key === name
      ? value
      : (colors.get(key) ??
        color.scale?.range?.[(color.scale?.domain ?? []).map(String).indexOf(key)]),
  );
  return {
    ...chart,
    encoding: { ...chart.encoding, color: { ...color, scale: { ...color.scale, domain, range } } },
  } as ChartSpec;
}
