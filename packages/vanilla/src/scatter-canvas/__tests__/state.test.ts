import type { ChartSpec, GradientDef } from '@opendata-ai/openchart-core';
import { compileChart } from '@opendata-ai/openchart-engine';
import { describe, expect, it } from 'vitest';
import { buildScatterCanvasState, computeClipRect, flattenFill, normalizeStroke } from '../state';

function scatterSpec(overrides: Partial<ChartSpec> = {}): ChartSpec {
  return {
    mark: 'point',
    data: [
      { a: 1, b: 4 },
      { a: 2, b: 9 },
      { a: 3, b: 6 },
      { a: 4, b: 11 },
    ],
    encoding: {
      x: { field: 'a', type: 'quantitative' },
      y: { field: 'b', type: 'quantitative' },
    },
    ...overrides,
  } as ChartSpec;
}

describe('flattenFill', () => {
  it('returns a solid color unchanged', () => {
    expect(flattenFill('#ff0000')).toBe('#ff0000');
  });

  it('returns the FIRST stop of a gradient', () => {
    const gradient: GradientDef = {
      gradient: 'linear',
      stops: [
        { offset: 0, color: '#111111' },
        { offset: 1, color: '#eeeeee' },
      ],
    };
    expect(flattenFill(gradient)).toBe('#111111');
  });

  it('falls back to transparent (a valid canvas color) for an empty gradient', () => {
    expect(flattenFill({ gradient: 'linear', stops: [] } as GradientDef)).toBe('transparent');
  });

  it("maps the SVG-ism 'none' to transparent (invalid canvas fillStyle)", () => {
    expect(flattenFill('none')).toBe('transparent');
    expect(flattenFill('NONE')).toBe('transparent');
  });
});

describe('normalizeStroke', () => {
  it('passes real colors through unchanged', () => {
    expect(normalizeStroke('#ffffff')).toBe('#ffffff');
    expect(normalizeStroke('rgba(0,0,0,0.5)')).toBe('rgba(0,0,0,0.5)');
  });

  it("maps 'none' and 'transparent' to '' (the renderer's skip sentinel)", () => {
    // 'none' is an invalid canvas strokeStyle: the assignment is silently
    // ignored and every point strokes with the stale color. '' makes the
    // stroke pass skip the point entirely.
    expect(normalizeStroke('none')).toBe('');
    expect(normalizeStroke('None')).toBe('');
    expect(normalizeStroke('transparent')).toBe('');
  });

  it("maps undefined and '' to ''", () => {
    expect(normalizeStroke(undefined)).toBe('');
    expect(normalizeStroke('')).toBe('');
  });
});

describe('buildScatterCanvasState markIds', () => {
  it('keys markIds off the ORIGINAL layout.marks index (trendline at marks[0])', () => {
    const layout = compileChart(scatterSpec(), { width: 600, height: 400 });

    // Sanity: the scatter renderer unshifts the trendline, so marks[0] is a line.
    expect(layout.marks[0].type).toBe('line');

    const state = buildScatterCanvasState(layout);
    expect(state.marks.n).toBe(4);
    // The first POINT is layout.marks[1] → point-1, NOT point-0.
    expect(state.marks.markIds[0]).toBe('point-1');
    expect(state.marks.markIds[3]).toBe('point-4');
  });

  it('starts at point-0 when no trendline is present', () => {
    const layout = compileChart(scatterSpec({ mark: { type: 'point', trendline: false } }), {
      width: 600,
      height: 400,
    });
    expect(layout.marks[0].type).toBe('point');

    const state = buildScatterCanvasState(layout);
    expect(state.marks.markIds[0]).toBe('point-0');
  });
});

