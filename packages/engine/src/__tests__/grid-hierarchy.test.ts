import { describe, expect, it } from 'vitest';
import { compileChart } from '../compile';

describe('authored zero gridline role', () => {
  const base = {
    mark: 'point',
    data: [
      { x: -1, y: -1 },
      { x: 2, y: 2 },
    ],
    encoding: { x: { field: 'x', type: 'quantitative' }, y: { field: 'y', type: 'quantitative' } },
  };
  it('changes only an existing zero rule and leaves scales intact', () => {
    const before = compileChart(base, { width: 640, height: 400 });
    const after = compileChart(
      { ...base, theme: { colors: { gridlineZero: '#778899' } } },
      { width: 640, height: 400 },
    );
    expect(after.axes.y?.ticks).toEqual(before.axes.y?.ticks);
    expect(after.area).toEqual(before.area);
    const zero = after.axes.y!.ticks.find((t) => t.value === 0)!;
    expect(after.axes.y!.gridlines.find((g) => g.position === zero.position)?.color).toBe(
      '#778899',
    );
    expect(
      after.axes
        .y!.gridlines.filter((g) => g.position !== zero.position)
        .every((g) => g.color === undefined),
    ).toBe(true);
  });
  it('does not add zero to a positive log domain', () => {
    const chart = compileChart(
      {
        ...base,
        data: [
          { x: 2, y: 10 },
          { x: 3, y: 100 },
        ],
        encoding: {
          ...base.encoding,
          y: { field: 'y', type: 'quantitative', scale: { type: 'log' } },
        },
        theme: { colors: { gridlineZero: '#778899' } },
      },
      { width: 640, height: 400 },
    );
    expect(chart.axes.y?.ticks.some((t) => t.value === 0)).toBe(false);
    expect(chart.axes.y?.gridlines.every((g) => g.color === undefined)).toBe(true);
  });
});
