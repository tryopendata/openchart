/**
 * Size legend: graduated circles keying a quantitative `size` encoding.
 *
 * Without this, `size` is an *unkeyed* channel: a bubble chart shows circles of
 * varying area and gives the reader nothing to decode them with.
 *
 * Three rules drive the module, and they are all about not lying to the reader.
 *
 * **Resolve the same scale the marks resolve.** The values come from
 * `buildSizeScale` -- the identical builder `scatter/compute.ts` and
 * `beeswarm/compute.ts` call -- rather than a re-derivation. A key computed
 * independently of the marks is a key that can silently drift from them.
 * (`continuous.ts` mirrors the color path for exactly this reason.)
 *
 * **Key the domain, not the data extent.** The size scale clamps. With an
 * explicit `scale.domain`, every datum past `domain[1]` renders at max radius,
 * so a circle labeled with the largest *datum* would imply a correspondence that
 * doesn't hold. The domain is what the scale actually promises.
 *
 * **A key you can't see keys nothing.** The one place the drawn circles are
 * allowed to depart from the marks: when the mark's radius range is too small to
 * read (a beeswarm's [2, 10] is a 20px smudge), the circles are redrawn across
 * `MIN_LEGIBLE_RANGE`. The labels still carry the true values -- only the swatch
 * is scaled up, and only when the literal version would be illegible.
 */

import type {
  DataRow,
  EncodingChannel,
  LegendLayout,
  Rect,
  ResolvedTheme,
  SizeLegendCircle,
  SizeLegendLayout,
} from '@opendata-ai/openchart-core';
import {
  abbreviateNumber,
  buildD3Formatter,
  estimateTextWidth,
  formatNumber,
} from '@opendata-ai/openchart-core';

import { scaleLinear, scaleSqrt } from 'd3-scale';

import { buildSizeScale, type SizeCurve, sizeScaleDefaultsFor } from '../compile/size-scale';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Gap between the circle stack and its labels. */
const LABEL_GAP = 6;

/** Padding below the baseline so the largest circle's stroke isn't clipped. */
const BASELINE_PAD = 2;

/** How many circles to key. Three reads as a scale; two reads as a comparison. */
const CIRCLE_COUNT = 3;

/**
 * Smallest radius range the drawn circles are allowed to occupy.
 *
 * A beeswarm sizes its dots [2, 10]: rendering the key at those radii puts three
 * labels next to a 20px smudge that reads as no key at all. When the mark's own
 * range is smaller than this, the circles are redrawn across [4, 18] -- still
 * ordered and still proportional to each other, but big enough to see. The key
 * becomes *indicative* rather than a 1:1 swatch of the marks, which is the right
 * trade: a key you can't see keys nothing. Marks that already exceed this (a
 * scatter's [3, 30]) are drawn at their true radii and match the bubbles exactly.
 */
const MIN_LEGIBLE_RANGE: readonly [number, number] = [4, 18];

