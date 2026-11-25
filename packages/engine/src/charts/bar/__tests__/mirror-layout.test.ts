import type { ChartLayout, ChartSpec, RectMark, TextMarkLayout } from '@opendata-ai/openchart-core';
import { estimateTextWidth } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../../compile';
import { validateSpec } from '../../../compiler/validate';

const ageGroups = ['Under five', 'Five to fourteen', 'Fifteen to twenty-four', 'Twenty-five plus'];

const data = ageGroups.flatMap((age, index) => [
  { age, sex: 'Male', pop: 4_100_000 + index * 950_000 },
  { age, sex: 'Female', pop: 3_900_000 + index * 1_100_000 },
]);

function pyramid(mirror: boolean, labels: ChartSpec['labels'] = { density: 'none' }): ChartSpec {
  return {
    mark: mirror ? { type: 'bar', mirror: true } : { type: 'bar' },
    data,
    labels,
    encoding: {
      y: { field: 'age', type: 'nominal', sort: ageGroups },
      x: { field: 'pop', type: 'quantitative' },
      color: { field: 'sex', type: 'nominal', sort: ['Male', 'Female'] },
    },
  };
}

function compile(spec: ChartSpec, width: number, axisTick = 12): ChartLayout {
  const theme = { fonts: { sizes: { axisTick } } };
  return compileChart({ ...spec, theme }, { width, height: 420, onWarn: () => {} });
}

function rects(layout: ChartLayout): RectMark[] {
  return layout.marks.filter((mark): mark is RectMark => mark.type === 'rect');
}

describe('mirrored bar layout', () => {
  it('does not reserve a y tick label gutter on the left of the plot', () => {
    const mirrored = compile(pyramid(true), 800);
    const ordinary = compile(pyramid(false), 800);
    const leftInset = mirrored.area.x;
    const rightInset = 800 - (mirrored.area.x + mirrored.area.width);
    // The category labels live in the center gutter, so the plot sits evenly in the chart.
    expect(leftInset).toBeCloseTo(rightInset, 0);
    expect(ordinary.area.x - mirrored.area.x).toBeGreaterThan(
      estimateTextWidth('Fifteen to twenty-four', 12, 400) / 2,
    );
  });

  it.each([
    [360, 12],
    [360, 14],
    [800, 12],
    [800, 14],
  ])('keeps every outer value label inside a %ipx chart (axisTick %i)', (width, axisTick) => {
    const layout = compile(pyramid(true, { density: 'all' }), width, axisTick);
    const labelled = rects(layout).filter((mark) => mark.label?.visible);
    expect(labelled).toHaveLength(data.length);
    for (const mark of labelled) {
      const label = mark.label!;
      const textWidth = estimateTextWidth(
        label.text,
        label.style.fontSize,
        label.style.fontWeight ?? 600,
      );
      if (label.style.textAnchor === 'end') {
        expect(label.x).toBeLessThan(mark.x);
        expect(label.x - textWidth).toBeGreaterThanOrEqual(0);
      } else {
        expect(label.x).toBeGreaterThan(mark.x + mark.width);
        expect(label.x + textWidth).toBeLessThanOrEqual(width);
      }
    }
  });
});

type Row = { age: string; sex?: string | null; pop: number };

function twoSided(rows: Row[], x: Record<string, unknown> = {}): ChartSpec {
  return {
    mark: { type: 'bar', mirror: true },
    data: rows,
    labels: { density: 'all' },
    encoding: {
      y: { field: 'age', type: 'nominal' },
      x: { field: 'pop', type: 'quantitative', ...x },
      color: { field: 'sex', type: 'nominal', sort: ['Male', 'Female'] },
    },
  } as ChartSpec;
}

function bar(layout: ChartLayout, sex: string, age: string): RectMark {
  const found = rects(layout).find((mark) => mark.data.sex === sex && mark.data.age === age);
  if (!found) throw new Error(`no ${sex} bar for ${age}`);
  return found;
}

/** The two inner edges, read from where each half's bars start. */
function innerEdges(layout: ChartLayout): [number, number] {
  return [bar(layout, 'Male', 'B').baseline!, bar(layout, 'Female', 'B').baseline!];
}

function zeroTickPositions(layout: ChartLayout): number[] {
  return (layout.axes.x?.ticks ?? [])
    .filter((tick) => tick.label === '0')
    .map((tick) => tick.position)
    .sort((a, b) => a - b);
}

