/**
 * Stack reveal: every animated stack is wrapped in one `.oc-stack-reveal`
 * group that clips as a unit on the author curve. Segments no longer chain.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { compileChart } from '@opendata-ai/openchart-engine';
import { afterEach, describe, expect, it } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { scanEntrance } from '../animation';
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
