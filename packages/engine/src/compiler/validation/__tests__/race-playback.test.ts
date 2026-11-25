import { describe, expect, it } from 'vitest';
import type { ValidationError } from '../../types';
import { validateRacePlayback } from '../race-options';

function validate(race: unknown, playback: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  validateRacePlayback(race, playback, errors);
  return errors;
}

describe('validateRacePlayback', () => {
  it.each([
    ['duration', 'step', { duration: 10000 }, { step: 500 }],
    ['step', 'duration', { step: 500 }, { duration: 10000 }],
  ])('rejects race.%s with playback.%s', (raceField, playbackField, race, playback) => {
    expect(validate(race, playback)).toEqual([
      {
        code: 'INVALID_VALUE',
        path: `/playback/${playbackField}`,
        message: `Spec error: duration and step are mutually exclusive across race and playback (race.${raceField}, playback.${playbackField})`,
        suggestion:
          'Keep duration for the whole race or step for each period, in one block. Remove the other option.',
      },
    ]);
  });

  it('accepts timing split across the blocks without duration and step together', () => {
    expect(validate({ top: 5, duration: 10000 }, { loop: true, holdEnd: 0 })).toEqual([]);
  });
});
