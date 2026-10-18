/**
 * The render spec: the chart spec as scales and marks see it. Hidden series
 * and clipped domains are filtered out, while the legend keeps the full chart
 * spec. Row/column facet channels desugar into the facet channel here too.
 */

import { strokeDashPatterns } from '../charts/line/compute';
import type { NormalizedChartSpec } from '../compiler/types';
import { createAreaStackCache } from '../data/area-stack';
import { seriesField } from '../legend/suppression';
import { filterClippedDomains } from './data-clip';

export type FacetDirection = 'row' | 'column' | 'wrap';

/**
 * Filter the data scales and marks draw. Runs BEFORE the layout plan so the
 * plan measures real labels from the filtered data set. Legend retains all
 * series via chartSpec (unfiltered); scales and marks use the render spec.
 */
export function buildRenderSpec(chartSpec: NormalizedChartSpec): NormalizedChartSpec {
  let renderData = chartSpec.data;

  // Filter hidden series: removed from rendering but kept in legend (dimmed in the adapter)
  // Series come from color, or strokeDash on a color-less line (seriesField).
  const hiddenField =
    chartSpec.encoding.color && 'field' in chartSpec.encoding.color
      ? chartSpec.encoding.color.field
      : seriesField(chartSpec);
  if (chartSpec.hiddenSeries.length > 0 && hiddenField) {
    const hiddenSet = new Set(chartSpec.hiddenSeries);
    renderData = renderData.filter((row) => !hiddenSet.has(String(row[hiddenField])));
  }

  // Filter clipped scale domains: when scale.clip is true, exclude rows outside the domain
  renderData = filterClippedDomains(renderData, chartSpec.encoding);

  // Build a filtered spec for scales and marks, keeping all other properties intact
  let renderSpec =
    chartSpec.markType === 'area'
      ? { ...chartSpec, data: renderData, areaStackCache: createAreaStackCache() }
      : renderData !== chartSpec.data
        ? { ...chartSpec, data: renderData }
        : chartSpec;

  // Lock the color scale domain to the unfiltered series list so palette
  // assignments stay stable across legend toggles. Without this, hiding a
  // series shrinks the ordinal scale's domain and shifts every remaining
  // series down one palette index -- the visible lines would mismatch the
  // legend swatches that still represent the original assignment.
  // Skipped when the user already supplied an explicit domain.
  const colorEnc = chartSpec.encoding.color;
  if (
    chartSpec.hiddenSeries.length > 0 &&
    colorEnc &&
    'field' in colorEnc &&
    colorEnc.type !== 'quantitative' &&
    colorEnc.scale?.domain == null
  ) {
    const colorField = colorEnc.field;
    const stableDomainSet = new Set<string>();
    for (const row of chartSpec.data) stableDomainSet.add(String(row[colorField]));
    const stableDomain = Array.from(stableDomainSet);
    renderSpec = {
      ...renderSpec,
      encoding: {
        ...renderSpec.encoding,
        color: {
          ...colorEnc,
          scale: { ...(colorEnc.scale ?? {}), domain: stableDomain },
        },
      },
    };
  }
  // Same for dash patterns, which strokeDashPatterns assigns in domain order.
  const dashEnc = chartSpec.encoding.strokeDash;
  if (
    chartSpec.hiddenSeries.length > 0 &&
    dashEnc &&
    'field' in dashEnc &&
    dashEnc.scale?.domain == null
  ) {
    renderSpec = {
      ...renderSpec,
      encoding: {
        ...renderSpec.encoding,
        strokeDash: {
          ...dashEnc,
          scale: { ...(dashEnc.scale ?? {}), domain: [...strokeDashPatterns(chartSpec).keys()] },
        },
      },
    };
  }
  return renderSpec;
}

/** Desugar `encoding.row` / `encoding.column` into the facet channel on both specs. */
export function desugarRowColumn(
  chartSpec: NormalizedChartSpec,
  renderSpec: NormalizedChartSpec,
): { chartSpec: NormalizedChartSpec; renderSpec: NormalizedChartSpec; direction: FacetDirection } {
  const rowChannel = renderSpec.encoding.row;
  const colChannel = renderSpec.encoding.column;
  if (!rowChannel?.field && !colChannel?.field) {
    return { chartSpec, renderSpec, direction: 'wrap' };
  }
  const channel = (rowChannel?.field ? rowChannel : colChannel)!;
  const direction = rowChannel?.field ? 'row' : 'column';
  const desugared = { ...renderSpec.encoding } as Record<string, unknown>;
  delete desugared.row;
  delete desugared.column;
  desugared.facet = {
    field: channel.field,
    type: channel.type,
    sort: channel.sort,
    ...(direction === 'row' ? { columns: 1 } : {}),
  };
  const chartDesugared = { ...chartSpec.encoding } as Record<string, unknown>;
  delete chartDesugared.row;
  delete chartDesugared.column;
  chartDesugared.facet = desugared.facet;
  return {
    chartSpec: { ...chartSpec, encoding: chartDesugared as typeof chartSpec.encoding },
    renderSpec: { ...renderSpec, encoding: desugared as typeof renderSpec.encoding },
    direction,
  };
}
