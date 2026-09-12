/**
 * Density transform: Gaussian kernel density estimate over a quantitative field.
 *
 * Unlike the other transforms, this one does not map or filter the input rows —
 * it replaces them. The output is a fresh dataset of evaluation points (one row
 * per step, per group), which is what an area mark plots as a smooth curve.
 */

import type { DataRow, DensityTransform } from '@opendata-ai/openchart-core';
import { deviation, quantile } from 'd3-array';

/** Default number of points the curve is evaluated at. */
const DEFAULT_STEPS = 200;

/** Hard cap on evaluation points, so a bad `steps` can't exhaust memory. */
const MAX_STEPS = 10_000;

/**
 * How far past the data extent to evaluate, in bandwidths. Three is enough for
 * a Gaussian kernel's tail to be visually closed; stopping at the data extent
 * would chop the curve off mid-slope at both ends.
 */
const EXTENT_PADDING_BANDWIDTHS = 3;

/** Fallback bandwidth when every value is identical (spread is zero). */
const DEGENERATE_BANDWIDTH = 1;

const SQRT_2PI = Math.sqrt(2 * Math.PI);

/**
 * Silverman's rule of thumb: `1.06 * min(stdev, IQR / 1.34) * n^(-1/5)`.
 *
 * The IQR term is what keeps a heavy tail or an outlier from inflating the
 * bandwidth and smearing away real structure, which using the standard
 * deviation alone would do.
 */
export function silvermanBandwidth(values: number[]): number {
  const n = values.length;
  if (n < 2) return DEGENERATE_BANDWIDTH;

  const sd = deviation(values) ?? 0;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25) ?? 0;
  const q3 = quantile(sorted, 0.75) ?? 0;
  const iqrScale = (q3 - q1) / 1.34;

  const spread = iqrScale > 0 ? Math.min(sd, iqrScale) : sd;
  if (!(spread > 0)) return DEGENERATE_BANDWIDTH;

  return 1.06 * spread * n ** (-1 / 5);
}

/**
 * Bounded, integral step count.
 *
 * `steps` arrives from the spec, where `NaN` or `Infinity` would reach
 * `new Array(steps)` and either throw or allocate until the tab dies. The cap
 * is well past the point where a curve is visually smooth at any chart width.
 */
function resolveSteps(requested: number | undefined): number {
  if (requested == null || !Number.isFinite(requested)) return DEFAULT_STEPS;
  return Math.min(MAX_STEPS, Math.max(2, Math.round(requested)));
}

/** An author-supplied extent is only usable if it's finite and ascending. */
function isUsableExtent(extent: [number, number]): boolean {
  const [lo, hi] = extent;
  return Number.isFinite(lo) && Number.isFinite(hi) && hi > lo;
}

/** Standard normal kernel. */
function gaussian(u: number): number {
  return Math.exp(-0.5 * u * u) / SQRT_2PI;
}

/** Group rows by a composite key over the groupby fields. */
function groupRows(data: DataRow[], groupby: string[]): Map<string, DataRow[]> {
  if (groupby.length === 0) return new Map([['', data]]);
  const groups = new Map<string, DataRow[]>();
  for (const row of data) {
    const key = groupby.map((f) => String(row[f] ?? '')).join('\x00');
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }
  return groups;
}

/**
 * Apply a density transform to data rows.
 *
 * @param data - Input rows holding the raw observations.
 * @param transform - Density transform definition.
 * @returns One row per (group, evaluation point), carrying the groupby fields.
 */
export function runDensity(data: DataRow[], transform: DensityTransform): DataRow[] {
  const field = transform.density;
  const groupby = transform.groupby ?? [];
  const steps = resolveSteps(transform.steps);
  const [valueAs, densityAs] = transform.as ?? ['value', 'density'];
  const cumulative = transform.cumulative === true;
  const counts = transform.counts === true;

  const groups = groupRows(data, groupby);

  // Per-group samples and bandwidths, resolved before the extent so an
  // unspecified extent can be padded by the widest bandwidth in play. Sharing
  // one extent across groups is what lets two curves be compared on one axis.
  const prepared: Array<{ rows: DataRow[]; samples: number[]; bandwidth: number }> = [];
  let widestBandwidth = 0;

  for (const rows of groups.values()) {
    // Filter the missing values out *before* coercing: `Number(null)` is 0,
    // so a row with no value would otherwise plant a kernel at zero.
    const samples: number[] = [];
    for (const r of rows) {
      const raw = r[field];
      if (raw == null || raw === '') continue;
      const v = Number(raw);
      if (Number.isFinite(v)) samples.push(v);
    }
    if (samples.length === 0) continue;
    const bandwidth =
      transform.bandwidth && transform.bandwidth > 0
        ? transform.bandwidth
        : silvermanBandwidth(samples);
    widestBandwidth = Math.max(widestBandwidth, bandwidth);
    prepared.push({ rows, samples, bandwidth });
  }

  if (prepared.length === 0) return [];

  let lo: number;
  let hi: number;
  if (transform.extent && isUsableExtent(transform.extent)) {
    [lo, hi] = transform.extent;
  } else {
    // Folded per group rather than spread over one flattened array:
    // `Math.min(...values)` blows the call stack somewhere past 100k rows.
    let dataMin = Number.POSITIVE_INFINITY;
    let dataMax = Number.NEGATIVE_INFINITY;
    for (const p of prepared) {
      for (const v of p.samples) {
        if (v < dataMin) dataMin = v;
        if (v > dataMax) dataMax = v;
      }
    }
    const pad = widestBandwidth * EXTENT_PADDING_BANDWIDTHS;
    lo = dataMin - pad;
    hi = dataMax + pad;
  }
  if (!(hi > lo)) {
    // Every observation identical: give the curve a nominal window so it has
    // somewhere to be drawn rather than collapsing to a zero-width spike.
    lo -= DEGENERATE_BANDWIDTH;
    hi += DEGENERATE_BANDWIDTH;
  }

  const stride = (hi - lo) / (steps - 1);
  const out: DataRow[] = [];

  for (const { rows, samples, bandwidth } of prepared) {
    // Carry the grouping values through so the color channel still resolves.
    const groupValues: DataRow = {};
    for (const f of groupby) groupValues[f] = rows[0][f];

    const n = samples.length;
    const scale = counts ? n : 1;

    const densities: number[] = new Array(steps);
    for (let i = 0; i < steps; i++) {
      const x = lo + i * stride;
      let sum = 0;
      for (const v of samples) sum += gaussian((x - v) / bandwidth);
      densities[i] = sum / (n * bandwidth);
    }

    if (cumulative) {
      // Trapezoidal running integral, renormalized so the curve ends at
      // exactly 1 (or n). The estimate's own integral drifts off 1 by the
      // mass that falls outside the evaluated extent.
      const running: number[] = new Array(steps);
      let acc = 0;
      running[0] = 0;
      for (let i = 1; i < steps; i++) {
        acc += ((densities[i] + densities[i - 1]) / 2) * stride;
        running[i] = acc;
      }
      const total = running[steps - 1] || 1;
      for (let i = 0; i < steps; i++) {
        out.push({
          ...groupValues,
          [valueAs]: lo + i * stride,
          [densityAs]: (running[i] / total) * scale,
        });
      }
      continue;
    }

    for (let i = 0; i < steps; i++) {
      out.push({
        ...groupValues,
        [valueAs]: lo + i * stride,
        [densityAs]: densities[i] * scale,
      });
    }
  }

  return out;
}
