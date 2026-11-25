import type { ChartLayout, ChartSpec, RectMark, TextMarkLayout } from '@opendata-ai/openchart-core';
import { resolveTheme } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../../compile';
import { mirrorGeometry } from '../mirror';

const data = [
  { age: '0-4', sex: 'Male', pop: 200 },
  { age: '0-4', sex: 'Female', pop: 100 },
  { age: '5-9', sex: 'Male', pop: 150 },
  { age: '5-9', sex: 'Female', pop: 150 },
  { age: '10-14', sex: 'Male', pop: 50 },
  { age: '10-14', sex: 'Female', pop: 60 },
];

function pyramid(overrides: Partial<ChartSpec> = {}): ChartSpec {
  return {
    mark: { type: 'bar', mirror: true },
    data,
    encoding: {
      y: { field: 'age', type: 'ordinal' },
      x: { field: 'pop', type: 'quantitative' },
      color: { field: 'sex', type: 'nominal', sort: ['Male', 'Female'] },
    },
    ...overrides,
  };
}

const options = { width: 640, height: 420, onWarn: () => {} };

function compile(spec: ChartSpec): ChartLayout {
  return compileChart(spec, options);
}

function rects(layout: ChartLayout): RectMark[] {
  return layout.marks.filter((mark): mark is RectMark => mark.type === 'rect');
}

function texts(layout: ChartLayout): TextMarkLayout[] {
  return layout.marks.filter((mark): mark is TextMarkLayout => mark.type === 'textMark');
}

function bySex(layout: ChartLayout, sex: string): RectMark[] {
  return rects(layout).filter((mark) => mark.data.sex === sex);
}

function bar(layout: ChartLayout, sex: string, age: string): RectMark {
  const found = bySex(layout, sex).find((mark) => mark.data.age === age);
  if (!found) throw new Error(`no ${sex} bar for ${age}`);
  return found;
}

const right = (mark: RectMark) => mark.x + mark.width;

