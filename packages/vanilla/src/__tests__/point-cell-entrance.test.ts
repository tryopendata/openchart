/**
 * Line points pop in after their own line has drawn, cascading left to right;
 * grid cells pop in on scattered starts; both scale about an inline px origin.
 * Pie slices grow from the centre and their labels wait for them.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import {
  CELL_SWEEP_BUDGET_MS,
  entranceTiming,
  LINE_POINT_CASCADE_MS,
  progressTimeMs,
} from '@opendata-ai/openchart-core';
import { compileChart } from '@opendata-ai/openchart-engine';
import { afterEach, describe, expect, it } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { scanEntrance } from '../animation';
import { renderChartSVG } from '../svg-renderer';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function render(spec: ChartSpec, width = 640, height = 400): SVGElement {
  const layout = compileChart(spec, { width, height });
  return renderChartSVG(layout, createContainer(), { animate: true });
}

function ms(el: Element, prop: string): number {
  return Number.parseFloat((el as SVGElement).style.getPropertyValue(prop));
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('line points', () => {
  const oneSeries = {
    mark: { type: 'line', point: true },
    data: MONTHS.map((m, i) => ({ month: m, value: 30 + i * 3 + ((i * 7) % 5) * 4 })),
    encoding: {
      x: { field: 'month', type: 'ordinal' },
      y: { field: 'value', type: 'quantitative' },
    },
    animation: true,
  } as ChartSpec;

  it('start after the line reaches 0.97 and cascade left to right within the window', () => {
    const svg = render(oneSeries);
    const scan = scanEntrance(svg);
    const phase = { duration: scan.durationMs ?? 800, ease: 'smooth' as const };
    const line = svg.querySelector<SVGElement>('.oc-mark-line')!;
    const lineIndex = Number(line.style.getPropertyValue('--oc-mark-index') || 0);
    const lineDrawn = progressTimeMs('line-area', lineIndex, phase, scan.context, 0.97);

    const points = Array.from(svg.querySelectorAll<SVGCircleElement>('circle.oc-mark-point'));
    expect(points.length).toBe(MONTHS.length);
    const byX = points
      .map((p) => ({ cx: Number(p.getAttribute('cx')), delay: ms(p, '--oc-line-point-delay') }))
      .sort((a, b) => a.cx - b.cx);
    for (const { delay } of byX) expect(delay).toBeGreaterThanOrEqual(lineDrawn - 1e-6);
    for (let i = 1; i < byX.length; i++) {
      expect(byX[i].delay).toBeGreaterThanOrEqual(byX[i - 1].delay);
    }
    expect(byX.at(-1)!.delay - byX[0].delay).toBeLessThanOrEqual(LINE_POINT_CASCADE_MS + 1e-6);
  });

  it('scale about their own centre', () => {
    const svg = render(oneSeries);
    for (const p of svg.querySelectorAll<SVGCircleElement>('circle.oc-mark-point')) {
      const cx = Number(p.getAttribute('cx'));
      const cy = Number(p.getAttribute('cy'));
      const [ox, oy] = p.style
        .getPropertyValue('transform-origin')
        .split(' ')
        .map(Number.parseFloat);
      expect(ox).toBeCloseTo(cx, 2);
      expect(oy).toBeCloseTo(cy, 2);
    }
  });

  it('play the pop keyframe', () => {
    const svg = render(oneSeries);
    const roles = scanEntrance(svg).elements.filter((e) => e.role === 'line-point');
    expect(roles.length).toBeGreaterThan(0);
    for (const e of roles) expect(e.keyframe).toBe('oc-enter-pop');
  });

  it('key each series on its own line', () => {
    const svg = render({
      ...oneSeries,
      data: MONTHS.flatMap((m, i) => [
        { month: m, series: 'A', value: 20 + i * 4 },
        { month: m, series: 'B', value: 70 - i * 3 },
      ]),
      encoding: { ...oneSeries.encoding, color: { field: 'series', type: 'nominal' } },
    } as ChartSpec);
    const scan = scanEntrance(svg);
    const phase = { duration: scan.durationMs ?? 800, ease: 'smooth' as const };
    const lines = Array.from(svg.querySelectorAll<SVGElement>('.oc-mark-line'));
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      const series = line.getAttribute('data-series');
      const index = Number(line.style.getPropertyValue('--oc-mark-index') || 0);
      const drawn = progressTimeMs('line-area', index, phase, scan.context, 0.97);
      const points = svg.querySelectorAll<SVGElement>(
        `circle.oc-mark-point[data-field-series="${series}"]`,
      );
      expect(points.length).toBeGreaterThan(0);
      for (const p of points) {
        const delay = ms(p, '--oc-line-point-delay');
        expect(delay).toBeGreaterThanOrEqual(drawn - 1e-6);
        expect(delay).toBeLessThanOrEqual(drawn + LINE_POINT_CASCADE_MS + 1e-6);
      }
    }
  });

  it('leave points hidden under an endpoint marker out of the entrance', () => {
    const svg = render({
      ...oneSeries,
      data: MONTHS.flatMap((m, i) => [
        { month: m, series: 'A', value: 20 + i * 4 },
        { month: m, series: 'B', value: 70 - i * 3 },
      ]),
      encoding: { ...oneSeries.encoding, color: { field: 'series', type: 'nominal' } },
    } as ChartSpec);
    const hidden = svg.querySelectorAll('circle.oc-mark-point[opacity="0"]');
    expect(hidden.length).toBeGreaterThan(0);
    const scanned = new Set(scanEntrance(svg).elements.map((e) => e.el));
    for (const el of hidden) expect(scanned.has(el as SVGElement)).toBe(false);
  });
});

describe('grid cells', () => {
  const HOURS = ['9am', '11am', '1pm', '3pm', '5pm'];
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const heatmap = {
    mark: 'rect',
    data: DAYS.flatMap((day, d) => HOURS.map((hour, h) => ({ day, hour, visits: d * 5 + h }))),
    encoding: {
      x: { field: 'hour', type: 'nominal' },
      y: { field: 'day', type: 'nominal' },
      color: { field: 'visits', type: 'quantitative' },
    },
    animation: true,
  } as ChartSpec;

  function cellGroups(svg: SVGElement): SVGElement[] {
    return Array.from(svg.querySelectorAll<SVGElement>('.oc-mark-rect[data-cell]'));
  }

  it('stamp scattered delays over the sweep budget', () => {
    const groups = cellGroups(render(heatmap));
    expect(groups).toHaveLength(25);
    const delays = groups.map((g) => ms(g, '--oc-cell-delay'));
    for (const d of delays) {
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(CELL_SWEEP_BUDGET_MS + 1e-6);
    }
    expect(new Set(delays).size).toBe(25);
    let inversions = 0;
    let pairs = 0;
    for (let i = 0; i < delays.length; i++) {
      for (let j = i + 1; j < delays.length; j++) {
        pairs++;
        if (delays[i] > delays[j]) inversions++;
      }
    }
    expect(inversions / pairs).toBeGreaterThan(0.25);
  });

  it('scale about the cell centre', () => {
    for (const g of cellGroups(render(heatmap))) {
      const shape = g.querySelector<SVGElement>('rect, path')!;
      const [ox, oy] = shape.style
        .getPropertyValue('transform-origin')
        .split(' ')
        .map(Number.parseFloat);
      if (shape.tagName === 'rect') {
        const x = Number(shape.getAttribute('x'));
        const y = Number(shape.getAttribute('y'));
        const w = Number(shape.getAttribute('width'));
        const h = Number(shape.getAttribute('height'));
        expect(ox).toBeCloseTo(x + w / 2, 2);
        expect(oy).toBeCloseTo(y + h / 2, 2);
      } else {
        expect(Number.isFinite(ox) && Number.isFinite(oy)).toBe(true);
      }
    }
  });

  it('finish within the budget plus one 400ms pop', () => {
    const svg = render(heatmap);
    const scan = scanEntrance(svg);
    const phase = { duration: scan.durationMs ?? 800, ease: 'smooth' as const };
    const cells = scan.elements.filter((e) => e.role === 'cell');
    expect(cells).toHaveLength(25);
    let end = 0;
    for (const c of cells) {
      expect(c.keyframe).toBe('oc-enter-cell');
      const t = entranceTiming('cell', c.index, phase, c.context);
      end = Math.max(end, t.delayMs + t.durationMs);
    }
    expect(end).toBeCloseTo(CELL_SWEEP_BUDGET_MS + 400, 3);
  });

  it('start a lone cell at once', () => {
    const svg = render({ ...heatmap, data: [{ day: 'Mon', hour: '9am', visits: 3 }] } as ChartSpec);
    const groups = cellGroups(svg);
    expect(groups).toHaveLength(1);
    expect(ms(groups[0], '--oc-cell-delay')).toBe(0);
  });
});

describe('pie slices', () => {
  const donut = {
    mark: { type: 'arc', innerRadius: 70 },
    data: [
      { category: 'Housing', value: 34 },
      { category: 'Food', value: 22 },
      { category: 'Transport', value: 18 },
    ],
    encoding: {
      theta: { field: 'value', type: 'quantitative' },
      color: { field: 'category', type: 'nominal' },
    },
    labels: true,
    animation: true,
  } as ChartSpec;

  it('animate each slice path, not its positioned group', () => {
    const svg = render(donut);
    const arcs = scanEntrance(svg).elements.filter((e) => e.role === 'arc');
    expect(arcs).toHaveLength(3);
    for (const a of arcs) {
      expect(a.el.tagName).toBe('path');
      expect(a.keyframe).toBe('oc-enter-arc');
    }
  });

  it('fade slice labels in after their slice reaches 0.97', () => {
    const svg = render(donut);
    const scan = scanEntrance(svg);
    const phase = { duration: scan.durationMs ?? 800, ease: 'smooth' as const };
    const labels = scan.elements.filter((e) => e.role === 'arc-label');
    for (const l of labels) {
      const { delayMs } = entranceTiming('arc-label', l.index, phase, l.context);
      expect(delayMs).toBeGreaterThanOrEqual(
        progressTimeMs('arc', l.index, phase, scan.context, 0.97) - 1e-6,
      );
    }
  });
});
