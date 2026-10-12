import type {
  AggregateOp,
  DataRow,
  FieldMetadata,
  TableSpec,
  Transform,
  VizSpec,
} from '@opendata-ai/openchart-core';
import { runTransforms, validateSpec } from '@opendata-ai/openchart-engine';
import { assertCompositionObservations } from './composition';
import { checkImportSize, fieldType, MAX_IMPORT_ROWS } from './document';
import { isSupported, type SupportedSpec } from './Preview';

export interface Preparation {
  filter?: { field: string; value: string };
  summary?: {
    groupby: string[];
    field: string;
    op: Extract<AggregateOp, 'sum' | 'mean' | 'min' | 'max' | 'count'>;
  };
}
/** App-owned envelope. The visualization itself is always an ordinary VizSpec. */
export interface StudioProject {
  format: 'openchart-studio';
  version: 1;
  spec: SupportedSpec;
  source: DataRow[];
  sourceKey?: string;
  sourceColumns?: TableSpec['columns'];
  sourceFields?: Record<string, FieldMetadata>;
  preparation: Preparation;
}
export function newProject(spec: VizSpec): StudioProject {
  if (!isSupported(spec)) throw new Error('Choose a chart, map, or table.');
  return {
    format: 'openchart-studio',
    version: 1,
    spec,
    source: spec.data,
    sourceKey:
      'type' in spec ? (spec.type === 'table' ? spec.rowKey : undefined) : spec.encoding.key?.field,
    sourceFields: spec.fields,
    sourceColumns: 'type' in spec && spec.type === 'table' ? spec.columns : undefined,
    preparation: {},
  };
}
function groupIdentityField(source: DataRow[]): string {
  const fields = new Set(source.flatMap(Object.keys));
  let key = '_studioGroup';
  while (fields.has(key)) key = `_${key}`;
  return key;
}
export const MAX_PROJECT_BYTES = 20_000_000;
export function serializeProject(project: StudioProject): string {
  const text = JSON.stringify(project);
  if (new Blob([text]).size > MAX_PROJECT_BYTES)
    throw new Error('This project exceeds 20 MB. Reduce the source data before saving.');
  return text;
}
function summaryField(source: DataRow[], summary: NonNullable<Preparation['summary']>): string {
  if (summary.op !== 'count') return summary.field;
  const names = new Set(source.flatMap(Object.keys));
  let field = 'Row count';
  while (names.has(field)) field = `_${field}`;
  return field;
}
export function prepareRows(source: DataRow[], preparation: Preparation): DataRow[] {
  const filtered = preparation.filter
    ? source.filter(
        (row) => String(row[preparation.filter!.field] ?? '') === preparation.filter!.value,
      )
    : source;
  if (!preparation.summary) return filtered;
  const { groupby, field, op } = preparation.summary;
  const transform: Transform = {
    aggregate: [{ field, op, as: summaryField(source, preparation.summary) }],
    groupby,
  };
  const identityField = groupIdentityField(source);
  return runTransforms(filtered, [transform]).map((row) => ({
    ...row,
    [identityField]: JSON.stringify([
      transform,
      groupby.map((key) => [typeof row[key], row[key] ?? null]),
    ]),
  }));
}
export function prepareProject(project: StudioProject, preparation: Preparation): StudioProject {
  const sourceNames = new Set(project.source.flatMap(Object.keys));
  if (preparation.filter && !sourceNames.has(preparation.filter.field))
    throw new Error('The filter field is missing from the source.');
  if (preparation.summary) {
    const { groupby, field, op } = preparation.summary;
    if (
      !groupby.length ||
      new Set(groupby).size !== groupby.length ||
      groupby.includes(field) ||
      (op !== 'count' && !sourceNames.has(field)) ||
      groupby.some((key) => !sourceNames.has(key))
    )
      throw new Error('Choose distinct, available grouping fields and a separate summary field.');
  }
  const groupKey = groupIdentityField(project.source);
  const outputField = preparation.summary ? summaryField(project.source, preparation.summary) : '';
  const data = prepareRows(project.source, preparation);
  let fields = preparation.summary
    ? (Object.fromEntries([
        ...preparation.summary.groupby.map((key) => [key, project.sourceFields?.[key] ?? {}]),
        [
          outputField,
          {
            ...(preparation.summary.op === 'count'
              ? {}
              : project.sourceFields?.[preparation.summary.field]),
            type: 'number',
            ...(preparation.summary.op === 'count' ? { unit: 'rows', measure: 'row-count' } : {}),
          },
        ],
        [groupKey, { type: 'text', role: 'identity' }],
      ]) as Record<string, FieldMetadata>)
    : project.sourceFields;
  const sameSummary =
    preparation.summary &&
    JSON.stringify(preparation.summary) === JSON.stringify(project.preparation.summary);
  // Values recompute, but deliberate metadata/identity edits keep their meaning
  // until the author changes the aggregation itself.
  if (sameSummary) fields = project.spec.fields;
  let spec = { ...project.spec, data, fields } as SupportedSpec;
  const identity = sameSummary
    ? 'type' in project.spec
      ? project.spec.type === 'table'
        ? project.spec.rowKey
        : undefined
      : project.spec.encoding.key?.field
    : preparation.summary
      ? groupKey
      : project.sourceKey;
  if (!('type' in spec)) {
    const encoding = { ...spec.encoding };
    if (identity) encoding.key = { field: identity, type: 'nominal' };
    else delete encoding.key;
    spec = { ...spec, encoding } as SupportedSpec;
  } else if (spec.type === 'table') {
    const available = new Set(
      preparation.summary
        ? [...preparation.summary.groupby, outputField]
        : project.source.flatMap(Object.keys),
    );
    spec = {
      ...spec,
      rowKey: identity,
      columns: (project.sourceColumns ?? spec.columns).filter((col) => available.has(col.key)),
    };
    if (preparation.summary && !spec.columns.some((column) => column.key === outputField))
      spec.columns.push({ key: outputField, label: outputField, sortable: true });
  }
  if (!('type' in spec) || spec.type === 'map') {
    const available = new Set(
      preparation.summary
        ? [...preparation.summary.groupby, outputField, groupKey]
        : project.source.flatMap(Object.keys),
    );
    const referenced: string[] = [];
    const visit = (value: unknown) => {
      if (!value || typeof value !== 'object') return;
      if ('field' in value && typeof value.field === 'string') referenced.push(value.field);
      for (const child of Object.values(value)) visit(child);
    };
    visit(spec.encoding);
    const missing = [...new Set(referenced.filter((field) => !available.has(field)))];
    // Authored transform outputs need not exist in source rows, but applying a
    // second grouping operation ahead of that pipeline would change its meaning.
    if (preparation.summary && !('type' in spec) && spec.transform?.length)
      throw new Error(
        'This chart already has an authored transform pipeline. Start from its source table to create a new summary.',
      );
    if (missing.length && (!('transform' in spec) || !spec.transform?.length))
      throw new Error(
        `Preparation removes fields used by this visualization: ${missing.join(', ')}. Include them in Group by, or change to a table first.`,
      );
  }
  if (
    !('type' in spec) &&
    !spec.transform?.length &&
    !preparation.summary &&
    (project.preparation.summary || project.preparation.filter)
  ) {
    assertCompositionObservations(
      typeof spec.mark === 'string' ? spec.mark : spec.mark.type,
      spec.encoding,
      spec.data,
    );
  }
  return { ...project, preparation, spec };
}
/** Recover legacy plain specs as well as versioned projects; reject untrusted envelopes. */
export function parseProject(text: string): StudioProject {
  if (new Blob([text]).size > MAX_PROJECT_BYTES)
    throw new Error('Choose a Studio project smaller than 20 MB.');
  const value = JSON.parse(text);
  const envelope = value?.format === 'openchart-studio';
  if (!envelope) checkImportSize(text);
  if (envelope && value.version !== 1)
    throw new Error('This Studio project version is not supported.');
  const result = validateSpec(envelope ? value.spec : value);
  if (!result.valid || !result.normalized || !isSupported(result.normalized))
    throw new Error(
      result.errors.map((error) => error.message).join('\n') ||
        'Choose a valid chart, map, or table document.',
    );
  if (result.normalized.data.length > MAX_IMPORT_ROWS)
    throw new Error('This workbench accepts up to 20,000 rows.');
  if (!envelope) return newProject(result.normalized);
  if (
    !Array.isArray(value.source) ||
    value.source.length > MAX_IMPORT_ROWS ||
    value.source.some((row: unknown) => !row || typeof row !== 'object' || Array.isArray(row))
  )
    throw new Error('The project source data is invalid.');
  if (value.sourceKey !== undefined && typeof value.sourceKey !== 'string')
    throw new Error('The source identity field is invalid.');
  const p = value.preparation;
  if (!p || typeof p !== 'object' || Array.isArray(p))
    throw new Error('The project preparation is invalid.');
  if (p.filter && (typeof p.filter.field !== 'string' || typeof p.filter.value !== 'string'))
    throw new Error('The saved filter is invalid.');
  if (
    p.summary &&
    (!Array.isArray(p.summary.groupby) ||
      !p.summary.groupby.length ||
      p.summary.groupby.some((field: unknown) => typeof field !== 'string') ||
      typeof p.summary.field !== 'string' ||
      !['sum', 'mean', 'min', 'max', 'count'].includes(p.summary.op))
  )
    throw new Error('The saved summary is invalid.');
  // Validate metadata through the library's public validator too.
  const sourceSpec = validateSpec({
    type: 'table',
    data: value.source,
    fields: value.sourceFields,
    columns: value.sourceColumns ?? [],
  });
  if (!sourceSpec.valid) throw new Error('The project field metadata is invalid.');
  const project: StudioProject = {
    ...newProject(result.normalized),
    source: value.source,
    sourceFields: value.sourceFields,
    sourceKey: value.sourceKey,
    sourceColumns: value.sourceColumns,
  };
  const prepared = prepareProject(project, p);
  const spec = { ...result.normalized, data: prepared.spec.data } as SupportedSpec;
  const checked = validateSpec(spec);
  if (!checked.valid) throw new Error(checked.errors.map((error) => error.message).join('\n'));
  return { ...prepared, spec };
}
/** Changing appearance never discards the source or preparation recipe. */
export function updateSpec(project: StudioProject, spec: VizSpec): StudioProject {
  if (!isSupported(spec)) throw new Error('Choose a chart, map, or table.');
  const available = new Set(project.spec.data.flatMap(Object.keys));
  const sourceColumns =
    'type' in spec && spec.type === 'table'
      ? [
          ...spec.columns,
          ...(project.preparation.summary ? (project.sourceColumns ?? []) : []).filter(
            (column) =>
              !available.has(column.key) && !spec.columns.some((next) => next.key === column.key),
          ),
        ]
      : project.sourceColumns;
  const sourceFields = project.preparation.summary ? project.sourceFields : spec.fields;
  const sourceKey = project.preparation.summary
    ? project.sourceKey
    : 'type' in spec
      ? spec.type === 'table'
        ? spec.rowKey
        : project.sourceKey
      : spec.encoding.key?.field;
  return { ...project, spec, sourceColumns, sourceFields, sourceKey };
}