describe('mirrored bars', () => {
  it('draws the first color value left of the second, by the color sort', () => {
    const layout = compile(pyramid());
    const male = bySex(layout, 'Male');
    const female = bySex(layout, 'Female');
    expect(male).toHaveLength(3);
    expect(female).toHaveLength(3);
    const maleRightEdge = Math.max(...male.map(right));
    const femaleLeftEdge = Math.min(...female.map((mark) => mark.x));
    expect(maleRightEdge).toBeLessThan(femaleLeftEdge);
    // Each half grows outward from one shared inner edge.
    expect(new Set(male.map((mark) => Math.round(right(mark))))).toHaveProperty('size', 1);
    expect(new Set(female.map((mark) => Math.round(mark.x)))).toHaveProperty('size', 1);
  });

  it('puts the first-seen color value on the left without a color sort', () => {
    const femaleFirst = [...data].sort((a) => (a.sex === 'Female' ? -1 : 1));
    const layout = compile(
      pyramid({
        data: femaleFirst,
        encoding: {
          y: { field: 'age', type: 'ordinal' },
          x: { field: 'pop', type: 'quantitative' },
          color: { field: 'sex', type: 'nominal' },
        },
      }),
    );
    expect(Math.max(...bySex(layout, 'Female').map(right))).toBeLessThan(
      Math.min(...bySex(layout, 'Male').map((mark) => mark.x)),
    );
  });

  it('sizes both halves on one symmetric [0, max] domain', () => {
    const layout = compile(pyramid());
    // 150 on each side draws the same length.
    expect(bar(layout, 'Male', '5-9').width).toBeCloseTo(bar(layout, 'Female', '5-9').width, 5);
    // The Female 100 bar is half the Male 200 bar, so both share one domain.
    expect(bar(layout, 'Female', '0-4').width * 2).toBeCloseTo(bar(layout, 'Male', '0-4').width, 5);
  });

  it('labels value ticks on both halves with absolute values and 0 at each inner edge', () => {
    const layout = compile(pyramid());
    const ticks = layout.axes.x?.ticks ?? [];
    const zeros = ticks.filter((tick) => tick.label === '0');
    expect(zeros).toHaveLength(2);
    const maleInner = right(bar(layout, 'Male', '0-4'));
    const femaleInner = bar(layout, 'Female', '0-4').x;
    expect(zeros.map((tick) => tick.position).sort((a, b) => a - b)).toEqual([
      expect.closeTo(maleInner, 1),
      expect.closeTo(femaleInner, 1),
    ]);
    expect(ticks.every((tick) => !tick.label.startsWith('-') && !tick.label.startsWith('−'))).toBe(
      true,
    );
    // Every nonzero label appears once per half.
    const counts = new Map<string, number>();
    for (const tick of ticks) counts.set(tick.label, (counts.get(tick.label) ?? 0) + 1);
    expect([...counts.values()].every((count) => count === 2)).toBe(true);
    expect(layout.axes.x?.domainLine).toBe(false);
  });

  it('hides the category axis and centers the category labels in the gutter', () => {
    const layout = compile(pyramid());
    expect(layout.axes.y).toBeUndefined();
    const gutterStart = right(bar(layout, 'Male', '0-4'));
    const gutterEnd = bar(layout, 'Female', '0-4').x;
    const center = (gutterStart + gutterEnd) / 2;
    for (const age of ['0-4', '5-9', '10-14']) {
      const label = texts(layout).find((mark) => mark.text === age);
      expect(label, `label for ${age}`).toBeDefined();
      expect(label?.textAnchor).toBe('middle');
      expect(label?.x).toBeCloseTo(center, 0);
      // Each label sits on its row of bars.
      const row = bar(layout, 'Male', age);
      expect(label?.y).toBeGreaterThanOrEqual(row.y);
      expect(label?.y).toBeLessThanOrEqual(row.y + row.height);
    }
  });

  it('labels the two halves above the plot and draws no legend', () => {
    const layout = compile(pyramid());
    const male = texts(layout).find((mark) => mark.text === 'Male');
    const female = texts(layout).find((mark) => mark.text === 'Female');
    expect(male?.y).toBeLessThan(layout.area.y);
    expect(female?.y).toBeLessThan(layout.area.y);
    expect(male?.x).toBeLessThan(female?.x ?? 0);
    expect(layout.legend.entries).toEqual([]);
  });

  it('places value labels outside the outer end of each bar', () => {
    const layout = compile(pyramid({ labels: { density: 'all' } }));
    for (const mark of bySex(layout, 'Male')) {
      expect(mark.label?.visible).toBe(true);
      expect(mark.label?.x).toBeLessThan(mark.x);
    }
    for (const mark of bySex(layout, 'Female')) {
      expect(mark.label?.visible).toBe(true);
      expect(mark.label?.x).toBeGreaterThan(right(mark));
    }
  });

  it('leaves ordinary bars with a color field stacked and legended', () => {
    const layout = compile(pyramid({ mark: 'bar' }));
    expect(layout.legend.entries.length).toBe(2);
    expect(layout.axes.y).toBeDefined();
    const male = bar(layout, 'Male', '0-4');
    const female = bar(layout, 'Female', '0-4');
    expect(Math.min(male.x, female.x)).toBeCloseTo(layout.area.x, 0);
  });
});

describe('mirrorGeometry', () => {
  const theme = resolveTheme();
  const area = { x: 40, y: 30, width: 600, height: 300 };
  const measure = (text: string) => ({ width: text.length * 10, height: 12 });

  it('splits the plot into equal halves around a gutter that spans the plot', () => {
    const geometry = mirrorGeometry(area, ['0-4', '85+'], measure, theme);
    expect(geometry.left.start).toBeCloseTo(area.x, 5);
    expect(geometry.right.end).toBeCloseTo(area.x + area.width, 5);
    expect(geometry.left.end).toBeCloseTo(geometry.gutter.start, 5);
    expect(geometry.gutter.end).toBeCloseTo(geometry.right.start, 5);
    expect(geometry.left.end - geometry.left.start).toBeCloseTo(
      geometry.right.end - geometry.right.start,
      5,
    );
  });

  it('sizes the gutter from the widest category label', () => {
    const narrow = mirrorGeometry(area, ['0-4', '5-9'], measure, theme);
    const wide = mirrorGeometry(area, ['0-4', 'Fifteen chars!!'], measure, theme);
    const width = (g: typeof narrow) => g.gutter.end - g.gutter.start;
    expect(width(narrow)).toBeGreaterThanOrEqual(30);
    expect(width(wide) - width(narrow)).toBeCloseTo(120, 5);
  });
});
