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

import type { MeasureTextFn, ResolvedTheme } from '@opendata-ai/openchart-core';
import { estimateTextWidth, formatDate, wrapText } from '@opendata-ai/openchart-core';
import type { NormalizedChartSpec } from '../compiler/types';
import { type ResolvedScaleType, resolveTemporalScaleType } from '../layout/scales';
import { endpointLabelsExplicitlyOn, isStackedColumn, seriesField } from '../legend/suppression';
import {
  ENDPOINT_GAP,
  ENDPOINT_LABEL_FONT_WEIGHT,
  ENDPOINT_SWATCH_SIZE,
  ENDPOINT_VALUE_FONT_WEIGHT,
  ENDPOINT_WRAP_WIDTH_DEFAULT,
  endpointTrailingPadding,
} from './constants';
import { composeEndpointText, formatEndpointValue, resolveEndpointContent } from './format';
import { endpointFormatter } from './formatter';
import { endpointSourceRows } from './source';

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
  theme: ResolvedTheme,
  measureText?: MeasureTextFn,
  xScaleType?: ResolvedScaleType,
): number {
  if (spec.endpointLabels === false) return 0;
  if (xScaleType === undefined && spec.encoding.x?.type === 'temporal')
    xScaleType =
      spec.encoding.x.scale?.type ?? resolveTemporalScaleType(spec.encoding.x, spec.data);
  if (
    spec.markType !== 'line' &&
    spec.markType !== 'area' &&
    !(isStackedColumn(spec) && endpointLabelsExplicitlyOn(spec))
  )
    return 0;
  // Distinct series count (color, or strokeDash on a color-less line).
  const field = seriesField(spec);
  if (!field) return 0;
  const seriesNames = new Set<string>();
  for (const row of spec.data) {
    seriesNames.add(String(row[field]));
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

  const valueField = config?.valueField ?? spec.encoding.y?.field;
  const groups = endpointSourceRows(spec);
  const sideRows = (side: 'leading' | 'trailing') =>
    Array.from(groups, ([name, rows]) => ({
      name,
      row: rows[side === 'leading' ? 0 : rows.length - 1],
    }));
  const displayed = sideRows('trailing');
  if (config?.ends === 'both') displayed.push(...sideRows('leading'));
  const formatter = endpointFormatter(
    spec,
    displayed.map(({ row }) => row[valueField ?? '']),
  );
  const measure = (text: string, size: number, weight?: number) =>
    measureText?.(text, size, weight).width ?? estimateTextWidth(text, size, weight);

  const sideTextWidth = (side: 'leading' | 'trailing'): number => {
    const content = resolveEndpointContent(config?.content, side);
    const rows = sideRows(side);
    const xField = spec.encoding.x?.field ?? '';
    const qualify =
      config?.placement === 'interior' ||
      new Set(rows.map(({ row }) => String(row[xField]))).size > 1;
    let maxWidth = 0;
    for (const { name, row } of rows) {
      const raw = row[valueField ?? ''];
      const formatted = formatEndpointValue(
        typeof raw === 'number' || typeof raw === 'string' ? raw : null,
        formatter,
      );
      const text = content ? composeEndpointText(content, name, formatted) : name;
      for (const line of wrapText(
        text,
        theme.fonts.sizes.endpointLabel,
        ENDPOINT_LABEL_FONT_WEIGHT,
        wrapWidth,
        measureText,
      )) {
        maxWidth = Math.max(
          maxWidth,
          measure(line, theme.fonts.sizes.endpointLabel, ENDPOINT_LABEL_FONT_WEIGHT),
        );
      }
      if (!content)
        maxWidth = Math.max(
          maxWidth,
          measure(formatted, theme.fonts.sizes.endpointValue, ENDPOINT_VALUE_FONT_WEIGHT),
        );
      if (qualify && (spec.encoding.x?.type !== 'temporal' || xScaleType)) {
        const date =
          spec.encoding.x?.type === 'temporal'
            ? formatDate(
                row[xField] as Date | string | number,
                undefined,
                undefined,
                xScaleType === 'utc',
              )
            : String(row[xField]);
        maxWidth = Math.max(
          maxWidth,
          measure(date, theme.fonts.sizes.endpointValue, ENDPOINT_VALUE_FONT_WEIGHT),
        );
      }
    }
    return maxWidth;
  };

  // Both columns share one reserved width (dimensions.ts mirrors the right
  // reservation onto the left in `ends: 'both'` mode), so take the max of
  // the sides in play.
  let textColumn = sideTextWidth('trailing');
  if (config?.ends === 'both') {
    textColumn = Math.max(textColumn, sideTextWidth('leading'));
  }

  // Column = swatch + gap + text column + small trailing pad.
  return Math.max(
    ENDPOINT_SWATCH_SIZE + ENDPOINT_GAP + textColumn + endpointTrailingPadding(spec.frame?.right),
    32,
  );
}

/**
 * Returns true when the spec requests both-ends endpoint labels.
 * Used by `computeDimensions` to also reserve left margin space.
 */
export function isEndsBoth(spec: NormalizedChartSpec): boolean {
  const ep = spec.endpointLabels;
  return typeof ep === 'object' && ep != null && ep.ends === 'both';
}
