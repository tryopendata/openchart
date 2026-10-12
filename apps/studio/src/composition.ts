import type {
  ChartSpec,
  DataRow,
  Encoding,
  EncodingChannel,
  TableSpec,
} from '@opendata-ai/openchart-core';
import { runTransforms } from '@opendata-ai/openchart-engine';
import { fieldType } from './document';
import type { SupportedSpec } from './Preview';

export const compositionNames = {
  bar: 'Bars',
  line: 'Lines',
  area: 'Area',
  point: 'Scatter',
  lollipop: 'Lollipop',
  range: 'Interval / before & after',
  histogram: 'Histogram',
  table: 'Table',
} as const;
export type Composition = keyof typeof compositionNames;
export function visibleFields(spec: SupportedSpec): string[] {
  return [...new Set(spec.data.flatMap(Object.keys))].filter(
    (field) => spec.fields?.[field]?.role !== 'identity',
  );
}
export function fieldChannel(
  spec: SupportedSpec,
  field: string,
  previous?: EncodingChannel,
): EncodingChannel {
  const type = fieldType(spec.data, field, spec.fields);
  const encodingType =
    type === 'number' ? 'quantitative' : type === 'date' ? 'temporal' : 'nominal';
  // Keep intentional formats and titles when the field is unchanged; a different
  // field has different meaning and gets neutral defaults until the author tunes it.
  return previous?.field === field ? previous : { field, type: encodingType };
}
export interface CompositionRoles {
  x: string;
  y: string;
  series: string;
  end: string;
}
export function compose(
  spec: SupportedSpec,
  kind: Composition,
  roles: CompositionRoles,
): SupportedSpec {
  const shared = {
    data: spec.data,
    fields: spec.fields,
    chrome: spec.chrome,
    theme: spec.theme,
    watermark: spec.watermark,
    animation: spec.animation,
  };
  const key =
    (!('type' in spec)
      ? spec.encoding.key?.field
      : spec.type === 'table'
        ? spec.rowKey
        : undefined) ??
    Object.keys(spec.fields ?? {}).find((field) => spec.fields?.[field]?.role === 'identity');
  if (kind === 'table')
    return {
      ...shared,
      type: 'table',
      rowKey: key,
      mobileLayout: 'priority',
      search: true,
      pagination: { pageSize: 10 },
      columns: visibleFields(spec).map((field, index) => ({
        key: field,
        label: field,
        sortable: true,
        priority: index < 2 ? 1 : 2,
      })),
    } as TableSpec;
  const fields = visibleFields(spec);
  if (!fields.includes(roles.x) || (kind !== 'histogram' && !fields.includes(roles.y)))
    throw new Error('Choose fields for both axes before applying the composition.');
  const previous = !('type' in spec) ? spec : null;
  const encoding: Encoding = {
    x: fieldChannel(spec, roles.x, previous?.encoding.x),
    ...(kind === 'histogram' ? {} : { y: fieldChannel(spec, roles.y, previous?.encoding.y) }),
    ...(key ? { key: { field: key, type: 'nominal' as const } } : {}),
  };
  if ((kind === 'line' || kind === 'area') && encoding.x && encoding.x.type !== 'temporal')
    encoding.x = { ...encoding.x, type: 'ordinal' };
  if (
    (kind === 'bar' || kind === 'lollipop') &&
    encoding.x?.type === 'quantitative' &&
    encoding.y?.type === 'quantitative'
  )
    throw new Error(
      'Bars need a category axis. Choose a category field or use Scatter for two numeric measures.',
    );
  if (kind === 'histogram' && encoding.x?.type !== 'quantitative')
    throw new Error('Histograms require a numeric X field.');
  if (
    kind === 'point' &&
    (encoding.x?.type !== 'quantitative' || encoding.y?.type !== 'quantitative')
  )
    throw new Error('Scatter plots require two numeric fields.');
  if (
    ['bar', 'line', 'area', 'lollipop'].includes(kind) &&
    encoding.x?.type !== 'quantitative' &&
    encoding.y?.type !== 'quantitative'
  )
    throw new Error('Choose at least one numeric measure.');
  if (roles.series) {
    if (!fields.includes(roles.series)) throw new Error('Choose an available series field.');
    const existing = previous?.encoding.color;
    encoding.color =
      existing && 'field' in existing && existing.field === roles.series
        ? existing
        : { field: roles.series, type: 'nominal' };
  }
  if (kind === 'range') {
    if (!fields.includes(roles.end) || fieldType(spec.data, roles.end, spec.fields) !== 'number')
      throw new Error('Choose a numeric interval endpoint.');
    if (encoding.x?.type !== 'quantitative')
      throw new Error('Intervals require a numeric X (start) field and a category Y field.');
    encoding.x2 = { field: roles.end, type: 'quantitative' };
  }
  const observations = previous?.transform
    ? runTransforms(spec.data, previous.transform)
    : spec.data;
  assertCompositionObservations(kind, encoding, observations);
  if (kind === 'bar' && roles.series) {
    const measure = encoding.x?.type === 'quantitative' ? 'x' : 'y';
    encoding[measure] = { ...encoding[measure]!, stack: null };
  }
  return {
    ...shared,
    mark: kind,
    encoding,
    ...(previous?.transform ? { transform: previous.transform } : {}),
    responsive: { preserveEnd: true, labelSummary: true },
  } as ChartSpec;
}

/** A categorical mark must not silently choose or sum repeated observations. */
export function assertCompositionObservations(
  kind: string,
  encoding: Encoding,
  observations: DataRow[],
): void {
  const color = encoding.color;
  const series =
    color && 'field' in color && (color.type === 'nominal' || color.type === 'ordinal')
      ? color.field
      : undefined;
  const facet = encoding.facet ?? encoding.row ?? encoding.column;
  const categoryField =
    kind === 'bar'
      ? encoding.x?.type === 'quantitative'
        ? encoding.y?.field
        : encoding.x?.field
      : kind === 'line' || kind === 'area'
        ? encoding.x?.field
        : kind === 'range' || kind === 'lollipop'
          ? encoding.y?.field
          : null;
  if (categoryField) {
    const identities = observations.map((row) =>
      JSON.stringify([
        row[categoryField],
        facet ? row[facet.field] : null,
        kind === 'range' || kind === 'lollipop' ? null : series ? row[series] : null,
      ]),
    );
    if (new Set(identities).size !== identities.length)
      throw new Error(
        'Several observations share a category and series. Use Data to filter or summarize, or choose Table to show every row.',
      );
  }
}
