/**
 * Shared `size` channel scale.
 *
 * Three marks map a quantitative field onto a visual magnitude, and each used to
 * build this scale inline with the same six lines and a different pair of
 * constants. A size legend has to resolve the *same* scale the marks resolve or
 * the key silently lies about what a big circle means, so the builder lives in
 * one place and everyone -- marks and legend -- calls it.
 *
 * The curve is the one thing that genuinely differs, and it is a perceptual
 * call, not a preference:
 *
 * - `sqrt` for circles (scatter, beeswarm). Perceived magnitude of a disc tracks
 *   its *area*, and area goes as r^2, so radius must go as sqrt(value).
 * - `linear` for glyphs (text). A word reads by its *height*, which is linear in
 *   font size. Running font size through sqrt would be cargo-culting the bubble
 *   math onto a channel that doesn't share its geometry.
 */

import type { DataRow, EncodingChannel } from '@opendata-ai/openchart-core';
import { max, min } from 'd3-array';
import { scaleLinear, scaleSqrt } from 'd3-scale';

/** How a size value maps onto its visual magnitude. */
export type SizeCurve = 'sqrt' | 'linear';

/** A resolved size scale plus the domain and range it was built from. */
export interface ResolvedSizeScale {
  /** Maps a data value to a visual magnitude (radius, or font size). */
  scale: (value: number) => number;
  /** The domain actually used: an explicit `scale.domain` wins over the data extent. */
  domain: [number, number];
  /** The output range actually used: an explicit `scale.range` wins over the default. */
  range: [number, number];
  /** The field the scale reads. */
  field: string;
}

/**
 * Build the size scale for a quantitative `size` encoding.
 *
 * Author overrides come from the encoding, mirroring the color path: an explicit
 * `scale.domain` (e.g. `[0, 900]`) keeps the largest datum below the max radius
 * so dense clusters don't blob together, and an explicit `scale.range` caps the
 * output magnitudes.
 *
 * The scale is **clamped**: a datum outside an explicit domain renders at the
 * range endpoint rather than running off to an absurd radius. A legend built
 * from this must therefore key the *domain*, not the data extent -- above an
 * explicit `domain[1]` every datum looks identical.
 *
 * Holes (`null`, `undefined`, `''`) are not zeros -- they are absent data --
 * and are dropped before the extent is fitted rather than coerced into it.
 *
 * @returns null when there is no size field, or when the domain is degenerate
 * (no finite values, or every value identical). A zero-width domain would map
 * every datum to the range's first value, so there is nothing to encode and
 * nothing to legend.
 */
export function buildSizeScale(
  sizeEncoding: EncodingChannel | undefined,
  data: readonly DataRow[],
  options: { curve: SizeCurve; range: [number, number] },
): ResolvedSizeScale | null {
  if (!sizeEncoding || !('field' in sizeEncoding) || !sizeEncoding.field) return null;
  const field = sizeEncoding.field;

  const values: number[] = [];
  for (const row of data) {
    const raw = row[field];
    // Reject holes before coercing: `Number(null)` and `Number('')` are both a
    // finite 0, so a null would enter the extent as a real zero and drag the
    // domain floor down -- rescaling every genuine mark, and drawing a
    // minimum-size mark for a datum that has no size at all.
    if (raw == null || raw === '') continue;
    const v = Number(raw);
    if (Number.isFinite(v)) values.push(v);
  }

  const explicitDomain = sizeEncoding.scale?.domain as [number, number] | undefined;

  // Nothing to fit a domain to. An explicit domain still stands on its own --
  // it is the author's, not the data's -- but without one there is no extent,
  // and `min([]) ?? 0` / `max([]) ?? 1` would fabricate a bogus [0, 1].
  if (!explicitDomain && values.length === 0) return null;

  const domain: [number, number] = explicitDomain ?? [min(values) as number, max(values) as number];

  // A zero-width domain maps every datum to range[0]: no magnitude is encoded,
  // so callers fall back to their static default rather than render a field of
  // identical minimum-size marks.
  if (!Number.isFinite(domain[0]) || !Number.isFinite(domain[1]) || domain[0] >= domain[1]) {
    return null;
  }

  const explicitRange = sizeEncoding.scale?.range as [number, number] | undefined;
  const range: [number, number] = explicitRange ?? options.range;

  const build = options.curve === 'linear' ? scaleLinear : scaleSqrt;
  const scale = build().domain(domain).range(range).clamp(true);

  return { scale: (value: number) => scale(value), domain, range, field };
}
