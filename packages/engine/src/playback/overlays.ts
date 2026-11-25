/**
 * Playback overlays: the large faint period label behind the marks and the name labels
 * `playback.labels` draws beside its points. Both are text marks the frame writer matches by
 * key, built per frame from the frame's marks.
 */
import {
  isOpaqueColor,
  type PlaybackPeriodPosition,
  type Rect,
  type ResolvedTheme,
  type TextMarkLayout,
} from '@opendata-ai/openchart-core';
import { interpolateRgb } from 'd3-interpolate';
import {
  labelOverflowsRight,
  labelPlaybackPoint,
  type PlaybackLabelSide,
} from '../charts/scatter/playback-labels';
import type { FrameMark } from './chart-types';

/** Key of the period label's text mark. */
export const PERIOD_LABEL_KEY = 'oc-playback-period';

/** What the period label sits behind, which decides where `auto` puts it. */
export type PeriodLabelKind = 'scatter' | 'map' | 'bar';

/** Where and how large the period label is drawn. */
export interface PeriodLabelPlacement {
  x: number;
  y: number;
  /** Font size in px, scaled to the plot area. */
  fontSize: number;
  textAnchor: TextMarkLayout['textAnchor'];
  dominantBaseline: NonNullable<TextMarkLayout['dominantBaseline']>;
}

/** Distance between a corner label and the plot edges, in px. */
const CORNER_INSET = 8;

/** Centered label: a share of the plot's height and width, whichever is tighter. */
const CENTER_SIZE = { heightShare: 0.35, widthShare: 0.25, min: 28, max: 180 };
/** Corner labels stay smaller so they don't crowd the marks they share the edge with. */
const CORNER_SIZE = { heightShare: 0.16, widthShare: 0.14, min: 20, max: 96 };

/** How much of the text color shows through: faint enough to read as background. */
const PERIOD_INK_LIGHT = 0.12;
/** Light text on a dark ground reads stronger at the same mix, so dark themes go a bit higher. */
const PERIOD_INK_DARK = 0.16;

const AUTO_POSITION: Record<PeriodLabelKind, Exclude<PlaybackPeriodPosition, 'auto'>> = {
  scatter: 'center',
  map: 'bottom-left',
  bar: 'top-right',
};

function scaledSize(area: Rect, size: typeof CENTER_SIZE): number {
  const fit = Math.min(area.height * size.heightShare, area.width * size.widthShare);
  return Math.round(Math.max(size.min, Math.min(size.max, fit)));
}

/**
 * Where the period label goes in `area` for an authored `position`. `auto` resolves per
 * kind: centered behind a scatter, lower left on a map, upper right on bars. Corner
 * positions sit `CORNER_INSET` px inside the plot area.
 */
export function periodLabelPlacement(
  position: PlaybackPeriodPosition,
  area: Rect,
  kind: PeriodLabelKind,
): PeriodLabelPlacement {
  const resolved = position === 'auto' ? AUTO_POSITION[kind] : position;
  if (resolved === 'center') {
    return {
      x: area.x + area.width / 2,
      y: area.y + area.height / 2,
      fontSize: scaledSize(area, CENTER_SIZE),
      textAnchor: 'middle',
      dominantBaseline: 'central',
    };
  }
  const fontSize = scaledSize(area, CORNER_SIZE);
  if (resolved === 'top-right') {
    return {
      x: area.x + area.width - CORNER_INSET,
      y: area.y + CORNER_INSET,
      fontSize,
      textAnchor: 'end',
      dominantBaseline: 'hanging',
    };
  }
  return {
    x: area.x + CORNER_INSET,
    y: area.y + area.height - CORNER_INSET,
    fontSize,
    textAnchor: 'start',
    dominantBaseline: 'text-after-edge',
  };
}

/**
 * The period label's fill: the theme text color mixed toward an opaque background. When the
 * background isn't an opaque color (the default 'transparent', 'none', a CSS variable) there
 * is nothing to mix toward, so the label is the text color at low alpha and stays faint on
 * whatever page hosts the chart.
 */
