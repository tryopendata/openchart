import { describe, expect, it } from 'vitest';
import v8Fixtures from '../__test-fixtures__/v8-styling.json';
import { compileChart, compileLayer } from '../compile';
import { validateSpec } from '../compiler/validate';
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
  it('preserves hardcoded v8 reference typography independently of the small theme size', () => {
    const source = {
      ...chart,
      theme: { fonts: { sizes: { small: 20 } } },
      annotations: [
        { type: 'refline', y: 0, label: 'Threshold' },
        { type: 'range', x1: 0, x2: 1, label: 'Interval' },
        { type: 'refline', y: 1, label: 'Authored', fontSize: 17 },
      ],
    };
    const migrated = migrateSpecV8(source);
    expect(
      compileChart(migrated.spec, { width: 800, height: 600 }).annotations.map(
        (a) => a.label?.style.fontSize,
      ),
    ).toEqual([11, 11, 17]);
    expect(migrateSpecV8(migrated.spec).repairs).toEqual([]);
    expect(
      compileChart(migrateSpecV8(source, { styling: 'v9' }).spec, {
        width: 800,
        height: 600,
      }).annotations.map((a) => a.label?.style.fontSize),
    ).toEqual([20, 20, 17]);
  });
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
    [{ type: 'map', valueFormat: '.2f' }, { type: 'map' }],
    [
      { type: 'barlist', valueFormat: '.2f', encoding: { label: { field: 'k' } } },
      { type: 'barlist', encoding: { label: { field: 'k' } } },
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

  it('drops a channel-less map valueFormat so the migrated spec validates', () => {
    const { spec, repairs } = migrateSpecV8({
      type: 'map',
      geography: 'us-states',
      data: [],
      valueFormat: '.1f',
      points: {
        data: [{ lat: 1, lon: 2 }],
        encoding: { latitude: { field: 'lat' }, longitude: { field: 'lon' } },
      },
    });
    expect(spec).not.toHaveProperty('valueFormat');
    expect(repairs.find((r) => r.path === '/valueFormat')?.reason).toMatch(/no effect/);
    expect(validateSpec(spec).errors.filter((e) => /valueFormat/.test(e.path + e.message))).toEqual(
      [],
    );
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
    // The legacy preset is dropped, so the default entrance applies.
    expect(layout.animation?.enter?.duration).toBe(450);
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
  const endpointLabels = compileLayer(migrated.spec, { width: 1280, height: 400 }).endpointLabels;
  expect(endpointLabels!.entries.map((e) => e.seriesKey).sort()).toEqual(['A', 'B']);
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
  // New resolved control metadata did not exist in the released capture.
  // Compare every old field unchanged; assert each added endpoint constant separately.
  const { endpointLabel, endpointValue, ...releasedSizes } = layout.theme.fonts.sizes;
  const { endpointEntryGap, endpointValueGap, endpointColumnGap, ...releasedSpacing } =
    layout.theme.spacing;
  expect({ ...layout.theme.fonts, sizes: releasedSizes }).toEqual(expected.fonts);
  expect(releasedSpacing).toEqual(expected.spacing);
  expect({ endpointLabel, endpointValue }).toEqual({ endpointLabel: 13, endpointValue: 12 });
  expect({ endpointEntryGap, endpointValueGap, endpointColumnGap }).toEqual({
    endpointEntryGap: 6,
    endpointValueGap: 4,
    endpointColumnGap: 18,
  });
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
  if ('marks' in expected)
    expect(
      JSON.parse(
        JSON.stringify(
          layout.marks.map((m) => ({
            type: m.type,
            fill: 'fill' in m ? m.fill : undefined,
            stroke: 'stroke' in m ? m.stroke : undefined,
          })),
        ),
      ),
    ).toEqual(expected.marks);
});

it('keeps v8 general font sizes ahead of authored chrome sizes', () => {
  const source = {
    ...chart,
    chrome: { title: 'T', subtitle: 'S', source: 'S', byline: 'B', footer: 'F' },
    theme: {
      fonts: { sizes: { title: 30, subtitle: 17, small: 13 } },
      chrome: {
        title: { fontSize: 18 },
        subtitle: { fontSize: 9 },
        source: { fontSize: 10 },
        byline: { fontSize: 8 },
        footer: { fontSize: 7, color: 'red' },
      },
    },
  };
  const { spec, repairs } = migrateSpecV8(source);
  const { chrome } = compileChart(spec, { width: 640, height: 400 }).theme;
  // Captured from released v8.9.1.
  expect(
    ['title', 'subtitle', 'source', 'byline', 'footer'].map(
      (key) => chrome[key as keyof typeof chrome].fontSize,
    ),
  ).toEqual([30, 17, 13, 13, 13]);
  expect(chrome.footer.color).toBe('red');
  expect(repairs.map((r) => r.path)).toContain('/theme/chrome/title/fontSize');
  expect(migrateSpecV8(spec).repairs).toEqual([]);
  const v9 = migrateSpecV8(source, { styling: 'v9' }).spec;
  expect(compileChart(v9, { width: 640, height: 400 }).theme.chrome.title.fontSize).toBe(18);
});

it('keeps each leaf palette while the layer theme keeps owning root chrome', () => {
  const source = {
    theme: { colors: { categorical: ['#111111'] }, fonts: { sizes: { title: 30 } } },
    chrome: { title: 'Title' },
    layer: [
      {
        ...chart,
        theme: { colors: { categorical: ['#00ff00'] }, fonts: { sizes: { title: 12 } } },
      },
      { ...chart, theme: { colors: { categorical: ['#ff0000'] } } },
    ],
  };
  const { spec } = migrateSpecV8(source);
  const layout = compileLayer(spec as never, { width: 640, height: 500 });
  // Captured from released v8.9.1.
  expect(layout.marks.filter((m) => m.type === 'point').map((m) => m.fill)).toEqual([
    '#00ff00',
    '#00ff00',
    '#ff0000',
    '#ff0000',
  ]);
  expect(layout.theme.chrome.title.fontSize).toBe(30);
  expect(migrateSpecV8(spec).repairs).toEqual([]);
  // v9 resolves root and leaf themes the way v8 did, so the leaf keeps its
  // own non-color keys rather than taking a copy of the parent theme.
  expect(spec.layer[0].theme.fonts.sizes.title).toBe(12);
  expect(spec.layer[0].theme.colors.categorical).toEqual(['#00ff00']);
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
  const layout = compileLayer(result.spec, { width: 640, height: 400 });
  expect(layout.annotations.map((a) => a.type)).toEqual(['refline']);
  expect(migrateSpecV8(result.spec).repairs).toEqual([]);
});

it('drops dual-axis leaf themes that v8 ignored under a layer theme', () => {
  const leafWith = (fill: string) => ({ ...chart, theme: { colors: { categorical: [fill] } } });
  const source = {
    theme: { colors: { categorical: ['#111111'] } },
    resolve: { scale: { y: 'independent' } },
    layer: [leafWith('#00ff00'), leafWith('#ff0000')],
  };
  const { spec, repairs } = migrateSpecV8(source);
  expect(spec.layer.map((leaf: { theme?: unknown }) => leaf.theme)).toEqual([undefined, undefined]);
  expect(repairs.map((r) => r.path)).toEqual(
    expect.arrayContaining(['/layer/0/theme', '/layer/1/theme']),
  );
  expect(migrateSpecV8(spec).repairs).toEqual([]);
  const layout = compileLayer(spec as never, { width: 640, height: 500 });
  // v8.9.1 drew both sides with the layer palette.
  expect(
    new Set(
      layout.marks.filter((m) => m.type === 'point').map((m) => (m as { fill: string }).fill),
    ),
  ).toEqual(new Set(['#111111']));
  // Without a layer theme each leaf kept its own in v8, so nothing changes.
  const { theme: _omit, ...noLayerTheme } = source;
  // (The leaf theme itself stays, keeping its own palette.)
  expect(migrateSpecV8(noLayerTheme).spec.layer[0].theme.colors.categorical).toEqual(['#00ff00']);
});

it('materializes released v8 endpoint constants without replacing authored controls', () => {
  const defaults = migrateSpecV8(chart).spec as typeof chart & {
    theme: { fonts: { sizes: Record<string, number> }; spacing: Record<string, number> };
  };
  expect(defaults.theme.fonts.sizes).toMatchObject({ endpointLabel: 13, endpointValue: 12 });
  expect(defaults.theme.spacing).toMatchObject({
    endpointEntryGap: 6,
    endpointValueGap: 4,
    endpointColumnGap: 18,
  });
  const source = {
    ...chart,
    theme: { fonts: { sizes: { endpointLabel: 17 } }, spacing: { endpointColumnGap: 24 } },
  };
  const migrated = migrateSpecV8(source);
  expect(migrated.spec.theme.fonts.sizes.endpointLabel).toBe(17);
  expect(migrated.spec.theme.spacing.endpointColumnGap).toBe(24);
  expect(migrateSpecV8(migrated.spec).repairs).toEqual([]);
  expect(migrateSpecV8(chart, { styling: 'v9' }).spec).not.toHaveProperty('theme');
});

it('reports the value-label font correction once without offering a false v8 styling guarantee', () => {
  const source = {
    mark: 'bar',
    data: [{ name: 'A', value: 4 }],
    encoding: {
      x: { field: 'value', type: 'quantitative' },
      y: { field: 'name', type: 'nominal' },
    },
    theme: { fonts: { family: 'Georgia, serif' } },
  };
  const migrated = migrateSpecV8(source);
  expect(
    migrated.repairs.some((repair) =>
      repair.reason.includes('value labels now follow the resolved theme font'),
    ),
  ).toBe(true);
  const layout = compileChart(migrated.spec, { width: 680, height: 400 });
  expect(
    layout.marks.some(
      (mark) => mark.type === 'rect' && mark.label?.style.fontFamily === 'Georgia, serif',
    ),
  ).toBe(true);
  expect(migrateSpecV8(migrated.spec).repairs).toEqual([]);
});
