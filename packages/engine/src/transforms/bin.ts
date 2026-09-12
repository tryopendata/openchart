/**
 * Bin transform: discretizes a continuous field into bins.
 *
 * Adds bin start (and optionally bin end) fields to each row.
 */

import type { BinParams, BinTransform, DataRow } from '@opendata-ai/openchart-core';

/**
 * Compute a nice step size for binning.
 */
function computeStep(extent: [number, number], maxbins: number, nice: boolean): number {
  const span = extent[1] - extent[0];
  if (span === 0) return 1;

  let step = span / maxbins;

  if (nice) {
    // Round to a nice step: 1, 2, 5, 10, 20, 50, etc.
    const magnitude = 10 ** Math.floor(Math.log10(step));
    const residual = step / magnitude;

    if (residual <= 1.5) {
      step = magnitude;
    } else if (residual <= 3.5) {
      step = 2 * magnitude;
    } else if (residual <= 7.5) {
      step = 5 * magnitude;
    } else {
      step = 10 * magnitude;
    }
  }

  return step;
}

/**
 * Compute log-spaced bin edges for a given extent and bin count.
 *
 * Edges are equally spaced in log10 space: for domain [min, max] with N bins,
 * edge_i = 10^(log10(min) + i * (log10(max) - log10(min)) / N).
 *
 * Values <= 0 are excluded from extent computation since log is undefined there.
 */
function computeLogBinEdges(extent: [number, number], maxbins: number): number[] {
  const lo = Math.max(extent[0], Number.MIN_VALUE);
  const hi = Math.max(extent[1], lo);
  const logMin = Math.log10(lo);
  const logMax = Math.log10(hi);
  const logSpan = logMax - logMin;

  if (logSpan === 0) return [lo, lo * 10];

  const edges: number[] = [];
  for (let i = 0; i <= maxbins; i++) {
    edges.push(10 ** (logMin + (i / maxbins) * logSpan));
  }
  return edges;
}

/**
 * Apply a bin transform to data rows.
 *
 * Adds one or two fields to each row:
 * - If `as` is a string: adds `as` with the bin start value.
 * - If `as` is [start, end]: adds both bin start and bin end fields.
 *
 * When `params.scaleType` is `'log'`, bins are log-spaced (equal width in log
 * space). This is auto-detected by the histogram mark when the x scale is
 * logarithmic.
 *
 * @param data - Input rows.
 * @param transform - Bin transform definition.
 * @returns New rows with binned field(s) added.
 */
export function runBin(data: DataRow[], transform: BinTransform): DataRow[] {
  const params: BinParams = transform.bin === true ? {} : transform.bin;
  const maxbins = params.maxbins ?? 10;
  const nice = params.nice ?? true;
  const field = transform.field;

  // Compute extent from data if not provided
  let extent = params.extent;
  if (!extent) {
    let min = Infinity;
    let max = -Infinity;
    for (const row of data) {
      const v = Number(row[field]);
      if (Number.isFinite(v)) {
        // For log scale, skip non-positive values
        if (params.scaleType === 'log' && v <= 0) continue;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    extent = [min === Infinity ? 0 : min, max === -Infinity ? 0 : max];
  }

  const [startAs, endAs] = Array.isArray(transform.as) ? transform.as : [transform.as, undefined];

  // Log-spaced binning
  if (params.scaleType === 'log') {
    const edges = computeLogBinEdges(extent, maxbins);
    return data.map((row) => {
      const v = Number(row[field]);
      const newRow = { ...row };

      if (!Number.isFinite(v) || v <= 0) {
        newRow[startAs] = null;
        if (endAs) newRow[endAs] = null;
      } else {
        // Binary search for the bin: find the last edge <= v
        let lo = 0;
        let hi = edges.length - 2; // last valid bin start index
        while (lo < hi) {
          const mid = (lo + hi + 1) >> 1;
          if (edges[mid] <= v) lo = mid;
          else hi = mid - 1;
        }
        // Clamp to the last bin if v equals the max edge
        const idx = Math.min(lo, edges.length - 2);
        newRow[startAs] = edges[idx];
        if (endAs) newRow[endAs] = edges[idx + 1];
      }

      return newRow;
    });
  }

  // Linear binning (original path)
  const step = params.step ?? computeStep(extent, maxbins, nice);

  return data.map((row) => {
    const v = Number(row[field]);
    const newRow = { ...row };

    if (!Number.isFinite(v)) {
      newRow[startAs] = null;
      if (endAs) newRow[endAs] = null;
    } else {
      const binStart = Math.floor((v - extent![0]) / step) * step + extent![0];
      newRow[startAs] = binStart;
      if (endAs) newRow[endAs] = binStart + step;
    }

    return newRow;
  });
}
