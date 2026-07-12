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
 *
 * When `theme.seriesStrategy` is `'accent-neutral'`, low-cardinality
 * charts use accent + neutral grays instead of the full palette.
 */

import { ACHROMATIC_RAMP, type Encoding, type ResolvedTheme } from '@opendata-ai/openchart-core';
import type { ScaleLinear, ScaleOrdinal, ScaleQuantile } from 'd3-scale';
import type { ResolvedScales } from '../layout/scales';
import { sampleRampColors } from '../legend/continuous';

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
  } else if (
    scales.color.type === 'quantile' ||
    scales.color.type === 'quantize' ||
    scales.color.type === 'threshold'
  ) {
    // Binned color scales: replace the placeholder colors with the theme's
    // sequential ramp, sampled to the class count. Same ramp the gradient
    // legend and continuous marks use.
    const seqStops = Object.values(theme.colors.sequential)[0] ?? theme.colors.categorical;
    const scale = scales.color.scale as unknown as ScaleQuantile<string>;
    scale.range(sampleRampColors(seqStops, scale.range().length));
  } else {
    const ordinalScale = scales.color.scale as ScaleOrdinal<string, string>;
    const palette = theme.colors.categorical;
    const domain = ordinalScale.domain();

    if (highlight && highlight.length > 0) {
      const highlightSet = new Set(highlight);
      const colors = domain.map((v, i) =>
        highlightSet.has(v) ? palette[i % palette.length] : MUTED_COLOR,
      );
      ordinalScale.range(colors);
    } else {
      const strategy = theme.seriesStrategy ?? 'palette';
      if (strategy !== 'accent-neutral') {
        ordinalScale.range(palette);
      } else {
        const count = domain.length;
        if (count <= 1) {
          ordinalScale.range([palette[0]]);
        } else if (count <= 4) {
          // Prominence tracks contrast against the surface: on dark canvases
          // the brightest gray reads strongest, on light canvases the darkest.
          const neutrals = theme.isDark
            ? [ACHROMATIC_RAMP.fgMuted, ACHROMATIC_RAMP.fgSubtle, ACHROMATIC_RAMP.fgFaint]
            : [ACHROMATIC_RAMP.fgFaint, ACHROMATIC_RAMP.fgSubtle, ACHROMATIC_RAMP.fgMuted];
          const colors = domain.map((_, i) =>
            i === 0 ? palette[0] : neutrals[(i - 1) % neutrals.length],
          );
          ordinalScale.range(colors);
        } else {
          ordinalScale.range(palette);
        }
      }
    }
  }
}
