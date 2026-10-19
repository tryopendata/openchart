import { expect, it } from 'vitest';
import { compileChart } from '../../compile';
import {
  buildReaderSliceIndex,
  compareReaderValues,
  nearestReaderSlice,
  reconcileReaderSlices,
} from '../reader-slices';

const metadata = { measure: 'rate', unit: '%', representation: 'percent' as const };
const binding = { dataset: 'data', transform: 'raw', grouping: [], panelId: 'root' };
const line = {
  mark: 'line',
  data: [
    { id: 'a0', x: 0, y: 0, s: 'A' },
    { id: 'a1', x: 1, y: 5, s: 'A' },
    { id: 'b1', x: 1, y: 3, s: 'B' },
  ],
  encoding: {
    x: { field: 'x', type: 'ordinal' },
    y: { field: 'y', type: 'quantitative' },
    color: { field: 's', type: 'nominal' },
    key: { field: 'id' },
  },
  fields: { y: metadata },
};
const build = (source = line, revision = 'r1') =>
  buildReaderSliceIndex(
    source as never,
    compileChart(source as never, { width: 800, height: 500 }),
    { revision },
  );
it('indexes observed raw slices, sparse members and stable keys without interpolation', () => {
  const index = build();
  expect(index.supported).toBe(true);
  expect(index.panels[0].slices).toHaveLength(2);
  const first = index.panels[0].slices[0];
  expect(first.x).toEqual({ kind: 'number', value: 0 });
  expect(first.members.find((m) => m.series.label === 'B')!.status).toBe('no-observation');
  expect(first.members.find((m) => m.series.label === 'A')!.value).toBe(0);
  expect(
    nearestReaderSlice(index, index.panels[0].positions[0], index.panels[0].scope.id)?.key,
  ).toBe(first.key);
});
it('preserves duplicate(series,x) observations as ambiguous evidence', () => {
  const source = { ...line, data: [...line.data, { id: 'duplicate', x: 0, y: 9, s: 'A' }] };
  const first = build(source).panels[0].slices[0].members[0];
  expect(first.status).toBe('ambiguous');
  expect(first.observations).toHaveLength(2);
  expect(first.value).toBeUndefined();
});
it('supports facets with typed panel scope and never compares across panels', () => {
  const source = {
    ...line,
    data: line.data.flatMap((row) => [
      { ...row, id: `${row.id}a`, p: 'North' },
      { ...row, id: `${row.id}b`, p: 'South' },
    ]),
    encoding: { ...line.encoding, facet: { field: 'p', type: 'nominal' } },
  };
  const index = build(source as never);
  expect(index.panels).toHaveLength(2);
  expect(index.panels[0].scope.id).not.toBe(index.panels[1].scope.id);
  expect(index.panels.every((p) => p.scope.facet?.values.length === 1)).toBe(true);
  expect(
    compareReaderValues(
      { value: 1, metadata, binding },
      { value: 2, metadata, binding: { ...binding, panelId: 'other' } },
    ).status,
  ).toBe('unavailable');
});
it('reconciles stable keys, retains filtered pins, clears removed and ephemeral rows', () => {
  const index = build(),
    slice = index.panels[0].slices[0];
  const selection = { kind: 'slices' as const, preview: null, pinned: [slice], announcement: '' };
  const reordered = build({ ...line, data: [...line.data].reverse() }, 'r2');
  expect(reconcileReaderSlices(selection, reordered, { dataReplaced: true }).pinned[0].key).toBe(
    slice.key,
  );
  expect(
    reconcileReaderSlices(selection, reordered, {
      dataReplaced: false,
      visibleObservationKeys: new Set(),
    }).pinned[0].state,
  ).toBe('filtered');
  expect(
    reconcileReaderSlices(selection, build({ ...line, data: line.data.slice(1) }, 'r3'), {
      dataReplaced: true,
    }).pinned,
  ).toEqual([]);
  const ephemeral = build({ ...line, encoding: { ...line.encoding, key: undefined } } as never);
  expect(
    reconcileReaderSlices({ ...selection, pinned: [ephemeral.panels[0].slices[0]] }, ephemeral, {
      dataReplaced: true,
    }).pinned,
  ).toEqual([]);
});
it('requires explicit metadata and compatible semantics, while guarding relative baselines', () => {
  const compare = (a: number, b: number, meta = metadata) =>
    compareReaderValues(
      { value: a, metadata: meta, binding },
      { value: b, metadata: meta, binding },
    );
  expect(compare(10, 15)).toMatchObject({
    status: 'comparable',
    absolute: 5,
    relative: 0.5,
    unit: 'percentage points',
  });
  expect(compare(0, 2)).toMatchObject({ relativeUnavailable: 'zero-baseline' });
  expect(compare(-2, 2)).toMatchObject({ relativeUnavailable: 'negative-baseline' });
  expect(
    compareReaderValues(
      { value: -2, metadata, binding },
      { value: 2, metadata, binding },
      { allowNegativeRelative: true },
    ),
  ).toMatchObject({ relative: 2 });
  expect(compareReaderValues({ value: 1, binding }, { value: 2, binding })).toMatchObject({
    reason: 'missing-metadata',
  });
  expect(
    compareReaderValues(
      { value: 1, metadata, binding },
      { value: 2, metadata, binding: { ...binding, transform: 'mean' } },
    ),
  ).toMatchObject({ reason: 'incompatible-binding' });
});

