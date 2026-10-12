import {
  type ChartSpec,
  type GeoMapSpec,
  SEQUENTIAL_PALETTES,
  type TableSpec,
} from '@opendata-ai/openchart-core';
import {
  compileChart,
  compileGeoMap,
  compileTable,
  validateSpec,
} from '@opendata-ai/openchart-engine';
import { describe, expect, it } from 'vitest';
import { compose } from '../composition';
import { editDocument, importDelimited, redoDocument, undoDocument } from '../document';
import { referencePatterns } from '../patterns';
import { newProject, parseProject, prepareProject, replaceSource, updateSpec } from '../project';

const rows = importDelimited(
  'place,year,value,upper\nA,2024,10,15\nA,2025,,18\nB,2024,30,32\nB,2025,50,53',
  (() => {
    let id = 0;
    return () => String(++id);
  })(),
);
const table: TableSpec = {
  type: 'table',
  data: rows.rows,
  fields: {
    ...Object.fromEntries(Object.entries(rows.fields).map(([key, type]) => [key, { type }])),
    [rows.key]: { type: 'text', role: 'identity' },
  },
  rowKey: rows.key,
  columns: ['place', 'year', 'value', 'upper'].map((key) => ({ key })),
  chrome: { title: 'Our evidence', source: 'Survey' },
  watermark: false,
};
const viewport = { width: 640, height: 400, onWarn: () => {} };

