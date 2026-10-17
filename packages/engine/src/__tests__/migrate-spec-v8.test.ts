import { describe, expect, it } from 'vitest';
import { compileChart, compileLayer } from '../compile';
import { migrateSpecV8 } from '../migration/v8';

const chart = {
  mark: 'point',
  data: [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ],
  encoding: { x: { field: 'x', type: 'quantitative' }, y: { field: 'y', type: 'quantitative' } },
};
describe('migrateSpecV8 alias repairs', () => {
  it.each([
    [
      { type: 'table', compact: true },
      { type: 'table', density: 'condensed' },
    ],
    [
      { type: 'table', compact: false },
      { type: 'table', density: 'regular' },
    ],
    [
      { type: 'map', valueFormat: '.2f', encoding: { color: { field: 'v' } } },
      { type: 'map', encoding: { color: { field: 'v', format: '.2f' } } },
    ],
    [
      { type: 'sankey', valueFormat: '.2f', encoding: { value: { field: 'v', format: '.1f' } } },
      { type: 'sankey', encoding: { value: { field: 'v', format: '.1f' } } },
    ],
    [
      { type: 'barlist', valueFormat: '.2f', encoding: { value: { field: 'v' } } },
      { type: 'barlist', encoding: { value: { field: 'v', format: '.2f' } } },
    ],
    [
      { mark: 'arc', encoding: { y: { field: 'v' } } },
      { mark: 'arc', encoding: { theta: { field: 'v' } } },
    ],
    [{ animation: 'legacy', darkMode: 'force' }, { animation: true }],
    [{ animation: { preset: 'legacy', update: false } }, { animation: { update: false } }],
    [
      { theme: { chrome: { title: 'red' } }, chrome: { title: 'Text' } },
      { theme: { chrome: { title: { color: 'red' } } }, chrome: { title: 'Text' } },
    ],
  ])('rewrites %j, preserves input, records repairs, and is idempotent', (source, expected) => {
    const before = structuredClone(source);
    const result = migrateSpecV8(source);
    expect(result.spec).toEqual(expected);
    expect(source).toEqual(before);
    expect(result.repairs.length).toBeGreaterThan(0);
    expect(migrateSpecV8(result.spec)).toEqual({ spec: result.spec, repairs: [] });
  });

  it('keeps record tilemap valueFormat', () => {
    const spec = { type: 'tilemap', data: { CA: 4 }, valueFormat: '.2f' };
    expect(migrateSpecV8(spec)).toEqual({ spec, repairs: [] });
  });

  it('rewrites nested layer aliases with root-relative repair paths', () => {
    const result = migrateSpecV8({ layer: [{ ...chart, annotations: [{ type: 'rule', y: 0 }] }] });
    expect(result.spec.layer[0].annotations[0].type).toBe('refline');
    expect(result.repairs.map((r) => r.path)).toContain('/layer/0/annotations/0/type');
  });

  it('preserves rendering for nonvisual aliases', () => {
    const spec = {
      ...chart,
      animation: { preset: 'legacy' },
      annotations: [{ type: 'rule', y: 0, label: 'Rule' }],
      theme: { chrome: { title: '#333333' } },
      chrome: { title: 'Title' },
    };
    expect(compileChart(migrateSpecV8(spec).spec, { width: 640, height: 400 })).toEqual(
      compileChart(spec, { width: 640, height: 400 }),
    );
  });

  it('replaces legacy labels and records each lost offset (explicit 8.10 exception)', () => {
    const spec = {
      mark: 'line',
      data: [
        { x: 'A', y: 1, s: 'one' },
        { x: 'B', y: 2, s: 'two' },
      ],
      encoding: {
        x: { field: 'x', type: 'ordinal' },
        y: { field: 'y', type: 'quantitative' },
        color: { field: 's', type: 'nominal' },
      },
      legend: { show: false },
      endpointLabels: false,
      labels: { offsets: { 'a/b': { dy: 4 }, two: { dx: 2 } } },
    };
    const result = migrateSpecV8(spec);
    expect(result.spec.endpointLabels).toEqual({ content: 'label', showMarker: false });
    expect(result.spec.labels).toEqual({});
    expect(result.repairs.map((r) => r.path)).toContain('/labels/offsets/a~1b');
  });
});

describe('legacy label suppression migration', () => {
  it('uses the shared series cutoff and respects quantitative color', () => {
    const spec = {
      mark: 'line',
      data: Array.from({ length: 9 }, (_, s) => ({ x: 1, y: s, s: String(s) })),
      encoding: {
        x: { field: 'x', type: 'quantitative' },
        y: { field: 'y', type: 'quantitative' },
        color: { field: 's', type: 'nominal' },
      },
      legend: { show: false },
    };
    expect(migrateSpecV8(spec).spec).toMatchObject({
      endpointLabels: { content: 'label', showMarker: false },
    });
    expect(
      migrateSpecV8({
        ...spec,
        encoding: { ...spec.encoding, color: { field: 's', type: 'quantitative' } },
      }).repairs,
    ).toEqual([]);
  });
  it.each(['waffle', 'parliament'])('rewrites %s y while preserving authored theta', (mark) => {
    const spec = {
      mark,
      encoding: { y: { field: 'old' }, theta: { field: 'v' }, radius: { field: 'unused' } },
    };
    expect(migrateSpecV8(spec).spec).toEqual({ mark, encoding: { theta: { field: 'v' } } });
  });
});

it('rewrites the parent endpoint owner of a legacy-label layer', () => {
  const spec = {
    legend: { show: false },
    endpointLabels: false,
    layer: [
      {
        mark: 'line' as const,
        data: [
          { x: 0, y: 1, s: 'A' },
          { x: 1, y: 2, s: 'B' },
        ],
        encoding: {
          x: { field: 'x', type: 'ordinal' as const },
          y: { field: 'y', type: 'quantitative' as const },
          color: { field: 's', type: 'nominal' as const },
        },
      },
    ],
  };
  const migrated = migrateSpecV8(spec);
  expect(migrated.spec.endpointLabels).toEqual({ content: 'label', showMarker: false });
  expect(migrated.repairs.map((repair) => repair.path)).toContain('/endpointLabels');
  expect(compileLayer(migrated.spec, { width: 1280, height: 400 }).endpointLabels).toBeDefined();
  expect(migrateSpecV8(migrated.spec).repairs).toEqual([]);
});

it('warns once for legacy chrome colors supplied through compile options', () => {
  const warnings: string[] = [];
  const options = {
    width: 640,
    height: 400,
    theme: { chrome: { title: 'red' } },
    onWarn: (message: string) => warnings.push(message),
  };
  compileChart(chart, options);
  compileChart(chart, options);
  expect(warnings.filter((message) => message.includes('theme.chrome'))).toHaveLength(1);
});
