/**
 * Apply the theme palette as the color scale range when no explicit range was provided.
 *
 * Sequential scales take the first/last stops of the first sequential palette
 * (or the categorical endpoints as a fallback). Categorical scales get the
 * full categorical palette. A user-provided `encoding.color.scale.range`
 * always wins.
 *
 * When `highlight` is non-empty, highlighted series get sequential palette
 * colors and muted series get a neutral gray.
 */

import type { Encoding, ResolvedTheme } from '@opendata-ai/openchart-core';
import type { ScaleLinear, ScaleOrdinal } from 'd3-scale';
import type { ResolvedScales } from '../layout/scales';

/** Neutral gray applied to muted (non-highlighted) series. */
const MUTED_COLOR = '#bfc3c8';

/** Mutates `scales.color.scale.range` in place when no explicit palette was set. */
export function applyColorScaleRange(
  scales: ResolvedScales,
  encoding: Encoding,
  theme: ResolvedTheme,
  highlight?: string[],
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
    const ordinalScale = scales.color.scale as ScaleOrdinal<string, string>;
    const palette = theme.colors.categorical;

    if (highlight && highlight.length > 0) {
      // Assign palette colors only to highlighted series, mute the rest
      const highlightSet = new Set(highlight);
      const domain = ordinalScale.domain();
      let paletteIndex = 0;
      const colors = domain.map((v) =>
        highlightSet.has(v) ? palette[paletteIndex++ % palette.length] : MUTED_COLOR,
      );
      ordinalScale.range(colors);
    } else {
      ordinalScale.range(palette);
    }
  }
}
