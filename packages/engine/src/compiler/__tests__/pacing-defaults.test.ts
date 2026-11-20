import { describe, expect, it } from 'vitest';
import { ENTER_DEFAULTS, MAX_TOTAL_STAGGER_MS, UPDATE_DEFAULTS } from '../animation';

describe('entrance pacing defaults', () => {
  it('enter runs 800ms with an 80ms stagger capped at 450ms total', () => {
    expect(ENTER_DEFAULTS.duration).toBe(800);
    expect(ENTER_DEFAULTS.staggerDelay).toBe(80);
    expect(ENTER_DEFAULTS.ease).toBe('smooth');
    expect(MAX_TOTAL_STAGGER_MS).toBe(450);
  });

  it('update keeps 500ms', () => {
    expect(UPDATE_DEFAULTS.duration).toBe(500);
  });
});
