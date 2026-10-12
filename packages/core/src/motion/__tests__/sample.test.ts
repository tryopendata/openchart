import { describe, expect, it } from 'vitest';
import { FLUID_SPRING, motionCSS, sampleMotion, springDuration } from '../sample';

describe('deterministic quantitative motion', () => {
  it('settles finitely, stays monotone and lands exactly on the terminal state', () => {
    for (const spring of [
      FLUID_SPRING,
      { stiffness: 100, damping: 1 },
      { mass: 2, stiffness: 10, damping: 100 },
    ]) {
      const duration = springDuration(spring);
      expect(duration).toBeLessThanOrEqual(1200);
      let previous = 0;
      for (let t = 0; t <= duration; t += 7) {
        const state = sampleMotion({ duration, spring }, t);
        expect(state.position).toBeGreaterThanOrEqual(previous);
        expect(state.position).toBeLessThanOrEqual(1);
        previous = state.position;
      }
      expect(sampleMotion({ duration, spring }, duration)).toEqual({
        position: 1,
        velocity: 0,
        settled: true,
      });
    }
  });
  it('samples CSS progress from the same curve', () => {
    const phase = { spring: FLUID_SPRING, duration: springDuration(FLUID_SPRING) };
    const css = motionCSS(phase).slice(7, -1).split(',').map(Number);
    expect(css[37]).toBeCloseTo(sampleMotion(phase, phase.duration * 0.37).position, 5);
  });
  it('rejects physically invalid springs and handles zero-duration phases', () => {
    expect(() => springDuration({ mass: 0 })).toThrow('positive');
    expect(() => springDuration({ stiffness: Number.NaN })).toThrow('positive');
    expect(sampleMotion({ duration: 0 }, 0).position).toBe(1);
  });
});
