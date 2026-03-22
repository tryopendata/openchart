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
    const magnitude = Math.pow(10, Math.floor(Math.log10(step)));
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
 * Apply a bin transform to data rows.
 *
 * Adds one or two fields to each row:
 * - If `as` is a string: adds `as` with the bin start value.
 * - If `as` is [start, end]: adds both bin start and bin end fields.
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
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    extent = [min === Infinity ? 0 : min, max === -Infinity ? 0 : max];
  }

  const step = params.step ?? computeStep(extent, maxbins, nice);
  const [startAs, endAs] = Array.isArray(transform.as) ? transform.as : [transform.as, undefined];

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
