/** Shared area pivot/offset semantics for domain measurement and mark geometry. */
import type { DataRow } from '@opendata-ai/openchart-core';
import type { Series } from 'd3-shape';
import {
  stack,
  stackOffsetExpand,
  stackOffsetNone,
  stackOffsetSilhouette,
  stackOrderNone,
} from 'd3-shape';
import { finiteNumber } from './finite-number';
import { sortByField } from './sort-by-field';

export interface AreaStackGeometry {
  stackedData: Series<Record<string, unknown>, string>[];
  rowsByXSeries: Map<string, DataRow>;
  missingBoundaries: Set<string>;
  extent: [number, number];
}
/** Created per compilation; never retained by a module or an authored input. */
export type AreaStackCache = WeakMap<DataRow[], Map<string, AreaStackGeometry>>;
export function createAreaStackCache(): AreaStackCache {
  return new WeakMap();
}

export function computeAreaStack(
  data: DataRow[],
  xField: string,
  yField: string,
  colorField: string,
  xType: string,
  offset: unknown,
  cache?: AreaStackCache,
): AreaStackGeometry {
  const key = cache ? JSON.stringify([xField, yField, colorField, xType, offset]) : '';
  const cached = cache?.get(data)?.get(key);
  if (cached) return cached;
  const sortedData = xType === 'nominal' || xType === 'ordinal' ? data : sortByField(data, xField);
  const seriesKeys = new Set<string>();
  const rowsByX = new Map<string, DataRow[]>();
  const rowsByXSeries = new Map<string, DataRow>();
  for (const row of sortedData) {
    const xKey = String(row[xField]);
    const series = String(row[colorField]);
    seriesKeys.add(series);
    rowsByXSeries.set(`${xKey}::${series}`, row);
    const rows = rowsByX.get(xKey) ?? [];
    rows.push(row);
    rowsByX.set(xKey, rows);
  }
  const keys = [...seriesKeys];
  const missingBoundaries = new Set<string>();
  const pivotData = [...rowsByX].map(([xKey, rows]) => {
    const pivot: Record<string, unknown> = { __x__: xKey };
    for (const key of keys) pivot[key] = 0;
    for (const row of rows) {
      const value = finiteNumber(row[yField]);
      if (value === undefined) missingBoundaries.add(xKey);
      pivot[String(row[colorField])] = value ?? 0;
    }
    return pivot;
  });
  const offsetFn =
    offset === 'normalize'
      ? stackOffsetExpand
      : offset === 'center'
        ? stackOffsetSilhouette
        : stackOffsetNone;
  const stackedData = stack<Record<string, unknown>>()
    .keys(keys)
    .order(stackOrderNone)
    .offset(offsetFn)(pivotData);
  let lower = 0;
  let upper = 0;
  for (const layer of stackedData)
    for (const point of layer) {
      if (missingBoundaries.has(String(point.data.__x__))) continue;
      if (Number.isFinite(point[0])) {
        lower = Math.min(lower, point[0]);
        upper = Math.max(upper, point[0]);
      }
      if (Number.isFinite(point[1])) {
        lower = Math.min(lower, point[1]);
        upper = Math.max(upper, point[1]);
      }
    }
  const result: AreaStackGeometry = {
    stackedData,
    rowsByXSeries,
    missingBoundaries,
    extent: [lower, upper],
  };
  if (cache) {
    const entries = cache.get(data) ?? new Map<string, AreaStackGeometry>();
    entries.set(key, result);
    cache.set(data, entries);
  }
  return result;
}
