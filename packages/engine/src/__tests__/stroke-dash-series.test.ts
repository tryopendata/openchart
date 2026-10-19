import type { ChartSpec, LineMark } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../compile';
import { migrateSpecV8 } from '../migration/v8';

const data = ['United States', 'Euro Area', 'China'].flatMap((country, i) =>
  [2020, 2021, 2022].map((year) => ({ year: String(year), gdp: i * 3 + year - 2020, country })),
);
const dashSpec = (extra: Partial<ChartSpec> = {}): ChartSpec =>
  ({
    mark: 'line',
    data,
    encoding: {
      x: { field: 'year', type: 'ordinal' },
      y: { field: 'gdp', type: 'quantitative' },
      strokeDash: { field: 'country', type: 'nominal' },
    },
    ...extra,
  }) as ChartSpec;

function compile(spec: ChartSpec, width = 1280) {
  const warnings: string[] = [];
  const layout = compileChart(spec, { width, height: 400, onWarn: (m) => warnings.push(m) });
  const lines = layout.marks.filter((m): m is LineMark => m.type === 'line');
  const legendEntries = 'entries' in layout.legend ? layout.legend.entries : [];
  return { layout, lines, legendEntries, warnings };
}
const identificationWarning = (warnings: string[]) =>
  warnings.filter((w) => w.includes('legend and endpointLabels are disabled'));

describe('strokeDash-only multi-series lines', () => {
  it('identifies each series in the endpoint column with its line color and dash', () => {
    const { layout, lines, legendEntries, warnings } = compile(dashSpec());
    const entries = layout.endpointLabels?.entries ?? [];
    expect(entries.map((e) => e.seriesKey)).toEqual(['United States', 'Euro Area', 'China']);
    for (const entry of entries) {
      const line = lines.find((l) => l.seriesKey === entry.seriesKey)!;
      expect(entry.color).toBe(line.stroke);
      expect(entry.strokeDasharray).toBe(line.strokeDasharray);
    }
    expect(entries.find((e) => e.seriesKey === 'Euro Area')?.strokeDasharray).toBe('6 4');
    // The endpoint column replaces the legend, as for color series.
    expect(legendEntries).toEqual([]);
    expect(identificationWarning(warnings)).toEqual([]);
  });

  it('falls back to a strokeDash legend with dashed line swatches', () => {
    const { lines, legendEntries } = compile(dashSpec({ endpointLabels: false }));
    expect(legendEntries.map((e) => [e.label, e.shape, e.strokeDasharray])).toEqual([
      ['United States', 'line', undefined],
      ['Euro Area', 'line', '6 4'],
      ['China', 'line', '2 3'],
    ]);
    expect(new Set(legendEntries.map((e) => e.color))).toEqual(new Set([lines[0].stroke]));
  });

  it('uses the strokeDash legend at the compact breakpoint', () => {
    const { layout, legendEntries } = compile(dashSpec(), 390);
    expect(layout.endpointLabels?.entries ?? []).toEqual([]);
    expect(legendEntries.map((e) => e.label)).toEqual(['United States', 'Euro Area', 'China']);
  });

  it('hides a toggled series without shifting the remaining dash patterns', () => {
    const { lines, legendEntries } = compile(
      dashSpec({ hiddenSeries: ['Euro Area'], endpointLabels: false }),
    );
    expect(lines.map((l) => [l.seriesKey, l.strokeDasharray])).toEqual([
      ['United States', undefined],
      ['China', '2 3'],
    ]);
    expect(legendEntries.find((e) => e.label === 'Euro Area')?.active).toBe(false);
  });

  it('warns only when the author turns both identifiers off', () => {
    const { warnings } = compile(dashSpec({ legend: { show: false }, endpointLabels: false }));
    expect(identificationWarning(warnings)).toHaveLength(1);
  });

  it('gives detail-only groups no legend or endpoint column (Vega-Lite detail)', () => {
    const spec = dashSpec();
    const encoding = { ...spec.encoding, detail: { field: 'country', type: 'nominal' } };
    delete (encoding as { strokeDash?: unknown }).strokeDash;
    const { layout, legendEntries, warnings } = compile({ ...spec, encoding } as ChartSpec);
    expect(layout.endpointLabels?.entries ?? []).toEqual([]);
    expect(legendEntries).toEqual([]);
    expect(identificationWarning(warnings)).toEqual([]);
  });
});

describe('migrateSpecV8 strokeDash series labels', () => {
  it.each([
    {},
    { legend: { show: false }, endpointLabels: false },
  ])('keeps v8 end-of-line labels as label-only endpoint labels (%j)', (extra) => {
    const { spec, repairs } = migrateSpecV8(dashSpec(extra as Partial<ChartSpec>));
    expect(spec.endpointLabels).toEqual({ content: 'label', showMarker: false });
    expect(repairs.map((r) => r.path)).toContain('/endpointLabels');
    expect(migrateSpecV8(spec).repairs).toEqual([]);
    const entries = compile(spec).layout.endpointLabels?.entries ?? [];
    expect(entries.map((e) => [e.labelLines.join(' '), e.value, e.marker])).toEqual([
      ['United States', '', undefined],
      ['Euro Area', '', undefined],
      ['China', '', undefined],
    ]);
  });

  it('leaves dash series alone when v8 drew no labels', () => {
    const source = dashSpec({ labels: { density: 'none' } });
    expect(migrateSpecV8(source).spec).not.toHaveProperty('endpointLabels');
  });
});
