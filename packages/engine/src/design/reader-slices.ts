import type {
  ChartLayout,
  ChartSpec,
  DataRow,
  DesignDiagnostic,
  LayerSpec,
  ReaderComparisonOperand,
  ReaderComparisonResult,
  ReaderDomainValue,
  ReaderPanelScope,
  ReaderSlice,
  ReaderSliceIndexOptions,
  ReaderSliceMember,
  ReaderSliceSelection,
  Rect,
} from '@opendata-ai/openchart-core';
import { prepareChartSpec } from '../compile/prepare';
import { finiteNumber } from '../data/finite-number';
import { resolveFieldFormatter } from '../format/field-format';
import { compareObservations, observationKey, resolveObservationIdentities } from './identity';

export interface ReaderPanelIndex {
  scope: ReaderPanelScope;
  area: Rect;
  slices: ReaderSlice[];
  positions: number[];
}
export interface ReaderSliceIndex {
  supported: boolean;
  panels: ReaderPanelIndex[];
  diagnostics: DesignDiagnostic[];
  revision: string;
  /** Source identity inventory keeps filtered rows distinct from deletions. */
  sourceObservationKeys: ReadonlySet<string>;
  sourceObservationData: ReadonlyMap<string, DataRow>;
  byKey: ReadonlyMap<string, ReaderSlice>;
  bindingKey: string;
}
export function readerDomainValue(value: unknown): ReaderDomainValue | null {
  if (value instanceof Date)
    return Number.isFinite(value.getTime()) ? { kind: 'date', value: value.toISOString() } : null;
  if (typeof value === 'number') return Number.isFinite(value) ? { kind: 'number', value } : null;
  if (typeof value === 'string') return { kind: 'string', value };
  if (typeof value === 'boolean') return { kind: 'boolean', value };
  return null;
}
function stable(value: unknown): string {
  if (value instanceof Date) return JSON.stringify({ date: value.toISOString() });
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'undefined';
}
export function compareReaderValues(
  before: ReaderComparisonOperand,
  after: ReaderComparisonOperand,
  options: { allowNegativeRelative?: boolean } = {},
): ReaderComparisonResult {
  const unavailable = (
    reason: Extract<ReaderComparisonResult, { status: 'unavailable' }>['reason'],
    message: string,
  ): ReaderComparisonResult => ({ status: 'unavailable', reason, message });
  if (!Number.isFinite(before.value) || !Number.isFinite(after.value))
    return unavailable('nonfinite', 'A comparison needs two finite observed values.');
  if (stable(before.binding) !== stable(after.binding))
    return unavailable(
      'incompatible-binding',
      'Dataset, transformation, grouping and panel scope must match for a delta.',
    );
  const a = before.metadata,
    b = after.metadata;
  if (
    !a?.measure ||
    !b?.measure ||
    a.unit === undefined ||
    b.unit === undefined ||
    a.representation === undefined ||
    b.representation === undefined
  )
    return unavailable(
      'missing-metadata',
      'Declare the measure, unit and representation to compare these values.',
    );
  const compared = compareObservations(before.value, after.value, a, b);
  if (!compared)
    return unavailable(
      'incompatible-metadata',
      'The measure, unit and representation must match for a delta.',
    );
  const relativeUnavailable =
    before.value === 0
      ? 'zero-baseline'
      : before.value < 0 && !options.allowNegativeRelative
        ? 'negative-baseline'
        : undefined;
  return {
    status: 'comparable',
    absolute: compared.absolute,
    unit: compared.unit ?? a.unit,
    ...(relativeUnavailable ? { relativeUnavailable } : { relative: compared.relative }),
  };
}
export function buildReaderSliceIndex(
  source: ChartSpec | LayerSpec,
  layout: ChartLayout,
  options: ReaderSliceIndexOptions,
): ReaderSliceIndex {
  const diagnostics: DesignDiagnostic[] = [];
  const report = (code: string, message: string, path = '/encoding') =>
    diagnostics.push({
      code,
      message,
      path,
      severity: 'warning',
      status: 'uncheckable',
      viewport: { width: layout.dimensions.width, height: layout.dimensions.height },
      origin: 'author',
    });
  const empty: ReaderSliceIndex = {
    supported: false,
    panels: [],
    diagnostics,
    revision: options.revision,
    sourceObservationKeys: new Set(),
    sourceObservationData: new Map(),
    byKey: new Map(),
    bindingKey: '',
  };
  if ('layer' in source) {
    report(
      'READER_LAYER_BINDING',
      'Slice inspection needs an explicit single-dataset binding; layered charts retain normal tooltips.',
      '/layer',
    );
    return empty;
  }
  const prepared = prepareChartSpec(source, {
    width: layout.dimensions.width,
    height: layout.dimensions.height,
    onWarn: () => {},
  });
  const spec = prepared.chartSpec,
    encoding = spec.encoding;
  if (!['line', 'area'].includes(spec.markType) || !encoding.x || !encoding.y) {
    report(
      'READER_SLICE_UNSUPPORTED',
      'Slice inspection requires a line or area chart with x and y fields.',
    );
    return empty;
  }
  const xField = encoding.x.field,
    valueField = encoding.y.field;
  const color = encoding.color;
  const seriesField =
    color && 'field' in color && color.type !== 'quantitative'
      ? color.field
      : encoding.strokeDash && 'field' in encoding.strokeDash
        ? encoding.strokeDash.field
        : undefined;
  const keyField = options.binding?.entityField ?? encoding.key?.field;
  const transforms = Array.isArray(prepared.rawSpec.transform)
    ? (prepared.rawSpec.transform as Array<Record<string, unknown>>)
    : [];
  const facetField = layout.facet?.facetField;
  const grouping = [
    ...(seriesField ? [seriesField] : []),
    ...(facetField ? [facetField] : []),
    ...transforms.flatMap((t) => (Array.isArray(t.groupby) ? (t.groupby as string[]) : [])),
  ].filter((field, i, list) => list.indexOf(field) === i);
  const binding = {
    dataset: options.binding?.dataset ?? 'reader:local',
    transform:
      options.binding?.transform ??
      stable({
        transforms: transforms.filter((t) => !('filter' in t)),
        identityField: keyField,
        kind: options.binding?.kind ?? 'row',
      }),
    grouping,
    xField,
    valueField,
  };
  const bindingKey = stable(binding);
  const data = spec.data,
    identities = resolveObservationIdentities(data, keyField, seriesField);
  const rawData = Array.isArray(source.data) ? source.data : [];
  const rawIdentities = resolveObservationIdentities(rawData, keyField, seriesField);
  const sourceObservationData = new Map(
    rawIdentities.flatMap((identity, i) =>
      identity.persistent ? [[identity.observation, rawData[i]] as const] : [],
    ),
  );
  const sourceObservationKeys = new Set(
    rawIdentities.filter((id) => id.persistent).map((id) => id.observation),
  );
  for (const id of identities) if (id.persistent) sourceObservationKeys.add(id.observation);
  // Filtering must not turn an ambiguous source key into a persistent identity.
  if (keyField) {
    const counts = new Map<string, number>();
    for (const row of rawData) {
      const key = observationKey(row[keyField]);
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (let i = 0; i < identities.length; i++) {
      const key = observationKey(data[i][keyField]);
      if (key && (counts.get(key) ?? 0) > 1) {
        identities[i] = { ...identities[i], persistent: false, observation: `revision-row:${i}` };
        sourceObservationKeys.delete(key);
      }
    }
  }
  const metadata = source.fields?.[valueField];
  const valueFormatter = resolveFieldFormatter({
    surfaceFormat: encoding.y.format || (encoding.y.axis ? encoding.y.axis.format : undefined),
    values: data.map((row) => row[valueField]),
  });
  const series = new Map<
    string,
    { key: string; label: string; color?: string; valueField: string; metadata?: typeof metadata }
  >();
  for (const row of data) {
    const key = seriesField ? observationKey(row[seriesField]) : '__default__';
    if (key && !series.has(key))
      series.set(key, {
        key,
        label: seriesField ? String(row[seriesField]) : (encoding.y.title ?? valueField),
        valueField,
        metadata,
      });
  }
  const panels = layout.facet?.panels ?? [{ key: 'root', area: layout.area, marks: layout.marks }];
  const byKey = new Map<string, ReaderSlice>();
  const panelIndexes: ReaderPanelIndex[] = [];
  for (const panel of panels) {
    const panelRows = data.flatMap((row, index) =>
      !facetField || String(row[facetField]) === panel.key ? [{ row, index }] : [],
    );
    const facetValues = new Map<string, ReaderDomainValue>();
    if (facetField)
      for (const { row } of panelRows) {
        const v = readerDomainValue(row[facetField]);
        if (v) facetValues.set(stable(v), v);
      }
    const values = [...facetValues.values()].sort((a, b) => stable(a).localeCompare(stable(b)));
    const scope: ReaderPanelScope = {
      id: facetField
        ? `facet:${stable({ field: facetField, renderedKey: panel.key, values })}`
        : 'root',
      ...(facetField ? { facet: { field: facetField, values } } : {}),
    };
    if (values.length > 1)
      report(
        'READER_FACET_TYPED_COLLISION',
        'This rendered facet combines multiple typed values; slice identity retains their complete typed set.',
        '/encoding/facet',
      );
    const pixels = new Map<string, number>(),
      visible = new Set<string>(),
      labels = new Map<string, string>();
    for (const mark of panel.marks) {
      if (mark.type !== 'line' && mark.type !== 'area') continue;
      const markSeries = seriesField ? mark.seriesKey : undefined;
      if (markSeries !== undefined)
        for (const s of series.values())
          if (s.label === markSeries)
            s.color =
              mark.type === 'line'
                ? mark.stroke
                : typeof mark.fill === 'string'
                  ? mark.fill
                  : undefined;
      for (const point of mark.dataPoints ?? []) {
        if ('observed' in point && point.observed === false) continue;
        const domain = readerDomainValue(point.datum[xField]);
        if (!domain || !Number.isFinite(point.x)) continue;
        pixels.set(stable(domain), point.x);
        visible.add(stable(point.datum));
        if (point.tooltip?.title) labels.set(stable(domain), point.tooltip.title);
      }
    }
    const groups = new Map<
      string,
      { x: ReaderDomainValue; rows: Array<{ row: DataRow; index: number }> }
    >();
    for (const item of panelRows) {
      const x = readerDomainValue(item.row[xField]);
      if (!x) continue;
      const key = stable(x),
        group = groups.get(key);
      if (group) group.rows.push(item);
      else groups.set(key, { x, rows: [item] });
    }
    const positioned: Array<{ slice: ReaderSlice; pixel: number }> = [];
    for (const [domainKey, group] of groups) {
      const members: ReaderSliceMember[] = [...series.values()].map((s) => {
        const matching = group.rows.filter(
          ({ row }) => (seriesField ? observationKey(row[seriesField]) : '__default__') === s.key,
        );
        const observations = matching.map(({ row, index }) => ({
          ...identities[index],
          datum: row,
          state: visible.has(stable(row)) ? ('visible' as const) : ('filtered' as const),
          ...(transforms.some((t) => 'aggregate' in t || 'bin' in t || 'density' in t)
            ? { kind: 'aggregate' as const }
            : {}),
        }));
        const member: ReaderSliceMember = {
          series: s,
          status:
            matching.length === 0
              ? 'no-observation'
              : matching.length > 1
                ? 'ambiguous'
                : 'observed',
          observations,
        };
        if (matching.length === 1) {
          const raw = matching[0].row[valueField],
            value = finiteNumber(raw);
          member.valueStatus =
            raw === null || raw === undefined
              ? 'missing'
              : value === undefined
                ? 'invalid'
                : 'finite';
          if (value !== undefined) member.value = value;
          member.formattedValue = value === undefined ? 'No observation' : valueFormatter(value);
        }
        return member;
      });
      if (members.some((m) => m.status === 'ambiguous'))
        report(
          'READER_AMBIGUOUS_SLICE',
          'More than one observation shares this series and typed x value; no aggregate or delta is invented.',
        );
      const observed = members.flatMap((m) => m.observations);
      const slice: ReaderSlice = {
        kind: 'slice',
        key: stable({ binding, panel: scope, x: group.x }),
        binding,
        panel: scope,
        x: group.x,
        xLabel: labels.get(domainKey) ?? String(group.x.value),
        revision: options.revision,
        members,
        persistent:
          observed.length > 0 &&
          observed.every((o) => o.persistent) &&
          members.every((m) => m.status !== 'ambiguous'),
        state: observed.some((o) => o.state === 'visible') ? 'visible' : 'filtered',
      };
      byKey.set(slice.key, slice);
      const pixel = pixels.get(domainKey);
      if (pixel !== undefined) positioned.push({ slice, pixel });
    }
    positioned.sort((a, b) => a.pixel - b.pixel || a.slice.key.localeCompare(b.slice.key));
    panelIndexes.push({
      scope,
      area: panel.area,
      slices: positioned.map((p) => p.slice),
      positions: positioned.map((p) => p.pixel),
    });
  }
  return {
    supported: true,
    panels: panelIndexes,
    diagnostics,
    revision: options.revision,
    sourceObservationKeys,
    sourceObservationData,
    byKey,
    bindingKey,
  };
}
export function nearestReaderSlice(
  index: ReaderSliceIndex,
  pixelX: number,
  panelId = 'root',
): ReaderSlice | null {
  const panel = index.panels.find((p) => p.scope.id === panelId);
  if (!panel || !panel.positions.length || !Number.isFinite(pixelX)) return null;
  let low = 0,
    high = panel.positions.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (panel.positions[mid] < pixelX) low = mid + 1;
    else high = mid;
  }
  if (
    low > 0 &&
    Math.abs(panel.positions[low - 1] - pixelX) <= Math.abs(panel.positions[low] - pixelX)
  )
    low--;
  return panel.slices[low] ?? null;
}
export function readerSliceByKey(index: ReaderSliceIndex, key: string): ReaderSlice | null {
  return index.byKey.get(key) ?? null;
}
export function reconcileReaderSlices(
  selection: ReaderSliceSelection,
  next: ReaderSliceIndex,
  options: { dataReplaced: boolean; visibleObservationKeys?: ReadonlySet<string> },
): ReaderSliceSelection {
  let cleared = false;
  const pinned = selection.pinned.flatMap((previous) => {
    if (!next.supported || (options.dataReplaced && !previous.persistent)) {
      cleared = true;
      return [];
    }
    let current = next.byKey.get(previous.key);
    if (!current) {
      const keys = previous.members.flatMap((m) => m.observations.map((o) => o.observation));
      if (
        stable(previous.binding) === next.bindingKey &&
        previous.persistent &&
        keys.every((key) => next.sourceObservationKeys.has(key))
      )
        current = {
          ...previous,
          revision: next.revision,
          state: 'filtered',
          members: previous.members.map((m) => ({
            ...m,
            status: 'no-observation',
            value: undefined,
            formattedValue: undefined,
            valueStatus: 'missing',
            observations: m.observations.map((o) => ({
              ...o,
              datum: next.sourceObservationData.get(o.observation) ?? {},
              state: 'filtered',
            })),
          })),
        };
      else {
        cleared = true;
        return [];
      }
    }
    if (options.dataReplaced && !current.persistent) {
      cleared = true;
      return [];
    }
    if (options.visibleObservationKeys) {
      const members = current.members.map((m) => ({
        ...m,
        observations: m.observations.map((o) => ({
          ...o,
          state: options.visibleObservationKeys!.has(o.observation)
            ? ('visible' as const)
            : ('filtered' as const),
        })),
      }));
      current = {
        ...current,
        members,
        state: members.some((m) => m.observations.some((o) => o.state === 'visible'))
          ? 'visible'
          : 'filtered',
      };
    }
    return [current];
  });
  return {
    kind: 'slices',
    preview: null,
    pinned,
    announcement: cleared
      ? 'Selection cleared: an observation or compatible binding was removed.'
      : '',
  };
}
