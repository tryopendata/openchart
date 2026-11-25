import type { RaceSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { validateSpec } from '../../compiler/validate';
import { prepareRace } from '../prepare';

const spec = {
  type: 'race',
  data: [
    { year: 2022, country: 'France', gdp: 2950 },
    { year: 2023, country: 'France', gdp: 3052 },
    { year: 2024, country: 'France', gdp: 3160 },
    { year: 2024, country: 'Chad', gdp: 20 },
  ],
  encoding: {
    time: { field: 'year', type: 'temporal' },
    key: { field: 'country' },
    value: { field: 'gdp' },
  },
  mark: 'bar',
} satisfies RaceSpec;

function errors(candidate: unknown) {
  return validateSpec(candidate).errors;
}

describe('race top-level playback block', () => {
  it('resolves playback timing fields like the race block', () => {
    const fromPlayback = prepareRace(
      { ...spec, playback: { duration: 12000, loop: true, holdEnd: 300, autoplay: false } },
      {},
    );
    const fromRace = prepareRace(
      { ...spec, race: { duration: 12000, loop: true, holdEnd: 300, autoplay: false } },
      {},
    );
    expect(fromPlayback.playback).toEqual({
      durationMs: 12000,
      holdEndMs: 300,
      loop: true,
      autoplay: false,
      controls: true,
    });
    expect(fromPlayback.playback).toEqual(fromRace.playback);
  });

  it('merges playback fields under race-only fields', () => {
    const model = prepareRace({ ...spec, race: { top: 1 }, playback: { step: 500 } }, {});
    expect(model.spec.race).toMatchObject({ top: 1, step: 500 });
    expect(model.playback.durationMs).toBe(1000);
  });

  it('rejects the same field in race and playback at the playback path', () => {
    expect(
      errors({ ...spec, race: { duration: 8000 }, playback: { duration: 12000 } }),
    ).toContainEqual(
      expect.objectContaining({
        path: '/playback/duration',
        message: 'Spec error: duration is set in both race and playback',
      }),
    );
  });

  it.each(['labels', 'trails'])('rejects playback.%s on a race', (field) => {
    const value = field === 'labels' ? ['France'] : true;
    expect(errors({ ...spec, playback: { [field]: value } })).toContainEqual(
      expect.objectContaining({
        path: `/playback/${field}`,
        message: `Spec error: playback.${field} applies to point and circle charts only`,
      }),
    );
  });

  it('accepts a race with a valid playback block', () => {
    expect(errors({ ...spec, playback: { duration: 12000, loop: true } })).toEqual([]);
  });
});
