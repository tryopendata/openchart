import type { AreaMark, ChartSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../../compile';

function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/** Two donation-shaped distributions: small gifts and large ones. */
function donations(): Array<Record<string, unknown>> {
  const r = rng(42);
  const rows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < 250; i++) rows.push({ amount: 450 + r() * 150, who: 'Small' });
  for (let i = 0; i < 150; i++) rows.push({ amount: 650 + r() * 150, who: 'Large' });
  return rows;
}

function areasOf(spec: ChartSpec): AreaMark[] {
  const layout = compileChart(spec as ChartSpec);
  return layout.marks.filter((m): m is AreaMark => m.type === 'area');
}

const base = { data: donations(), width: 600, height: 400 } as const;

describe('mark: density', () => {
  it('renders one overlapping translucent curve per color group', () => {
    const areas = areasOf({
      ...base,
      mark: { type: 'density' },
      encoding: {
        x: { field: 'amount', type: 'quantitative' },
        color: { field: 'who', type: 'nominal' },
      },
    } as unknown as ChartSpec);

    expect(areas).toHaveLength(2);
    for (const a of areas) {
      expect(a.fillOpacity).toBe(0.4);
      // A flat series color, not the auto gradient: two gradients read as mud.
      expect(typeof a.fill).toBe('string');
    }
  });

  it('renders a single curve with no color field', () => {
    const areas = areasOf({
      ...base,
      mark: { type: 'density' },
      encoding: { x: { field: 'amount', type: 'quantitative' } },
    } as unknown as ChartSpec);
    expect(areas).toHaveLength(1);
  });

  it('interpolates linearly so the estimate is not re-smoothed', () => {
    const [area] = areasOf({
      ...base,
      mark: { type: 'density' },
      encoding: { x: { field: 'amount', type: 'quantitative' } },
    } as unknown as ChartSpec);
    expect(area.interpolate).toBe('linear');
  });

  it('does not pad the x domain to zero', () => {
    const layout = compileChart({
      ...base,
      mark: { type: 'density', bandwidth: 20 },
      encoding: { x: { field: 'amount', type: 'quantitative' } },
    } as unknown as ChartSpec);
    expect(layout.xInvert?.topData as number).toBeGreaterThan(100);
  });

  it('suppresses the density y axis by default', () => {
    const layout = compileChart({
      ...base,
      mark: { type: 'density' },
      encoding: { x: { field: 'amount', type: 'quantitative' } },
    } as unknown as ChartSpec);
    expect(layout.axes.y).toBeUndefined();
  });

  it('honors an explicit y axis', () => {
    const layout = compileChart({
      ...base,
      mark: { type: 'density' },
      encoding: {
        x: { field: 'amount', type: 'quantitative' },
        y: { axis: { title: 'Density' } },
      },
    } as unknown as ChartSpec);
    expect(layout.axes.y).toBeDefined();
  });

  it('rises monotonically when cumulative', () => {
    const [area] = areasOf({
      ...base,
      mark: { type: 'density', cumulative: true },
      encoding: { x: { field: 'amount', type: 'quantitative' } },
    } as unknown as ChartSpec);
    // Screen y grows downward, so a rising CDF is a non-increasing pixel y.
    for (let i = 1; i < area.topPoints.length; i++) {
      expect(area.topPoints[i].y).toBeLessThanOrEqual(area.topPoints[i - 1].y + 1e-6);
    }
  });

  it('matches the canonical area + density transform spelling', () => {
    const sugar = areasOf({
      ...base,
      mark: { type: 'density', bandwidth: 25 },
      encoding: {
        x: { field: 'amount', type: 'quantitative' },
        color: { field: 'who', type: 'nominal' },
      },
    } as unknown as ChartSpec);

    const canonical = areasOf({
      ...base,
      mark: { type: 'area', interpolate: 'linear', fillOpacity: 0.4 },
      transform: [{ density: 'amount', groupby: ['who'], bandwidth: 25 }],
      crosshair: false,
      endpointLabels: false,
      encoding: {
        x: { field: 'value', type: 'quantitative', title: 'amount' },
        y: { field: 'density', type: 'quantitative', title: 'Density', axis: false, stack: null },
        color: { field: 'who', type: 'nominal' },
      },
    } as unknown as ChartSpec);

    expect(sugar.map((a) => a.path)).toEqual(canonical.map((a) => a.path));
  });

  it('suppresses endpoint labels, which would print a raw density float', () => {
    const layout = compileChart({
      ...base,
      mark: { type: 'density' },
      encoding: {
        x: { field: 'amount', type: 'quantitative' },
        color: { field: 'who', type: 'nominal' },
      },
    } as unknown as ChartSpec);
    expect(layout.endpointLabels).toBeUndefined();
  });

  it('estimates over the rows a user filter left behind', () => {
    // The density transform has to run last: after the KDE the source field
    // is gone, so a filter appended behind it would have nothing to match.
    const unfiltered = areasOf({
      ...base,
      mark: { type: 'density', bandwidth: 20 },
      encoding: { x: { field: 'amount', type: 'quantitative' } },
    } as unknown as ChartSpec);
    const filtered = areasOf({
      ...base,
      mark: { type: 'density', bandwidth: 20 },
      transform: [{ filter: { field: 'who', equal: 'Small' } }],
      encoding: { x: { field: 'amount', type: 'quantitative' } },
    } as unknown as ChartSpec);
    expect(filtered[0].path).not.toBe(unfiltered[0].path);
  });

  it('turns the crosshair off by default but respects an explicit one', () => {
    const implicit = compileChart({
      ...base,
      mark: { type: 'density' },
      encoding: { x: { field: 'amount', type: 'quantitative' } },
    } as unknown as ChartSpec);
    expect(implicit.crosshair).toBe(false);

    const explicit = compileChart({
      ...base,
      mark: { type: 'density' },
      crosshair: true,
      encoding: { x: { field: 'amount', type: 'quantitative' } },
    } as unknown as ChartSpec);
    expect(explicit.crosshair).toBe(true);
  });
});
