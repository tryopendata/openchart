import type { ChartSpec } from '@opendata-ai/openchart-core';
import { compileChartPlayback, type ObservedValues } from '@opendata-ai/openchart-engine';
import { describe, expect, it } from 'vitest';
import { playbackTooltip } from '../tooltip';
import { createFakePlayback, PERIOD_LABELS } from './fake-playback';

/** Avalon observed in 2000 and 2002; 2001 was filled by interpolation. */
function observed(key: string, t: number): ObservedValues | null {
  if (key !== 'Avalon') return null;
  const period = Math.round(t);
  return {
    periodLabel: PERIOD_LABELS[period],
    filled: period === 1,
    values: { gdp: ['$100', '$150', '$200'][period], life: ['50', '52', '54'][period] },
  };
}

const playback = createFakePlayback({ observed });

describe('playback tooltip', () => {
  it('shows the nearest period’s observed values, labelled with that period', () => {
    const content = playbackTooltip(playback, 'Avalon', 0.3);
    expect(content.title).toContain('Avalon');
    expect(content.title).toContain('2000');
    expect(content.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'GDP per capita', value: '$100' }),
        expect.objectContaining({ label: 'life', value: '50' }),
      ]),
    );
  });

  it('follows the playhead to the next period past the midpoint', () => {
    const content = playbackTooltip(playback, 'Avalon', 1.7);
    expect(content.title).toContain('2002');
    expect(content.fields).toEqual(
      expect.arrayContaining([expect.objectContaining({ value: '$200' })]),
    );
  });

  it('says so when the nearest period was gap-filled', () => {
    const filled = JSON.stringify(playbackTooltip(playback, 'Avalon', 1));
    const observedOnly = JSON.stringify(playbackTooltip(playback, 'Avalon', 0));
    expect(filled).toMatch(/estimat|interpolat|filled/i);
    expect(observedOnly).not.toMatch(/estimat|interpolat|filled/i);
  });

  it('has no fields for a key with no values near t', () => {
    expect(playbackTooltip(playback, 'Borea', 1).fields).toEqual([]);
  });
});

describe('playback tooltip on bars', () => {
  const pyramidRows = [2000, 2001].flatMap((year) => [
    { sex: 'Male', age: '0-4', pop: 50, year },
    { sex: 'Female', age: '0-4', pop: 48, year },
    { sex: 'Male', age: '5-9', pop: 30, year },
    { sex: 'Female', age: '5-9', pop: 31, year },
  ]);
  const compile = (spec: ChartSpec) =>
    compileChartPlayback(spec, { width: 600, height: 400, onWarn: () => {} });
  const titlesAt = (spec: ChartSpec, t: number) => {
    const playback = compile(spec);
    return playback.keys.map((key) => playbackTooltip(playback, key, t).title).sort();
  };

  it('titles a pyramid bar with its age group and sex, not the internal key', () => {
    const pyramid: ChartSpec = {
      mark: { type: 'bar', mirror: true },
      data: pyramidRows,
      encoding: {
        y: { field: 'age', type: 'ordinal' },
        x: { field: 'pop', type: 'quantitative' },
        color: { field: 'sex', type: 'nominal' },
        time: { field: 'year', type: 'temporal' },
      },
    };
    expect(titlesAt(pyramid, 0)).toEqual([
      '0-4, Female, 2000',
      '0-4, Male, 2000',
      '5-9, Female, 2000',
      '5-9, Male, 2000',
    ]);
  });

  it('titles a plain bar with its category alone', () => {
    const bars: ChartSpec = {
      mark: 'bar',
      data: pyramidRows.filter((row) => row.sex === 'Male'),
      encoding: {
        y: { field: 'age', type: 'nominal' },
        x: { field: 'pop', type: 'quantitative' },
        time: { field: 'year', type: 'temporal' },
      },
    };
    expect(titlesAt(bars, 1)).toEqual(['0-4, 2001', '5-9, 2001']);
  });
});
