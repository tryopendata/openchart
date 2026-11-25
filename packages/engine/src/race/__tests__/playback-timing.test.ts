import type { RaceSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { prepareRace } from '../prepare';

const spec = {
  type: 'race',
  data: [
    { year: 2022, country: 'France', gdp: 2950 },
    { year: 2023, country: 'France', gdp: 3052 },
    { year: 2024, country: 'France', gdp: 3160 },
  ],
  encoding: {
    time: { field: 'year', type: 'temporal' },
    key: { field: 'country' },
    value: { field: 'gdp' },
  },
  mark: 'bar',
} satisfies RaceSpec;

describe('race step overflow', () => {
  it.each([
    ['race', { race: { step: Number.MAX_VALUE } }],
    ['playback', { playback: { step: Number.MAX_VALUE } }],
  ])('names the %s block that supplied the step', (block, timing) => {
    expect(() => prepareRace({ ...spec, ...timing }, {})).toThrow(
      new RangeError(`${block}.step is too large for 3 periods. Use a shorter step.`),
    );
  });
});
