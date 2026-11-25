import type { PointMark } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../compile';

// Two panels whose size/color ranges don't overlap: A holds small values,
// B holds large ones. With per-panel domains, both panels' extremes would map
// to the same radius and color.
const data = [
  { x: 1, y: 1, pop: 10, gdp: 1, group: 'A' },
  { x: 2, y: 2, pop: 20, gdp: 2, group: 'A' },
  { x: 3, y: 3, pop: 30, gdp: 3, group: 'A' },
  { x: 1, y: 2, pop: 1000, gdp: 100, group: 'B' },
  { x: 2, y: 3, pop: 2000, gdp: 200, group: 'B' },
  { x: 3, y: 1, pop: 3000, gdp: 300, group: 'B' },
];

const spec = {
  mark: 'point' as const,
  data,
  encoding: {
    x: { field: 'x', type: 'quantitative' as const },
    y: { field: 'y', type: 'quantitative' as const },
    size: { field: 'pop', type: 'quantitative' as const },
    color: { field: 'gdp', type: 'quantitative' as const },
    facet: { field: 'group', type: 'nominal' as const },
  },
};

function points(layout: ReturnType<typeof compileChart>, panel: number): PointMark[] {
  return layout.facet!.panels[panel].marks.filter(
    (m): m is PointMark => m.type === 'point' && !(m as { isTrailMark?: boolean }).isTrailMark,
  );
}

function byPop(marks: PointMark[], pop: number): PointMark {
  const mark = marks.find((m) => m.data.pop === pop);
  if (!mark) throw new Error(`no point with pop ${pop}`);
  return mark;
}

describe('faceted size and color scales', () => {
  it('share one size domain across panels by default', () => {
    const layout = compileChart(spec, { width: 800, height: 400 });
    const a = points(layout, 0);
    const b = points(layout, 1);
    // A's largest value (30) is far below B's largest (3000), so it must draw smaller.
    expect(byPop(a, 30).r).toBeLessThan(byPop(b, 3000).r);
    expect(byPop(b, 1000).r).toBeGreaterThan(byPop(a, 30).r);
  });

  it('share one color domain across panels by default', () => {
    const layout = compileChart(spec, { width: 800, height: 400 });
    expect(byPop(points(layout, 0), 30).fill).not.toBe(byPop(points(layout, 1), 3000).fill);
  });

  it('give a category the same color in every panel', () => {
    // Panel Q lacks category a; a per-panel ordinal scale would hand b the
    // first palette color there and a different one in panel P.
    const rows = [
      { x: 'm', y: 1, k: 'a', g: 'P' },
      { x: 'n', y: 2, k: 'b', g: 'P' },
      { x: 'm', y: 3, k: 'b', g: 'Q' },
    ];
    for (const mark of ['point', 'bar'] as const) {
      const layout = compileChart(
        {
          mark,
          data: rows,
          encoding: {
            x: { field: 'x', type: 'nominal' as const },
            y: { field: 'y', type: 'quantitative' as const },
            color: { field: 'k', type: 'nominal' as const },
            facet: { field: 'g', type: 'nominal' as const },
          },
        },
        { width: 800, height: 400 },
      );
      const fillOfB = layout.facet!.panels.map(
        (panel) =>
          (
            panel.marks.find((m) => (m as { data?: { k?: string } }).data?.k === 'b') as {
              fill?: unknown;
            }
          )?.fill,
      );
      expect(fillOfB[0]).toBeDefined();
      expect(fillOfB[1]).toBe(fillOfB[0]);
    }
  });

  it('fit each panel on its own with resolve independent', () => {
    const layout = compileChart(
      {
        ...spec,
        resolve: { scale: { size: 'independent' as const, color: 'independent' as const } },
      },
      { width: 800, height: 400 },
    );
    expect(byPop(points(layout, 0), 30).r).toBeCloseTo(byPop(points(layout, 1), 3000).r);
    expect(byPop(points(layout, 0), 30).fill).toBe(byPop(points(layout, 1), 3000).fill);
  });
});

describe('faceted x tick labels', () => {
  it('leave second-column labels at their tick positions', () => {
    const layout = compileChart(
      { ...spec, encoding: { ...spec.encoding, size: undefined, color: undefined } },
      { width: 800, height: 400 },
    );
    const [first, second] = layout.facet!.panels;
    const offset = second.area.x - first.area.x;
    const firstTicks = first.axes.x!.ticks;
    const secondTicks = second.axes.x!.ticks;
    expect(secondTicks.length).toBe(firstTicks.length);
    secondTicks.forEach((tick, i) => {
      const drawn = tick.labelPosition ?? tick.position;
      const reference = firstTicks[i].labelPosition ?? firstTicks[i].position;
      // Same domain, same panel width: the second panel's labels sit exactly
      // one column to the right of the first panel's.
      expect(drawn - reference).toBeCloseTo(offset);
    });
  });
});

describe('faceted trendline', () => {
  it('fits each panel to its own points', () => {
    // A rises, B falls: one shared fit would point the same way in both panels.
    const rows = [
      { x: 1, y: 1, g: 'A' },
      { x: 2, y: 2, g: 'A' },
      { x: 3, y: 3, g: 'A' },
      { x: 1, y: 3, g: 'B' },
      { x: 2, y: 2, g: 'B' },
      { x: 3, y: 1, g: 'B' },
    ];
    const layout = compileChart(
      {
        mark: 'point' as const,
        data: rows,
        encoding: {
          x: { field: 'x', type: 'quantitative' as const },
          y: { field: 'y', type: 'quantitative' as const },
          facet: { field: 'g', type: 'nominal' as const },
        },
      },
      { width: 800, height: 400 },
    );
    const [riseDy, fallDy] = layout.facet!.panels.map((panel) => {
      const lines = panel.marks.filter((m) => m.type === 'line') as Array<{
        points: { x: number; y: number }[];
      }>;
      expect(lines).toHaveLength(1);
      const pts = lines[0].points;
      return pts[pts.length - 1].y - pts[0].y;
    });
    // SVG y grows downward: a rising fit ends higher on screen (smaller y).
    expect(riseDy).toBeLessThan(0);
    expect(fallDy).toBeGreaterThan(0);
  });
});