describe('buildScatterCanvasState SoA', () => {
  it('packs geometry and style into parallel typed arrays', () => {
    const layout = compileChart(scatterSpec(), { width: 600, height: 400 });
    const state = buildScatterCanvasState(layout);
    const points = layout.marks.filter((m) => m.type === 'point');

    expect(state.marks.x).toBeInstanceOf(Float32Array);
    expect(state.marks.y).toBeInstanceOf(Float32Array);
    expect(state.marks.r).toBeInstanceOf(Float32Array);
    expect(state.marks.animationIndex).toBeInstanceOf(Uint32Array);

    points.forEach((mark, i) => {
      expect(state.marks.x[i]).toBeCloseTo(mark.cx, 2);
      expect(state.marks.y[i]).toBeCloseTo(mark.cy, 2);
      expect(state.marks.r[i]).toBeCloseTo(mark.r, 2);
      expect(state.marks.fill[i]).toBe(flattenFill(mark.fill));
      expect(state.marks.data[i]).toBe(mark.data);
    });
  });

  it('starts with no entrance alpha, no ghosts, and no hover', () => {
    const layout = compileChart(scatterSpec(), { width: 600, height: 400 });
    const state = buildScatterCanvasState(layout);
    expect(state.enterAlpha).toBeNull();
    expect(state.exiting).toBeNull();
    expect(state.hoverIndex).toBe(-1);
  });

  it('carries theme background, gridline color, and figure dimensions', () => {
    const layout = compileChart(scatterSpec(), { width: 600, height: 400 });
    const state = buildScatterCanvasState(layout);
    expect(state.width).toBe(layout.dimensions.width);
    expect(state.height).toBe(layout.dimensions.height);
    expect(state.background).toBe(layout.theme.colors.background);
    expect(state.gridlineStroke).toBe(layout.theme.colors.gridline);
    expect(state.gridlineWidth).toBe(1);
    expect(state.plotRect).toEqual({
      x: layout.area.x,
      y: layout.area.y,
      width: layout.area.width,
      height: layout.area.height,
    });
  });
});

describe('buildScatterCanvasState gridlines', () => {
  it('mirrors the axis gridline sets with the SVG stroke opacity', () => {
    const layout = compileChart(scatterSpec(), { width: 600, height: 400 });
    const state = buildScatterCanvasState(layout);

    const expected =
      (layout.axes.y?.gridlines.length ?? 0) + (layout.axes.x?.gridlines.length ?? 0);
    expect(state.gridlines).toHaveLength(expected);
    expect(state.gridlines.every((g) => g.alpha === 0.6)).toBe(true);

    const yPositions = state.gridlines.filter((g) => g.orient === 'y').map((g) => g.position);
    expect(yPositions).toEqual(layout.axes.y?.gridlines.map((g) => g.position) ?? []);
  });

  it('skips gridlines from a right-side y-axis, matching axes.ts', () => {
    const layout = compileChart(scatterSpec(), { width: 600, height: 400 });
    const y = layout.axes.y;
    if (!y) throw new Error('expected a y axis');

    const rightAxisLayout = {
      ...layout,
      axes: { ...layout.axes, y: { ...y, orient: 'right' as const } },
    };
    const state = buildScatterCanvasState(rightAxisLayout);
    expect(state.gridlines.some((g) => g.orient === 'y')).toBe(false);
  });
});

describe('computeClipRect', () => {
  it('matches the svg-renderer formula (full width, padded by max point radius)', () => {
    const layout = compileChart(scatterSpec(), { width: 600, height: 400 });

    const maxPointR = layout.marks.reduce(
      (max, m) => (m.type === 'point' && m.r ? Math.max(max, m.r) : max),
      0,
    );
    const clipPad = Math.max(maxPointR, 2);

    expect(computeClipRect(layout)).toEqual({
      x: 0,
      y: layout.area.y - clipPad,
      width: layout.dimensions.width,
      height: layout.area.height + clipPad * 2,
    });
  });

  it('floors the pad at 2px when points are smaller', () => {
    const layout = compileChart(scatterSpec(), { width: 600, height: 400 });
    const tiny = {
      ...layout,
      marks: layout.marks.map((m) => (m.type === 'point' ? { ...m, r: 1 } : m)),
    };
    const rect = computeClipRect(tiny);
    expect(rect.y).toBe(layout.area.y - 2);
    expect(rect.height).toBe(layout.area.height + 4);
  });
});

describe('buildScatterCanvasState stroke normalization', () => {
  it("packs mark.stroke 'none' as '' so the stroke pass skips it", () => {
    const layout = compileChart(scatterSpec({ mark: { type: 'point', stroke: 'none' } }), {
      width: 600,
      height: 400,
    });
    // Sanity: the compiled marks really carry the SVG-ism through.
    const points = layout.marks.filter((m) => m.type === 'point');
    expect(points.every((m) => m.stroke === 'none')).toBe(true);

    const state = buildScatterCanvasState(layout);
    for (let i = 0; i < state.marks.n; i++) {
      expect(state.marks.stroke[i]).toBe('');
    }
  });
});
