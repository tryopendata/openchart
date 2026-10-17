import { describe, expect, it } from 'vitest';
import v8Fixtures from '../__test-fixtures__/v8-styling.json';
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
    expect(result.spec).toEqual(migrateSpecV8(expected).spec);
    expect(source).toEqual(before);
    expect(result.repairs.length).toBeGreaterThan(0);
    expect(migrateSpecV8(result.spec)).toEqual({ spec: result.spec, repairs: [] });
  });

  it('keeps record tilemap valueFormat', () => {
    const spec = { type: 'tilemap', data: { CA: 4 }, valueFormat: '.2f' };
    expect(migrateSpecV8(spec).spec).toMatchObject(spec);
    expect(migrateSpecV8(migrateSpecV8(spec).spec).repairs).toEqual([]);
  });

  it('rewrites nested layer aliases with root-relative repair paths', () => {
    const result = migrateSpecV8({ layer: [{ ...chart, annotations: [{ type: 'rule', y: 0 }] }] });
    expect(result.spec.layer[0].annotations[0].type).toBe('refline');
    expect(result.repairs.map((r) => r.path)).toContain('/layer/0/annotations/0/type');
  });

  it('compiles the repaired aliases under v9', () => {
    const spec = {
      ...chart,
      animation: { preset: 'legacy' },
      annotations: [{ type: 'rule', y: 0, label: 'Rule' }],
      theme: { chrome: { title: '#333333' } },
      chrome: { title: 'Title' },
    };
    const layout = compileChart(migrateSpecV8(spec).spec, { width: 640, height: 400 });
    expect(layout.annotations[0].type).toBe('refline');
    expect(layout.theme.chrome.title.color).toBe('#333333');
    expect(layout.animation).toBeDefined();
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
      }).repairs.filter((repair) => repair.path === '/endpointLabels'),
    ).toEqual([]);
  });
  it.each(['waffle', 'parliament'])('rewrites %s y while preserving authored theta', (mark) => {
    const spec = {
      mark,
      encoding: { y: { field: 'old' }, theta: { field: 'v' }, radius: { field: 'unused' } },
    };
    expect(migrateSpecV8(spec).spec.encoding).toEqual({ theta: { field: 'v' } });
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

it('rejects removed chrome color strings in compile options', () => {
  expect(() =>
    compileChart(chart, { width: 640, height: 400, theme: { chrome: { title: 'red' } } } as never),
  ).toThrow('theme.chrome');
});

describe('migrateSpecV8 default materialization', () => {
  it('pins v8 annotation defaults without replacing authored opt-ins', () => {
    const source = {
      ...chart,
      annotations: [
        { type: 'text', x: 0, y: 0, text: 'Headline', subtitle: 'Detail', connector: 'curve' },
        {
          type: 'text',
          x: 1,
          y: 1,
          text: 'Custom',
          subtitle: 'Detail',
          fontSize: 20,
          fontWeight: 400,
          subtitleFontSize: 17,
          maxWidth: 90,
          connector: { type: 'curve', arrow: false },
        },
        { type: 'refline', y: 0, label: 'Horizontal' },
        { type: 'refline', x: 0, label: 'Vertical' },
      ],
    };
    const { spec, repairs } = migrateSpecV8(source);
    expect(spec.annotations[0]).toMatchObject({
      fontWeight: 700,
      subtitleFontSize: 11,
      maxWidth: null,
      connector: { type: 'curve', arrow: true },
    });
    expect(spec.annotations[1]).toEqual(source.annotations[1]);
    expect(spec.annotations[2]).toMatchObject({ labelAnchor: 'top' });
    expect(spec.annotations[3]).toMatchObject({ labelAnchor: 'left' });
    expect(spec).toMatchObject({
      responsive: { compactAnnotationLimit: null },
      chromeLayout: 'subtract',
    });
    expect(repairs.map((repair) => repair.path)).toContain('/annotations/0/maxWidth');
    expect(migrateSpecV8(spec).spec).toMatchObject(spec);
    expect(migrateSpecV8(migrateSpecV8(spec).spec).repairs).toEqual([]);
  });
  it.each([
    false,
    { autoThin: false },
    undefined,
  ])('preserves opt-out semantics (%j)', (responsive) => {
    const source = { ...chart, width: 390, height: 500, responsive };
    const migrated = migrateSpecV8(source).spec;
    expect(compileChart(migrated, { width: 390, height: 500 }).annotations).toEqual(
      compileChart(source, { width: 390, height: 500 }).annotations,
    );
    if (responsive === false || responsive === undefined) expect(migrated.responsive).toBe(false);
  });
});

it('can adopt v9 styling while performing every necessary alias repair', () => {
  const source = {
    ...chart,
    darkMode: 'off',
    annotations: [
      { type: 'rule', y: 0, label: 'Rule' },
      { type: 'text', x: 0, y: 0, text: 'Text', subtitle: 'Details' },
    ],
  };
  const migrated = migrateSpecV8(source, { styling: 'v9' });
  expect(migrated.spec.annotations[0].type).toBe('refline');
  expect(migrated.spec).not.toHaveProperty('darkMode');
  expect(migrated.spec).not.toHaveProperty('theme');
  expect(migrated.spec.annotations[1]).not.toHaveProperty('fontWeight');
  expect(migrateSpecV8(migrated.spec, { styling: 'v9' }).repairs).toEqual([]);
});

// Captured from released v8.9.1 (8baef9e8), not regenerated by v9 snapshots.
// Layout coordinates intentionally are not part of the styling compatibility promise.
it.each(v8Fixtures)('preserves released v8 styling: $name', ({ source, expected }) => {
  const before = structuredClone(source);
  const { spec } = migrateSpecV8(source);
  const compile = 'layer' in source ? compileLayer : compileChart;
  const layout = compile(spec as never, { width: 640, height: 500 });
  expect(source).toEqual(before);
  expect(migrateSpecV8(spec)).toEqual({ spec, repairs: [] });
  expect(layout.theme.fonts).toEqual(expected.fonts);
  expect(layout.theme.spacing).toEqual(expected.spacing);
  expect(layout.theme.chrome).toEqual(expected.chrome);
  expect(layout.theme.colors).toEqual(expected.colors);
  const annotations = layout.annotations.map((a) => ({
    type: a.type,
    label: a.label ? { text: a.label.text, style: a.label.style } : undefined,
    subtitle: a.subtitle ? { text: a.subtitle.text, style: a.subtitle.style } : undefined,
    connector: a.label?.connector
      ? { arrow: a.label.connector.arrow, stroke: a.label.connector.stroke }
      : undefined,
  }));
  expect(JSON.parse(JSON.stringify(annotations))).toEqual(expected.annotations);
});

it('repairs aliases in a line-layer before inspecting its legacy label policy', () => {
  const source = {
    layer: [
      {
        ...chart,
        mark: 'line',
        annotations: [{ type: 'rule', y: 0, label: 'Baseline' }],
        encoding: {
          ...chart.encoding,
          x: { field: 'x', type: 'ordinal' },
          radius: { field: 'unused' },
        },
      },
    ],
  };
  const result = migrateSpecV8(source);
  expect(result.spec.layer[0].annotations[0].type).toBe('refline');
  expect(result.spec.layer[0].encoding).not.toHaveProperty('radius');
  expect(() => compileLayer(result.spec, { width: 640, height: 400 })).not.toThrow();
  expect(migrateSpecV8(result.spec).repairs).toEqual([]);
});
