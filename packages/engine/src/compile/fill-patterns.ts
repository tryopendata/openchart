/**
 * Per-series fill pattern assignment for `mark.fillPattern: 'auto'`.
 *
 * Series identity is the mark's resolved fill color (already theme-resolved
 * by the color scale), so assignment is deterministic: the first distinct
 * fill gets the first pattern shape, the second the next, cycling through
 * the four built-in shapes. The pattern line color is contrast-picked
 * against the series color per mode, so patterns read in light and dark.
 *
 * The renderer turns each ResolvedFillPattern into an SVG `<pattern>` def
 * (see packages/vanilla/src/pattern-utils.ts).
 */

import type {
  FillPatternType,
  GradientDef,
  Mark,
  MarkDef,
  ResolvedFillPattern,
  ResolvedTheme,
} from '@opendata-ai/openchart-core';
import { getRepresentativeColor, pickLabelColor } from '@opendata-ai/openchart-core';

/** Assignment order for series patterns. */
const PATTERN_SEQUENCE: readonly FillPatternType[] = ['diagonal', 'dot', 'crosshatch', 'vertical'];

/**
 * Minimum-area rule: a mark keeps its solid fill when its thin dimension is
 * below this many pixels. Pattern tiles are 6px; below ~2 tiles the pattern
 * degrades into noise on thin stacked segments and slivers of pie.
 */
const MIN_PATTERN_EXTENT = 12;

/**
 * Stamp `pattern` onto filled marks (rect, area, arc) when the mark def opts
 * in with `fillPattern: 'auto'`. Mutates marks in place (same convention as
 * assignAnimationIndices). No-op otherwise.
 */
export function applyFillPatterns(marks: Mark[], markDef: MarkDef, theme: ResolvedTheme): void {
  if (markDef.fillPattern !== 'auto') return;

  const assignment = new Map<string, ResolvedFillPattern>();
  const resolve = (fill: string | GradientDef): ResolvedFillPattern => {
    const base = getRepresentativeColor(fill);
    let resolved = assignment.get(base);
    if (!resolved) {
      const type = PATTERN_SEQUENCE[assignment.size % PATTERN_SEQUENCE.length];
      resolved = { type, base, line: pickLabelColor(base, theme.isDark) };
      assignment.set(base, resolved);
    }
    return resolved;
  };

  for (const mark of marks) {
    // Resolve BEFORE any size check so pattern-to-series assignment does not
    // depend on which individual marks are large enough to render one.
    if (mark.type === 'rect') {
      const pattern = resolve(mark.fill);
      if (Math.min(mark.width, mark.height) >= MIN_PATTERN_EXTENT) {
        mark.pattern = pattern;
      }
    } else if (mark.type === 'area') {
      mark.pattern = resolve(mark.fill);
    } else if (mark.type === 'arc') {
      const pattern = resolve(mark.fill);
      const radialExtent = mark.outerRadius - mark.innerRadius;
      const midRadius = (mark.innerRadius + mark.outerRadius) / 2;
      const arcExtent = Math.abs(mark.endAngle - mark.startAngle) * midRadius;
      if (Math.min(radialExtent, arcExtent) >= MIN_PATTERN_EXTENT) {
        mark.pattern = pattern;
      }
    }
  }
}
