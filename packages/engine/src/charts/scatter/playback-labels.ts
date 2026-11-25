/**
 * Name labels for the points `playback.labels` lists. They sit to the right of the bubble
 * and are always visible: no collision pass runs per frame, so a label never pops.
 */
import type { PointMark, ResolvedTheme } from '@opendata-ai/openchart-core';

/** Gap between the bubble's edge and the start of its label, in px. */
const LABEL_GAP = 4;

/** A copy of `mark` carrying a visible `text` label beside the bubble. */
export function labelPlaybackPoint(mark: PointMark, text: string, theme: ResolvedTheme): PointMark {
  return {
    ...mark,
    label: {
      text,
      x: mark.cx + mark.r + LABEL_GAP,
      y: mark.cy,
      style: {
        fontFamily: theme.fonts.family,
        fontSize: theme.fonts.sizes.small,
        fontWeight: theme.fonts.weights.medium,
        fill: theme.colors.text,
        lineHeight: 1.2,
        textAnchor: 'start',
        dominantBaseline: 'central',
      },
      visible: true,
    },
  };
}
