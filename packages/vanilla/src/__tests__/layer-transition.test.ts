import type { LayerSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { createChart } from '../mount';
import { canTransitionSpecShape } from '../transition';

function scores(score: number, domain = [0, 100]): LayerSpec {
  return {
    animation: { enter: false, update: { duration: 700 } },
    data: [{ district: 'Austin', score, low: score - 5, high: score + 5 }],
    encoding: {
      y: { field: 'district', type: 'nominal' },
      key: { field: 'district', type: 'nominal' },
    },
    layer: [
      {
        mark: 'rule',
        encoding: {
          x: { field: 'low', type: 'quantitative', scale: { domain, nice: false } },
          x2: { field: 'high' },
        },
      },
      {
        mark: 'point',
        encoding: {
          x: { field: 'score', type: 'quantitative', scale: { domain, nice: false } },
        },
      },
    ],
  };
}

function geometry(container: HTMLElement) {
  const point = container.querySelector('.oc-mark-point')!;
  const rule = container.querySelector('.oc-mark-rule')!;
  return [
    Number(point.getAttribute('cx')),
    Number(rule.getAttribute('x1')),
    Number(rule.getAttribute('x2')),
  ];
}

describe('layered chart updates', () => {
  it('animates points and interval endpoints together when data and axis domains change', () => {
    const container = createContainer();
    const chart = createChart(container, scores(20));
    const start = geometry(container);
    const handle = chart.beginManualUpdate(scores(90, [50, 100]));
    expect(handle).not.toBeNull();
    expect(geometry(container)).toEqual(start);
    handle!.step(handle!.totalMs / 2);
    const middle = geometry(container);
    handle!.step(handle!.totalMs);
    const end = geometry(container);
    for (let i = 0; i < start.length; i++) {
      expect(middle[i]).toBeGreaterThan(start[i]);
      expect(middle[i]).toBeLessThan(end[i]);
    }
    expect(container.textContent).toContain('Austin');
    chart.destroy();
  });

  it('rejects changed layer types, inherited fields, layer counts, transforms and scale resolution', () => {
    const from = scores(20);
    const next = scores(80);
    expect(canTransitionSpecShape(from, next)).toBe(true);
    expect(canTransitionSpecShape(from, { ...next, layer: next.layer.slice(1) })).toBe(false);
    expect(canTransitionSpecShape(from, { ...next, layer: [...next.layer].reverse() })).toBe(false);
    expect(
      canTransitionSpecShape(from, {
        ...next,
        encoding: { y: { field: 'other', type: 'nominal' } },
      }),
    ).toBe(false);
    expect(
      canTransitionSpecShape(from, { ...next, transform: [{ filter: 'datum.score > 50' }] }),
    ).toBe(false);
    expect(
      canTransitionSpecShape(from, { ...next, resolve: { scale: { y: 'independent' } } }),
    ).toBe(false);
  });
});
