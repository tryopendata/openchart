/**
 * Single source of truth for legend / endpoint-column / end-of-line label
 * suppression on multi-series line/area charts.
 *
 * Three independent toggles drive the chart's series identification surface:
 *
 *   - `legend.show` — the traditional swatch legend (top/bottom/right).
 *   - `endpointLabels` — the right-side per-series column with last value.
 *   - end-of-line labels — the legacy series-name label glued to the last point.
 *
 * For ≥2-series line/area charts the resolution table is:
 *
 * | `legend.show` | `endpointLabels` | Traditional legend | Endpoint column | End-of-line labels |
 * |--|--|--|--|--|
 * | unset | unset | hidden (auto-suppressed) | shown                  | hidden |
 * | true  | unset | shown                    | shown                  | hidden |
 * | unset | false | shown (auto-revoked)     | hidden                 | hidden |
 * | false | false | hidden                   | hidden                 | shown  |
 * | true  | false | shown                    | hidden                 | hidden |
 * | false | true  | hidden                   | shown                  | hidden |
 * | true  | true  | shown                    | shown                  | hidden |
 *
 * Single-series and non-line/area charts: column always hidden, legend hidden
 * (single-series rule), end-of-line labels never render.
 *
 * Rule of thumb: end-of-line labels are the fallback identifier of last resort.
 * They render only when neither the traditional legend nor the endpoint column
 * is showing. The endpoint column "owns" the right zone and absorbs the
 * suppression role the traditional legend used to have for end-of-line labels.
 */

import type { Encoding } from '@opendata-ai/openchart-core';

import type { NormalizedChartSpec } from '../compiler/types';

/** Result of the suppression resolution. */
export interface SuppressionResult {
  /** Whether the traditional swatch legend should render. */
  showTraditionalLegend: boolean;
  /** Whether the right-side endpoint column should render. */
  showEndpointLabels: boolean;
  /** Whether the legacy end-of-line labels should render. */
  showEndOfLineLabels: boolean;
}

/** Inputs needed by the resolution helper. */
export interface SuppressionContext {
  /** Number of distinct series (color-encoding domain values). 0 if no color encoding. */
  seriesCount: number;
  /** True when responsive strategy strips inline labels (compact breakpoint). */
  labelsHiddenByStrategy: boolean;
  /** True when spec.labels.density === 'none'. */
  labelsDensityNone: boolean;
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
 * Resolve the three booleans from spec + context.
 *
 * Pure: no theme, no chart area, no scales. Both `computeLegend` and
 * `computeLineLabels` and `computeEndpointLabels` share this exact logic.
 */
export function resolveSuppression(
  spec: NormalizedChartSpec,
  ctx: SuppressionContext,
): SuppressionResult {
  const isLineOrArea = spec.markType === 'line' || spec.markType === 'area';
  const hasColorEncoding = spec.encoding.color != null;
  const isMultiSeries = isLineOrArea && hasColorEncoding && ctx.seriesCount >= 2;

  // Single-series, non-line/area, or compact strategy: never show endpoint
  // column or end-of-line labels. Legend follows its own rules elsewhere.
  //
  // Note: `labelsDensityNone` is intentionally NOT in this short-circuit.
  // `labels.density: 'none'` is the legacy switch for end-of-line labels and
  // must not affect the endpoint column or the traditional legend (those
  // are independent concerns governed by the truth table below).
  if (!isMultiSeries || ctx.labelsHiddenByStrategy) {
    return {
      // Defer the legend's own show/hide rules to computeLegend; this helper
      // doesn't override the existing legend behavior for non-multi-series.
      showTraditionalLegend: !legendHiddenExplicitly(spec),
      showEndpointLabels: false,
      showEndOfLineLabels: false,
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
  const isStacked = isArea
    ? stackValue === true ||
      stackValue === 'zero' ||
      stackValue === 'normalize' ||
      stackValue === 'center'
    : false;

  // Stacked area: revert to the pre-v6 behavior — show legend, no endpoint column.
  if (isStacked) {
    // Allow explicit user opt-in via endpointLabels: true even on stacked areas.
    const explicitOn = endpointLabelsExplicitlyOn(spec);
    return {
      showTraditionalLegend: !legendHiddenExplicitly(spec),
      showEndpointLabels: explicitOn,
      showEndOfLineLabels: false,
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

  // End-of-line labels are the last-resort series identifier: they render
  // only when both the traditional legend and the endpoint column are off.
  // `labels.density: 'none'` is the legacy switch that explicitly disables
  // end-of-line labels regardless of the other toggles.
  const showEndOfLineLabels =
    !showTraditionalLegend && !showEndpointLabels && !ctx.labelsDensityNone;

  return {
    showTraditionalLegend,
    showEndpointLabels,
    showEndOfLineLabels,
  };
}

/**
 * Count distinct series for the color encoding (for use in
 * SuppressionContext.seriesCount). Returns 0 when no color encoding is set
 * or when the encoding is conditional/quantitative.
 */
export function countColorSeries(spec: NormalizedChartSpec): number {
  const colorEnc = spec.encoding.color;
  if (!colorEnc) return 0;
  if ('condition' in colorEnc) return 0;
  if (!('field' in colorEnc)) return 0;
  if (colorEnc.type === 'quantitative') return 0;
  const field = colorEnc.field;
  if (!field) return 0;
  const seen = new Set<string>();
  for (const row of spec.data) {
    seen.add(String(row[field]));
  }
  return seen.size;
}
