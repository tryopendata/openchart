/**
 * Width-only predictor for the endpoint labels column.
 *
 * `computeDimensions` runs BEFORE marks are computed, so it can't read
 * `mark.dataPoints[-1].y` to lay out the column. But it still needs to reserve
 * the right margin so marks render inside the data area instead of underneath
 * the column.
 *
 * Single-pass design: this predictor returns ONLY the column's width. The full
 * entry positions are computed exactly once, in `computeEndpointLabels`, after
 * dimensions settle. Both call sites use the same wrapping math (font size,
 * weight, max width) so the predicted width matches the eventual layout.
 */

import type { ResolvedTheme } from '@opendata-ai/openchart-core';
import { estimateTextWidth, wrapText } from '@opendata-ai/openchart-core';

import type { NormalizedChartSpec } from '../compiler/types';
import { endpointLabelsExplicitlyOn } from '../legend/suppression';
import {
  ENDPOINT_GAP,
  ENDPOINT_LABEL_FONT_SIZE,
  ENDPOINT_LABEL_FONT_WEIGHT,
  ENDPOINT_SWATCH_SIZE,
  ENDPOINT_VALUE_FONT_SIZE,
  ENDPOINT_VALUE_FONT_WEIGHT,
  ENDPOINT_WRAP_WIDTH_DEFAULT,
} from './constants';
import { formatEndpointValue } from './format';

/**
 * Predict the pixel width the endpoint-labels column will need, including
 * swatch + label + value + padding. Returns 0 when the column would be empty
 * (single series, opt-out, non-line/area, etc.).
 *
 * Does NOT do collision sweep or full layout. Does the same `wrapText` math
 * as `computeEndpointLabels` so the two stay aligned by construction.
 */
export function predictEndpointLabelsWidth(
  spec: NormalizedChartSpec,
  _theme: ResolvedTheme,
): number {
  if (spec.endpointLabels === false) return 0;
  if (spec.markType !== 'line' && spec.markType !== 'area') return 0;
  const colorEnc = spec.encoding.color;
  if (!colorEnc) return 0;
  if ('condition' in colorEnc) return 0;
  if (!('field' in colorEnc)) return 0;
  if (colorEnc.type === 'quantitative') return 0;

  // Distinct series count.
  const colorField = colorEnc.field;
  if (!colorField) return 0;
  const seriesNames = new Set<string>();
  for (const row of spec.data) {
    seriesNames.add(String(row[colorField]));
  }
  if (seriesNames.size < 2) return 0;

  // When the user passed `endpointLabels: false`, predict 0. (Already handled above
  // for the bare boolean; also handle the object form `{ show: false }`.)
  if (typeof spec.endpointLabels === 'object' && spec.endpointLabels?.show === false) return 0;

  // Series-count cutoff: above maxSeries (default 8), skip endpoint labels
  // unless the user explicitly enabled them. Uses the same explicit-on logic
  // as suppression.ts to keep predict and render decisions aligned.
  const maxSeries =
    (typeof spec.endpointLabels === 'object' && spec.endpointLabels?.maxSeries) || 8;
  if (!endpointLabelsExplicitlyOn(spec) && seriesNames.size > maxSeries) return 0;

  const config = typeof spec.endpointLabels === 'object' ? spec.endpointLabels : undefined;
  const wrapWidth = config?.width ?? ENDPOINT_WRAP_WIDTH_DEFAULT;

  // Wrap each series name and find the widest wrapped line.
  let maxLabelWidth = 0;
  for (const name of seriesNames) {
    const lines = wrapText(name, ENDPOINT_LABEL_FONT_SIZE, ENDPOINT_LABEL_FONT_WEIGHT, wrapWidth);
    for (const line of lines) {
      const w = estimateTextWidth(line, ENDPOINT_LABEL_FONT_SIZE, ENDPOINT_LABEL_FONT_WEIGHT);
      if (w > maxLabelWidth) maxLabelWidth = w;
    }
  }

  // Estimate value width from the spec's data + format. We don't know which row
  // is "last" without computing scales/marks, so we sample the largest absolute
  // value to bound the formatted width.
  const yField = config?.valueField ?? spec.encoding.y?.field;
  const yFormat =
    config?.format ??
    ((spec.encoding.y?.axis as Record<string, unknown> | undefined)?.format as string | undefined);
  let valueWidth = 0;
  if (yField) {
    let maxAbs = 0;
    for (const row of spec.data) {
      const v = Number(row[yField]);
      if (Number.isFinite(v) && Math.abs(v) > maxAbs) maxAbs = Math.abs(v);
    }
    // When the user supplied a format string, run it through the same
    // formatter compute.ts will use so width prediction matches reality.
    // Without one, fall back to a magnitude-aware sample that bounds the
    // expected unformatted value width (compute.ts uses toFixed(2) here,
    // which is roughly the same character count as "1.5K"-style abbreviations
    // for the upper end of each band).
    let sample: string;
    if (yFormat) {
      sample = formatEndpointValue(maxAbs, yFormat);
    } else if (maxAbs >= 1_000_000_000) sample = '1.5B';
    else if (maxAbs >= 1_000_000) sample = '1.5M';
    else if (maxAbs >= 1_000) sample = '1.5K';
    else sample = String(Math.round(maxAbs * 100) / 100);
    valueWidth = estimateTextWidth(sample, ENDPOINT_VALUE_FONT_SIZE, ENDPOINT_VALUE_FONT_WEIGHT);
  }

  // Column = swatch + gap + max(label width, value width) + small trailing pad.
  const textColumn = Math.max(maxLabelWidth, valueWidth);
  return ENDPOINT_SWATCH_SIZE + ENDPOINT_GAP + textColumn + 4;
}

/**
 * Returns true when the spec requests both-ends endpoint labels.
 * Used by `computeDimensions` to also reserve left margin space.
 */
export function isEndsBoth(spec: NormalizedChartSpec): boolean {
  const ep = spec.endpointLabels;
  return typeof ep === 'object' && ep != null && ep.ends === 'both';
}
