/**
 * Shared value-formatting helpers for the endpoint-labels predictor and
 * compute pass. Keeping the format-string path in one place guarantees
 * predicted column width matches the eventual rendered text.
 */

import type { EndpointLabelContent, NumberFormatter } from '@opendata-ai/openchart-core';
import { defaultNumberFormatter } from '@opendata-ai/openchart-core';

const defaultFmt = defaultNumberFormatter();

/**
 * Format a value for an endpoint label. When a pre-built formatter is
 * supplied (resolved from the spec's format/encoding), it is used directly.
 * Otherwise falls back to the smart default (compact notation with
 * magnitude-aware units).
 */
export function formatEndpointValue(
  value: number | string | null,
  formatter?: NumberFormatter | null,
): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (formatter) return formatter(value);
  return defaultFmt(value);
}

/**
 * Compose the single-line text an endpoint entry renders when the spec sets
 * `endpointLabels.content`. `'label value'` joins the series name and its
 * formatted value on one line, which is the slope-chart convention. Returns
 * the series name alone when the value is empty so a missing value never
 * leaves a trailing space.
 */
export function composeEndpointText(
  content: EndpointLabelContent,
  label: string,
  value: string,
): string {
  if (content === 'label') return label;
  if (content === 'value') return value;
  return value ? `${label} ${value}` : label;
}

/**
 * Resolve the content mode for one column from the config's `content` field,
 * which accepts either a single mode for both columns or a per-side object.
 * Returns undefined when unset (the classic name-plus-value-below layout).
 */
export function resolveEndpointContent(
  content:
    | EndpointLabelContent
    | { leading?: EndpointLabelContent; trailing?: EndpointLabelContent }
    | undefined,
  side: 'leading' | 'trailing',
): EndpointLabelContent | undefined {
  if (content == null) return undefined;
  if (typeof content === 'string') return content;
  return content[side];
}
