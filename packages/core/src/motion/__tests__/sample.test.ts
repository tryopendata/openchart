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
  it('uses the default curve when optional spring settings are explicitly undefined', () => {
    const spring = { stiffness: undefined, damping: undefined, mass: undefined };
    const duration = springDuration(spring);
    expect(duration).toBe(springDuration(FLUID_SPRING));
    expect(sampleMotion({ duration, spring }, duration / 2)).toEqual(
      sampleMotion({ duration, spring: FLUID_SPRING }, duration / 2),
    );
  });
  it.each([1e-200, 1e200])('preserves the same physical spring at parameter scale %s', (scale) => {
    const spring = {
      stiffness: FLUID_SPRING.stiffness * scale,
      damping: FLUID_SPRING.damping * scale,
      mass: FLUID_SPRING.mass * scale,
    };
    const duration = springDuration(FLUID_SPRING);
    expect(springDuration(spring)).toBe(duration);
    for (let elapsed = 1; elapsed < duration; elapsed += 13) {
      const expected = sampleMotion({ duration, spring: FLUID_SPRING }, elapsed);
      const actual = sampleMotion({ duration, spring }, elapsed);
      expect(actual.position).toBeCloseTo(expected.position, 10);
      expect(actual.velocity).toBeCloseTo(expected.velocity, 10);
    }
    expect(motionCSS({ duration, spring })).not.toContain('NaN');
  });
  it('keeps heavily overdamped springs finite', () => {
    const spring = { stiffness: 320, damping: 1e200, mass: 1 };
    const duration = springDuration(spring);
    const sample = sampleMotion({ duration, spring }, 100);
    expect(Number.isFinite(sample.position)).toBe(true);
    expect(Number.isFinite(sample.velocity)).toBe(true);
    expect(sample.position).toBeGreaterThanOrEqual(0);
    expect(sample.position).toBeLessThanOrEqual(1);
  });
});
