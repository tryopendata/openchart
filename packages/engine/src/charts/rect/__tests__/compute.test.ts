import type { RectMark } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../../compile';

/** A 3x2 day/hour grid with a quantitative value: the canonical heatmap shape. */
const grid = [
  { day: 'Mon', hour: '9am', v: 3 },
  { day: 'Mon', hour: '10am', v: 7 },
  { day: 'Tue', hour: '9am', v: 5 },
  { day: 'Tue', hour: '10am', v: 9 },
  { day: 'Wed', hour: '9am', v: 1 },
  { day: 'Wed', hour: '10am', v: 4 },
];

function heatmap(data = grid) {
  return {
    mark: { type: 'rect' as const },
    data: [...data],
    encoding: {
      x: { field: 'day', type: 'nominal' as const },
      y: { field: 'hour', type: 'nominal' as const },
      color: { field: 'v', type: 'quantitative' as const },
    },
  };
}

function cellsOf(spec: Parameters<typeof compileChart>[0]): RectMark[] {
  const layout = compileChart(spec, { width: 600, height: 400 });
  return layout.marks.filter((m): m is RectMark => m.type === 'rect');
}

describe('rect mark (heatmap)', () => {
  /**
   * Regression: `rect` used to alias `columnRenderer`, which requires a *linear*
   * y-scale (it anchors cells to `yScale(0)`). A heatmap bands both axes, so the
   * renderer hit its bandwidth guard and returned []. `mark: 'rect'` rendered a
   * blank chart with no error.
   */
  it('emits one cell per row instead of a blank chart', () => {
    const cells = cellsOf(heatmap());
    expect(cells).toHaveLength(grid.length);
  });

  it('gives every cell a positive width and height', () => {
    for (const cell of cellsOf(heatmap())) {
      expect(cell.width).toBeGreaterThan(0);
      expect(cell.height).toBeGreaterThan(0);
    }
  });

  it('tiles cells into a grid: one distinct x per day, one distinct y per hour', () => {
    const cells = cellsOf(heatmap());
    expect(new Set(cells.map((c) => c.x)).size).toBe(3); // Mon/Tue/Wed
    expect(new Set(cells.map((c) => c.y)).size).toBe(2); // 9am/10am
  });

  it('colors cells from the quantitative color scale, not a flat default', () => {
    const fills = new Set(cellsOf(heatmap()).map((c) => String(c.fill)));
    // Six distinct values -> a sequential ramp must produce more than one color.
    expect(fills.size).toBeGreaterThan(1);
  });

  it('keys each cell on its x/y pair so updates match by cell', () => {
    const keys = cellsOf(heatmap()).map((c) => c.key);
    expect(new Set(keys).size).toBe(grid.length);
  });

  it('skips rows whose color value is not finite', () => {
    const cells = cellsOf(
      heatmap([...grid, { day: 'Thu', hour: '9am', v: Number.NaN as unknown as number }]),
    );
    expect(cells).toHaveLength(grid.length);
  });

  /**
   * Cells tile. The band default (0.35) is a *bar* value -- bars need air
   * between them to read as separate quantities -- and it left the heatmap
   * looking like a scatter of floating rectangles. A cell gap should be a
   * hairline gutter, so each cell claims nearly its whole step.
   */
  it('tiles cells with only a hairline gutter, not a bar-sized gap', () => {
    const cells = cellsOf(heatmap());
    const xs = [...new Set(cells.map((c) => c.x))].sort((a, b) => a - b);
    const step = xs[1] - xs[0];
    const cellWidth = cells[0].width;
    // Cell fills at least 90% of its step (0.35 padding would give ~65%).
    expect(cellWidth / step).toBeGreaterThan(0.9);
  });

  it('draws no gridlines: the cells are the grid', () => {
    const layout = compileChart(heatmap(), { width: 600, height: 400 });
    expect(layout.axes.y?.gridlines ?? []).toHaveLength(0);
  });

  /**
   * A quantitative axis has no bandwidth, so a cell has no width. Emitting
   * zero-area marks would render an invisible chart -- the exact failure this
   * renderer exists to end. Bail instead of pretending.
   */
  it('emits nothing when an axis is quantitative (no bandwidth to size a cell)', () => {
    const cells = cellsOf({
      mark: { type: 'rect' as const },
      data: [...grid],
      encoding: {
        x: { field: 'v', type: 'quantitative' as const },
        y: { field: 'hour', type: 'nominal' as const },
        color: { field: 'v', type: 'quantitative' as const },
      },
    });
    expect(cells).toHaveLength(0);
  });

  it('labels each cell with its x, y, and value for screen readers', () => {
    const cells = cellsOf(heatmap());
    const mon9 = cells.find((c) => c.data?.day === 'Mon' && c.data?.hour === '9am');
    expect(mon9?.aria.label).toContain('Mon');
    expect(mon9?.aria.label).toContain('9am');
    expect(mon9?.aria.label).toContain('3');
  });
});
