import type { ChartSpec, LayerSpec } from '@opendata-ai/openchart-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Count compile entries through the validate/normalize stage every chart
// compile passes exactly once. A re-entered compile shows up as a second call.
// Pass-through wrapper: a re-entered compile returns the same layout, so the
// entry count is the only direct signal for this single-pass invariant.
const entries = vi.hoisted(() => ({ count: 0 }));
vi.mock('../compiler/index', async (importOriginal) => {
  const original = await importOriginal<typeof import('../compiler/index')>();
  return {
    ...original,
    compile: (...args: Parameters<typeof original.compile>) => {
      entries.count++;
      return original.compile(...args);
    },
  };
});

const { compileChart, compileLayer } = await import('../compile');

const annotated: ChartSpec = {
  mark: 'line',
  data: [
    { x: 0, y: 1 },
    { x: 1, y: 3 },
    { x: 2, y: 2 },
  ],
  encoding: { x: { field: 'x', type: 'ordinal' }, y: { field: 'y', type: 'quantitative' } },
  chrome: { title: 'Annotated', source: 'Source' },
  annotations: [
    { type: 'text', x: 1, y: 3, text: 'Peak' },
    { type: 'text', x: 2, y: 2, text: 'Settles' },
  ],
};

const shortFacet: ChartSpec = {
  mark: 'point',
  data: ['A', 'B', 'C', 'D'].flatMap((group) => [
    { x: 0, y: 0, group },
    { x: 10, y: 10, group },
  ]),
  encoding: {
    x: { field: 'x', type: 'quantitative' },
    y: { field: 'y', type: 'quantitative' },
    facet: { field: 'group', type: 'nominal', columns: 1 },
  },
  chrome: { title: 'Short facet', source: 'Source' },
  annotations: [
    { type: 'text', x: 3, y: 3, text: 'First' },
    { type: 'text', x: 6, y: 6, text: 'Second' },
  ],
};

const dualAxis: LayerSpec = {
  resolve: { scale: { y: 'independent' } },
  endpointLabels: { content: 'label' },
  annotations: [
    { type: 'text', x: 'Jan', y: 120, text: 'Bars start' },
    { type: 'text', x: 'Feb', y: 140, text: 'Bars end' },
  ],
  layer: [
    {
      mark: 'bar',
      data: [
        { x: 'Jan', y: 100 },
        { x: 'Feb', y: 150 },
      ],
      encoding: { x: { field: 'x', type: 'ordinal' }, y: { field: 'y', type: 'quantitative' } },
    },
    {
      mark: 'line',
      data: [
        { x: 'Jan', y: 2, s: 'Alpha' },
        { x: 'Feb', y: 5, s: 'Alpha' },
        { x: 'Jan', y: 6, s: 'Beta' },
        { x: 'Feb', y: 4, s: 'Beta' },
      ],
      encoding: {
        x: { field: 'x', type: 'ordinal' },
        y: { field: 'y', type: 'quantitative' },
        color: { field: 's', type: 'nominal' },
      },
    },
  ],
};

beforeEach(() => {
  entries.count = 0;
});

/** Annotated chart that also trips one sugar and one normalize warning. */
const warned = {
  ...annotated,
  $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
  encoding: { ...annotated.encoding, y: { field: 'y' } },
} as unknown as ChartSpec;

