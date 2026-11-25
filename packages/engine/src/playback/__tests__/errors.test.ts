import { describe, expect, it } from 'vitest';
import { RaceDataError } from '../../race/errors';
import { PlaybackDataError } from '../errors';

describe('PlaybackDataError', () => {
  it('carries its code and message', () => {
    const error = new PlaybackDataError('NO_VALUES', 'No finite values.');
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('NO_VALUES');
    expect(error.message).toBe('No finite values.');
  });

  it('is the base class of the race data error', () => {
    const error = new RaceDataError('TOO_FEW_PERIODS', 'One period.');
    expect(error).toBeInstanceOf(PlaybackDataError);
    expect(error.code).toBe('TOO_FEW_PERIODS');
    expect(error.name).toBe('RaceDataError');
  });
});
