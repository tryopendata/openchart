/**
 * Tests for the animation resolver: resolveAnimation() and clampStaggerDelay().
 *
 * These are pure functions that normalize the various AnimationSpec shorthand
 * forms into a fully resolved config with all defaults filled in.
 */

import { describe, expect, it } from 'vitest';
import { clampStaggerDelay, resolveAnimation } from '../animation';

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

  it('returns defaults for true', () => {
    const result = resolveAnimation(true);
    expect(result).toEqual({
      enabled: true,
      duration: 500,
      ease: 'smooth',
      staggerDelay: 80,
      staggerOrder: 'index',
      annotationDelay: 200,
    });
  });

  it('resolves AnimationConfig with enter: true', () => {
    const result = resolveAnimation({ enter: true });
    expect(result).toBeDefined();
    expect(result!.enabled).toBe(true);
    expect(result!.duration).toBe(500);
    expect(result!.ease).toBe('smooth');
    expect(result!.staggerDelay).toBe(80);
    expect(result!.staggerOrder).toBe('index');
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
    expect(result!.duration).toBe(800);
    expect(result!.ease).toBe('smooth');
    expect(result!.staggerDelay).toBe(40);
    expect(result!.staggerOrder).toBe('value');
  });

  it('returns undefined when enter is false', () => {
    expect(resolveAnimation({ enter: false })).toBeUndefined();
  });

  it('resolves stagger: false to staggerDelay: 0', () => {
    const result = resolveAnimation({ enter: { stagger: false } });
    expect(result).toBeDefined();
    expect(result!.staggerDelay).toBe(0);
  });

  it('uses custom annotationDelay', () => {
    const result = resolveAnimation({ enter: true, annotationDelay: 500 });
    expect(result).toBeDefined();
    expect(result!.annotationDelay).toBe(500);
  });

  it('returns undefined when no phase is specified', () => {
    // Empty config with no enter/update/exit should not produce animation
    expect(resolveAnimation({})).toBeUndefined();
  });

  it('preserves default annotationDelay when not overridden', () => {
    const result = resolveAnimation({ enter: { duration: 1000 } });
    expect(result!.annotationDelay).toBe(200);
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
