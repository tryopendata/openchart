import { describe, expect, it } from 'vitest';
import { assignRaceColors } from '../colors';
import type { RaceMatrix, RaceTimeline } from '../types';

const matrix: RaceMatrix = {
  keys: ['A', 'B', 'C', 'D', 'E', 'F'],
  labels: ['A', 'B', 'C', 'D', 'E', 'F'],
  colorValues: ['east', null, 'south', 'south', 'west', null],
  periods: [2022, 2023, 2024].map((value) => ({ value, sortKey: value })),
  values: [
    [8, 7, 4],
    [4, 9, 11],
    [10, 2, 9],
    [3, 2, 3],
    [12, 12, 9],
    [2, 1, 2],
  ].map((values) => new Float64Array(values)),
};
const orderedKeys = [
  [4, 2, 0, 1, 3, 5],
  [4, 1, 0, 2, 3, 5],
  [1, 4, 2, 0, 3, 5],
];
const timeline: RaceTimeline = {
  keyCount: 6,
  periodCount: 3,
  top: 2,
  valueAt: (keyIndex, t) => matrix.values[keyIndex][t],
  exactRank: (keyIndex, t) => orderedKeys[t].indexOf(keyIndex),
  rankPos: (keyIndex, t) => Math.min(2, orderedKeys[t].indexOf(keyIndex)),
  sample(t) {
    return {
      t,
      periodIndex: t,
      items: orderedKeys[t].slice(0, this.top).map((keyIndex, rank) => ({
        keyIndex,
        rank,
        rankPos: rank,
        value: this.valueAt(keyIndex, t),
        opacity: 1,
        change: 0,
      })),
      domainMin: 0,
      domainMax: this.valueAt(orderedKeys[t][0], t),
    };
  },
};
const palette = ['red', 'blue', 'green', 'orange', 'purple', 'brown'];

describe('race colors', () => {
  it('assigns colors on first top-N appearance, then to unseen keys in key order', () => {
    expect(assignRaceColors(matrix, timeline, palette, undefined, 'team')).toEqual([
      'orange',
      'green',
      'blue',
      'purple',
      'red',
      'brown',
    ]);
  });

  it('colors by key when the color field is the key field', () => {
    expect(assignRaceColors(matrix, timeline, palette, { field: 'team' }, 'team')).toEqual([
      'orange',
      'green',
      'blue',
      'purple',
      'red',
      'brown',
    ]);
  });

  it('shares colors between keys with the same category, including missing categories', () => {
    expect(assignRaceColors(matrix, timeline, palette, { field: 'region' }, 'team')).toEqual([
      'orange',
      'green',
      'blue',
      'blue',
      'red',
      'green',
    ]);
  });

  it('assigns a constant color to every key', () => {
    expect(assignRaceColors(matrix, timeline, palette, { value: '#abc' }, 'team')).toEqual([
      '#abc',
      '#abc',
      '#abc',
      '#abc',
      '#abc',
      '#abc',
    ]);
  });

  it('cycles the palette as new keys appear', () => {
    expect(assignRaceColors(matrix, timeline, ['red', 'blue'], undefined, 'team')).toEqual([
      'blue',
      'red',
      'blue',
      'red',
      'red',
      'blue',
    ]);
  });

  it('assigns colors when smoothed rows first become visible in an integer sample', () => {
    const transitioning: RaceTimeline = {
      ...timeline,
      sample(t) {
        const sample = timeline.sample(t);
        if (t !== 1) return sample;
        return {
          ...sample,
          items: [
            sample.items[0],
            { keyIndex: 0, value: 7, rank: 2, rankPos: 0.9, opacity: 1, change: 0 },
            sample.items[1],
          ],
        };
      },
    };
    expect(assignRaceColors(matrix, transitioning, palette, undefined, 'team')).toEqual([
      'green',
      'orange',
      'blue',
      'purple',
      'red',
      'brown',
    ]);
    expect(assignRaceColors(matrix, transitioning, palette, { field: 'region' }, 'team')).toEqual([
      'green',
      'orange',
      'blue',
      'blue',
      'red',
      'orange',
    ]);
  });
});