it('never exposes synthetic stacked-area pivot rows as observed slice values', () => {
  const source = { ...line, mark: 'area', endpointLabels: true };
  const index = build(source as never);
  const first = index.panels[0].slices[0];
  expect(first.members.find((m) => m.series.label === 'B')!.status).toBe('no-observation');
  expect(first.members.find((m) => m.series.label === 'A')!.value).toBe(0);
});
it('preserves explicit formats, proportion percentage points and invalid-value provenance', () => {
  const formatted = build({
    ...line,
    encoding: { ...line.encoding, y: { ...line.encoding.y, format: '.2f' } },
  } as never);
  expect(formatted.panels[0].slices[0].members[0].formattedValue).toBe('0.00');
  const proportion = { ...metadata, unit: 'share', representation: 'proportion' as const };
  expect(
    compareReaderValues(
      { value: 0.1, metadata: proportion, binding },
      { value: 0.2, metadata: proportion, binding },
    ),
  ).toMatchObject({ absolute: 10, unit: 'percentage points' });
  const invalid = build({
    ...line,
    data: [...line.data, { id: 'b0', x: 0, y: null, s: 'B' }],
  } as never);
  const member = invalid.byKey
    .get(invalid.panels[0].slices[0].key)!
    .members.find((m) => m.series.label === 'B')!;
  expect(member.status).toBe('observed');
  expect(member.valueStatus).toBe('missing');
  expect(member.value).toBeUndefined();
});
it('retains complete typed identity when existing facets merge numeric and string values', () => {
  const source = {
    ...line,
    data: line.data.flatMap((row) => [
      { ...row, id: `${row.id}number`, p: 1 },
      { ...row, id: `${row.id}string`, p: '1' },
    ]),
    encoding: { ...line.encoding, facet: { field: 'p', type: 'nominal' } },
  };
  const index = build(source as never);
  expect(index.panels).toHaveLength(1);
  expect(index.panels[0].scope.facet!.values).toEqual(
    expect.arrayContaining([
      { kind: 'number', value: 1 },
      { kind: 'string', value: '1' },
    ]),
  );
  expect(index.diagnostics.some((d) => d.code === 'READER_FACET_TYPED_COLLISION')).toBe(true);
});
it('does not change typed date identity on resize or introduce a local-time label key', () => {
  const source = {
    ...line,
    data: line.data.map((row) => ({ ...row, x: new Date(Date.UTC(2024, 0, row.x + 1)) })),
    encoding: { ...line.encoding, x: { field: 'x', type: 'temporal' } },
  };
  const a = buildReaderSliceIndex(
      source as never,
      compileChart(source as never, { width: 390, height: 500 }),
      { revision: 'same' },
    ),
    b = buildReaderSliceIndex(
      source as never,
      compileChart(source as never, { width: 1280, height: 500 }),
      { revision: 'same' },
    );
  expect(a.panels[0].slices.map((s) => s.key)).toEqual(b.panels[0].slices.map((s) => s.key));
  expect(a.panels[0].slices[0].x).toEqual({ kind: 'date', value: '2024-01-01T00:00:00.000Z' });
});

