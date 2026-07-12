/**
 * Shared value-formatting helpers for the endpoint-labels predictor and
 * compute pass. Keeping the format-string path in one place guarantees
 * predicted column width matches the eventual rendered text.
 */

import type { EndpointLabelContent } from '@opendata-ai/openchart-core';
import { buildD3Formatter } from '@opendata-ai/openchart-core';

/**
 * Format a value with a d3-format string, falling back to String() on
 * unknown specifiers. Accepts the `'ordinal'` extension ("1st", "2nd") and
 * trailing literal suffixes via `buildD3Formatter`, so endpoint values format
 * exactly like axis ticks. When no format string is supplied, applies a
 * sensible default: integers under 1000 render as-is, anything else gets
 * two decimals.
 */
export function formatEndpointValue(
  value: number | string | null,
  formatString: string | undefined,
): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (formatString) {
    const fmt = buildD3Formatter(formatString);
    return fmt ? fmt(value) : String(value);
  }
  if (Number.isInteger(value) && Math.abs(value) < 1000) return String(value);
  return value.toFixed(2);
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
