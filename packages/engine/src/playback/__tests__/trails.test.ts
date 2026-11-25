import type { DataRow } from '@opendata-ai/openchart-core';
import { scaleLinear, scaleLog } from 'd3-scale';
import { describe, expect, it, vi } from 'vitest';
import type { FrozenChartFrame } from '../chart-types';
import { resolveTrailKeys, trailsAt } from '../trails';
import { bubbleMatrix, bubbleRows } from './chart-fixtures';

/** The two scales trails read, on a 1000 x 500 plot; the rest of the frame is unused here. */
function frameWith(logX: boolean): FrozenChartFrame {
  const x = logX
    ? scaleLog().domain([100, 10000]).range([0, 1000])
    : scaleLinear().domain([0, 10000]).range([0, 1000]);
  return {
    scales: {
      x: {
        scale: x,
        type: logX ? 'log' : 'linear',
        channel: { field: 'gdp', type: 'quantitative' },
      },
      y: {
        scale: scaleLinear().domain([0, 100]).range([500, 0]),
        type: 'linear',
        channel: { field: 'life', type: 'quantitative' },
      },
    },
  } as unknown as FrozenChartFrame;
}

const logFrame = frameWith(true);
const x = (value: number) => logFrame.scales.x?.scale(value as never) as number;
const y = (value: number) => logFrame.scales.y?.scale(value as never) as number;

describe('trailsAt', () => {
  // Avalon: gdp 120, 400, 1500; life 50, 55, 60.
  const matrix = bubbleMatrix();

  it('passes through every period position up to t and ends at the interpolated head', () => {
    const [trail] = trailsAt(matrix, logFrame, ['Avalon'], 1.5);
    expect(trail.key).toBe('Avalon');
    expect(trail.points).toEqual([
      { x: expect.closeTo(x(120), 6), y: expect.closeTo(y(50), 6) },
      { x: expect.closeTo(x(400), 6), y: expect.closeTo(y(55), 6) },
    ]);
    // Halfway between 400 and 1500 on a log axis, and between 55 and 60 linearly.
    expect(trail.head.x).toBeCloseTo(x(Math.sqrt(400 * 1500)), 6);
    expect(trail.head.y).toBeCloseTo(y(57.5), 6);
  });

  it('interpolates the head linearly on a linear axis', () => {
    const linear = frameWith(false);
    const [trail] = trailsAt(matrix, linear, ['Avalon'], 1.5);
    expect(trail.head.x).toBeCloseTo(linear.scales.x?.scale(950 as never) as number, 6);
  });

  it('starts as a single point at the first period', () => {
    const [trail] = trailsAt(matrix, logFrame, ['Avalon'], 0);
    expect(trail.points).toEqual([{ x: expect.closeTo(x(120), 6), y: expect.closeTo(y(50), 6) }]);
    expect(trail.head).toEqual({ x: expect.closeTo(x(120), 6), y: expect.closeTo(y(50), 6) });
  });

  it('draws only the requested keys, in request order, and skips unknown ones', () => {
    const trails = trailsAt(matrix, logFrame, ['Cydonia', 'Nowhere', 'Avalon'], 2);
    expect(trails.map((trail) => trail.key)).toEqual(['Cydonia', 'Avalon']);
    expect(trails[0].points).toHaveLength(3);
  });

  it('skips periods where the key has no position', () => {
    const rows: DataRow[] = bubbleRows().filter(
      (row) => !(row.country === 'Avalon' && row.year === 2001),
    );
    const dropped = bubbleMatrix(rows, 'drop');
    const [trail] = trailsAt(dropped, logFrame, ['Avalon'], 2);
    expect(trail.points.map((point) => point.x)).toEqual([
      expect.closeTo(x(120), 6),
      expect.closeTo(x(1500), 6),
    ]);
  });

  it('draws no trails when the matrix has no y channel (a categorical y)', () => {
    const { y: _y, ...values } = matrix.values;
    expect(trailsAt({ ...matrix, values }, logFrame, ['Avalon'], 1)).toEqual([]);
  });
});

describe('resolveTrailKeys', () => {
  const keys = ['A', 'B', 'C'];

  it('draws no trails when off', () => {
    const warn = vi.fn();
    expect(resolveTrailKeys(undefined, keys, warn)).toEqual([]);
    expect(resolveTrailKeys(false, keys, warn)).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('draws every key for true, warning only above 30 keys', () => {
    const warn = vi.fn();
    expect(resolveTrailKeys(true, keys, warn)).toEqual(keys);
    expect(warn).not.toHaveBeenCalled();
    const many = Array.from({ length: 31 }, (_, index) => `K${index}`);
    expect(resolveTrailKeys(true, many, warn)).toEqual(many);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('31');
  });

  it('keeps the listed keys that exist', () => {
    expect(resolveTrailKeys(['C', 'Z', 'A'], keys, () => {})).toEqual(['C', 'A']);
  });
});
