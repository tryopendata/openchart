/** Series identification uses two independent surfaces: legend and endpoint column. */

import type { Encoding } from '@opendata-ai/openchart-core';

import type { NormalizedChartSpec } from '../compiler/types';

/** Result of the suppression resolution. */
export interface SuppressionResult {
  /** Whether the traditional swatch legend should render. */
  showTraditionalLegend: boolean;
  /** Whether the right-side endpoint column should render. */
  showEndpointLabels: boolean;
}

/** Inputs needed by the resolution helper. */
export interface SuppressionContext {
  /** Number of distinct series (`seriesField` values). 0 when the chart has no series field. */
  seriesCount: number;
  /** True when responsive strategy strips inline labels (compact breakpoint). */
  labelsHiddenByStrategy: boolean;
  /** When true, endpoint labels are demoted because they don't fit at the current width. */
  endpointLabelsDemoted?: boolean;
}

/**
 * Did the user write `legend.show: true` or any non-`show` legend config?
 * (Used by the truth table to decide between the "unset" and "true" rows.)
 */
function legendShownExplicitly(spec: NormalizedChartSpec): boolean {
  if (spec.legend == null) return false;
  if (spec.legend.show === true) return true;
  // Any non-`show` legend property counts as opt-in to render the legend.
  return Object.keys(spec.legend).some((k) => k !== 'show');
}

/** Did the user write `legend.show: false` explicitly? */
function legendHiddenExplicitly(spec: NormalizedChartSpec): boolean {
  return spec.legend?.show === false;
}

/** Keys on EndpointLabelsConfig that configure behavior but don't signal show intent. */
const EP_CONFIG_ONLY_KEYS = new Set(['show', 'maxSeries']);

/**
 * Did the user explicitly set endpointLabels: true?
 * Either the bare boolean or `{ show: true }` or any display-affecting config keys count.
 * Config-only keys like `maxSeries` don't count as show intent.
 */
export function endpointLabelsExplicitlyOn(spec: NormalizedChartSpec): boolean {
  const ep = spec.endpointLabels;
  if (ep === true) return true;
  if (ep === false || ep == null) return false;
  if (ep.show === true) return true;
  if (ep.show === false) return false;
  return Object.keys(ep).some((k) => !EP_CONFIG_ONLY_KEYS.has(k));
}

/** Did the user explicitly set endpointLabels: false (or { show: false })? */
function endpointLabelsExplicitlyOff(spec: NormalizedChartSpec): boolean {
  const ep = spec.endpointLabels;
  if (ep === false) return true;
  if (typeof ep === 'object' && ep != null && ep.show === false) return true;
  return false;
}

const DEFAULT_MAX_SERIES = 8;

/** Read the maxSeries cutoff from the spec's endpointLabels config. */
function getMaxSeries(spec: NormalizedChartSpec): number {
  const ep = spec.endpointLabels;
  if (typeof ep === 'object' && ep != null && ep.maxSeries != null) return ep.maxSeries;
  return DEFAULT_MAX_SERIES;
}

/**
 * Resolve legend and endpoint visibility from spec + context.
 *
 * Pure: no theme, no chart area, no scales. `computeLegend` and `computeEndpointLabels` share this exact logic.
 */
