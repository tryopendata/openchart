/**
 * Stack reveal: every animated stack is wrapped in one `.oc-stack-reveal`
 * group that clips as a unit on the author curve. Segments no longer chain.
 */

import type { ChartSpec, RectMark } from '@opendata-ai/openchart-core';
import { compileChart } from '@opendata-ai/openchart-engine';
import { afterEach, describe, expect, it } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { scanEntrance } from '../animation';
import { stackExtents } from '../renderers/entrance-geometry';
import { renderChartSVG } from '../svg-renderer';

const ROWS = ['A', 'B', 'C'].flatMap((category, i) =>
  ['x', 'y', 'z'].map((series, j) => ({ category, series, value: 10 + i * 3 + j * 2 })),
);

function stackedColumns(overrides: Partial<ChartSpec> = {}): ChartSpec {
  return {
    mark: 'bar',
    data: ROWS,
    encoding: {
      x: { field: 'category', type: 'nominal' },
      y: { field: 'value', type: 'quantitative' },
      color: { field: 'series', type: 'nominal' },
    },
    animation: 'fluid',
    ...overrides,
  } as ChartSpec;
}

function render(spec: ChartSpec): SVGElement {
  const layout = compileChart(spec, { width: 600, height: 400 });
  return renderChartSVG(layout, createContainer(), { animate: true });
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('stack reveal', () => {
  it('wraps each stack in one group inside g.oc-marks, with its own stagger index', () => {
    const svg = render(stackedColumns());
    const wrappers = Array.from(svg.querySelectorAll<SVGElement>('.oc-stack-reveal'));
    expect(wrappers).toHaveLength(3);
    for (const w of wrappers) {
      expect(w.parentElement?.classList.contains('oc-marks')).toBe(true);
      expect(w.querySelectorAll('.oc-mark-rect')).toHaveLength(3);
    }
    const indices = wrappers.map((w) => w.style.getPropertyValue('--oc-mark-index'));
    expect(new Set(indices).size).toBe(3);
    // Each wrapper is a stack-reveal target; its segments are suppressed.
    const roles = scanEntrance(svg).elements.map((e) => e.role);
    expect(roles.filter((r) => r === 'stack-reveal')).toHaveLength(3);
    expect(roles).not.toContain('bar');
  });

  it('spreads the stagger over stacks, not segments', () => {
    // 3 stacks of 3 segments are 3 stagger slots: min(80, 300 / 2) = 80ms.
    // Counting the 9 segments would give 300 / 8 = 37.5ms.
    const svg = render(stackedColumns({ animation: true }));
    expect(svg.style.getPropertyValue('--oc-animation-stagger')).toBe('80ms');
  });

  it('is the default for eased presets too, with no per-segment chain', () => {
    const svg = render(stackedColumns({ animation: true }));
    expect(svg.querySelectorAll('.oc-stack-reveal')).toHaveLength(3);
    expect(svg.style.getPropertyValue('--oc-stack-segment-duration')).toBe('');
    for (const rect of svg.querySelectorAll<SVGElement>('.oc-mark-rect')) {
      expect(rect.style.getPropertyValue('--oc-stack-pos')).toBe('');
    }
  });

  it('wraps stacks inside faceted panels too', () => {
    const svg = render(
      stackedColumns({
        data: ROWS.flatMap((r) => [
          { ...r, panel: 'P1' },
          { ...r, panel: 'P2' },
        ]),
        encoding: {
          ...stackedColumns().encoding,
          facet: { field: 'panel', type: 'nominal' },
        },
      } as Partial<ChartSpec>),
    );
    const panels = svg.querySelectorAll('.oc-facet-panel');
    expect(panels).toHaveLength(2);
    for (const panel of panels) {
      expect(panel.querySelectorAll('.oc-marks > .oc-stack-reveal')).toHaveLength(3);
    }
  });

  it("gives each stacked label its own stack's stagger index, in faceted panels too", () => {
    const svg = render(
      stackedColumns({
        data: ROWS.flatMap((r) => [
          { ...r, panel: 'P1' },
          { ...r, panel: 'P2' },
        ]),
        encoding: {
          ...stackedColumns().encoding,
          facet: { field: 'panel', type: 'nominal' },
        },
        labels: { density: 'all' },
      } as Partial<ChartSpec>),
    );
    let checked = 0;
    for (const panel of svg.querySelectorAll('.oc-facet-panel')) {
      const stackIndexByKey = new Map<string, string>();
      for (const wrapper of panel.querySelectorAll<SVGElement>('.oc-stack-reveal')) {
        const index = wrapper.style.getPropertyValue('--oc-mark-index');
        for (const segment of wrapper.querySelectorAll('.oc-mark-rect[data-key]')) {
          stackIndexByKey.set(segment.getAttribute('data-key')!, index);
        }
      }
      for (const label of panel.querySelectorAll<SVGElement>('.oc-mark-label')) {
        const key = label.getAttribute('data-label-key')!;
        expect(stackIndexByKey.has(key)).toBe(true);
        expect(label.style.getPropertyValue('--oc-mark-index')).toBe(stackIndexByKey.get(key));
        checked++;
      }
    }
    expect(checked).toBe(ROWS.length * 2);
  });

  it('grows a stack that crosses zero both ways from the baseline', () => {
    // stack: 'center' centres each stack on zero, so every stack crosses it
    // and its middle segment straddles zero.
    const spec = stackedColumns();
    const layout = compileChart(
      {
        ...spec,
        encoding: {
          ...spec.encoding,
          y: { field: 'value', type: 'quantitative', stack: 'center' },
        },
      } as ChartSpec,
      { width: 600, height: 400 },
    );
    const svg = renderChartSVG(layout, createContainer(), { animate: true });
    const wrappers = Array.from(svg.querySelectorAll<SVGElement>('.oc-stack-reveal'));
    expect(wrappers).toHaveLength(3);
    const zeroTick = layout.axes.y!.ticks.find((t) => t.value === 0)!;
    for (const wrapper of wrappers) {
      const rects = Array.from(wrapper.querySelectorAll('rect')).map((r) => ({
        y: Number(r.getAttribute('y')),
        h: Number(r.getAttribute('height')),
      }));
      const top = Math.min(...rects.map((r) => r.y));
      const bottom = Math.max(...rects.map((r) => r.y + r.h));
      expect(top).toBeLessThan(zeroTick.position);
      expect(bottom).toBeGreaterThan(zeroTick.position);
      // The starting clip collapses onto the zero line: inset(top% 0 bottom% 0).
      const [before, , after] = wrapper.style
        .getPropertyValue('--oc-stack-from')
        .split(' ')
        .map((v) => Number.parseFloat(v));
      const h = bottom - top;
      expect(top + (before / 100) * h).toBeCloseTo(zeroTick.position, 2);
      expect(bottom - (after / 100) * h).toBeCloseTo(zeroTick.position, 2);
    }
  });

  it('stamps no baseline inset on a stack that starts at zero', () => {
    const svg = render(stackedColumns());
    for (const w of svg.querySelectorAll<SVGElement>('.oc-stack-reveal')) {
      expect(w.style.getPropertyValue('--oc-stack-from')).toBe('');
    }
  });
});

describe('grid cells', () => {
  const CELLS: Record<string, ChartSpec> = {
    heatmap: {
      mark: 'rect',
      data: ['a', 'b'].flatMap((x, i) => ['p', 'q'].map((y, j) => ({ x, y, v: i * 2 + j }))),
      encoding: {
        x: { field: 'x', type: 'nominal' },
        y: { field: 'y', type: 'nominal' },
        color: { field: 'v', type: 'quantitative' },
      },
    },
    waffle: {
      mark: 'waffle',
      data: [
        { source: 'Coal', share: 30 },
        { source: 'Gas', share: 70 },
      ],
      encoding: {
        theta: { field: 'share', type: 'quantitative' },
        color: { field: 'source', type: 'nominal' },
      },
    },
    calendar: {
      mark: 'calendar',
      data: Array.from({ length: 21 }, (_, i) => ({
        date: `2024-01-${String(i + 1).padStart(2, '0')}`,
        value: i % 5,
      })),
      encoding: {
        x: { field: 'date', type: 'temporal' },
        color: { field: 'value', type: 'quantitative' },
      },
    },
  };

  it.each(Object.entries(CELLS))('%s cells fade: no stack wrapper or baseline', (_, spec) => {
    const layout = compileChart({ ...spec, animation: true }, { width: 600, height: 400 });
    const cells = layout.marks.filter((m): m is RectMark => m.type === 'rect' && !!m.cell);
    expect(cells.length).toBeGreaterThan(0);
    const stacks = stackExtents(layout.marks);
    for (const cell of cells) {
      expect(cell.baseline).toBeUndefined();
      expect(stacks.has(cell)).toBe(false);
    }

    const svg = renderChartSVG(layout, createContainer(), { animate: true });
    expect(svg.querySelector('.oc-stack-reveal')).toBeNull();
    const groups = svg.querySelectorAll<SVGElement>('.oc-mark-rect[data-cell]');
    expect(groups).toHaveLength(cells.length);
    for (const g of groups) {
      expect(g.hasAttribute('data-orient')).toBe(false);
      const shape = g.querySelector<SVGElement>('rect, path')!;
      expect(shape.style.getPropertyValue('--oc-bar-from')).toBe('');
    }
    const roles = scanEntrance(svg).elements.map((e) => e.role);
    expect(roles.filter((r) => r === 'cell')).toHaveLength(cells.length);
    expect(roles).not.toContain('bar');
  });

  it.each(Object.entries(CELLS))('%s without an entrance stamps no data-cell', (_, spec) => {
    const layout = compileChart({ ...spec, animation: false }, { width: 600, height: 400 });
    const svg = renderChartSVG(layout, createContainer());
    expect(svg.querySelector('[data-cell]')).toBeNull();
  });
});
