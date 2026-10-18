import { describe, expect, it } from 'vitest';
import { classIntervalText, mapLegendCaptionCandidate } from '../legend-semantics';

describe('map class interval semantics', () => {
  const scale = { breaks: [0, 10], colors: ['a', 'b', 'c'], binIndex: () => 0, color: () => 'a' };
  it('describes the exact open and closed class edges from the fill descriptor', () => {
    expect(classIntervalText(scale, 0, String)).toBe('Less than 0');
    expect(classIntervalText(scale, 1, String)).toBe('0 inclusive to 10 exclusive');
    expect(classIntervalText(scale, 2, String)).toBe('10 or greater');
  });
});

describe('map key caption prototype', () => {
  it('reads supplied semantics without inventing units or replacing an explicit title', () => {
    expect(
      mapLegendCaptionCandidate(
        { field: 'change', type: 'quantitative' },
        { label: 'Rate change', unit: 'percentage points' },
      ),
    ).toEqual({ title: 'Rate change', unit: 'percentage points' });
    expect(
      mapLegendCaptionCandidate(
        { field: 'change', title: 'Authored title', type: 'quantitative' },
        { label: 'Rate change' },
      ),
    ).toEqual({ title: 'Authored title', unit: undefined });
    expect(mapLegendCaptionCandidate({ field: 'change', type: 'quantitative' })).toEqual({
      title: 'change',
      unit: undefined,
    });
  });
});