export function resolveSuppression(
  spec: NormalizedChartSpec,
  ctx: SuppressionContext,
): SuppressionResult {
  const isLineOrArea = spec.markType === 'line' || spec.markType === 'area';
  const isMultiSeries = isLineOrArea && seriesField(spec) != null && ctx.seriesCount >= 2;

  // Single-series, non-line/area, or compact strategy: never show endpoint
  // column. Legend follows its own rules elsewhere.
  // Explicit user opt-in (endpointLabels config) overrides the compact
  // strip: slope/bump recipes carry their values on the labels, so an
  // author who wrote endpointLabels config keeps the column at 320px.
  //
  const strategyHidesEndpoint = ctx.labelsHiddenByStrategy && !endpointLabelsExplicitlyOn(spec);
  if (!isMultiSeries || strategyHidesEndpoint) {
    return {
      // Defer the legend's own show/hide rules to computeLegend; this helper
      // doesn't override the existing legend behavior for non-multi-series.
      showTraditionalLegend: !legendHiddenExplicitly(spec),
      showEndpointLabels: false,
    };
  }

  // Stacked-area branch: gradient fills overlap, so endpoint labels at the
  // last data point would land on top of each other. Don't auto-enable the
  // column for stacked areas. Users can still force it with `endpointLabels: true`.
  const isArea = spec.markType === 'area';
  const quantChannel = (
    spec.encoding.y?.type === 'quantitative' ? spec.encoding.y : spec.encoding.x
  ) as Encoding[keyof Encoding] | undefined;
  const stackValue = quantChannel && 'stack' in quantChannel ? quantChannel.stack : undefined;
  // v8 VL-aligned default: area stacks unless stack is explicitly null/false.
  const isStacked = isArea ? stackValue !== null && stackValue !== false : false;

  // Stacked area: revert to the pre-v6 behavior — show legend, no endpoint column.
  if (isStacked) {
    // Allow explicit user opt-in via endpointLabels: true even on stacked areas.
    const explicitOn = endpointLabelsExplicitlyOn(spec);
    return {
      showTraditionalLegend: !legendHiddenExplicitly(spec),
      showEndpointLabels: explicitOn,
    };
  }

  // Series-count cutoff: above maxSeries (default 8), treat as if endpoint
  // labels are off so a legend shows instead. Explicit user opt-in overrides.
  const exceedsCutoff = !endpointLabelsExplicitlyOn(spec) && ctx.seriesCount > getMaxSeries(spec);

  // Auto-thinning demotion: endpoint labels don't fit at the current width.
  const demoted = !endpointLabelsExplicitlyOn(spec) && !!ctx.endpointLabelsDemoted;

  // The eight-cell truth table for ≥2-series overlap line/area charts.
  const epExplicitOff = endpointLabelsExplicitlyOff(spec) || exceedsCutoff || demoted;
  const legShown = legendShownExplicitly(spec);
  const legHidden = legendHiddenExplicitly(spec);

  // Endpoint column: on by default; only `endpointLabels: false` (or
  // `{ show: false }`) or series-count cutoff turns it off.
  const showEndpointLabels = !epExplicitOff;

  // Traditional legend:
  //   - explicit hide  -> hidden
  //   - explicit show  -> shown
  //   - unset          -> hidden when endpoint column is on, shown otherwise
  let showTraditionalLegend: boolean;
  if (legHidden) {
    showTraditionalLegend = false;
  } else if (legShown) {
    showTraditionalLegend = true;
  } else {
    showTraditionalLegend = !showEndpointLabels;
  }

  return {
    showTraditionalLegend,
    showEndpointLabels,
  };
}

/**
 * The field that splits a line/area chart into identifiable series: a
 * categorical color field, or, on a line without one, the strokeDash field
 * (the line compute groups by it). `detail` is deliberately excluded: as in
 * Vega-Lite it groups without identifying, so it gets no legend or endpoint
 * column. Conditional and quantitative color never define series themselves.
 */
export function seriesField(spec: NormalizedChartSpec): string | undefined {
  const color = spec.encoding.color;
  if (color && !('condition' in color) && 'field' in color && color.type !== 'quantitative')
    return color.field || undefined;
  if (spec.markType !== 'line') return undefined;
  const dash = spec.encoding.strokeDash;
  return dash && 'field' in dash ? dash.field || undefined : undefined;
}

/**
 * Count distinct series (for use in SuppressionContext.seriesCount): values of
 * `seriesField`, so color series and strokeDash-only line series both count.
 * Returns 0 when the chart has no series field.
 */
export function countColorSeries(spec: NormalizedChartSpec): number {
  const field = seriesField(spec);
  if (!field) return 0;
  const seen = new Set<string>();
  for (const row of spec.data) {
    seen.add(String(row[field]));
  }
  return seen.size;
}
