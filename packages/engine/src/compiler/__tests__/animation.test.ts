/**
 * Tests for the animation resolver: resolveAnimation() and clampStaggerDelay().
 *
 * These are pure functions that normalize the various AnimationSpec shorthand
 * forms into a fully resolved config with all defaults filled in.
 */

import { describe, expect, it } from 'vitest';
import {
  clampStaggerDelay,
  ENTER_DEFAULTS,
  EXIT_DEFAULTS,
  resolveAnimation,
  UPDATE_DEFAULTS,
} from '../animation';

// ---------------------------------------------------------------------------
// resolveAnimation
// ---------------------------------------------------------------------------

describe('resolveAnimation', () => {
  it('returns undefined for false', () => {
    expect(resolveAnimation(false)).toBeUndefined();
  });

  it('returns full defaults for undefined (on by default), the same as true', () => {
    expect(resolveAnimation(undefined)).toEqual(resolveAnimation(true));
  });

  it('returns all three phases with defaults for true', () => {
    const result = resolveAnimation(true);
    expect(result).toEqual({
      enter: { ...ENTER_DEFAULTS },
      update: { ...UPDATE_DEFAULTS },
      exit: { ...EXIT_DEFAULTS },
      annotationDelay: 150,
    });
  });

  it('resolves AnimationConfig with enter: true', () => {
    const result = resolveAnimation({ enter: true });
    expect(result).toBeDefined();
    expect(result!.enter).toEqual(ENTER_DEFAULTS);
    expect(result!.update).toEqual(UPDATE_DEFAULTS);
    expect(result!.exit).toEqual(EXIT_DEFAULTS);
    expect(result!.annotationDelay).toBe(150);
  });

  it('resolves custom enter config', () => {
    const result = resolveAnimation({
      enter: {
        duration: 800,
        ease: 'smooth',
        stagger: { delay: 40, order: 'value' },
      },
    });
    expect(result).toBeDefined();
    expect(result!.enter).toEqual({
      duration: 800,
      ease: 'smooth',
      staggerDelay: 40,
      staggerOrder: 'value',
      trigger: 'visible',
    });
    // Other phases still present with defaults
    expect(result!.update).toEqual(UPDATE_DEFAULTS);
    expect(result!.exit).toEqual(EXIT_DEFAULTS);
  });

  it('enter: false, update: true produces update present, no enter', () => {
    const result = resolveAnimation({ enter: false, update: true });
    expect(result).toBeDefined();
    expect(result!.enter).toBeUndefined();
    expect(result!.update).toEqual(UPDATE_DEFAULTS);
    expect(result!.exit).toEqual(EXIT_DEFAULTS);
  });

  it('update: false produces enter + exit present, update absent', () => {
    const result = resolveAnimation({ update: false });
    expect(result).toBeDefined();
    expect(result!.enter).toEqual(ENTER_DEFAULTS);
    expect(result!.update).toBeUndefined();
    expect(result!.exit).toEqual(EXIT_DEFAULTS);
  });

  it('all phases false returns undefined', () => {
    expect(resolveAnimation({ enter: false, update: false, exit: false })).toBeUndefined();
  });

  it('resolves stagger: false to staggerDelay: 0', () => {
    const result = resolveAnimation({ enter: { stagger: false } });
    expect(result).toBeDefined();
    expect(result!.enter!.staggerDelay).toBe(0);
  });

  it('uses custom annotationDelay', () => {
    const result = resolveAnimation({ enter: true, annotationDelay: 500 });
    expect(result).toBeDefined();
    expect(result!.annotationDelay).toBe(500);
  });

  it('empty config resolves all phases with defaults (behaves like true)', () => {
    const result = resolveAnimation({});
    expect(result).toBeDefined();
    expect(result!.enter).toEqual(ENTER_DEFAULTS);
    expect(result!.update).toEqual(UPDATE_DEFAULTS);
    expect(result!.exit).toEqual(EXIT_DEFAULTS);
  });

  it('preserves default annotationDelay when not overridden', () => {
    const result = resolveAnimation({ enter: { duration: 1000 } });
    expect(result!.annotationDelay).toBe(150);
  });

  it('enter phase uses ENTER_DEFAULTS for unspecified fields', () => {
    const result = resolveAnimation({ enter: { duration: 1000 } });
    expect(result!.enter).toEqual({
      duration: 1000,
      ease: 'smooth',
      staggerDelay: 80,
      staggerOrder: 'index',
      trigger: 'visible',
    });
  });

  it('update phase uses UPDATE_DEFAULTS (no stagger by default)', () => {
    const result = resolveAnimation(true);
    expect(result!.update).toEqual({
      duration: 500,
      ease: 'smooth',
      staggerDelay: 0,
      staggerOrder: 'index',
    });
  });

  it('exit phase uses EXIT_DEFAULTS (a 120ms fade on gentle)', () => {
    const result = resolveAnimation(true);
    expect(result!.exit).toEqual({
      duration: 120,
      ease: 'gentle',
      staggerDelay: 0,
      staggerOrder: 'index',
    });
  });

  // -------------------------------------------------------------------------
  // update.maxMarks
  // -------------------------------------------------------------------------

  it('passes update.maxMarks through to the resolved phase', () => {
    const result = resolveAnimation({ update: { maxMarks: 5000 } });
    expect(result!.update!.maxMarks).toBe(5000);
  });

  it('floors a fractional update.maxMarks', () => {
    const result = resolveAnimation({ update: { maxMarks: 5000.7 } });
    expect(result!.update!.maxMarks).toBe(5000);
  });

  it('leaves maxMarks absent for animation: true (renderer supplies the default)', () => {
    expect(resolveAnimation(true)!.update!.maxMarks).toBeUndefined();
  });

  it('leaves maxMarks absent for update: true', () => {
    expect(resolveAnimation({ update: true })!.update!.maxMarks).toBeUndefined();
  });

  it.each([
    [0],
    [-1],
    [Number.NaN],
    [Number.POSITIVE_INFINITY],
  ])('ignores an out-of-range maxMarks (%p)', (value) => {
    const result = resolveAnimation({ update: { maxMarks: value } });
    expect(result!.update!.maxMarks).toBeUndefined();
  });

  it.each([[0.5], [0.99]])('ignores a fractional maxMarks below 1 (%p)', (value) => {
    // Flooring these would yield 0, and `0 ?? DEFAULT` keeps 0 -- silently
    // disabling every update transition on the chart.
    const result = resolveAnimation({ update: { maxMarks: value } });
    expect(result!.update!.maxMarks).toBeUndefined();
  });

  it('accepts maxMarks of exactly 1', () => {
    expect(resolveAnimation({ update: { maxMarks: 1 } })!.update!.maxMarks).toBe(1);
  });

  it('ignores maxMarks read off an array-shaped update config', () => {
    const result = resolveAnimation({
      update: [1, 2, 3] as unknown as boolean,
    });
    expect(result!.update!.maxMarks).toBeUndefined();
  });

  it('ignores a non-numeric maxMarks', () => {
    const result = resolveAnimation({
      update: { maxMarks: '5000' as unknown as number },
    });
    expect(result!.update!.maxMarks).toBeUndefined();
  });

  it('does not leak maxMarks onto the enter or exit phases', () => {
    const result = resolveAnimation({ update: { maxMarks: 5000 } });
    expect(result!.enter).toEqual(ENTER_DEFAULTS);
    expect(result!.exit).toEqual(EXIT_DEFAULTS);
  });

  it('keeps the other update fields at their defaults when only maxMarks is set', () => {
    const result = resolveAnimation({ update: { maxMarks: 5000 } });
    expect(result!.update).toEqual({ ...UPDATE_DEFAULTS, maxMarks: 5000 });
  });

  it('defaults the enter trigger to visible for every shorthand', () => {
    expect(resolveAnimation(true)!.enter!.trigger).toBe('visible');
    expect(resolveAnimation({ enter: true })!.enter!.trigger).toBe('visible');
    expect(resolveAnimation({})!.enter!.trigger).toBe('visible');
    expect(resolveAnimation('fluid')!.enter!.trigger).toBe('visible');
    expect(resolveAnimation('subtle')!.enter!.trigger).toBe('visible');
    expect(resolveAnimation({ enter: { duration: 300 } })!.enter!.trigger).toBe('visible');
  });

  it("respects an explicit enter trigger of 'mount'", () => {
    const result = resolveAnimation({ enter: { trigger: 'mount' } });
    expect(result!.enter).toEqual({ ...ENTER_DEFAULTS, trigger: 'mount' });
    expect(resolveAnimation({ preset: 'fluid', enter: { trigger: 'mount' } })!.enter!.trigger).toBe(
      'mount',
    );
  });

  it('keeps trigger off the update and exit phases', () => {
    const result = resolveAnimation({ enter: { trigger: 'mount' } });
    expect(result!.update!.trigger).toBeUndefined();
    expect(result!.exit!.trigger).toBeUndefined();
  });

  it('does not resurrect a disabled update phase', () => {
    const result = resolveAnimation({
      enter: true,
      update: false,
      exit: false,
    });
    expect(result!.update).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// clampStaggerDelay
// ---------------------------------------------------------------------------

describe('clampStaggerDelay', () => {
  it('returns 0 for single element', () => {
    expect(clampStaggerDelay(30, 1)).toBe(0);
  });

  it('returns 0 for zero elements', () => {
    expect(clampStaggerDelay(30, 0)).toBe(0);
  });

  it('returns delay unchanged for small counts', () => {
    // 9 gaps of 30 = 270, under the 450ms cap
    expect(clampStaggerDelay(30, 10)).toBe(30);
  });

  it('clamps delay for large counts', () => {
    // 199 gaps of 30 = 5970 > 450, so clamp to 450/199
    expect(clampStaggerDelay(30, 200)).toBeCloseTo(450 / 199, 10);
  });

  it('clamps to cap total at 450ms', () => {
    // 7 bars at the default 80ms land 75ms apart (6 gaps); 40 bars 450/39 apart
    expect(clampStaggerDelay(80, 7)).toBe(75);
    expect(clampStaggerDelay(80, 40)).toBeCloseTo(450 / 39, 10);
  });

  it('does not increase delay when already under the cap', () => {
    // 49 gaps of 5 = 245 < 450, keeps at 5
    expect(clampStaggerDelay(5, 50)).toBe(5);
  });
});
