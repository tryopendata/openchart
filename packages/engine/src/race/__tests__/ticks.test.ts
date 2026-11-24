import { describe, expect, it } from 'vitest';
import { crossfadeTicks, periodTickLadder, valueTickLadder } from '../ticks';

describe('race tick ladders', () => {
  it.each([
    { span: 240, steps: [1, 5, 10, 50, 100, 500] },
    { span: 0.5, steps: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5] },
  ])('nests steps from two decades below $span through the first covering step', ({
    span,
    steps,
  }) => {
    const ladder = valueTickLadder(span);
    expect(ladder).toEqual(steps);
    for (const [index, step] of ladder.slice(1).entries()) {
      const ratio = step / ladder[index];
      expect(ratio).toBeCloseTo(Math.round(ratio));
    }
  });

  it('uses nested period steps that keep crossfading ticks on the same grid', () => {
    const ladder = periodTickLadder();
    expect(ladder).toEqual([1, 5, 10, 50, 100, 500]);
    for (const [index, step] of ladder.slice(1).entries()) {
      expect(step % ladder[index]).toBe(0);
    }
    expect(crossfadeTicks([0, 100], 2.6, ladder)).toEqual([
      { value: 0, opacity: 1 },
      { value: 50, opacity: 1 },
      { value: 100, opacity: 1 },
    ]);
  });
});

describe('race axis tick crossfade', () => {
  const ladder = [1, 5, 10, 50];

  it('selects the first step with room and includes both domain endpoints', () => {
    expect(crossfadeTicks([0, 20], 6.4, ladder)).toEqual([
      { value: 0, opacity: 1 },
      { value: 10, opacity: 1 },
      { value: 20, opacity: 1 },
    ]);
  });

  it('falls back to the widest step when none has room', () => {
    expect(crossfadeTicks([-50, 60], 1, ladder)).toEqual([
      { value: -50, opacity: 1 },
      { value: 0, opacity: 1 },
      { value: 50, opacity: 1 },
    ]);
  });

  it('fades in finer ticks in proportion to their spacing and keeps shared ticks opaque', () => {
    const ticks = crossfadeTicks([-7, 22], 10, ladder);
    expect(ticks.map(({ value }) => value)).toEqual([-5, 0, 5, 10, 15, 20]);
    expect(ticks.map(({ opacity }) => opacity)).toEqual([5 / 12, 1, 5 / 12, 1, 5 / 12, 1]);
  });

  it('honors custom fade spacing and omits opacities at or below the cutoff', () => {
    expect(crossfadeTicks([0, 10], 2.1, [5, 10], 60, 10)).toEqual([
      { value: 0, opacity: 1 },
      { value: 10, opacity: 1 },
    ]);
    expect(crossfadeTicks([0, 10], 4, [5, 10], 60, 10)).toEqual([
      { value: 0, opacity: 1 },
      { value: 5, opacity: 0.2 },
      { value: 10, opacity: 1 },
    ]);
    expect(crossfadeTicks([0, 10], 2.2, [5, 10], 60, 10)).toEqual([
      { value: 0, opacity: 1 },
      { value: 5, opacity: 0.02 },
      { value: 10, opacity: 1 },
    ]);
  });

  it('keeps shared decimal multiples aligned and includes decimal endpoints', () => {
    expect(crossfadeTicks([-0.3, 0.3], 25, [0.1, 0.3], 8, 2)).toEqual([
      { value: -0.3, opacity: 1 },
      { value: -0.2, opacity: 1 / 12 },
      { value: -0.1, opacity: 1 / 12 },
      { value: 0, opacity: 1 },
      { value: 0.1, opacity: 1 / 12 },
      { value: 0.2, opacity: 1 / 12 },
      { value: 0.3, opacity: 1 },
    ]);
  });

  it('merges both contributions when multiplying decimal steps would round differently', () => {
    const ticks = crossfadeTicks([0, 0.63], 700, [0.07, 0.21]);
    expect(ticks.map(({ value }) => value)).toEqual([
      0, 0.07, 0.14, 0.21, 0.28, 0.35, 0.42, 0.49, 0.56, 0.63,
    ]);
    for (const [index, tick] of ticks.entries()) {
      expect(tick.opacity).toBeCloseTo(index % 3 === 0 ? 1 : 0.375);
    }
  });

  it('changes each shared tick opacity by less than 0.1 across a 1% domain change', () => {
    const before = 93.3;
    const after = before * 1.01;
    const previous = crossfadeTicks([0, before], 600 / before, valueTickLadder(before));
    const next = crossfadeTicks([0, after], 600 / after, valueTickLadder(after));
    expect(next.map(({ value }) => value)).toEqual(previous.map(({ value }) => value));
    for (const [index, tick] of previous.entries()) {
      expect(Math.abs(tick.opacity - next[index].opacity)).toBeLessThan(0.1);
    }
    expect(next.find(({ value }) => value === 10)?.opacity).toBeLessThan(1);
  });
});
