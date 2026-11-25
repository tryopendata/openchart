/**
 * Validation of `encoding.time` on chart specs (RFC 2.7 errors). Warnings come from
 * `compileChartPlayback`, since validation has no warnings channel.
 */
import type { ValidationError } from '../types';

/** Where the chart being validated sits. */
export interface TimeValidationContext {
  /** True for a leaf of a `LayerSpec`, where `time` is not supported. */
  inLayer?: boolean;
}

/**
 * Append errors for a chart spec that sets `encoding.time`: an unsupported mark (naming
 * point, circle and bar), missing `encoding.key` on point and circle, two rows with the same
 * identity and period (the derived `color|category` key for bars), `facet`, a layer leaf,
 * `youDrawIt`, an authored `trendline`, `playback.trails`/`labels` on a non-point mark, an
 * `aggregate` whose groupby drops the time field, and problems in the `playback` block.
 * Called only for specs with `encoding.time`.
 */
export function validateTimeEncoding(
  spec: Record<string, unknown>,
  errors: ValidationError[],
  context: TimeValidationContext = {},
): void {
  void spec;
  void errors;
  void context;
  throw new Error('not implemented');
}
