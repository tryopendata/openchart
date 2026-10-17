import type { ChartSpec, TextAnnotation } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../compile';
import { migrateSpecV8 } from '../../migration/v8';

const base: ChartSpec = {
  mark: 'point',
  data: [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
  ],
  encoding: { x: { field: 'x', type: 'quantitative' }, y: { field: 'y', type: 'quantitative' } },
  chrome: { title: 'A figure', source: 'Source' },
  animation: false,
};
const text: TextAnnotation = {
  type: 'text',
  x: 5,
  y: 5,
  text: 'A long **annotation phrase** that needs to wrap across several lines',
  subtitle: 'Supporting context',
  connector: 'curve',
  responsive: false,
  anchor: 'left',
  offset: { dx: -30, dy: -90 },
};

describe('v9 annotation defaults', () => {
  it('places automatic text around the measured label of a range band', () => {
    for (const y of [8, 9, 10]) {
      const layout = compileChart(
        {
          ...base,
          annotations: [
            { type: 'range', x1: 2, x2: 8, label: 'A labeled interval near the peak' },
            { type: 'text', x: 5, y, text: 'Peak value', subtitle: 'Supporting context' },
          ],
        },
        { width: 800, height: 500 },
      );
      const range = layout.annotations.find((a) => a.type === 'range')!;
      const text = layout.annotations.find((a) => a.type === 'text')!;
      expect(range.bounds).toBeDefined();
      const a = range.bounds!;
      const b = text.bounds!;
      expect(
        Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 &&
          Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1,
      ).toBe(false);
    }
  });
  it('uses regular text, a 12/13 subtitle, bounded wrapping, and a quiet curve with a marker', () => {
    const a = compileChart({ ...base, annotations: [text] }, { width: 800, height: 600 })
      .annotations[0];
    expect(a.label!.style.fontWeight).toBe(400);
    expect(a.subtitle!.style.fontSize).toBe(12);
    expect(a.label!.lines!.length).toBeGreaterThan(1);
    expect(a.bounds!.width).toBeLessThanOrEqual(240);
    expect(a.label!.connector!.arrow).toBe(false);
    expect(a.dot).toBeDefined();
    expect(a.label!.text).toBe(text.text);
  });
  it('materialized v8 styling keeps the former text, arrow, and wrapping choices', () => {
    const migrated = migrateSpecV8({ ...base, annotations: [text] }).spec as ChartSpec;
    const a = compileChart(migrated, { width: 800, height: 600 }).annotations[0];
    expect(a.label!.style.fontWeight).toBe(700);
    expect(a.subtitle!.style.fontSize).toBe(11);
    expect(a.label!.lines).toBeUndefined();
    expect(a.label!.connector!.arrow).toBe(true);
  });
  it('retains source text ordinals through filtering, priority and facet duplication', () => {
    const annotations: ChartSpec['annotations'] = [
      { type: 'text', x: 'missing', y: 100, text: 'Unresolved position' },
      { type: 'refline', y: 4, label: 'Rule' },
      { type: 'text', x: 3, y: 3, text: '**Second**', subtitle: '**Context**', priority: 20 },
      { type: 'text', x: 7, y: 7, text: 'Third', priority: 1 },
    ];
    for (const facet of [false, true]) {
      const spec: ChartSpec = {
        ...base,
        annotations,
        responsive: { compactAnnotationLimit: 0 },
        ...(facet
          ? {
              data: ['A', 'B'].flatMap((group) => base.data.map((row) => ({ ...row, group }))),
              encoding: {
                ...base.encoding,
                facet: { field: 'group', type: 'nominal', columns: 2 },
              },
            }
          : {}),
      };
      const layout = compileChart(spec, { width: 390, height: 700 });
      expect(layout.chrome.footnotes!.map((n) => n.index)).toEqual([2, 3]);
      expect(layout.chrome.footnotes![0]).toMatchObject({
        text: '**Second**',
        subtitle: '**Context**',
      });
      expect(layout.chrome.footnotes![0].spans!.flat().some((s) => s.bold)).toBe(true);
    }
  });
  it.each([false, true])('grows only the note band by default (facet=%s)', (facet) => {
    const spec: ChartSpec = {
      ...base,
      annotations: [
        { ...text, responsive: undefined },
        { ...text, x: 7 },
      ],
      ...(facet
        ? {
            data: ['A', 'B'].flatMap((group) => base.data.map((row) => ({ ...row, group }))),
            encoding: { ...base.encoding, facet: { field: 'group', type: 'nominal', columns: 2 } },
          }
        : {}),
    };
    const options = { width: 800, height: 800 };
    const current = compileChart(spec, options);
    const subtract = compileChart({ ...spec, chromeLayout: 'subtract' }, options);
    expect(current.chrome.grownHeight).toBeCloseTo(current.chrome.noteBandHeight!);
    expect(current.dimensions.height).toBe(options.height + current.chrome.noteBandHeight!);
    expect(current.area.height - subtract.area.height).toBeCloseTo(current.chrome.noteBandHeight!);
  });
});

it('keeps auto-placed subtitle blocks clear of their own point markers', () => {
  const layout = compileChart(
    {
      ...base,
      annotations: [
        {
          type: 'text',
          x: 5,
          y: 8,
          text: 'Callout',
          subtitle: 'Context for the observation',
          maxWidth: 130,
          connector: 'curve',
        },
      ],
    },
    { width: 1280, height: 850 },
  );
  const a = layout.annotations[0];
  const point = a.label!.connector?.endpoint ?? a.dot!;
  const b = a.bounds!;
  expect(
    point.x >= b.x && point.x <= b.x + b.width && point.y >= b.y && point.y <= b.y + b.height,
  ).toBe(false);
});