describe('authoring with public package artifacts', () => {
  it('summarizes, changes composition, saves/reopens, undoes and restores the original source', () => {
    const original = newProject(table);
    const summarized = prepareProject(original, {
      summary: { groupby: ['place'], field: 'value', op: 'mean' },
    });
    expect(summarized.source).toEqual(rows.rows);
    expect(summarized.spec.data.map((row) => row.value)).toEqual([10, 40]);
    const chart = compose(summarized.spec, 'bar', {
      x: 'value',
      y: 'place',
      series: '',
      end: '',
    }) as ChartSpec;
    const project = updateSpec(summarized, chart);
    const layout = compileChart(project.spec, viewport);
    expect(
      layout.marks.filter((mark) => mark.type === 'rect').map((mark) => mark.data.value),
    ).toEqual([10, 40]);
    const reopened = parseProject(JSON.stringify(project));
    expect(reopened).toEqual(project);
    const restored = prepareProject(
      updateSpec(reopened, compose(reopened.spec, 'table', { x: '', y: '', series: '', end: '' })),
      {},
    );
    expect(restored.spec.data).toEqual(rows.rows);
    const history = editDocument({ past: [], present: original, future: [] }, project);
    expect(undoDocument(history).present).toEqual(original);
    expect(redoDocument(undoDocument(history)).present).toEqual(project);
  });
  it('keeps grouping identity stable through sorting and rejects malformed preparation', () => {
    const preparation = { summary: { groupby: ['place'], field: 'value', op: 'sum' as const } };
    const first = prepareProject(newProject(table), preparation);
    const second = prepareProject(
      newProject({ ...table, data: [...table.data].reverse() }),
      preparation,
    );
    expect(first.spec.data.find((row) => row.place === 'A')?._studioGroup).toBe(
      second.spec.data.find((row) => row.place === 'A')?._studioGroup,
    );
    expect(() =>
      parseProject(JSON.stringify({ ...first, preparation: { summary: { op: 'guess' } } })),
    ).toThrow('summary');
  });
  it('replaces renamed source columns without dropping design or preparation', () => {
    const project = prepareProject(newProject(table), { filter: { field: 'year', value: '2024' } });
    const imported = importDelimited('region,date,amount,limit\nC,2024,70,75\nD,2025,90,95');
    expect(() => replaceSource(project, imported, {})).toThrow('Map the replacement fields');
    const replaced = replaceSource(project, imported, {
      place: 'region',
      year: 'date',
      value: 'amount',
      upper: 'limit',
    });
    expect(replaced.spec.chrome).toEqual(table.chrome);
    expect(replaced.source).toHaveLength(2);
    expect(replaced.spec.data).toHaveLength(1);
    expect(replaced.spec.data[0]).toMatchObject({ place: 'C', value: 70 });
    expect(replaced.spec).toMatchObject({ type: 'table', columns: table.columns });
  });
  it.each([
    'bar',
    'line',
    'area',
    'point',
    'lollipop',
    'range',
    'histogram',
  ] as const)('compiles a %s composition without losing source rows or editorial chrome', (kind) => {
    const input = ['bar', 'lollipop', 'range'].includes(kind)
      ? { ...table, data: table.data.map((row) => ({ ...row, place: `${row.place} ${row.year}` })) }
      : table;
    const spec = compose(input, kind, {
      x:
        kind === 'bar' ||
        kind === 'point' ||
        kind === 'histogram' ||
        kind === 'range' ||
        kind === 'lollipop'
          ? 'value'
          : 'year',
      y: kind === 'bar' || kind === 'range' || kind === 'lollipop' ? 'place' : 'value',
      series: kind === 'line' || kind === 'area' ? 'place' : '',
      end: 'upper',
    });
    expect(spec.chrome).toEqual(table.chrome);
    expect(spec.data).toBe(input.data);
    const layout = compileChart(spec, viewport);
    expect(layout.marks.length).toBeGreaterThan(0);
    expect(JSON.stringify(layout.marks)).not.toContain('NaN');
  });
  it('compiles data format, refline and table visualization settings', () => {
    const chart = compose(
      { ...table, data: table.data.filter((row) => row.year === 2024) },
      'bar',
      {
        x: 'value',
        y: 'place',
        series: '',
        end: '',
      },
    ) as ChartSpec;
    const layout = compileChart(
      {
        ...chart,
        encoding: {
          ...chart.encoding,
          x: { ...chart.encoding.x, field: 'value', type: 'quantitative', format: '$,.0f' },
        },
        annotations: [{ type: 'refline', x: 20, label: 'Target', responsive: false }],
      },
      viewport,
    );
    expect(layout.annotations.some((annotation) => annotation.type === 'refline')).toBe(true);
    const renderedTable = compileTable(
      {
        ...table,
        columns: [
          { key: 'place', priority: 1 },
          { key: 'value', format: '$,.0f', bar: {}, priority: 1 },
        ],
        mobileLayout: 'priority',
      },
      { ...viewport, width: 320 },
    );
    expect(renderedTable.rows.length).toBeGreaterThan(0);
  });
  it('validates every offered map palette and uses its actual colors', () => {
    const source = referencePatterns.find((pattern) => pattern.id === 'map')!.spec as GeoMapSpec;
    for (const [scheme, colors] of Object.entries(SEQUENTIAL_PALETTES)) {
      const spec: GeoMapSpec = {
        ...source,
        encoding: { ...source.encoding, color: { ...source.encoding.color!, scale: { scheme } } },
      };
      expect(validateSpec(spec).valid).toBe(true);
      const layout = compileGeoMap(spec, viewport);
      expect(
        layout.features
          .filter((feature) => !feature.noData)
          .every((feature) => colors.includes(feature.fill)),
      ).toBe(true);
    }
  });
  it('reports duplicate map observations rather than silently coloring with the last one', () => {
    const spec = referencePatterns.find((pattern) => pattern.id === 'map')!.spec as GeoMapSpec;
    const duplicate = { ...spec, data: [...spec.data, { ...spec.data[0], gdp: 999999 }] };
    const layout = compileGeoMap(duplicate, viewport);
    expect(layout.warnings.some((warning) => warning.code === 'DUPLICATE_DATA_KEYS')).toBe(true);
    const key = String(spec.data[0][spec.encoding.key!.field]);
    expect(layout.features.find((feature) => String(feature.id) === key)?.data).not.toMatchObject({
      gdp: 999999,
    });
  });
});

