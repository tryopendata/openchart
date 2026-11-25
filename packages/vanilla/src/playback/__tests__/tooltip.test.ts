import type { ObservedValues } from '@opendata-ai/openchart-engine';
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
