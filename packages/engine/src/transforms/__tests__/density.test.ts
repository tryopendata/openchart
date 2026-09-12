import type { DataRow, DensityTransform } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { runDensity, silvermanBandwidth } from '../density';

/** Deterministic pseudo-random generator so the fixtures don't flake. */
function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function sample(
  n: number,
  center: number,
  spread: number,
  seed: number,
  group?: string,
): DataRow[] {
  const r = rng(seed);
  const rows: DataRow[] = [];
  for (let i = 0; i < n; i++) {
    const v = center + (r() + r() + r() - 1.5) * spread;
    rows.push(group ? { v, g: group } : { v });
  }
  return rows;
}

/** Trapezoidal integral of a curve given as (value, density) rows. */
function integrate(rows: DataRow[], valueField = 'value', densityField = 'density'): number {
  let total = 0;
  for (let i = 1; i < rows.length; i++) {
    const dx = (rows[i][valueField] as number) - (rows[i - 1][valueField] as number);
    const avg = ((rows[i][densityField] as number) + (rows[i - 1][densityField] as number)) / 2;
    total += dx * avg;
  }
  return total;
}

describe('runDensity', () => {
  it('produces a curve that integrates to 1', () => {
    const out = runDensity(sample(400, 100, 40, 11), { density: 'v' });
    expect(integrate(out)).toBeCloseTo(1, 2);
  });

  it('defaults to 200 evaluation points', () => {
    expect(runDensity(sample(50, 0, 10, 3), { density: 'v' })).toHaveLength(200);
  });

  it('honors an explicit steps count', () => {
    expect(runDensity(sample(50, 0, 10, 3), { density: 'v', steps: 25 })).toHaveLength(25);
  });

  it('finds two modes in a bimodal sample', () => {
    const data = [...sample(300, 0, 10, 5), ...sample(300, 200, 10, 9)];
    const out = runDensity(data, { density: 'v', bandwidth: 8 });
    let maxima = 0;
    for (let i = 1; i < out.length - 1; i++) {
      const prev = out[i - 1].density as number;
      const cur = out[i].density as number;
      const next = out[i + 1].density as number;
      if (cur > prev && cur > next) maxima++;
    }
    expect(maxima).toBe(2);
  });

  it('emits one curve per group and shares the extent across them', () => {
    const data = [...sample(100, 0, 10, 1, 'a'), ...sample(100, 100, 10, 2, 'b')];
    const out = runDensity(data, { density: 'v', groupby: ['g'], steps: 50 });
    expect(out).toHaveLength(100);
    const aValues = out.filter((r) => r.g === 'a').map((r) => r.value as number);
    const bValues = out.filter((r) => r.g === 'b').map((r) => r.value as number);
    expect(aValues[0]).toBe(bValues[0]);
    expect(aValues.at(-1)).toBe(bValues.at(-1));
  });

  it('rises monotonically to 1 when cumulative', () => {
    const out = runDensity(sample(200, 50, 20, 7), { density: 'v', cumulative: true });
    const ys = out.map((r) => r.density as number);
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i]).toBeGreaterThanOrEqual(ys[i - 1] - 1e-9);
    }
    expect(ys.at(-1)).toBeCloseTo(1, 6);
  });

  it('scales by the row count when counts is set', () => {
    const out = runDensity(sample(120, 10, 5, 13), { density: 'v', counts: true });
    expect(integrate(out)).toBeCloseTo(120, 0);
  });

  it('does not produce NaN for a single-value input', () => {
    const out = runDensity([{ v: 5 }, { v: 5 }, { v: 5 }], { density: 'v', steps: 20 });
    expect(out).toHaveLength(20);
    for (const row of out) {
      expect(Number.isFinite(row.value as number)).toBe(true);
      expect(Number.isFinite(row.density as number)).toBe(true);
    }
  });

  it('handles a large sample without blowing the call stack', () => {
    const rows: DataRow[] = [];
    for (let i = 0; i < 200_000; i++) rows.push({ v: (i * 37) % 1000 });
    const out = runDensity(rows, { density: 'v', steps: 10 });
    expect(out).toHaveLength(10);
  });

  it('ignores rows with a missing value rather than counting them as zero', () => {
    const withNulls: DataRow[] = [
      ...sample(100, 500, 20, 23),
      ...Array.from({ length: 50 }, () => ({ v: null })),
    ];
    const clean = runDensity(sample(100, 500, 20, 23), { density: 'v', steps: 40 });
    const dirty = runDensity(withNulls, { density: 'v', steps: 40 });
    expect(dirty.map((r) => r.value)).toEqual(clean.map((r) => r.value));
    expect(dirty.map((r) => r.density)).toEqual(clean.map((r) => r.density));
  });

  it('falls back to the default steps for a non-finite count', () => {
    expect(runDensity(sample(30, 0, 5, 29), { density: 'v', steps: Number.NaN })).toHaveLength(200);
    expect(
      runDensity(sample(30, 0, 5, 29), { density: 'v', steps: Number.POSITIVE_INFINITY }),
    ).toHaveLength(200);
  });

  it('ignores a reversed or non-finite extent', () => {
    const out = runDensity(sample(50, 10, 3, 31), {
      density: 'v',
      extent: [100, 0],
      steps: 20,
    });
    const values = out.map((r) => r.value as number);
    expect(values[0]).toBeLessThan(values.at(-1) as number);
  });

  it('honors an explicit extent and output field names', () => {
    const t: DensityTransform = { density: 'v', extent: [0, 10], steps: 11, as: ['x', 'y'] };
    const out = runDensity(sample(50, 5, 2, 17), t);
    expect(out[0].x).toBe(0);
    expect(out.at(-1)?.x).toBe(10);
    expect(typeof out[0].y).toBe('number');
  });
});

describe('silvermanBandwidth', () => {
  it('falls back to a positive constant when the spread is zero', () => {
    expect(silvermanBandwidth([4, 4, 4, 4])).toBeGreaterThan(0);
  });

  it('grows with the spread of the data', () => {
    const tight = silvermanBandwidth([1, 2, 3, 4, 5, 6, 7, 8]);
    const wide = silvermanBandwidth([10, 20, 30, 40, 50, 60, 70, 80]);
    expect(wide).toBeGreaterThan(tight);
  });
});
