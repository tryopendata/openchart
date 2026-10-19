import type { ChartSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../compile';

const spec: ChartSpec = {
  mark: 'point',
  data: [
    { x: 0, y: 0, group: 'A' },
    { x: 10, y: 10, group: 'A' },
    { x: 0, y: 0, group: 'B' },
    { x: 10, y: 10, group: 'B' },
  ],
  encoding: {
    x: { field: 'x', type: 'quantitative' },
    y: { field: 'y', type: 'quantitative' },
    facet: { field: 'group', type: 'nominal', columns: 2 },
  },
  chrome: { title: 'Two panels', source: 'Source' },
  annotations: [
    { type: 'text', id: 'one', x: 3, y: 3, text: 'First', subtitle: 'Detail' },
    { type: 'text', id: 'two', x: 6, y: 6, text: 'Second' },
  ],
  responsive: { compactAnnotationLimit: 0 },
};
describe('facet chrome growth', () => {
  it('appends one chrome/note band while preserving the non-chrome plot budget', () => {
    const subtract = compileChart(
      { ...spec, chromeLayout: 'subtract' },
      { width: 390, height: 650 },
    );
    const grow = compileChart({ ...spec, chromeLayout: 'grow' }, { width: 390, height: 650 });
    const added =
      grow.chrome.topHeight + grow.chrome.bottomHeight + (grow.chrome.noteBandHeight ?? 0);
    expect(grow.dimensions.height).toBeCloseTo(650 + added);
    expect(grow.chrome.grownHeight).toBeCloseTo(added);
    expect(grow.area.height - subtract.area.height).toBeCloseTo(added);
    expect(grow.chrome.footnotes).toHaveLength(2);
    expect(
      grow.facet!.panels.every((panel) => panel.annotations.every((a) => a.footnoteIndex)),
    ).toBe(true);
  });
  it('grows only notes by default and accepts the compile option', () => {
    const opts = { width: 800, height: 650 };
    const defaultLayout = compileChart(spec, opts);
    const subtract = compileChart({ ...spec, chromeLayout: 'subtract' }, opts);
    expect(defaultLayout.dimensions.height - subtract.dimensions.height).toBeCloseTo(
      defaultLayout.chrome.noteBandHeight ?? 0,
    );
    expect(defaultLayout.chrome.grownHeight ?? 0).toBeCloseTo(
      defaultLayout.chrome.noteBandHeight ?? 0,
    );
    expect(compileChart(spec, { ...opts, chromeLayout: 'grow' })).toEqual(
      compileChart({ ...spec, chromeLayout: 'grow' }, opts),
    );
  });
});

it('reports all engine-owned growth for short multi-row facets', () => {
  const input: ChartSpec = {
    ...spec,
    chromeLayout: 'grow',
    encoding: { ...spec.encoding, facet: { ...spec.encoding.facet!, columns: 1 } },
  };
  const result = compileChart(input, { width: 390, height: 200 });
  expect(result.chrome.grownHeight).toBeCloseTo(result.dimensions.height - 200);
});

it('grows an authored-height facet budget and reports actual added height', () => {
  const input: ChartSpec = {
    ...spec,
    height: 200,
    chromeLayout: 'grow',
    encoding: { ...spec.encoding, facet: { ...spec.encoding.facet!, columns: 1 } },
  };
  const result = compileChart(input, { width: 390, height: 600 });
  const inferred = compileChart({ ...input, height: undefined }, { width: 390, height: 200 });
  expect(result.dimensions.height).toBe(inferred.dimensions.height);
  expect(result.chrome.grownHeight).toBeCloseTo(result.dimensions.height - 200);
});
