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

  it('returns undefined for undefined', () => {
    expect(resolveAnimation(undefined)).toBeUndefined();
  });

  it('returns all three phases with defaults for true', () => {
    const result = resolveAnimation(true);
    expect(result).toEqual({
      enter: { ...ENTER_DEFAULTS },
      update: { ...UPDATE_DEFAULTS },
      exit: { ...EXIT_DEFAULTS },
      annotationDelay: 200,
    });
  });

  it('resolves AnimationConfig with enter: true', () => {
    const result = resolveAnimation({ enter: true });
    expect(result).toBeDefined();
    expect(result!.enter).toEqual(ENTER_DEFAULTS);
    expect(result!.update).toEqual(UPDATE_DEFAULTS);
    expect(result!.exit).toEqual(EXIT_DEFAULTS);
    expect(result!.annotationDelay).toBe(200);
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
    expect(result!.annotationDelay).toBe(200);
  });

  it('enter phase uses ENTER_DEFAULTS for unspecified fields', () => {
    const result = resolveAnimation({ enter: { duration: 1000 } });
    expect(result!.enter).toEqual({
      duration: 1000,
      ease: 'smooth',
      staggerDelay: 80,
      staggerOrder: 'index',
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

  it('exit phase uses EXIT_DEFAULTS (shorter duration)', () => {
    const result = resolveAnimation(true);
    expect(result!.exit).toEqual({
      duration: 300,
      ease: 'smooth',
      staggerDelay: 0,
      staggerOrder: 'index',
    });
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
    // 30 * 10 = 300, well under 2000ms cap
    expect(clampStaggerDelay(30, 10)).toBe(30);
  });

  it('clamps delay for large counts', () => {
    // 30 * 200 = 6000 > 2000, so clamp to 2000/200 = 10
    expect(clampStaggerDelay(30, 200)).toBe(10);
  });

  it('clamps to cap total at 2000ms', () => {
    // 50 * 100 = 5000 > 2000, so clamp to 2000/100 = 20
    expect(clampStaggerDelay(50, 100)).toBe(20);
  });

  it('does not increase delay when already under the cap', () => {
    // 5 * 50 = 250 < 2000, keeps at 5
    expect(clampStaggerDelay(5, 50)).toBe(5);
  });
});