describe('single-pass compile', () => {
  it('enters compile once for an annotated chart', () => {
    const layout = compileChart(annotated, { width: 600, height: 400 });
    expect(layout.chrome.noteBandHeight).toBeGreaterThan(0);
    expect(entries.count).toBe(1);
  });

  it('re-solves a short facet at its grown height inside one compile', () => {
    const layout = compileChart(shortFacet, { width: 390, height: 200 });
    expect(layout.chrome.grownHeight).toBeGreaterThan(0);
    expect(entries.count).toBe(1);
  });

  it('compiles each dual-axis leaf once to measure and once frozen', () => {
    const layout = compileLayer(dualAxis, { width: 640, height: 400 });
    expect(layout.endpointLabels?.entries.length).toBeGreaterThan(0);
    expect(entries.count).toBe(4);
  });

  it('emits dual-axis leaf warnings once', () => {
    const warnings: string[] = [];
    const [bars, lines] = dualAxis.layer as ChartSpec[];
    compileLayer(
      {
        ...dualAxis,
        layer: [
          { ...bars, encoding: { ...bars.encoding, y: { field: 'y' } } } as ChartSpec,
          { ...lines, encoding: { ...lines.encoding, y: { field: 'y' } } } as ChartSpec,
        ],
      },
      { width: 640, height: 400, onWarn: (m) => warnings.push(m) },
    );
    // One per leaf: the primary (bars) and the secondary (lines) each infer y.
    expect(warnings.filter((m) => m.includes('Inferred encoding.y.type'))).toHaveLength(2);
  });

  it('emits sugar and normalize warnings once for an annotated chart', () => {
    const warnings: string[] = [];
    compileChart(warned, { width: 600, height: 400, onWarn: (m) => warnings.push(m) });
    expect(warnings.filter((m) => m.includes('$schema'))).toHaveLength(1);
    expect(warnings.filter((m) => m.includes('Inferred encoding.y.type'))).toHaveLength(1);
  });
});

describe('note overflow without re-entry', () => {
  // A host measure whose wrapping is not monotone in the note ordinal: note 2
  // wraps far wider than the widest-ordinal capacity predicted.
  const measureText = (text: string, fontSize: number) => ({
    width: text.startsWith('2. ') && text.length > 3 ? 10_000 : text.length * fontSize * 0.55,
    height: fontSize,
  });
  const crowded: ChartSpec = {
    ...annotated,
    data: Array.from({ length: 8 }, (_, x) => ({ x, y: x % 3 })),
    annotations: Array.from({ length: 6 }, (_, x) => ({
      type: 'text' as const,
      x,
      y: x % 3,
      text: `Callout number ${x} with words`,
    })),
  };

  it('grows the figure by the overflow when notes sit outside the budget', () => {
    const layout = compileChart(crowded, { width: 200, height: 340, measureText });
    expect(entries.count).toBe(1);
    expect(layout.chrome.footnotes?.length ?? 0).toBeGreaterThan(1);
    const band = layout.chrome.noteBandHeight!;
    const monotone = compileChart(crowded, {
      width: 200,
      height: 340,
      measureText: (text, fontSize) => ({ width: text.length * fontSize * 0.55, height: fontSize }),
    });
    // The overflow grew only the figure; the plot stayed where the reserve put it.
    expect(band).toBeGreaterThan(monotone.chrome.noteBandHeight!);
    expect(layout.area).toEqual(monotone.area);
    expect(layout.dimensions.height).toBeCloseTo(340 + band, 8);
    expect(layout.chrome.grownHeight).toBeCloseTo(band, 8);
  });

  it('keeps a subtract figure fixed and reports the overflow', () => {
    const diagnostics: string[] = [];
    const layout = compileChart(
      { ...crowded, chromeLayout: 'subtract' },
      { width: 200, height: 340, measureText, onDiagnostic: (d) => diagnostics.push(d.code) },
    );
    expect(entries.count).toBe(1);
    expect(layout.dimensions.height).toBe(340);
    expect(layout.area.height).toBeGreaterThan(0);
    expect(diagnostics).toContain('layout.note-capacity');
  });

  it('reports a subtract layer overflow once', () => {
    const { annotations, ...leaf } = crowded;
    const diagnostics: string[] = [];
    const layout = compileLayer({ layer: [leaf], annotations } as LayerSpec, {
      width: 200,
      height: 340,
      measureText,
      chromeLayout: 'subtract',
      onDiagnostic: (d) => diagnostics.push(d.code),
    });
    expect(layout.dimensions.height).toBe(340);
    expect(layout.area.height).toBeGreaterThan(0);
    expect(diagnostics.filter((code) => code === 'layout.note-capacity')).toHaveLength(1);
  });
});
