import { describe, expect, it } from 'vitest';
import type { ValidationError } from '../../types';
import { validatePlaybackBlock } from '../playback';

function validate(blockName: 'race' | 'playback', value: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  validatePlaybackBlock(blockName, value, errors);
  return errors;
}

describe('validatePlaybackBlock', () => {
  it('accepts every shared field and the chart-only fields on a playback block', () => {
    expect(
      validate('playback', {
        duration: 12000,
        gaps: 'hold',
        holdEnd: 0,
        loop: true,
        autoplay: 'visible',
        controls: true,
        period: { format: '%Y', position: 'center' },
        labels: ['France'],
        trails: ['France'],
      }),
    ).toEqual([]);
  });

  it('rejects an unknown playback key at its path', () => {
    expect(validate('playback', { durration: 1000 })).toEqual([
      expect.objectContaining({
        code: 'INVALID_VALUE',
        path: '/playback/durration',
        message: expect.stringContaining('Unknown playback option'),
      }),
    ]);
  });

  it('reports duration and step together at the block path', () => {
    expect(validate('playback', { duration: 1000, step: 100 })).toEqual([
      expect.objectContaining({
        path: '/playback',
        message: expect.stringMatching(/playback\.duration.*playback\.step/),
      }),
    ]);
  });

  it.each([
    ['duration', -1],
    ['step', 0],
    ['holdEnd', Number.NaN],
    ['gaps', 'skip'],
    ['loop', 'yes'],
    ['controls', 1],
    ['autoplay', 'scroll'],
    ['period', 'top'],
  ])('rejects an invalid playback.%s at its path', (field, value) => {
    const errors = validate('playback', { [field]: value });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      path: `/playback/${field}`,
      message: expect.stringContaining(`playback.${field}`),
    });
  });

  it('rejects an unknown period position', () => {
    expect(validate('playback', { period: { position: 'middle' } })).toEqual([
      expect.objectContaining({ path: '/playback/period/position' }),
    ]);
  });

  it('rejects a playback block that is not an object', () => {
    expect(validate('playback', 'fast')).toEqual([
      expect.objectContaining({ code: 'INVALID_TYPE', path: '/playback' }),
    ]);
  });

  it('keeps the race messages and paths unchanged', () => {
    expect(validate('race', { duration: 1000, step: 100 })).toEqual([
      {
        code: 'INVALID_VALUE',
        path: '/race',
        message: 'Spec error: race.duration and race.step are mutually exclusive',
        suggestion:
          'Keep duration for the whole race or step for each period. Remove the other option.',
      },
    ]);
    expect(validate('race', { holdEnd: -1 })).toEqual([
      {
        code: 'INVALID_VALUE',
        path: '/race/holdEnd',
        message: 'Spec error: race.holdEnd must be a finite number of zero or more',
        suggestion: 'Use holdEnd: 0 or omit the option. Times are in milliseconds.',
      },
    ]);
    expect(validate('race', { loop: 'yes' })).toEqual([
      {
        code: 'INVALID_VALUE',
        path: '/race/loop',
        message: 'Spec error: race.loop must be true or false',
        suggestion: 'Use loop: false to disable it or loop: true to enable it.',
      },
    ]);
  });

  it('leaves race-only fields to the race validator', () => {
    expect(validate('race', { top: 5, swap: 300, rescale: 'fixed', summary: 'sum' })).toEqual([]);
  });
});
