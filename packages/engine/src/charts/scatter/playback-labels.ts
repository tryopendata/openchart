/**
 * Name labels for the points `playback.labels` lists. Each is its own text mark beside the
 * bubble and is always visible: no collision pass runs per frame, so a label never pops.
 */
import {
  estimateTextWidth,
  type PointMark,
  type Rect,
  type ResolvedTheme,
  type TextMarkLayout,
} from '@opendata-ai/openchart-core';

/** Gap between the bubble's edge and the start of its label, in px. */
const LABEL_GAP = 4;

/** The name label's identity for the point keyed `pointKey`; frames match it by `data-key`. */
export function playbackLabelKey(pointKey: string): string {
  return `oc-playback-label|${pointKey}`;
}

/**
 * A text mark reading `text` just right of `mark`'s edge, vertically centered on it and
 * keyed by `playbackLabelKey(mark.key)`. When `bounds` is given and the label would run past
 * its right edge, it sits left of the bubble instead, so it never clips or runs into the
 * legend beside the plot.
 */
export function labelPlaybackPoint(
  mark: PointMark,
  text: string,
  theme: ResolvedTheme,
  bounds?: Rect,
): TextMarkLayout {
  const fontSize = theme.fonts.sizes.small;
  const fontWeight = theme.fonts.weights.medium;
  const rightX = mark.cx + mark.r + LABEL_GAP;
  const overflows =
    bounds !== undefined &&
    rightX + estimateTextWidth(text, fontSize, fontWeight) > bounds.x + bounds.width;
  return {
    type: 'textMark',
    key: playbackLabelKey(String(mark.key)),
    x: overflows ? mark.cx - mark.r - LABEL_GAP : rightX,
    y: mark.cy,
    text,
    fill: theme.colors.text,
    fontSize,
    fontWeight,
    fontFamily: theme.fonts.family,
    textAnchor: overflows ? 'end' : 'start',
    dominantBaseline: 'central',
    data: mark.data,
    // The point itself carries the key's aria label; the name would only repeat it.
    aria: { decorative: true },
  };
}
