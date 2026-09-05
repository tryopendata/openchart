/**
 * Series-color parity.
 *
 * A line's stroke is darkened on a light canvas (`adaptSeriesStroke`) because
 * the palette hues are tuned as fills. Every place that echoes a series color
 * as chrome — the legend swatch, the endpoint-label column, the end-of-line
 * direct label, the area's top edge — has to show the SAME rendered color, or
 * the reader sees one cyan in the legend and a different one on the line.
 */

import type { AreaMark, ChartSpec, LineMark, TextMarkLayout } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../compile';

const SIZE = { width: 700, height: 420 };

const multiSeries = [
  { date: '2020-01-01', value: 10, series: 'North' },
  { date: '2020-02-01', value: 24, series: 'North' },
  { date: '2020-03-01', value: 18, series: 'North' },
  { date: '2020-01-01', value: 6, series: 'South' },
  { date: '2020-02-01', value: 14, series: 'South' },
  { date: '2020-03-01', value: 22, series: 'South' },
];

function lineSpec(overrides: Partial<ChartSpec> = {}): ChartSpec {
  return {
    mark: 'line',
    data: multiSeries,
    encoding: {
      x: { field: 'date', type: 'temporal' },
      y: { field: 'value', type: 'quantitative' },
      color: { field: 'series', type: 'nominal' },
    },
    legend: { show: true },
    ...overrides,
  } as ChartSpec;
}

function lineStrokes(layout: ReturnType<typeof compileChart>): Map<string, string> {
  const out = new Map<string, string>();
  for (const mark of layout.marks) {
    if (mark.type === 'line' && (mark as LineMark).seriesKey) {
      out.set((mark as LineMark).seriesKey!, (mark as LineMark).stroke);
    }
  }
  return out;
}