describe('project fidelity at authoring boundaries', () => {
  it('restores authored column styles and never adds intentionally hidden source fields', () => {
    const spec: TableSpec = {
      type: 'table',
      data: [{ name: 'A', value: 2, extra: 3, secret: 4 }],
      columns: [
        { key: 'name' },
        { key: 'value', format: '$,.0f' },
        { key: 'extra', heatmap: {}, priority: 3 },
      ],
    };
    const original = newProject(spec);
    expect(parseProject(JSON.stringify(original)).spec).toEqual(spec);
    const prepared = prepareProject(original, {
      summary: { groupby: ['name'], field: 'value', op: 'sum' },
    });
    const reopened = parseProject(JSON.stringify(prepared));
    expect((prepareProject(reopened, {}).spec as TableSpec).columns).toEqual(spec.columns);
    const edited = updateSpec(original, { ...spec, columns: spec.columns.slice(0, 2) });
    expect((parseProject(JSON.stringify(edited)).spec as TableSpec).columns).toEqual(
      spec.columns.slice(0, 2),
    );
  });
  it('saves authored metadata and key edits without silently reverting them', () => {
    const spec: ChartSpec = {
      mark: 'bar',
      data: [{ name: 'A', id: 'a', alt: 'b', value: 10 }],
      fields: { value: { unit: 'USD' } },
      encoding: {
        x: { field: 'value', type: 'quantitative' },
        y: { field: 'name', type: 'nominal' },
        key: { field: 'id', type: 'nominal' },
      },
    };
    const changed = updateSpec(newProject(spec), {
      ...spec,
      fields: { value: { unit: 'EUR' } },
      encoding: { ...spec.encoding, key: { field: 'alt', type: 'nominal' } },
    });
    const restored = parseProject(JSON.stringify(changed));
    expect(restored.spec.fields?.value.unit).toBe('EUR');
    expect((restored.spec as ChartSpec).encoding.key?.field).toBe('alt');
    expect(prepareProject(newProject(spec), {}).spec).toMatchObject({
      encoding: { key: { field: 'id' } },
    });
  });
  it('replaces a count chart source while retaining its derived numeric measure and design', () => {
    const prepared = prepareProject(newProject(table), {
      summary: { groupby: ['place'], field: '', op: 'count' },
    });
    const chart = updateSpec(
      prepared,
      compose(prepared.spec, 'bar', { x: 'Row count', y: 'place', series: '', end: '' }),
    );
    const imported = importDelimited(
      'place,year,value,upper\nC,2024,10,12\nC,2025,20,22\nC,2026,30,32',
    );
    const replacement = replaceSource(chart, imported, {});
    expect(replacement.source).toHaveLength(3);
    expect(replacement.spec.chrome).toEqual(table.chrome);
    expect(replacement.spec.data[0]['Row count']).toBe(3);
    expect(compileChart(replacement.spec as ChartSpec, viewport).marks).toHaveLength(1);
  });
  it('keeps prepared metadata and identity edits when values recompute', () => {
    const preparation = { summary: { groupby: ['place'], field: 'value', op: 'mean' as const } };
    const prepared = prepareProject(newProject(table), preparation);
    const edited = updateSpec(prepared, {
      ...prepared.spec,
      fields: { value: { unit: 'EUR' } },
      rowKey: 'place',
    } as TableSpec);
    const reopened = parseProject(JSON.stringify(edited));
    const refreshed = prepareProject(
      { ...reopened, source: reopened.source.map((row) => ({ ...row, value: 20 })) },
      preparation,
    );
    expect(refreshed.spec.fields?.value.unit).toBe('EUR');
    expect((refreshed.spec as TableSpec).rowKey).toBe('place');
    expect(refreshed.spec.data.map((row) => row.value)).toEqual([20, 20]);
    expect(prepareProject(refreshed, {}).spec.fields).toEqual(table.fields);
  });
  it('keeps a grouping column named _studioGroup and gives counts clean measure semantics', () => {
    const spec: TableSpec = {
      type: 'table',
      data: [
        { _studioGroup: 'A', value: 0.2 },
        { _studioGroup: 'A', value: 0.3 },
      ],
      fields: { value: { type: 'number', unit: '%', representation: 'proportion' } },
      columns: [{ key: '_studioGroup' }, { key: 'value', format: '.1%' }],
    };
    const prepared = prepareProject(newProject(spec), {
      summary: { groupby: ['_studioGroup'], field: '', op: 'count' },
    });
    expect(prepared.spec.data[0]).toMatchObject({ _studioGroup: 'A', 'Row count': 2 });
    expect(prepared.spec.fields?.['Row count']).toEqual({
      type: 'number',
      unit: 'rows',
      measure: 'row-count',
    });
    expect((prepared.spec as TableSpec).rowKey).toBe('__studioGroup');
    expect(
      (prepared.spec as TableSpec).columns.find((column) => column.key === 'Row count')?.format,
    ).toBeUndefined();
    expect(
      (prepareProject(parseProject(JSON.stringify(prepared)), {}).spec as TableSpec).columns,
    ).toEqual(spec.columns);
  });
  it('round trips an accepted source whose envelope exceeds the plain-spec import limit', () => {
    const imported = importDelimited(`name,value\n${'A'.repeat(2_600_000)},10`);
    const project = newProject({ type: 'table', data: imported.rows, columns: [{ key: 'value' }] });
    const backup = JSON.stringify(project);
    expect(backup.length).toBeGreaterThan(5_000_000);
    expect(parseProject(backup).source[0].name).toHaveLength(2_600_000);
  });
  it('prepares the supported 20,000 unique-group workload without scanning source for every output', () => {
    const project = newProject({
      type: 'table',
      data: Array.from({ length: 20_000 }, (_, id) => ({ id, value: id })),
      columns: [{ key: 'id' }, { key: 'value' }],
    });
    const prepared = prepareProject(project, {
      summary: { groupby: ['id'], field: 'value', op: 'mean' },
    });
    expect(prepared.spec.data).toHaveLength(20_000);
    expect(prepared.spec.data.at(-1)?.value).toBe(19_999);
  });
  it.each([
    'facet',
    'row',
    'column',
  ] as const)('restores separate %s small multiples without accepting within-facet duplicates', (facet) => {
    const filtered = prepareProject(newProject(table), {
      filter: { field: 'year', value: '2024' },
    });
    const chart = compose(filtered.spec, 'bar', {
      x: 'value',
      y: 'place',
      series: '',
      end: '',
    }) as ChartSpec;
    const faceted = updateSpec(filtered, {
      ...chart,
      encoding: { ...chart.encoding, [facet]: { field: 'year', type: 'nominal' } },
    } as ChartSpec);
    expect(prepareProject(faceted, {}).spec.data).toEqual(table.data);
    const quantitative = updateSpec(filtered, {
      ...chart,
      encoding: { ...chart.encoding, color: { field: 'value', type: 'quantitative' } },
    } as ChartSpec);
    expect(() => prepareProject(quantitative, {})).toThrow('filter or summarize');
    expect(() =>
      prepareProject({ ...faceted, source: [...faceted.source, faceted.source[0]] }, {}),
    ).toThrow('filter or summarize');
  });
  it('does not turn a mean comparison into implicit sums when source rows are restored', () => {
    const prepared = prepareProject(newProject(table), {
      summary: { groupby: ['place'], field: 'value', op: 'mean' },
    });
    const chart = updateSpec(
      prepared,
      compose(prepared.spec, 'bar', { x: 'value', y: 'place', series: '', end: '' }),
    );
    expect(() => prepareProject(chart, {})).toThrow('filter or summarize');
    const asTable = updateSpec(
      chart,
      compose(chart.spec, 'table', { x: '', y: '', series: '', end: '' }),
    );
    expect(prepareProject(asTable, {}).spec.data).toEqual(table.data);
  });
  it('requires an explicit preparation choice before drawing overlapping category observations', () => {
    expect(() => compose(table, 'bar', { x: 'value', y: 'place', series: '', end: '' })).toThrow(
      'filter or summarize',
    );
    expect(() =>
      prepareProject(
        newProject(
          compose({ ...table, data: table.data.slice(0, 1) }, 'bar', {
            x: 'value',
            y: 'place',
            series: '',
            end: '',
          }),
        ),
        { summary: { groupby: ['year'], field: 'value', op: 'mean' } },
      ),
    ).toThrow('removes fields');
  });
});
