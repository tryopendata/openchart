/**
 * Exits (RFC D9): a removed mark's ghost has faded out before any surviving
 * mark moves onto the space it occupied, and its geometry never leaves
 * [from, to].
 *
 * Every case drives the driver's manual clock (`manual: true` + `step(ms)`)
 * and samples every 8ms, so nothing depends on rAF or wall time.
 */

import {
  type ArcMark,
  type ChartLayout,
  type ChartSpec,
  EXIT_FADE_MS,
  type PointMark,
  type RectMark,
  sampleMotion,
} from '@opendata-ai/openchart-core';
import { buildArcPath, compileChart } from '@opendata-ai/openchart-engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { type RectGeometry, rectMarkGeometry } from '../__test-fixtures__/rect-geometry';
import { renderChartSVG } from '../svg-renderer';
import { lerpArcGeom } from '../transition/apply';
import { runTransition } from '../transition/driver';
import type { CanvasLayerLike, TransitionHandle } from '../transition/types';

const STEP_MS = 8;
const EPS = 1e-6;

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => {
    throw new Error('manual transition must not schedule requestAnimationFrame');
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

function compile(spec: ChartSpec): ChartLayout {
  return compileChart(spec, { width: 600, height: 400 });
}

/** Render NEXT (as mount.ts does) and start a manual transition from PREV. */
function begin(
  prev: ChartLayout,
  next: ChartLayout,
  canvas?: CanvasLayerLike,
): { svg: SVGSVGElement; handle: TransitionHandle } {
  const svg = renderChartSVG(next, createContainer(600, 400)) as SVGSVGElement;
  const handle = runTransition({
    svg,
    prevLayout: prev,
    nextLayout: next,
    animation: next.animation!,
    onComplete: () => {},
    manual: true,
    canvas,
  });
  return { svg, handle };
}

/** Sample times from 0 through the end, every STEP_MS. */
function times(totalMs: number): number[] {
  const out: number[] = [];
  for (let t = 0; t < totalMs; t += STEP_MS) out.push(t);
  out.push(totalMs);
  return out;
}

function opacityOf(el: Element): number {
  const raw = (el as SVGElement).style.opacity;
  return raw === '' ? 1 : Number(raw);
}

/** Area of the intersection of two boxes (0 when they only touch). */
function overlap(a: RectGeometry, b: RectGeometry): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

// ---------------------------------------------------------------------------
// Bars
// ---------------------------------------------------------------------------

function barSpec(categories: string[]): ChartSpec {
  return {
    animation: { enter: false, update: true, exit: true },
    mark: 'bar',
    data: categories.map((category, i) => ({ category, value: 40 + i * 10 })),
    encoding: {
      x: { field: 'category', type: 'nominal' },
      y: { field: 'value', type: 'quantitative', scale: { domain: [0, 100] } },
    },
  };
}

describe('bar exits', () => {
  it('fade out before a neighbour reaches the removed bar, and stay within [from, to]', () => {
    const prev = compile(barSpec(['A', 'B', 'C', 'D']));
    const next = compile(barSpec(['A', 'C', 'D']));
    expect(next.animation?.exit?.duration).toBe(EXIT_FADE_MS);
    const removed = prev.marks.find(
      (m): m is RectMark => m.type === 'rect' && m.key !== undefined && /B/.test(m.key),
    )!;
    expect(removed).toBeDefined();
    const slot: RectGeometry = {
      x: removed.x,
      y: removed.y,
      width: removed.width,
      height: removed.height,
    };

    const { svg, handle } = begin(prev, next);
    const ghost = svg.querySelector('.oc-mark-rect.oc-ghost')!;
    expect(ghost).not.toBeNull();
    const survivors = [...svg.querySelectorAll('.oc-mark-rect:not(.oc-ghost)')];
    expect(survivors).toHaveLength(3);

    let firstOverlapMs = Number.POSITIVE_INFINITY;
    let lastVisibleMs = 0;
    let previousHeight = slot.height;
    for (const t of times(handle.totalMs)) {
      const live = handle.step(t);
      const covered = survivors.some((el) => overlap(rectMarkGeometry(el)!, slot) > EPS);
      if (covered) firstOverlapMs = Math.min(firstOverlapMs, t);
      if (!live) break;

      const op = opacityOf(ghost);
      if (op > 0) lastVisibleMs = t;
      if (covered) expect(op, `ghost visible at ${t}ms under a neighbour`).toBe(0);

      // Geometry in [from, to]: x and width fixed, the bar collapses onto its
      // baseline without ever growing back or passing it.
      const g = rectMarkGeometry(ghost)!;
      expect(g.x).toBeCloseTo(slot.x, 6);
      expect(g.width).toBeCloseTo(slot.width, 6);
      expect(g.height).toBeGreaterThanOrEqual(-EPS);
      expect(g.height).toBeLessThanOrEqual(previousHeight + EPS);
      expect(g.y + g.height).toBeCloseTo(slot.y + slot.height, 6);
      previousHeight = g.height;
    }

    // The fixture is meaningful: survivors do cover the slot, and only after
    // the ghost has gone.
    expect(firstOverlapMs).toBeLessThan(handle.totalMs);
    expect(lastVisibleMs).toBeLessThan(firstOverlapMs);
    expect(lastVisibleMs).toBeLessThan(EXIT_FADE_MS);
    expect(svg.querySelector('.oc-ghost')).toBeNull();
    handle.cancel();
  });

  it('keeps an authored exit duration and holds survivors for it', () => {
    const spec = (c: string[]): ChartSpec => ({
      ...barSpec(c),
      animation: { enter: false, update: { duration: 500 }, exit: { duration: 300 } },
    });
    const prev = compile(spec(['A', 'B', 'C']));
    const next = compile(spec(['A', 'C']));
    const { svg, handle } = begin(prev, next);
    expect(handle.totalMs).toBe(800);
    const ghost = svg.querySelector('.oc-mark-rect.oc-ghost')!;
    handle.step(250);
    expect(opacityOf(ghost)).toBeGreaterThan(0);
    handle.step(300);
    expect(opacityOf(ghost)).toBe(0);
    handle.cancel();
  });

  it('does not hold survivors when nothing is removed', () => {
    const prev = compile(barSpec(['A', 'B']));
    const next = compile(barSpec(['A', 'B', 'C']));
    const { handle } = begin(prev, next);
    expect(handle.totalMs).toBe(next.animation!.update!.duration);
    handle.cancel();
  });
});

// ---------------------------------------------------------------------------
// Points (SVG and canvas)
// ---------------------------------------------------------------------------

/** Three keyed points on a line; `b` is removed and `c` slides onto its spot. */
function pointSpec(rows: Array<{ id: string; x: number }>): ChartSpec {
  return {
    animation: { enter: false, update: true, exit: true },
    mark: 'point',
    data: rows.map((r) => ({ ...r, y: 50 })),
    encoding: {
      x: { field: 'x', type: 'quantitative', scale: { domain: [0, 100] } },
      y: { field: 'y', type: 'quantitative', scale: { domain: [0, 100] } },
      key: { field: 'id', type: 'nominal' },
    },
  };
}

const POINTS_PREV = [
  { id: 'a', x: 10 },
  { id: 'b', x: 50 },
  { id: 'c', x: 90 },
];
const POINTS_NEXT = [
  { id: 'a', x: 10 },
  { id: 'c', x: 50 },
];

function pointByKey(layout: ChartLayout, id: string): PointMark {
  return layout.marks.find(
    (m): m is PointMark => m.type === 'point' && m.key !== undefined && m.key.includes(id),
  )!;
}

function discsOverlap(ax: number, ay: number, ar: number, bx: number, by: number, br: number) {
  return Math.hypot(ax - bx, ay - by) < ar + br - EPS;
}

describe('point exits', () => {
  it('SVG: the ghost has faded before the neighbour reaches it', () => {
    const prev = compile(pointSpec(POINTS_PREV));
    const next = compile(pointSpec(POINTS_NEXT));
    const gone = pointByKey(prev, 'b');
    const { svg, handle } = begin(prev, next);
    const ghost = svg.querySelector('circle.oc-mark-point.oc-ghost')!;
    expect(ghost).not.toBeNull();
    const c = svg.querySelector(`circle.oc-mark-point[data-key="${pointByKey(next, 'c').key}"]`)!;
    expect(c).not.toBeNull();

    let sawOverlap = false;
    for (const t of times(handle.totalMs)) {
      if (!handle.step(t)) break;
      const covered = discsOverlap(
        Number(c.getAttribute('cx')),
        Number(c.getAttribute('cy')),
        Number(c.getAttribute('r') ?? gone.r),
        gone.cx,
        gone.cy,
        gone.r,
      );
      if (covered) {
        sawOverlap = true;
        expect(opacityOf(ghost), `ghost visible at ${t}ms`).toBe(0);
      }
      // A point ghost holds its position.
      expect(Number(ghost.getAttribute('cx'))).toBeCloseTo(gone.cx, 6);
      expect(Number(ghost.getAttribute('cy'))).toBeCloseTo(gone.cy, 6);
    }
    expect(sawOverlap).toBe(true);
    handle.cancel();
  });

  it('canvas: the exit ghost has faded before the neighbour reaches it', () => {
    const prev = compile(pointSpec(POINTS_PREV));
    const next = compile(pointSpec(POINTS_NEXT));
    const gone = pointByKey(prev, 'b');
    const nextPoints = next.marks.filter((m): m is PointMark => m.type === 'point');
    // A layer built from the NEXT layout, as render() builds it in canvas mode.
    const layer: CanvasLayerLike = {
      state: {
        marks: {
          n: nextPoints.length,
          x: Float32Array.from(nextPoints.map((p) => p.cx)),
          y: Float32Array.from(nextPoints.map((p) => p.cy)),
          r: Float32Array.from(nextPoints.map((p) => p.r)),
          keys: nextPoints.map((p) => p.key),
        },
        gridlines: [],
        enterAlpha: null,
        exiting: null,
      },
      repaint() {},
      rebuildIndex() {},
      setInteractionSuspended() {},
    };
    const cIndex = nextPoints.findIndex((p) => p.key?.includes('c'));
    const { handle } = begin(prev, next, layer);
    expect(layer.state.exiting).not.toBeNull();
    const exiting = layer.state.exiting!;

    let sawOverlap = false;
    for (const t of times(handle.totalMs)) {
      if (!handle.step(t)) break;
      const m = layer.state.marks;
      if (discsOverlap(m.x[cIndex], m.y[cIndex], m.r[cIndex], gone.cx, gone.cy, gone.r)) {
        sawOverlap = true;
        expect(exiting.alpha, `canvas ghost visible at ${t}ms`).toBe(0);
      }
      expect(exiting.alpha).toBeGreaterThanOrEqual(0);
      expect(exiting.alpha).toBeLessThanOrEqual(1);
      expect(exiting.x[0]).toBeCloseTo(gone.cx, 4);
      expect(exiting.y[0]).toBeCloseTo(gone.cy, 4);
    }
    expect(sawOverlap).toBe(true);
    handle.cancel();
  });
});

// ---------------------------------------------------------------------------
// Arcs
// ---------------------------------------------------------------------------

function donutSpec(statuses: string[]): ChartSpec {
  return {
    animation: { enter: false, update: true, exit: true },
    mark: { type: 'arc', innerRadius: 55 },
    data: statuses.map((status, i) => ({ status, services: 10 + i * 5 })),
    encoding: {
      theta: { field: 'services', type: 'quantitative' },
      color: { field: 'status', type: 'nominal' },
    },
    legend: { show: false },
    labels: { density: 'none' },
  };
}

describe('arc exits', () => {
  it('collapse to the midpoint angle within [from, to] and are gone after the exit', () => {
    const prev = compile(donutSpec(['Healthy', 'Degraded', 'Down']));
    const next = compile(donutSpec(['Healthy', 'Down']));
    const gone = prev.marks.find(
      (m): m is ArcMark => m.type === 'arc' && m.key !== undefined && m.key.includes('Degraded'),
    )!;
    expect(gone).toBeDefined();
    const from = {
      startAngle: gone.startAngle,
      endAngle: gone.endAngle,
      innerRadius: gone.innerRadius,
      outerRadius: gone.outerRadius,
    };
    const mid = (gone.startAngle + gone.endAngle) / 2;
    const to = { ...from, startAngle: mid, endAngle: mid };
    const exit = next.animation!.exit!;

    const { svg, handle } = begin(prev, next);
    const ghost = svg.querySelector('.oc-mark-arc.oc-ghost')!;
    expect(ghost).not.toBeNull();
    const path = ghost.tagName === 'path' ? ghost : ghost.querySelector('path')!;
    let previous = -1;
    for (const t of times(handle.totalMs)) {
      if (!handle.step(t)) break;
      const p = sampleMotion(exit, t).position;
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
      expect(p).toBeGreaterThanOrEqual(previous);
      previous = p;
      expect(path.getAttribute('d')).toBe(buildArcPath(lerpArcGeom(from, to, p)));
      if (t >= exit.duration) expect(opacityOf(ghost)).toBe(0);
    }
    handle.cancel();
  });
});

// ---------------------------------------------------------------------------
// Lines: removal vs crossfade
// ---------------------------------------------------------------------------

function lineSpec(rows: Array<{ series: string; x: string; y: number }>): ChartSpec {
  return {
    animation: { enter: false, update: true, exit: true },
    mark: 'line',
    data: rows,
    encoding: {
      x: { field: 'x', type: 'temporal' },
      y: { field: 'y', type: 'quantitative', scale: { domain: [0, 10] } },
      color: { field: 'series', type: 'nominal' },
    },
    legend: { show: false },
    labels: { density: 'none' },
  };
}

const series = (name: string, xs: number[], y: number) =>
  xs.map((x) => ({ series: name, x: `${2010 + x}-01-01`, y: y + (x % 3) }));

describe('line exits', () => {
  it('a removed series fades on the exit clock without changing shape', () => {
    const prev = compile(lineSpec([...series('a', [0, 5, 10], 2), ...series('b', [0, 5, 10], 6)]));
    const next = compile(lineSpec(series('a', [0, 5, 10], 3)));
    const { svg, handle } = begin(prev, next);
    const ghost = svg.querySelector('.oc-mark-line.oc-ghost')!;
    expect(ghost).not.toBeNull();
    const d = ghost.querySelector('path')!.getAttribute('d');
    for (const t of times(handle.totalMs)) {
      if (!handle.step(t)) break;
      expect(ghost.querySelector('path')!.getAttribute('d')).toBe(d);
      if (t >= EXIT_FADE_MS) expect(opacityOf(ghost)).toBe(0);
    }
    handle.cancel();
  });

  it('a redrawn series crossfades into its replacement with no gap', () => {
    // No shared x values, so the series is redrawn rather than morphed.
    const prev = compile(lineSpec(series('a', [0, 2, 4], 2)));
    const next = compile(lineSpec(series('a', [6, 8, 10], 5)));
    const { svg, handle } = begin(prev, next);
    const ghost = svg.querySelector('.oc-mark-line.oc-ghost')!;
    const live = svg.querySelector('.oc-mark-line:not(.oc-ghost)')!;
    expect(ghost).not.toBeNull();
    // A crossfade is not a removal: the update is not held.
    expect(handle.totalMs).toBe(next.animation!.update!.duration);
    for (const t of times(handle.totalMs)) {
      if (!handle.step(t)) break;
      expect(opacityOf(ghost) + opacityOf(live)).toBeCloseTo(1, 6);
    }
    handle.cancel();
  });
});
