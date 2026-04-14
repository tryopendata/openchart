/**
 * Apply the theme palette as the color scale range when no explicit range was provided.
 *
 * Sequential scales take the first/last stops of the first sequential palette
 * (or the categorical endpoints as a fallback). Categorical scales get the
 * full categorical palette. A user-provided `encoding.color.scale.range`
 * always wins.
 */

import type { Encoding, ResolvedTheme } from '@opendata-ai/openchart-core';
import type { ScaleLinear, ScaleOrdinal } from 'd3-scale';
import type { ResolvedScales } from '../layout/scales';

/** Mutates `scales.color.scale.range` in place when no explicit palette was set. */
export function applyColorScaleRange(
  scales: ResolvedScales,
  encoding: Encoding,
  theme: ResolvedTheme,
): void {
  if (!scales.color) return;

  const hasExplicitRange = !!(
    encoding.color &&
    'field' in encoding.color &&
    (encoding.color.scale?.range as string[] | undefined)?.length
  );
  if (hasExplicitRange) return;

  if (scales.color.type === 'sequential') {
    const seqStops = Object.values(theme.colors.sequential)[0] ?? theme.colors.categorical;
    (scales.color.scale as unknown as ScaleLinear<string, string>).range([
      seqStops[0],
      seqStops[seqStops.length - 1],
    ]);
  } else {
    (scales.color.scale as ScaleOrdinal<string, string>).range(theme.colors.categorical);
  }
}