it('uses transformed observations with declared grouping semantics and clears incompatible bindings', () => {
  const source = {
    ...line,
    transform: [{ calculate: { op: '*', field: 'y', value: 2 }, as: 'twice' }],
    encoding: { ...line.encoding, y: { field: 'twice', type: 'quantitative' } },
    fields: { twice: metadata },
  };
  const index = build(source as never);
  expect(index.panels[0].slices[1].members.find((m) => m.series.label === 'A')!.value).toBe(10);
  expect(
    index.panels[0].slices[1].members.find((m) => m.series.label === 'A')!.series.metadata,
  ).toEqual(metadata);
  const changed = build(
    {
      ...source,
      transform: [{ calculate: { op: '*', field: 'y', value: 3 }, as: 'twice' }],
    } as never,
    'r2',
  );
  expect(
    reconcileReaderSlices(
      { kind: 'slices', preview: null, pinned: [index.panels[0].slices[1]], announcement: '' },
      changed,
      { dataReplaced: true },
    ).pinned,
  ).toEqual([]);
});
it('retains filter-hidden identities while making unresolved revision values unavailable', () => {
  const initial = build(),
    selected = initial.panels[0].slices[0];
  const filtered = build(
    { ...line, transform: [{ filter: { field: 'x', gt: 0 } }] } as never,
    'r2',
  );
  const result = reconcileReaderSlices(
    { kind: 'slices', preview: null, pinned: [selected], announcement: '' },
    filtered,
    { dataReplaced: true },
  );
  expect(result.pinned).toHaveLength(1);
  expect(result.pinned[0].state).toBe('filtered');
  expect(result.pinned[0].members[0].value).toBeUndefined();
});
it('rejects layered slices with an actionable diagnostic and leaves ordinary chart compilation valid', () => {
  const spec = { layer: [line, line] };
  const layout = compileChart(line as never, { width: 800, height: 500 });
  const index = buildReaderSliceIndex(spec as never, layout, { revision: 'r1' });
  expect(index.supported).toBe(false);
  expect(index.diagnostics[0].code).toBe('READER_LAYER_BINDING');
});
it('rejects missing units, changed representations and nonfinite operands without changing numeric helper conventions', () => {
  expect(
    compareReaderValues(
      { value: 1, metadata: { measure: 'count', representation: 'number' }, binding },
      { value: 2, metadata: { measure: 'count', representation: 'number' }, binding },
    ),
  ).toMatchObject({ reason: 'missing-metadata' });
  expect(
    compareReaderValues(
      { value: 1, metadata, binding },
      { value: 2, metadata: { ...metadata, representation: 'proportion' }, binding },
    ),
  ).toMatchObject({ reason: 'incompatible-metadata' });
  expect(
    compareReaderValues({ value: Number.NaN, metadata, binding }, { value: 2, metadata, binding }),
  ).toMatchObject({ reason: 'nonfinite' });
});
it('does not make a duplicated source identity persistent when a filter leaves only one duplicate', () => {
  const source = { ...line, data: [...line.data, { ...line.data[0], x: 9 }] };
  const filtered = build({ ...source, transform: [{ filter: { field: 'x', lt: 9 } }] } as never);
  expect(filtered.panels[0].slices[0].persistent).toBe(false);
});

it('never stamps a prior finite value into a new revision when its slice is filtered out', () => {
  const source = {
    ...line,
    data: [
      { id: 'a', x: 2022, y: 10, s: 'A' },
      { id: 'b', x: 2024, y: 20, s: 'A' },
    ],
  };
  const first = build(source as never, 'r1');
  const next = build(
    {
      ...source,
      data: [
        { id: 'a', x: 2022, y: 99, s: 'A' },
        { id: 'b', x: 2024, y: 30, s: 'A' },
      ],
      transform: [{ filter: { field: 'x', equal: 2024 } }],
    } as never,
    'r2',
  );
  const selected = reconcileReaderSlices(
    { kind: 'slices', preview: null, pinned: [first.panels[0].slices[0]], announcement: '' },
    next,
    { dataReplaced: true },
  ).pinned[0];
  expect(selected.revision).toBe('r2');
  expect(selected.state).toBe('filtered');
  expect(selected.members[0].value).toBeUndefined();
  expect(selected.members[0].valueStatus).toBe('missing');
  expect(selected.members[0].observations[0].datum.y).toBe(99);
});
