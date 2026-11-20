/**
 * Bar value labels wait for their bar: they fade in place once the bar at
 * their own stagger index reaches 0.97, and never ride the bar.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { entranceTiming, progressTimeMs } from '@opendata-ai/openchart-core';
import { compileChart } from '@opendata-ai/openchart-engine';
import { afterEach, describe, expect, it } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { scanEntrance } from '../animation';
import { renderChartSVG } from '../svg-renderer';

const TEAMS = [
  { label: 'Engineering', value: 142 },
  { label: 'Product', value: 118 },
  { label: 'Sales', value: 96 },
  { label: 'Design', value: 71 },
  { label: 'Support', value: 44 },
];

function horizontalBars(overrides: Partial<ChartSpec> = {}): ChartSpec {
  return {
    mark: 'bar',
    data: TEAMS,
    encoding: {
      x: { field: 'value', type: 'quantitative' },
      y: { field: 'label', type: 'nominal' },
    },
    labels: true,
    animation: true,
    ...overrides,
  } as ChartSpec;
}

function render(spec: ChartSpec): SVGElement {
  const layout = compileChart(spec, { width: 640, height: 400 });
  return renderChartSVG(layout, createContainer(), { animate: true });
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('bar value label entrance', () => {
  it('stamps no ride offset', () => {
    const svg = render(horizontalBars());
    const labels = svg.querySelectorAll<SVGElement>('.oc-mark-label');
    expect(labels.length).toBe(TEAMS.length);
    for (const label of labels) {
      expect(label.style.getPropertyValue('--oc-label-from')).toBe('');
    }
  });

  it('starts each label after its own bar reaches 0.97', () => {
    const svg = render(horizontalBars());
    const scan = scanEntrance(svg);
    const phase = { duration: scan.durationMs ?? 800, ease: 'smooth' as const };
    const labels = scan.elements.filter((e) => e.role === 'label');
    expect(labels).toHaveLength(TEAMS.length);
    for (const label of labels) {
      const { delayMs } = entranceTiming('label', label.index, phase, label.context);
      const barLands = progressTimeMs('bar', label.index, phase, scan.context, 0.97);
      expect(delayMs).toBeGreaterThanOrEqual(barLands - 1e-6);
      expect(label.keyframe).toBe('oc-enter-fade-only');
    }
  });

  it('gives faceted labels the stagger index of their own bar', () => {
    const svg = render(
      horizontalBars({
        data: TEAMS.flatMap((t) => [
          { ...t, panel: 'P1' },
          { ...t, panel: 'P2', value: t.value + 10 },
        ]),
        encoding: {
          ...horizontalBars().encoding,
          facet: { field: 'panel', type: 'nominal' },
        },
      } as Partial<ChartSpec>),
    );
    const panels = svg.querySelectorAll('.oc-facet-panel');
    expect(panels).toHaveLength(2);
    let checked = 0;
    for (const panel of panels) {
      const barIndex = new Map<string, string>();
      for (const g of panel.querySelectorAll<SVGElement>('.oc-mark-rect[data-key]')) {
        barIndex.set(g.getAttribute('data-key')!, g.style.getPropertyValue('--oc-mark-index'));
      }
      for (const label of panel.querySelectorAll<SVGElement>('.oc-mark-label')) {
        const key = label.getAttribute('data-label-key')!;
        expect(barIndex.has(key)).toBe(true);
        expect(label.style.getPropertyValue('--oc-mark-index')).toBe(barIndex.get(key));
        checked++;
      }
    }
    expect(checked).toBe(TEAMS.length * 2);
  });
});
