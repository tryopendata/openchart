/**
 * Size legend: graduated circles keying a quantitative `size` encoding.
 *
 * Without this, `size` is an *unkeyed* channel: a bubble chart shows circles of
 * varying area and gives the reader nothing to decode them with.
 *
 * Two rules drive the whole module, and both are about not lying to the reader.
 *
 * **Resolve the same scale the marks resolve.** The radii here come from
 * `buildSizeScale` -- the identical builder `scatter/compute.ts` and
 * `beeswarm/compute.ts` call -- rather than a re-derivation. A key whose circles
 * are computed independently of the marks is a key that can silently drift from
 * them. (`continuous.ts` mirrors the color path for exactly this reason.)
 *
 * **Key the domain, not the data extent.** The size scale clamps. With an
 * explicit `scale.domain`, every datum past `domain[1]` renders at max radius,
 * so a circle labeled with the largest *datum* would imply a correspondence that
 * doesn't hold. The domain is what the scale actually promises.
 */

import type {
  DataRow,
  EncodingChannel,
  Rect,
  ResolvedTheme,
  SizeLegendCircle,
  SizeLegendLayout,
} from '@opendata-ai/openchart-core';
import { abbreviateNumber, buildD3Formatter, formatNumber } from '@opendata-ai/openchart-core';

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
 * Pick the values to key, largest first.
 *
 * Anchored at the top of the domain and stepped down by halves, then
 * nice-rounded. Values that collapse onto each other after rounding, or fall
 * below the domain floor, are dropped -- better to show two honest circles than
 * three where two are indistinguishable.
 */
function pickValues(domain: [number, number]): number[] {
  const [lo, hi] = domain;
  const out: number[] = [];
  for (let i = 0; i < CIRCLE_COUNT; i++) {
    const raw = hi / 2 ** i;
    const nice = niceFloor(raw);
    if (nice < lo || nice <= 0) continue;
    if (out.some((v) => v === nice)) continue;
    out.push(nice);
  }
  // Always key the top of the domain, even when it isn't a round number: it is
  // the one value the scale's maximum radius actually corresponds to.
  if (out.length === 0 || out[0] < hi) out.unshift(hi);
  return [...new Set(out)];
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

  const values = pickValues(resolved.domain);
  if (values.length === 0) return null;

  const maxRadius = resolved.scale(resolved.domain[1]);
  if (!Number.isFinite(maxRadius) || maxRadius <= 0) return null;

  const fontSize = theme.fonts.sizes.small;

  // Nested: every circle shares the baseline, so cy = baseline - r.
  const baseline = maxRadius * 2;
  const cx = maxRadius;

  const circles: SizeLegendCircle[] = values.map((value) => {
    const radius = resolved.scale(value);
    return {
      value,
      label: formatValue(value, (sizeEncoding as EncodingChannel).format),
      radius,
      cx,
      cy: baseline - radius,
      // Label sits on each circle's top edge, to the right of the stack.
      labelY: baseline - radius * 2 + fontSize * 0.35,
    };
  });

  // Widest label decides the block width. Rough advance-width estimate is fine:
  // this is a reservation, and over-reserving by a few px is harmless.
  const widestLabel = Math.max(...circles.map((c) => c.label.length)) * fontSize * 0.6;

  return {
    circles,
    width: maxRadius * 2 + LABEL_GAP + widestLabel,
    height: baseline + BASELINE_PAD,
  };
}

/**
 * Place size legend content into chart coordinates.
 *
 * Sits in the right column that `dimensions.ts` reserved, top-aligned with the
 * plot. The content's circle/label coordinates are bounds-relative, so the
 * renderer just translates by `bounds`.
 */
export function placeSizeLegend(
  content: SizeLegendContent,
  chartArea: Rect,
  theme: ResolvedTheme,
): SizeLegendLayout {
  return {
    type: 'size',
    channel: 'size',
    position: 'right',
    bounds: {
      x: chartArea.x + chartArea.width + SIZE_LEGEND_GAP,
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
