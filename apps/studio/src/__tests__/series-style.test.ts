import { describe, expect, it } from 'vitest';
import { revenueSpec } from '../patterns';
import { changeSeriesColor, seriesColors } from '../series-style';

describe('series color editing', () => {
  it('shows compiled colors and preserves unedited colors across data reorder', () => {
    const before = seriesColors(revenueSpec);
    expect(before.size).toBeGreaterThan(2);
    const name = [...before.keys()][0];
    const next = changeSeriesColor(revenueSpec, before, name, '#ff0000');
    const after = seriesColors({ ...next, data: [...next.data].reverse() });
    expect(after.get(name)).toBe('#ff0000');
    for (const [key, color] of before) if (key !== name) expect(after.get(key)).toBe(color);
  });
});
