import { describe, expect, it } from 'vitest';
import { buildRaceFrame, type RacePresentation } from '../frame';
import type { RaceSample } from '../types';

const presentation: RacePresentation = {
  keys: ['A', 'B', 'C'],
  labels: ['Team A', 'Team B', 'Team C'],
  colors: ['blue', 'orange', 'purple'],
  formatValue: (value) => `${value.toFixed(1)} km`,
  periods: [
    { value: 2023, sortKey: 0 },
    { value: '2024-01-01', sortKey: 1 },
    { value: '2025-01-01', sortKey: 2 },
  ],
  periodLabels: ['2023', 'Jan 2024', 'Jan 2025'],
  top: 2,
  summary: true,
};
const sample: RaceSample = {
  t: 1.125,
  periodIndex: 1,
  domainMin: -10,
  domainMax: 10,
  items: [
    { keyIndex: 1, value: 5, rank: 2, rankPos: 0.5, opacity: 1, change: -1 },
    { keyIndex: 2, value: 10, rank: 0, rankPos: 1, opacity: 1, change: 1 },
    { keyIndex: 0, value: 6, rank: 1, rankPos: 1.5, opacity: 0.5, change: 0 },
  ],
};

describe('race frame presentation', () => {
  it('preserves draw order, rank state and domain and attaches period and item labels', () => {
    expect(buildRaceFrame(sample, { ...presentation, summary: false })).toEqual({
      t: 1.125,
      period: { index: 1, value: '2024-01-01', label: 'Jan 2024' },
      domain: [-10, 10],
      items: [
        {
          key: 'B',
          label: 'Team B',
          color: 'orange',
          value: 5,
          valueLabel: '5.0 km',
          rank: 2,
          rankPos: 0.5,
          opacity: 1,
          change: -1,
        },
        {
          key: 'C',
          label: 'Team C',
          color: 'purple',
          value: 10,
          valueLabel: '10.0 km',
          rank: 0,
          rankPos: 1,
          opacity: 1,
          change: 1,
        },
        {
          key: 'A',
          label: 'Team A',
          color: 'blue',
          value: 6,
          valueLabel: '6.0 km',
          rank: 1,
          rankPos: 1.5,
          opacity: 0.5,
          change: 0,
        },
      ],
    });
  });

  it.each([
    { top: 2, value: 16, label: '16.0 km' },
    { top: 3, value: 21, label: '21.0 km' },
  ])('sums items in the exact top $top during a smoothed rank change', ({ top, value, label }) => {
    const crossing = {
      ...sample,
      items: sample.items.map((item) => ({ ...item, opacity: Math.min(1, top - item.rankPos) })),
    };
    expect(buildRaceFrame(crossing, { ...presentation, top }).summary).toEqual({ value, label });
  });
});
