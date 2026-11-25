/**
 * Name labels for the points `playback.labels` lists. Each is its own text mark beside the
 * bubble and is always visible: no collision pass runs per frame, and each label keeps the
 * side chosen for the whole run, so a label never pops or jumps across its bubble.
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

/** Which side of its bubble a name label sits on. */
export type PlaybackLabelSide = 'left' | 'right';

/** Key prefix of every name label; the rest of the key is its point's key. */
export const PLAYBACK_LABEL_KEY_PREFIX = 'oc-playback-label|';

/** The name label's identity for the point keyed `pointKey`; frames match it by `data-key`. */
export function playbackLabelKey(pointKey: string): string {
  return `${PLAYBACK_LABEL_KEY_PREFIX}${pointKey}`;
}

/** The point key a name label's key names, or null when `key` isn't a name label's. */
export function playbackLabelPointKey(key: string): string | null {
  return key.startsWith(PLAYBACK_LABEL_KEY_PREFIX)
    ? key.slice(PLAYBACK_LABEL_KEY_PREFIX.length)
    : null;
}

function labelFont(theme: ResolvedTheme) {
  return { fontSize: theme.fonts.sizes.small, fontWeight: theme.fonts.weights.medium };
}

/** Whether a label reading `text` right of `mark` would run past the right edge of `bounds`. */
export function labelOverflowsRight(
  mark: PointMark,
  text: string,
  theme: ResolvedTheme,
  bounds: Rect,
): boolean {
  const { fontSize, fontWeight } = labelFont(theme);
  const rightX = mark.cx + mark.r + LABEL_GAP;
  return rightX + estimateTextWidth(text, fontSize, fontWeight) > bounds.x + bounds.width;
}

/**
 * A text mark reading `text` on `side` of `mark`'s edge, vertically centered on it and keyed
 * by `playbackLabelKey(mark.key)`. The label carries the point's `data` row because series
 * hiding reads the color field from it, so hiding a series hides its labels too.
 */
export function labelPlaybackPoint(
  mark: PointMark,
  text: string,
  theme: ResolvedTheme,
  side: PlaybackLabelSide,
): TextMarkLayout {
  const { fontSize, fontWeight } = labelFont(theme);
  const left = side === 'left';
  return {
    type: 'textMark',
    key: playbackLabelKey(String(mark.key)),
    x: left ? mark.cx - mark.r - LABEL_GAP : mark.cx + mark.r + LABEL_GAP,
    y: mark.cy,
    text,
    fill: theme.colors.text,
    fontSize,
    fontWeight,
    fontFamily: theme.fonts.family,
    textAnchor: left ? 'end' : 'start',
    dominantBaseline: 'central',
    data: mark.data,
    // The point itself carries the key's aria label; the name would only repeat it.
    aria: { decorative: true },
  };
}
