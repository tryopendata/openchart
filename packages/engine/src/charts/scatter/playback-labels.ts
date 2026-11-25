/**
 * Name labels for the points `playback.labels` lists. Each is its own text mark beside the
 * bubble and is always visible. A label keeps the side chosen for the whole run unless that
 * side would cover another name label in a frame (see `placeNameLabels`).
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
export type PlaybackLabelSide = 'left' | 'right' | 'above' | 'below';

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

/** A label's anchor point, text anchor and estimated box. */
interface LabelGeometry {
  x: number;
  y: number;
  textAnchor: TextMarkLayout['textAnchor'];
  box: Rect;
}

/** The x of a label centered on `cx`, nudged so its `width` stays within `area`. */
function centeredX(cx: number, width: number, area: Rect): number {
  const low = area.x + width / 2;
  const high = area.x + area.width - width / 2;
  return low > high ? cx : Math.min(Math.max(cx, low), high);
}

/**
 * Where a label reading `text` on `side` of `mark` sits and the box it covers, from the
 * engine's text width estimate and the font size as its height. Labels above and below are
 * centered on the bubble, nudged sideways to stay inside `area`.
 */
export function playbackLabelGeometry(
  mark: PointMark,
  text: string,
  theme: ResolvedTheme,
  side: PlaybackLabelSide,
  area: Rect,
): LabelGeometry {
  const { fontSize, fontWeight } = labelFont(theme);
  const width = estimateTextWidth(text, fontSize, fontWeight);
  const offset = mark.r + LABEL_GAP;
  const box = (left: number, y: number) => ({
    x: left,
    y: y - fontSize / 2,
    width,
    height: fontSize,
  });
  if (side === 'left') {
    const x = mark.cx - offset;
    return { x, y: mark.cy, textAnchor: 'end', box: box(x - width, mark.cy) };
  }
  if (side === 'right') {
    const x = mark.cx + offset;
    return { x, y: mark.cy, textAnchor: 'start', box: box(x, mark.cy) };
  }
  // Above and below keep the central baseline, so moving a label between sides only
  // changes x, y and text-anchor, the attributes the live frame writer updates.
  const shift = offset + fontSize / 2;
  const y = side === 'above' ? mark.cy - shift : mark.cy + shift;
  const x = centeredX(mark.cx, width, area);
  return { x, y, textAnchor: 'middle', box: box(x - width / 2, y) };
}

/**
 * A text mark reading `text` at `geometry` (see `playbackLabelGeometry`) beside `mark`,
 * keyed by `playbackLabelKey(mark.key)`. The label carries the point's `data` row because
 * series hiding reads the color field from it, so hiding a series hides its labels too.
 */
export function labelPlaybackPoint(
  mark: PointMark,
  text: string,
  theme: ResolvedTheme,
  geometry: Pick<LabelGeometry, 'x' | 'y' | 'textAnchor'>,
): TextMarkLayout {
  const { fontSize, fontWeight } = labelFont(theme);
  const { x, y, textAnchor } = geometry;
  return {
    type: 'textMark',
    key: playbackLabelKey(String(mark.key)),
    x,
    y,
    text,
    fill: theme.colors.text,
    fontSize,
    fontWeight,
    fontFamily: theme.fonts.family,
    textAnchor,
    dominantBaseline: 'central',
    data: mark.data,
    // The point itself carries the key's aria label; the name would only repeat it.
    aria: { decorative: true },
  };
}
