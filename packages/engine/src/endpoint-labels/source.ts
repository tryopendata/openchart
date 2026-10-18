import type { DataRow } from '@opendata-ai/openchart-core';
import { sortByField } from '../charts/utils';
import type { NormalizedChartSpec } from '../compiler/types';
import { finiteNumber } from '../data/finite-number';
import { seriesField } from '../legend/suppression';

/** Source rows eligible for endpoint display before geometry exists. */
export function endpointSourceRows(spec: NormalizedChartSpec): Map<string, DataRow[]> {
  const field = seriesField(spec);
  const x = spec.encoding.x;
  const y = spec.encoding.y;
  const groups = new Map<string, DataRow[]>();
  if (!field || !x || !y) return groups;
  const stacked = spec.markType === 'area' && y.stack !== null && y.stack !== false;
  const gaps = new Set<string>();
  if (stacked) {
    for (const row of spec.data) {
      if (finiteNumber(row[y.field]) === undefined) gaps.add(String(row[x.field]));
    }
  }
  const rows =
    x.type === 'nominal' || x.type === 'ordinal' ? spec.data : sortByField(spec.data, x.field);
  for (const row of rows) {
    const xValue = row[x.field];
    const positionalType = x.scale?.type;
    const temporal =
      positionalType === 'time' ||
      positionalType === 'utc' ||
      (!positionalType && x.type === 'temporal');
    const numeric = positionalType
      ? !['time', 'utc', 'point', 'band', 'ordinal'].includes(positionalType)
      : x.type === 'quantitative';
    if (
      temporal &&
      Number.isNaN((xValue instanceof Date ? xValue : new Date(String(xValue))).getTime())
    )
      continue;
    if (numeric && finiteNumber(xValue) === undefined) continue;
    const name = String(row[field]);
    if (spec.highlight?.length && !spec.highlight.includes(name)) continue;
    if (
      row[x.field] == null ||
      finiteNumber(row[y.field]) === undefined ||
      gaps.has(String(row[x.field]))
    )
      continue;
    const group = groups.get(name);
    if (group) group.push(row);
    else groups.set(name, [row]);
  }
  return groups;
}
