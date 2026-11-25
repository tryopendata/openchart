import type { ChartLayout, ChartSpec, RectMark } from '@opendata-ai/openchart-core';
import { estimateTextWidth } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../../compile';

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
