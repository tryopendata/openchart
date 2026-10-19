/** Destination-layout map observations; no renderer or DOM joins. */
import type {
  DataRow,
  DesignDiagnostic,
  EncodingChannel,
  FieldMetadata,
  GeoMapLayout,
  GeoMapSpec,
  GeoReaderObservation,
} from '@opendata-ai/openchart-core';
import { buildD3Formatter } from '@opendata-ai/openchart-core';
import { finiteNumber } from '../data/finite-number';
import { resolveFieldFormatter } from '../format/field-format';
import { joinDataToFeatures } from './join';
import { decodeGeoViewSource } from './view-geometry';
export interface GeoReaderRecord {
  observation: GeoReaderObservation;
  name: string;
  valueLabel: string;
  valueStatus: 'value' | 'missing' | 'ambiguous';
  unit?: string;
  identityStatus: 'persistent' | 'ephemeral' | 'ambiguous';
  primary?: {
    channel: 'color' | 'size';
    field: string;
    value: number | undefined;
    metadata?: FieldMetadata;
  };
  color?: { field: string; value: unknown };
  fields: Array<{ label: string; value: string }>;
  point?: { cx: number; cy: number; r: number };
  viewIds?: string[];
}
export interface GeoReaderIndex {
  records: GeoReaderRecord[];
  byObservation: Map<string, GeoReaderRecord>;
  diagnostics: DesignDiagnostic[];
}
export function buildGeoReaderIndex(spec: GeoMapSpec, layout: GeoMapLayout): GeoReaderIndex {
  const records: GeoReaderRecord[] = [];
  const diagnostics: DesignDiagnostic[] = [];
  const formatters = new Map<string, ReturnType<typeof resolveFieldFormatter>>();
  const reported = new Set<string>();
  const formatter = (kind: 'feature' | 'point', channel: EncodingChannel) => {
    const key = `${kind}:${channel.field}:${channel.format ?? ''}`;
    let format = formatters.get(key);
    if (!format) {
      format = resolveFieldFormatter({
        channelFormat: channel.format,
        values: (kind === 'feature' ? spec.data : (spec.points?.data ?? [])).map(
          (row) => row[channel.field],
        ),
      });
      formatters.set(key, format);
    }
    return format;
  };
  const validId = (value: unknown) =>
    (typeof value === 'string' && value.trim() !== '') ||
    (typeof value === 'number' && Number.isFinite(value));
  const featureCounts = new Map<string, number>();
  const pointCounts = new Map<string, number>();
  const views = layout.views ?? [
    { viewId: 'root', features: layout.features, pointMarks: layout.pointMarks },
  ];
  for (const view of views) {
    const local = new Map<string, number>();
    for (const mark of view.features)
      local.set(String(mark.id), (local.get(String(mark.id)) ?? 0) + 1);
    for (const [id, count] of local)
      featureCounts.set(id, Math.max(count, featureCounts.get(id) ?? 0));
  }
  // A representation copy shares source identity across views. Repeated
  // observations inside any one view still need separate inspection records.
  const mergeRepresentations = <T, K>(lists: T[][], identity: (mark: T) => K): T[] => {
    const retained = new Map<K, number>();
    const merged: T[] = [];
    for (const list of lists) {
      const occurrences = new Map<K, number>();
      for (const mark of list) {
        const key = identity(mark),
          occurrence = occurrences.get(key) ?? 0;
        occurrences.set(key, occurrence + 1);
        if (occurrence < (retained.get(key) ?? 0)) continue;
        merged.push(mark);
        retained.set(key, occurrence + 1);
      }
    }
    return merged;
  };
  const features: Array<{ id: unknown; data: DataRow | null; name?: string }> = layout.views
    ? mergeRepresentations(
        views.map((view) => view.features),
        (mark) => String(mark.id),
      )
    : [...layout.features];
  // Projection clipping affects representation, never the source-place inventory.
  const sourceFeatures = decodeGeoViewSource(spec.geo.features, spec.geo.objectKey).collection
    .features;
  const sourceCounts = new Map<string, number>();
  for (const feature of sourceFeatures) {
    if (validId(feature.id))
      sourceCounts.set(String(feature.id), (sourceCounts.get(String(feature.id)) ?? 0) + 1);
  }
  for (const [id, count] of sourceCounts)
    featureCounts.set(id, Math.max(count, featureCounts.get(id) ?? 0));
  const sourceJoined = spec.encoding.key
    ? joinDataToFeatures(
        sourceFeatures.map((feature) => ({
          id: feature.id as string | number,
          properties: feature.properties ?? {},
        })),
        spec.data,
        spec.encoding.key.field,
        spec.geo.idField ?? 'id',
      ).joined
    : new Map<string | number, DataRow>();
  const represented = new Set(features.map((feature) => String(feature.id)));
  const unavailableFeatures = new Set<number>();
  for (const feature of sourceFeatures) {
    if (represented.has(String(feature.id))) continue;
    unavailableFeatures.add(features.length);
    features.push({
      id: feature.id,
      data: sourceJoined.get(feature.id as string | number) ?? null,
      name: String(feature.properties?.name ?? feature.properties?.NAME ?? feature.id),
    });
  }
  const points = layout.views
    ? mergeRepresentations(
        views.map((view) => view.pointMarks),
        (mark) => mark.data,
      )
    : layout.pointMarks;
  if (spec.points?.key)
    for (const row of spec.points.data) {
      const key = row[spec.points.key.field];
      if (validId(key)) pointCounts.set(String(key), (pointCounts.get(String(key)) ?? 0) + 1);
    }
  const add = (
    kind: 'feature' | 'point',
    rawId: unknown,
    datum: DataRow | null,
    name: string,
    index: number,
  ) => {
    const counts = kind === 'feature' ? featureCounts : pointCounts;
    const authoredKey = kind === 'feature' || !!spec.points?.key;
    const ambiguous = validId(rawId) && (counts.get(String(rawId)) ?? 0) > 1;
    const persistent = authoredKey && validId(rawId) && !ambiguous;
    const canonicalId = persistent ? String(rawId) : `revision:${index}`;
    const observation = `${kind}:${canonicalId}`;
    const channel =
      kind === 'feature' ? spec.encoding.color : (spec.points?.size ?? spec.points?.color);
    const channelName = kind === 'point' && spec.points?.size ? 'size' : 'color';
    const color = kind === 'feature' ? spec.encoding.color : spec.points?.color;
    const metadata = channel ? spec.fields?.[channel.field] : undefined;
    const value = channel ? finiteNumber(datum?.[channel.field]) : undefined;
    let valueLabel = 'No data';
    if (channel && datum && datum[channel.field] != null) {
      valueLabel =
        channel.type === 'quantitative'
          ? value === undefined
            ? 'No data'
            : formatter(kind, channel)(value)
          : String(datum[channel.field]);
    }
    const tooltip = kind === 'feature' ? spec.encoding.tooltip : spec.points?.tooltip;
    const fields = (tooltip ? (Array.isArray(tooltip) ? tooltip : [tooltip]) : []).map(
      (field: EncodingChannel) => {
        const raw = datum?.[field.field];
        const numeric = finiteNumber(raw);
        const format = field.format ? buildD3Formatter(field.format) : undefined;
        return {
          label: field.title ?? spec.fields?.[field.field]?.label ?? field.field,
          value:
            raw == null
              ? 'No data'
              : field.type === 'quantitative'
                ? numeric === undefined
                  ? 'No data'
                  : format
                    ? format(numeric)
                    : String(numeric)
                : String(raw),
        };
      },
    );
    records.push({
      observation: {
        entity: {
          kind,
          id: validId(rawId) ? (rawId as string | number) : canonicalId,
          canonicalId,
        },
        observation,
        persistent,
        datum,
        state: 'visible',
      },
      name,
      valueLabel,
      valueStatus: ambiguous
        ? 'ambiguous'
        : !channel ||
            !datum ||
            datum[channel.field] == null ||
            (channel.type === 'quantitative' && value === undefined)
          ? 'missing'
          : 'value',
      unit: metadata?.unit,
      identityStatus: ambiguous ? 'ambiguous' : persistent ? 'persistent' : 'ephemeral',
      ...(channel?.type === 'quantitative'
        ? { primary: { channel: channelName, field: channel.field, value, metadata } }
        : {}),
      ...(color ? { color: { field: color.field, value: datum?.[color.field] } } : {}),
      fields,
    });
    if (ambiguous && !reported.has(kind)) {
      reported.add(kind);
      diagnostics.push({
        code: 'MAP_READER_AMBIGUOUS_ID',
        severity: 'warning',
        status: 'uncheckable',
        origin: 'author',
        path: kind === 'feature' ? '/geo/features' : '/points/key',
        viewport: { width: layout.width, height: layout.height },
        message:
          'Duplicate map identities can be inspected, but cannot be pinned or compared. Supply unique keys.',
      });
    }
  };
  features.forEach((mark, index) => {
    add('feature', mark.id, mark.data, mark.name ?? String(mark.id), index);
    if (unavailableFeatures.has(index)) records[records.length - 1].viewIds = [];
  });
  points.forEach((mark, index) => {
    const sourceIndex =
      !spec.points?.key && Number.isInteger(Number(mark.key)) ? Number(mark.key) : index;
    const rawId = spec.points?.key ? mark.data[spec.points.key.field] : undefined;
    const text = spec.points?.text ? mark.data[spec.points.text.field] : undefined;
    add(
      'point',
      rawId,
      mark.data,
      text == null ? String(rawId ?? `Point ${sourceIndex + 1}`) : String(text),
      sourceIndex < 0 ? index : sourceIndex,
    );
    records[records.length - 1].point = { cx: mark.cx, cy: mark.cy, r: mark.r };
  });
  if (layout.views)
    for (const record of records) {
      record.viewIds = views
        .filter((view) =>
          record.observation.entity.kind === 'feature'
            ? view.features.some((mark) => String(mark.id) === String(record.observation.entity.id))
            : view.pointMarks.some((mark) =>
                spec.points?.key
                  ? String(mark.data[spec.points.key.field]) ===
                    String(record.observation.entity.id)
                  : `revision:${mark.key}` === record.observation.entity.canonicalId,
              ),
        )
        .map((view) => view.viewId);
    }
  return {
    records,
    byObservation: new Map(records.map((record) => [record.observation.observation, record])),
    diagnostics,
  };
}
export function queryGeoReaderRecords(
  index: GeoReaderIndex,
  query: string,
  rank?: 'ascending' | 'descending',
  kind?: 'feature' | 'point',
): Array<GeoReaderRecord & { rank?: number }> {
  const records = index.records.filter(
    (record) =>
      (!kind || record.observation.entity.kind === kind) &&
      record.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  if (!rank || (!kind && new Set(records.map((record) => record.observation.entity.kind)).size > 1))
    return records;
  records.sort((a, b) => {
    const av = a.primary?.value;
    const bv = b.primary?.value;
    if (av === undefined)
      return bv === undefined
        ? a.observation.observation.localeCompare(b.observation.observation)
        : 1;
    if (bv === undefined) return -1;
    return (
      (rank === 'descending' ? bv - av : av - bv) ||
      a.observation.observation.localeCompare(b.observation.observation)
    );
  });
  let position = 0;
  let prior: number | undefined;
  let priorRank = 0;
  return records.map((record) => {
    const value = record.primary?.value;
    if (value === undefined) return record;
    position++;
    if (value !== prior) {
      priorRank = position;
      prior = value;
    }
    return { ...record, rank: priorRank };
  });
}
