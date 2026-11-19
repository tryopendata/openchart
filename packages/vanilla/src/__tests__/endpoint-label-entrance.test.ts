/**
 * Endpoint labels enter with their own series' line: each trailing entry
 * carries its series' stagger slot, so the endpoint-label role fades it in
 * as that line reaches the end, never before.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { compileChart } from '@opendata-ai/openchart-engine';
import { afterEach, describe, expect, it } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { scanEntrance } from '../animation';
import { renderChartSVG } from '../svg-renderer';

const spec: ChartSpec = {
  mark: 'line',
  data: ['Jan', 'Feb', 'Mar', 'Apr'].flatMap((month, i) => [
    { month, series: 'A', value: 10 + i * 3 },
    { month, series: 'B', value: 30 - i * 2 },
    { month, series: 'C', value: 18 + (i % 2) * 4 },
  ]),
  encoding: {
    x: { field: 'month', type: 'ordinal' },
    y: { field: 'value', type: 'quantitative' },
    color: { field: 'series', type: 'nominal' },
  },
} as ChartSpec;

function render(animate: boolean): SVGElement {
  const layout = compileChart(spec, { width: 640, height: 400 });
  return renderChartSVG(layout, createContainer(), { animate });
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('endpoint label entrance', () => {
  it("stamps each trailing entry with its own series' line index", () => {
    const svg = render(true);
    const entries = Array.from(svg.querySelectorAll<SVGElement>('.oc-endpoint-label-entry'));
    expect(entries.length).toBe(3);
    for (const entry of entries) {
      const key = entry.getAttribute('data-endpoint-key');
      const line = svg.querySelector<SVGElement>(`.oc-mark-line[data-series="${key}"]`);
      expect(line, `line for ${key}`).toBeTruthy();
      expect(entry.style.getPropertyValue('--oc-mark-index')).toBe(
        line!.style.getPropertyValue('--oc-mark-index'),
      );
    }
    const roles = scanEntrance(svg).elements.map((e) => e.role);
    expect(roles.filter((r) => r === 'endpoint-label')).toHaveLength(3);
  });

  it('stamps nothing when the render does not animate', () => {
    const svg = render(false);
    for (const entry of svg.querySelectorAll<SVGElement>('.oc-endpoint-label-entry')) {
      expect(entry.style.getPropertyValue('--oc-mark-index')).toBe('');
    }
  });
});