describe('series color parity', () => {
  it('legend swatches match the rendered line stroke on a light canvas', () => {
    const layout = compileChart(lineSpec(), SIZE);
    const strokes = lineStrokes(layout);

    expect(strokes.size).toBe(2);
    expect(layout.legend.entries.length).toBe(2);
    for (const entry of layout.legend.entries) {
      expect(entry.color).toBe(strokes.get(entry.label));
    }
  });

  it('the swatch is the darkened stroke, not the raw palette fill', () => {
    const layout = compileChart(lineSpec(), SIZE);
    const palette = layout.theme.colors.categorical;
    const north = layout.legend.entries.find((e) => e.label === 'North')!;

    expect(north.color).not.toBe(palette[0]);
    expect(north.color).toBe(lineStrokes(layout).get('North'));
  });

  it('an explicit scale.range renders verbatim on both the line and the swatch', () => {
    const range = ['#ff0000', '#0000ff'];
    const layout = compileChart(
      lineSpec({
        encoding: {
          x: { field: 'date', type: 'temporal' },
          y: { field: 'value', type: 'quantitative' },
          color: { field: 'series', type: 'nominal', scale: { range } },
        },
      } as Partial<ChartSpec>),
      SIZE,
    );
    const strokes = lineStrokes(layout);

    // The author typed these hexes, so they are their call in exactly the way
    // markDef.stroke is: no light-canvas darkening anywhere.
    expect(strokes.get('North')).toBe('#ff0000');
    expect(strokes.get('South')).toBe('#0000ff');
    for (const entry of layout.legend.entries) {
      expect(entry.color).toBe(strokes.get(entry.label));
    }
    expect(layout.legend.entries.map((e) => e.color)).toEqual(range);
  });

  it("an explicit scale.range also renders verbatim on an area's top stroke", () => {
    const range = ['#ff0000', '#0000ff'];
    const layout = compileChart(
      lineSpec({
        mark: 'area',
        encoding: {
          x: { field: 'date', type: 'temporal' },
          y: { field: 'value', type: 'quantitative' },
          color: { field: 'series', type: 'nominal', scale: { range } },
        },
      } as Partial<ChartSpec>),
      SIZE,
    );
    const areas = layout.marks.filter((m): m is AreaMark => m.type === 'area');

    expect(areas.length).toBeGreaterThan(0);
    for (const area of areas) {
      expect(range).toContain(area.stroke);
    }
    for (const entry of layout.legend.entries) {
      expect(range).toContain(entry.color);
    }
  });

  it('bar swatches keep the raw palette color (fills are not adapted)', () => {
    const layout = compileChart(
      {
        mark: 'bar',
        data: multiSeries,
        encoding: {
          x: { field: 'value', type: 'quantitative' },
          y: { field: 'date', type: 'nominal' },
          color: { field: 'series', type: 'nominal' },
        },
        legend: { show: true },
      } as ChartSpec,
      SIZE,
    );
    const fills = new Set(
      layout.marks.filter((m) => m.type === 'rect').map((m) => m.fill as string),
    );
    for (const entry of layout.legend.entries) {
      expect(fills.has(entry.color)).toBe(true);
    }
  });

  it('legend swatches match line strokes in dark mode too', () => {
    const layout = compileChart(lineSpec({ darkMode: 'force' }), SIZE);
    const strokes = lineStrokes(layout);
    for (const entry of layout.legend.entries) {
      expect(entry.color).toBe(strokes.get(entry.label));
    }
  });

  it("an area's top stroke matches the line drawn over it", () => {
    const layout = compileChart(
      lineSpec({ mark: 'area', legend: { show: true } } as Partial<ChartSpec>),
      SIZE,
    );
    const areas = layout.marks.filter((m): m is AreaMark => m.type === 'area');
    const strokes = lineStrokes(layout);

    expect(areas.length).toBeGreaterThan(0);
    for (const area of areas) {
      expect(area.stroke).toBe(strokes.get(area.seriesKey!));
    }
    for (const entry of layout.legend.entries) {
      expect(entry.color).toBe(strokes.get(entry.label));
    }
  });

  it('single-series area top stroke matches its own line mark', () => {
    const layout = compileChart(
      {
        mark: 'area',
        data: multiSeries.filter((d) => d.series === 'North'),
        encoding: {
          x: { field: 'date', type: 'temporal' },
          y: { field: 'value', type: 'quantitative' },
        },
      } as ChartSpec,
      SIZE,
    );
    const area = layout.marks.find((m): m is AreaMark => m.type === 'area')!;
    const line = layout.marks.find((m): m is LineMark => m.type === 'line')!;
    expect(area.stroke).toBe(line.stroke);
  });

  it('endpoint labels carry the rendered stroke color', () => {
    const layout = compileChart(
      lineSpec({ endpointLabels: true, legend: false } as Partial<ChartSpec>),
      SIZE,
    );
    const strokes = lineStrokes(layout);
    const entries = layout.endpointLabels?.entries ?? [];

    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.color).toBe(strokes.get(entry.seriesKey));
    }
  });

  it('end-of-line direct labels carry the rendered stroke color', () => {
    const layout = compileChart(
      lineSpec({
        legend: { show: false },
        endpointLabels: false,
        labels: { density: 'all' },
      } as Partial<ChartSpec>),
      SIZE,
    );
    const lines = layout.marks.filter((m): m is LineMark => m.type === 'line');
    const labelled = lines.filter((l) => l.label);

    expect(labelled.length).toBeGreaterThan(0);
    for (const line of labelled) {
      expect(line.label!.style.fill).toBe(line.stroke);
    }
  });
});

describe('donut centerLabel', () => {
  const donutSpec = (centerLabel: unknown): ChartSpec =>
    ({
      mark: { type: 'arc', innerRadius: 0.6, centerLabel },
      data: [
        { category: 'A', value: 40 },
        { category: 'B', value: 60 },
      ],
      encoding: {
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'category', type: 'nominal' },
      },
    }) as ChartSpec;

  it('emits one decorative text mark for the string form', () => {
    const layout = compileChart(donutSpec('$4.2M'), SIZE);
    const texts = layout.marks.filter((m): m is TextMarkLayout => m.type === 'textMark');

    expect(texts).toHaveLength(1);
    expect(texts[0].text).toBe('$4.2M');
    expect(texts[0].textAnchor).toBe('middle');
    expect(texts[0].aria.decorative).toBe(true);
  });

  it('emits value + caption for the object form, stacked on the hole', () => {
    const layout = compileChart(donutSpec({ text: '$4.2M', subtitle: 'Total revenue' }), SIZE);
    const texts = layout.marks.filter((m): m is TextMarkLayout => m.type === 'textMark');

    expect(texts.map((t) => t.text)).toEqual(['$4.2M', 'Total revenue']);
    expect(texts[1].y).toBeGreaterThan(texts[0].y);
    expect(texts[1].fontSize).toBeLessThan(texts[0].fontSize);
  });

  it('emits nothing when centerLabel is absent', () => {
    const layout = compileChart(donutSpec(undefined), SIZE);
    expect(layout.marks.some((m) => m.type === 'textMark')).toBe(false);
  });
});
