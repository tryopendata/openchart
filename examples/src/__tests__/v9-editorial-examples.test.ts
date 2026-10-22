/// <reference types="vite/client" />
import type { ChartSpec, LineMark, RectMark } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../../packages/engine/src/compile';

const modules = import.meta.glob(
  [
    '../gallery/charts-bar-column.stories.tsx',
    '../gallery/charts-line-area.stories.tsx',
    '../gallery/features-annotations.stories.tsx',
    '../gallery/showcase.stories.tsx',
    '../gallery/welcome.stories.tsx',
    '../testing/fixtures-bars.stories.tsx',
  ],
  { eager: true },
) as Record<string, { __authoredValues: Record<string, ChartSpec> }>;
const specFor = (file: string, name: string) =>
  modules[`../${file}.stories.tsx`].__authoredValues[name];

const populationExamples = [
  ['gallery/charts-bar-column', 'simpleBarsSpec'],
  ['gallery/showcase', 'fullChromeSpec'],
  ['testing/fixtures-bars', 'populationBarSpec'],
] as const;
const amazonExamples = [
  ['gallery/charts-line-area', 'fiveSeriesSpec'],
  ['gallery/showcase', 'multiLineSpec'],
  ['gallery/welcome', 'heroSpec'],
] as const;

describe('v9 authored editorial choices', () => {
  it.each(
    populationExamples,
  )('%s uses flat ranked population bars with explicit India/China emphasis', (file, name) => {
    const original = specFor(file, name);
    const spec = { ...original, data: [...original.data].reverse() } as ChartSpec;
    const before = JSON.stringify(spec.data);
    expect(spec.encoding.color).toMatchObject({ field: 'country', highlight: ['India', 'China'] });
    const layout = compileChart(spec, { width: 700, height: 500, onWarn: () => {} });
    expect(JSON.stringify(spec.data)).toBe(before);
    const bars = layout.marks
      .filter((mark): mark is RectMark => mark.type === 'rect')
      .sort((a, b) => a.y - b.y);
    expect(bars.map((bar) => bar.data.population)).toEqual(
      [...bars.map((bar) => Number(bar.data.population))].sort((a, b) => b - a),
    );
    expect(bars.map((bar) => bar.data.country).slice(0, 2)).toEqual(['India', 'China']);
    expect(bars.every((bar) => typeof bar.fill === 'string')).toBe(true);
    expect(bars[0].fill).not.toBe(bars[2].fill);
    expect(bars[1].fill).not.toBe(bars[2].fill);
  });

  it.each(
    amazonExamples,
  )('%s focuses Amazon and identifies every comparison series at each width', (file, name) => {
    const spec = specFor(file, name);
    expect(spec.encoding.color).toMatchObject({
      field: 'company',
      scale: { domain: ['Amazon', 'Apple', 'Alphabet', 'Microsoft', 'Meta'] },
    });
    expect(spec.seriesStyles).toMatchObject({ Amazon: { strokeWidth: 3 } });
    const series = ['Alphabet', 'Amazon', 'Apple', 'Meta', 'Microsoft'];
    for (const width of [320, 390, 700, 701, 1280]) {
      const layout = compileChart(spec, { width, height: 460, onWarn: () => {} });
      const lines = layout.marks.filter((mark): mark is LineMark => mark.type === 'line');
      const amazon = lines.find((line) => line.seriesKey === 'Amazon')!;
      expect(lines).toHaveLength(5);
      expect(
        lines
          .filter((line) => line.seriesKey !== 'Amazon')
          .every((line) => line.stroke !== amazon.stroke && line.strokeWidth < amazon.strokeWidth),
      ).toBe(true);
      if (!('entries' in layout.legend)) throw new Error('Expected a categorical revenue legend');
      if (width <= 700) {
        expect(layout.endpointLabels).toBeUndefined();
        expect(layout.legend.position).toBe('top');
        expect(layout.legend.entries.map((entry) => entry.label).sort()).toEqual(series);
        expect(layout.legend.bounds.y + layout.legend.bounds.height).toBeLessThanOrEqual(
          layout.area.y,
        );
        for (const entry of layout.legend.entries) {
          expect(entry.color).toBe(lines.find((line) => line.seriesKey === entry.label)?.stroke);
        }
      } else {
        expect(layout.endpointLabels?.entries.map((entry) => entry.seriesKey).sort()).toEqual(
          series,
        );
        expect(layout.legend.entries).toHaveLength(0);
      }
    }
  });

  it('uses rule-relative placement instead of pixel offsets in reference-line examples', () => {
    for (const spec of [
      specFor('gallery/charts-bar-column', 'simpleBarsSpec'),
      specFor('gallery/showcase', 'fullChromeSpec'),
      specFor('testing/fixtures-bars', 'populationBarSpec'),
      specFor('gallery/charts-bar-column', 'columnsSpec'),
      specFor('gallery/features-annotations', 'reflineSpec'),
    ]) {
      const rules = spec.annotations!.filter(
        (annotation) => annotation.type === 'refline' && annotation.label,
      );
      expect(rules.length).toBeGreaterThan(0);
      for (const rule of rules) {
        expect(rule).not.toHaveProperty('labelOffset');
        expect(rule).toHaveProperty('labelPlacement');
      }
    }
  });
});