function periodInk(theme: ResolvedTheme): string {
  const share = theme.isDark ? PERIOD_INK_DARK : PERIOD_INK_LIGHT;
  const { background, text } = theme.colors;
  // A text color d3 can't parse (a CSS variable) gets its alpha from the browser instead.
  if (!isOpaqueColor(text)) return `color-mix(in srgb, ${text} ${share * 100}%, transparent)`;
  // d3 takes a NaN channel from the other end, so mixing from 'transparent' keeps the
  // text's channels and only ramps the alpha.
  const ground = isOpaqueColor(background) ? background : 'transparent';
  return interpolateRgb(ground, text)(share);
}

/** The period label's text mark reading `text` at `placement`. */
export function periodLabelMark(
  text: string,
  placement: PeriodLabelPlacement,
  theme: ResolvedTheme,
): TextMarkLayout {
  return {
    type: 'textMark',
    key: PERIOD_LABEL_KEY,
    x: placement.x,
    y: placement.y,
    text,
    fill: periodInk(theme),
    fontSize: placement.fontSize,
    fontWeight: theme.fonts.weights.bold,
    fontFamily: theme.fonts.family,
    textAnchor: placement.textAnchor,
    dominantBaseline: placement.dominantBaseline,
    data: {},
    // The live region and the controls' readout already announce the period.
    aria: { decorative: true },
  };
}

/** What a chart's overlays need, fixed for the whole run. */
export interface OverlayPlan {
  /** Period label text per period index, or null when there's no period label. */
  periodTexts: string[] | null;
  placement: PeriodLabelPlacement;
  /** The side of its bubble each labelled point key's name label sits on, for the whole run. */
  labelSides: ReadonlyMap<string, PlaybackLabelSide>;
  theme: ResolvedTheme;
}

/** One frame's overlays, split by where they paint relative to the marks. */
export interface FrameOverlays {
  /** Drawn before the marks: the period label. */
  behind: FrameMark[];
  /** Drawn after the marks: the name labels. */
  above: FrameMark[];
}

/**
 * The side each of `labelled` gets for the run: right of its bubble, unless at any of
 * `periodFrames` (the marks at every period) the right-side label would pass the right edge
 * of `area`, in which case left for the whole run. Positions between periods interpolate
 * between those frames, so checking each period covers the run.
 */
export function decideLabelSides(
  labelled: Iterable<string>,
  periodFrames: Iterable<FrameMark[]>,
  theme: ResolvedTheme,
  area: Rect,
): Map<string, PlaybackLabelSide> {
  const sides = new Map<string, PlaybackLabelSide>();
  for (const key of labelled) sides.set(key, 'right');
  if (sides.size === 0) return sides;
  for (const frame of periodFrames) {
    for (const { key, mark } of frame) {
      if (mark.type !== 'point' || sides.get(key) !== 'right') continue;
      if (labelOverflowsRight(mark, key, theme, area)) sides.set(key, 'left');
    }
  }
  return sides;
}

/**
 * The overlays for one frame: the period label for `period` (the period the playhead has
 * reached) and a name label beside each labelled point in `marks`, sharing its presence.
 */
export function buildFrameOverlays(
  plan: OverlayPlan,
  marks: FrameMark[],
  period: number,
): FrameOverlays {
  const behind: FrameMark[] = [];
  const periodText = plan.periodTexts?.[period];
  if (periodText !== undefined) {
    const mark = periodLabelMark(periodText, plan.placement, plan.theme);
    behind.push({ key: PERIOD_LABEL_KEY, mark, presence: 1 });
  }
  const above: FrameMark[] = [];
  for (const { key, mark, presence } of marks) {
    const side = plan.labelSides.get(key);
    if (mark.type !== 'point' || side === undefined) continue;
    const label = labelPlaybackPoint(mark, key, plan.theme, side);
    above.push({ key: String(label.key), mark: label, presence });
  }
  return { behind, above };
}

/**
 * A frame's marks and overlays in paint order: the overlays behind the marks, the marks,
 * then the overlays above them. The base layout and the static compile both order their
 * marks through this, so the two never disagree.
 */
export function paintOrder(overlays: FrameOverlays, marks: FrameMark[]): FrameMark[] {
  return [...overlays.behind, ...marks, ...overlays.above];
}