describe('mirrored bar value mapping', () => {
  const signed: Row[] = [
    { age: 'A', sex: 'Male', pop: -50 },
    { age: 'A', sex: 'Female', pop: 40 },
    { age: 'B', sex: 'Male', pop: 100 },
    { age: 'B', sex: 'Female', pop: 0 },
  ];

  it.each([
    ['the default scale', {}],
    ['scale.zero false', { scale: { zero: false } }],
    ['an authored domain [10, 100]', { scale: { domain: [10, 100] } }],
  ])('keeps 0 at both inner edges with negative data and %s', (_label, x) => {
    const layout = compile(twoSided(signed, x), 640);
    const [maleInner, femaleInner] = innerEdges(layout);
    expect(zeroTickPositions(layout)).toEqual([
      expect.closeTo(maleInner, 1),
      expect.closeTo(femaleInner, 1),
    ]);
    const labels = (layout.axes.x?.ticks ?? []).map((tick) => tick.label);
    expect(labels.filter((label) => /^[-−]/.test(label))).toEqual([]);
    expect(bar(layout, 'Female', 'B').width).toBe(0);
    // The negative Male bar collapses to its inner edge; its label reads outward, not into the gutter.
    const negative = bar(layout, 'Male', 'A');
    expect(negative.width).toBe(0);
    expect(negative.label?.style.textAnchor).toBe('end');
    expect(negative.label?.x).toBeLessThan(maleInner);
  });

  it('draws all-zero data as zero-length bars with a single 0 tick per half', () => {
    const zeros = signed.map((row) => ({ ...row, pop: 0 }));
    const layout = compile(twoSided(zeros), 640);
    expect(rects(layout).map((mark) => mark.width)).toEqual([0, 0, 0, 0]);
    const [maleInner, femaleInner] = innerEdges(layout);
    expect(layout.axes.x?.ticks.map((tick) => tick.label)).toEqual(['0', '0']);
    expect(zeroTickPositions(layout)).toEqual([
      expect.closeTo(maleInner, 1),
      expect.closeTo(femaleInner, 1),
    ]);
  });
});

describe('mirrored bar inputs', () => {
  it('accepts a horizontal mirror whose field types are left to inference', () => {
    const spec = {
      mark: { type: 'bar', mirror: true },
      data,
      encoding: { y: { field: 'age' }, x: { field: 'pop' }, color: { field: 'sex' } },
    };
    expect(validateSpec(spec).errors).toEqual([]);
  });

  it('ignores rows with no color value when counting and drawing the two sides', () => {
    const rows: Row[] = [
      { age: 'A', sex: 'Male', pop: 10 },
      { age: 'A', sex: 'Female', pop: 12 },
      { age: 'B', pop: 7 },
      { age: 'B', sex: null, pop: 3 },
    ];
    const spec = twoSided(rows);
    expect(validateSpec(spec).errors).toEqual([]);
    const layout = compile(spec, 640);
    expect(rects(layout).map((mark) => mark.data.sex)).toEqual(['Male', 'Female']);
    const halves = layout.marks.filter(
      (mark): mark is TextMarkLayout => mark.type === 'textMark' && mark.y < layout.area.y,
    );
    expect(halves.map((mark) => mark.text)).toEqual(['Male', 'Female']);
  });

  it('never cuts the widest label of a gutter sized to fit it', () => {
    const ages = ['0-4', '5-9', '10-14', '95-99', '100+'];
    const rows = ages.flatMap((age, index) => [
      { age, sex: 'Male', pop: 2000 - index * 300 },
      { age, sex: 'Female', pop: 1900 - index * 280 },
    ]);
    for (const width of [360, 800]) {
      const labels = compile(twoSided(rows), width).marks.filter(
        (mark): mark is TextMarkLayout => mark.type === 'textMark' && 'category' in mark.data,
      );
      expect(labels.map((mark) => mark.text)).toEqual(labels.map((mark) => mark.data.category));
    }
  });

  it('cuts a category label that is wider than the capped gutter at 360px', () => {
    const name = 'Bosnia and Herzegovina';
    const rows: Row[] = [
      { age: name, sex: 'Male', pop: 1_700_000 },
      { age: name, sex: 'Female', pop: 1_800_000 },
      { age: 'B', sex: 'Male', pop: 900_000 },
      { age: 'B', sex: 'Female', pop: 950_000 },
    ];
    const layout = compile(twoSided(rows), 360);
    const [gutterStart, gutterEnd] = innerEdges(layout);
    const label = layout.marks.find(
      (mark): mark is TextMarkLayout => mark.type === 'textMark' && mark.data.category === name,
    );
    expect(label?.text).toMatch(/…$/);
    expect(label?.aria.label).toBe(name);
    const drawn = estimateTextWidth(label!.text, label!.fontSize, label!.fontWeight);
    expect(drawn).toBeLessThanOrEqual(gutterEnd - gutterStart);
  });
});
