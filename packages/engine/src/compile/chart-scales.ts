import type { Rect, ResolvedTheme } from '@opendata-ai/openchart-core';
import type { NormalizedChartSpec } from '../compiler/types';
import { computeScales, type ResolvedScales } from '../layout/scales';
import { applyColorScaleRange, defaultSeriesColor } from './color-scale-range';

/**
 * Scales for a chart (or one facet panel) over `spec.data`, with the theme
 * palette applied to the color scale. When highlight is active, palette colors
 * go to highlighted series and the rest are muted. Returns the palette
 * warnings for the caller to emit or drop.
 */
export function computeChartScales(
  spec: NormalizedChartSpec,
  area: Rect,
  theme: ResolvedTheme,
  chartSpec: NormalizedChartSpec,
): { scales: ResolvedScales; warnings: string[] } {
  const scales = computeScales(spec, area, spec.data);
  const warnings = applyColorScaleRange(
    scales,
    spec.encoding,
    theme,
    spec.highlight,
    chartSpec.markType,
  );
  // INVARIANT 3 -- post-hoc defaultColor: must run AFTER computeScales since resolution needs
  // theme context. Do not move into computeScales (would require threading theme through).
  // fill wins for bar/area/arc marks; stroke wins for line marks (the stroke IS the color).
  scales.defaultColor =
    chartSpec.markDef.fill ??
    chartSpec.markDef.stroke ??
    defaultSeriesColor(theme, chartSpec.markType);
  return { scales, warnings };
}
