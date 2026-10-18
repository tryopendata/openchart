import type { CompileOptions, LayoutStrategy, ResolvedTheme } from '@opendata-ai/openchart-core';
import { resolveRendererKey } from '../charts/post-process';
import { getChartRenderer } from '../charts/registry';
import type { NormalizedChartSpec } from '../compiler/types';
import { computeEndpointLabels } from '../endpoint-labels/compute';
import { buildSeriesSummary, type SeriesSummaryEntry } from '../layout/budget';
import { computeChartScales } from './chart-scales';

/**
 * Series-summary preview for the up-front note reserve. The summary text is a
 * series key and its last value, which no plot geometry changes, so marks
 * computed against the container rect yield the same entries the final marks do.
 */
export function previewSeriesSummary(
  chartSpec: NormalizedChartSpec,
  renderSpec: NormalizedChartSpec,
  strategy: LayoutStrategy,
  theme: ResolvedTheme,
  options: CompileOptions,
  plan: { endpointLabelsDemoted?: boolean },
): SeriesSummaryEntry[] {
  const area = { x: 0, y: 0, width: options.width, height: options.height };
  const { scales } = computeChartScales(renderSpec, area, theme, chartSpec);
  const renderer = getChartRenderer(
    resolveRendererKey(renderSpec.markType, renderSpec.encoding, renderSpec.markDef),
  );
  const marks = renderer ? renderer(renderSpec, scales, area, strategy, theme, options.width) : [];
  const endpointLabels = computeEndpointLabels(
    chartSpec,
    marks,
    theme,
    area,
    strategy,
    plan.endpointLabelsDemoted,
    options.measureText,
    scales.x?.type,
  );
  if (endpointLabels.entries.length > 0) return [];
  return buildSeriesSummary(
    computeEndpointLabels(
      chartSpec,
      marks,
      theme,
      area,
      undefined,
      false,
      options.measureText,
      scales.x?.type,
    ).entries,
    options.width,
    theme,
    options.measureText,
  );
}