/** Replace source values while retaining the document and explicit preparation. */
export function replaceSource(
  project: StudioProject,
  imported: import('./document').ImportedData,
  mapping: Record<string, string>,
): StudioProject {
  const expected = [...new Set(project.source.flatMap(Object.keys))].filter(
    (key) => project.sourceFields?.[key]?.role !== 'identity',
  );
  const resolved = expected.map((field) => [
    field,
    mapping[field] ?? (field in imported.fields ? field : ''),
  ]);
  const missing = resolved.filter(([, from]) => !from || !(from in imported.fields));
  if (missing.length)
    throw new Error(`Map the replacement fields: ${missing.map(([field]) => field).join(', ')}.`);
  if (new Set(resolved.map(([, from]) => from)).size !== resolved.length)
    throw new Error('Map each existing field to a different replacement column.');
  const key =
    project.sourceKey ??
    Object.keys(project.sourceFields ?? {}).find(
      (field) => project.sourceFields?.[field]?.role === 'identity',
    ) ??
    imported.key;
  const source = imported.rows.map((row) =>
    Object.fromEntries([
      [key, row[imported.key]],
      ...resolved.map(([to, from]) => [to, row[from]]),
    ]),
  );
  const sourceFields: Record<string, FieldMetadata> = Object.fromEntries([
    [key, { type: 'text', role: 'identity' }],
    ...resolved.map(([to, from]) => [
      to,
      { ...project.sourceFields?.[to], type: imported.fields[from] },
    ]),
  ]);
  const next = prepareProject(
    { ...project, source, sourceFields, sourceKey: key },
    project.preparation,
  );
  if (!('type' in next.spec)) {
    const observations = next.spec.transform
      ? runTransforms(next.spec.data, next.spec.transform)
      : next.spec.data;
    for (const axis of ['x', 'y'] as const) {
      const channel = next.spec.encoding[axis];
      if (
        channel?.type === 'quantitative' &&
        (sourceFields[channel.field]?.type ??
          fieldType(observations, channel.field, next.spec.fields)) !== 'number'
      )
        throw new Error(
          `The ${channel.field} axis needs numeric data. Correct the replacement column before importing.`,
        );
    }
  }
  return next;
}
