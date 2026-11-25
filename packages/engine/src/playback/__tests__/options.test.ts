import { describe, expect, it } from 'vitest';
import { resolvePlayback } from '../options';

describe('resolvePlayback', () => {
  it('applies the shared defaults', () => {
    expect(resolvePlayback(undefined, 20)).toEqual({
      durationMs: 14000,
      holdEndMs: 1500,
      loop: false,
      autoplay: 'visible',
      controls: true,
      gaps: 'interpolate',
      period: { position: 'auto' },
    });
  });

  it.each([
    [3, 8000],
    [20, 14000],
    [200, 90000],
  ])('defaults %i periods to the race duration rule: %i ms', (periods, durationMs) => {
    expect(resolvePlayback({}, periods).durationMs).toBe(durationMs);
  });

  it('keeps an authored duration and derives duration from step', () => {
    expect(resolvePlayback({ duration: 12000 }, 50).durationMs).toBe(12000);
    expect(resolvePlayback({ step: 500 }, 5).durationMs).toBe(2000);
  });

  it('keeps authored timing, controls and period fields', () => {
    expect(
      resolvePlayback(
        {
          holdEnd: 0,
          loop: true,
          autoplay: false,
          controls: false,
          gaps: 'hold',
          period: { format: '%Y', position: 'center' },
        },
        4,
      ),
    ).toMatchObject({
      holdEndMs: 0,
      loop: true,
      autoplay: false,
      controls: false,
      gaps: 'hold',
      period: { format: '%Y', position: 'center' },
    });
    expect(resolvePlayback({ period: false }, 4).period).toBe(false);
  });

  it('throws the race step overflow error when step x intervals is not finite', () => {
    expect(() => resolvePlayback({ step: Number.MAX_VALUE }, 3, 'race')).toThrow(
      new RangeError('race.step is too large for 3 periods. Use a shorter step.'),
    );
    expect(() => resolvePlayback({ step: Number.MAX_VALUE }, 3)).toThrow(RangeError);
  });
});