/** Gap between the plot's right edge and the size legend column. */
export const SIZE_LEGEND_GAP = 12;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Pre-placement size legend content (origin-relative coordinates). */
export interface SizeLegendContent {
  circles: SizeLegendCircle[];
  /** Total width of the legend block. */
  width: number;
  /** Total height of the legend block. */
  height: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * A radius scale over an explicit range, bypassing the encoding's own
 * `scale.range` (which `buildSizeScale` honours, and which is exactly the
 * too-small range the legible floor exists to escape). Same curve and clamping
 * as the mark scale, so the circles stay proportional to each other.
 */
function buildRadiusScale(
  curve: SizeCurve,
  domain: [number, number],
  range: readonly [number, number],
): (value: number) => number {
  const build = curve === 'linear' ? scaleLinear : scaleSqrt;
  const scale = build().domain(domain).range([range[0], range[1]]).clamp(true);
  return (value: number) => scale(value);
}

/** Format a legend value: channel format wins, then the house number style. */
function formatValue(value: number, formatStr?: string): string {
  if (formatStr) {
    const fmt = buildD3Formatter(formatStr);
    if (fmt) return fmt(value);
  }
  if (Math.abs(value) >= 1000) return abbreviateNumber(value);
  return formatNumber(value);
}

/**
 * Round a value down to one significant-ish figure (1, 2, 5 x 10^n).
 *
 * Real graduated-circle keys show round numbers -- "500M", not "487.3M". A
 * naive min/median/max would also cluster badly on the skewed (log-normal)
 * data that bubble charts are usually made of: population min/median/max might
 * be 300k / 9M / 1.4B, and under a sqrt scale the first two are visually
 * identical. Nice-rounding off the domain's top spreads the circles out.
 */
function niceFloor(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return value;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1;
  return step * magnitude;
}

/**
 * Pick the values to key, largest first. At most `CIRCLE_COUNT` of them.
 *
 * **Spaced evenly in radius, not in value.** Radius is what the reader actually
 * sees, and the mapping to it is non-linear (sqrt, so circle *area* tracks the
 * value). Stepping the value by halves or by a constant ratio therefore bunches
 * the small circles together: on `[300k, 1.4B]` the geometric midpoint is 20M,
 * whose radius sits a couple of pixels off the floor. Walking the *radius* range
 * in equal steps and inverting back to a value spreads the circles out the way a
 * published graduated-circle key does.
 *
 * The domain top is always keyed first: it is the one value the maximum radius
 * corresponds to, round number or not.
 *
 * Interior values are then nice-rounded, but only when the rounded number still
 * lands inside the domain and doesn't collapse onto the neighbour above --
 * `niceFloor(95)` is 50, which on `[90, 100]` is a value the scale never renders.
 * Prettiness loses to being true.
 */
function pickValues(domain: [number, number], scale: (v: number) => number): number[] {
  const [lo, hi] = domain;
  const rHi = scale(hi);
  const rLo = scale(lo);
  const out: number[] = [hi];

  // Invert the scale numerically: it is monotone on [lo, hi], so bisection finds
  // the value for a target radius without needing the scale's own `.invert`
  // (which `buildSizeScale` doesn't surface, and which wouldn't exist for a
  // clamped custom curve anyway).
  const valueAtRadius = (target: number): number => {
    let a = lo;
    let b = hi;
    for (let i = 0; i < 40; i++) {
      const mid = (a + b) / 2;
      if (scale(mid) < target) a = mid;
      else b = mid;
    }
    return (a + b) / 2;
  };

  for (let i = 1; i < CIRCLE_COUNT; i++) {
    const targetRadius = rHi - ((rHi - rLo) * i) / (CIRCLE_COUNT - 1);
    // Bisection lands on float dust (89.99999...), which formats as "90.00".
    // Snap to 3 significant figures so the fallback label is readable even when
    // it isn't a round number.
    const raw = toPrecision(valueAtRadius(targetRadius), 3);
    const nice = niceFloor(raw);
    const prev = out[out.length - 1];
    // Take the round number only when it's in-domain and still distinct.
    const value = nice >= lo && nice <= hi && nice < prev ? nice : raw;
    if (!Number.isFinite(value) || value <= 0) continue;
    if (value < lo || value >= prev) continue;
    // A zero-anchored domain bisects toward the floor and lands on a value that
    // is positive only in the float sense (1e-9 of the domain). A bubble of ~zero
    // magnitude has no area to key, so drop it rather than label a dot "0".
    if (value < hi * 1e-6) continue;
    out.push(value);
  }
  return out;
}

/** Round to `digits` significant figures. */
function toPrecision(value: number, digits: number): number {
  if (!Number.isFinite(value) || value === 0) return value;
  const magnitude = 10 ** (Math.floor(Math.log10(Math.abs(value))) - digits + 1);
  return Math.round(value / magnitude) * magnitude;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** True when the spec encodes a quantitative `size` channel worth keying. */
export function hasSizeChannel(encoding: { size?: unknown } | undefined): boolean {
  const size = encoding?.size as EncodingChannel | undefined;
  return !!size && 'field' in size && !!size.field && size.type === 'quantitative';
}

/**
 * Marks whose `size` channel is a *keyed* encoding -- one a reader is meant to
 * decode back into a value, and which therefore earns a legend.
 *
 * `point` and `beeswarm` map size to circle area: keyable, and the graduated
 * circles below key it.
 *
 * `text` is deliberately absent. It maps size to *font size*, and no publication
 * legends font size -- a stack of type at 12/24/48px reads as a font-sample
 * sheet, not a key. Size on a text mark is emphasis, not a channel a reader
 * decodes. (Vega-Lite emits one only because its legend generation is
 * mechanical, not because anyone wants it.)
 */
const KEYED_SIZE_MARKS = new Set(['point', 'beeswarm']);

/** Size-scale options for a mark's legend, or null when its size channel gets none. */
export function sizeLegendScaleFor(
  markType: string,
): { curve: SizeCurve; range: [number, number] } | null {
  if (!KEYED_SIZE_MARKS.has(markType)) return null;
  return sizeScaleDefaultsFor(markType);
}

/**
 * Compute size legend content from a quantitative `size` encoding.
 *
 * Circles are nested: concentric, sharing a bottom edge, so the ratio between
 * magnitudes is legible rather than just their order.
 *
 * @returns null when there is no size channel, or when the scale is degenerate
 * (a zero-width domain encodes no magnitude, so there is nothing to key).
 */
export function computeSizeLegendContent(
  sizeEncoding: EncodingChannel | undefined,
  data: readonly DataRow[],
  theme: ResolvedTheme,
  options: { curve: SizeCurve; range: [number, number] },
): SizeLegendContent | null {
  if (!hasSizeChannel({ size: sizeEncoding })) return null;

  const resolved = buildSizeScale(sizeEncoding, data, options);
  if (!resolved) return null;

  // Circle area encodes magnitude, and a negative magnitude has no area to
  // encode -- a key for it would be nonsense (and `sqrt` of a negative is NaN).
  // The marks still render; the channel just isn't keyable, so we say nothing
  // rather than key it wrongly.
  if (!(resolved.domain[0] >= 0) || !(resolved.domain[1] > 0)) return null;

  // A lone circle is not a graduated key: it tells the reader only that the
  // biggest bubble is the biggest datum, which they already assumed. Two is the
  // minimum that establishes a scale.
  const values = pickValues(resolved.domain, resolved.scale);
  if (values.length < 2) return null;

  // Draw at the mark's own radii, unless they're too small to see -- then redraw
  // across MIN_LEGIBLE_RANGE. The *values* always come from the real scale, so
  // the labels stay true either way; only the circle sizes are rescaled.
  //
  // Test the RESOLVED range, not `options.range`: an explicit
  // `encoding.size.scale.range` overrides the mark default, and the beeswarm
  // fixture does exactly that ([2, 8]). Checking the default would miss it.
  //
  // The redraw is built straight from the domain rather than through
  // `buildSizeScale`, which reads the range off the encoding and would hand back
  // the same too-small range we're trying to escape.
  const [markMin, markMax] = resolved.range;
  const needsFloor = markMax - markMin < MIN_LEGIBLE_RANGE[1] - MIN_LEGIBLE_RANGE[0];
  const drawScale = needsFloor
    ? buildRadiusScale(options.curve, resolved.domain, MIN_LEGIBLE_RANGE)
    : resolved.scale;

  const maxRadius = drawScale(resolved.domain[1]);
  if (!Number.isFinite(maxRadius) || maxRadius <= 0) return null;

  const fontSize = theme.fonts.sizes.small;

  // Nested: every circle shares the baseline, so cy = baseline - r.
  const baseline = maxRadius * 2;
  const cx = maxRadius;

  // Labels ride each circle's top edge -- but only if the edges are far enough
  // apart to hold them. A beeswarm's size range is [2, 10], so the whole stack is
  // 20px tall and three labels pinned to those edges land on top of each other.
  // Walk down (largest first) and hold each label at least a line below the last;
  // the leader line still points at the true edge, so a nudged label stays
  // unambiguous.
  const lineHeight = fontSize * 1.25;
  let prevLabelY = Number.NEGATIVE_INFINITY;

  const circles: SizeLegendCircle[] = values.map((value) => {
    const radius = drawScale(value);
    const edgeY = baseline - radius * 2 + fontSize * 0.35;
    const labelY = Math.max(edgeY, prevLabelY + lineHeight);
    prevLabelY = labelY;
    return {
      value,
      label: formatValue(value, (sizeEncoding as EncodingChannel).format),
      radius,
      cx,
      cy: baseline - radius,
      labelY,
    };
  });

  // Widest label decides the block width. Measured with the same estimator the
  // renderer uses -- a char-count heuristic would disagree with what actually
  // gets drawn, and the sign of that disagreement flips with the font and the
  // number format (so "it over-reserves today" is not a guarantee).
  const widestLabel = Math.max(
    ...circles.map((c) => estimateTextWidth(c.label, fontSize, theme.fonts.weights.normal)),
  );

  // The label column can now run past the circle stack (see the nudge above), so
  // the block is as tall as whichever finishes lower.
  const lastLabelBottom = (circles[circles.length - 1]?.labelY ?? 0) + fontSize * 0.5;

  return {
    circles,
    width: maxRadius * 2 + LABEL_GAP + widestLabel,
    height: Math.max(baseline, lastLabelBottom) + BASELINE_PAD,
  };
}

/**
 * Place size legend content into chart coordinates.
 *
 * Sits in the right column that `dimensions.ts` reserved, top-aligned with the
 * plot. Circle/label coordinates in `content` are bounds-relative; the renderer
 * adds `bounds.x/y` to each.
 *
 * `colorLegend` is the ALREADY-PLACED color legend. When it also lives in the
 * right column, the size legend starts past its right edge -- `dimensions.ts`
 * reserved `colorWidth + 8 + sizeWidth + GAP` of right margin, and anchoring
 * both to the gutter's left edge would stack them on top of each other (a
 * bubble chart keying continent and population drew the circles straight
 * through the swatch labels). Anything else -- a top/bottom legend, or none --
 * leaves the gutter free and the size legend takes it.
 */
export function placeSizeLegend(
  content: SizeLegendContent,
  chartArea: Rect,
  theme: ResolvedTheme,
  colorLegend?: LegendLayout | null,
): SizeLegendLayout {
  const gutterX = chartArea.x + chartArea.width + SIZE_LEGEND_GAP;
  const sharesGutter =
    colorLegend != null &&
    (colorLegend.position === 'right' || colorLegend.position === 'bottom-right') &&
    colorLegend.bounds.width > 0;
  const x = sharesGutter
    ? Math.max(gutterX, colorLegend.bounds.x + colorLegend.bounds.width + SIZE_LEGEND_GAP)
    : gutterX;

  return {
    type: 'size',
    channel: 'size',
    position: 'right',
    bounds: {
      x,
      y: chartArea.y,
      width: content.width,
      height: content.height,
    },
    circles: content.circles,
    stroke: theme.colors.axis,
    labelStyle: {
      fontFamily: theme.fonts.family,
      fontSize: theme.fonts.sizes.small,
      fontWeight: theme.fonts.weights.normal,
      fill: theme.colors.text,
      lineHeight: 1.3,
      fontVariant: 'tabular-nums',
    },
  };
}
