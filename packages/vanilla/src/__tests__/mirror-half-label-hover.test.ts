/**
 * The two half labels above a mirrored bar chart stand in for the suppressed swatch
 * legend: hovering one emphasizes its series and dims the other.
 */

import type { ChartSpec } from '@opendata-ai/openchart-engine';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createContainer, createMouseEvent } from '../__test-fixtures__/dom';
import { createChart } from '../mount';

const pyramidSpec: ChartSpec = {
  mark: { type: 'bar', mirror: true },
  data: [
    { sex: 'Male', age: '0-9', pop: 50 },
    { sex: 'Female', age: '0-9', pop: 48 },
    { sex: 'Male', age: '10-19', pop: 30 },
    { sex: 'Female', age: '10-19', pop: 31 },
  ],
  encoding: {
    y: { field: 'age', type: 'ordinal' },
    x: { field: 'pop', type: 'quantitative' },
    color: { field: 'sex', type: 'nominal' },
  },
};

function halfLabel(container: HTMLElement, side: string): SVGElement {
  const label = container.querySelector(`[data-key="oc-mirror-half|${side}"]`);
  if (!label) throw new Error(`no half label for ${side}`);
  return label as SVGElement;
}

function bars(container: HTMLElement, side: string): SVGElement[] {
  return Array.from(
    container.querySelectorAll(`.oc-marks [data-series="${side}"]`),
  ) as SVGElement[];
}

describe('mirrored bar half labels', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = createContainer(600, 400);
  });

  afterEach(() => {
    container.remove();
  });

  it('emphasizes the hovered half and dims the other', () => {
    const chart = createChart(container, pyramidSpec);
    halfLabel(container, 'Female').dispatchEvent(createMouseEvent('mouseenter'));

    expect(bars(container, 'Female').length).toBeGreaterThan(0);
    for (const bar of bars(container, 'Female')) {
      expect(bar.classList.contains('oc-mark--hover')).toBe(true);
      expect(bar.classList.contains('oc-mark--dim')).toBe(false);
    }
    for (const bar of bars(container, 'Male')) {
      expect(bar.classList.contains('oc-mark--dim')).toBe(true);
    }
    expect(halfLabel(container, 'Female').classList.contains('oc-mark--dim')).toBe(false);
    chart.destroy();
  });

  it('restores every mark when the pointer leaves', () => {
    const chart = createChart(container, pyramidSpec);
    const label = halfLabel(container, 'Male');
    label.dispatchEvent(createMouseEvent('mouseenter'));
    label.dispatchEvent(createMouseEvent('mouseleave'));

    expect(container.querySelector('.oc-hover-active')).toBeNull();
    expect(container.querySelector('.oc-mark--dim, .oc-mark--hover')).toBeNull();
    chart.destroy();
  });
});
