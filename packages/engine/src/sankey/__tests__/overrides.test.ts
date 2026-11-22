import { describe, expect, it } from 'vitest';
import { applySankeyOverride } from '../overrides';

const base = {
  type: 'sankey',
  data: [{ from: 'A', to: 'B', amount: 1 }],
  chrome: { title: 'Desktop', source: 'LLNL' },
  nodePadding: 16,
};

describe('applySankeyOverride', () => {
  it('copies only the fields an override may set', () => {
    const spec = {
      ...base,
      overrides: { compact: { data: [], type: 'line', nodePadding: 4, other: 0.02 } },
    };
    const merged = applySankeyOverride(spec, 360);
    expect(merged.data).toBe(base.data);
    expect(merged.type).toBe('sankey');
    expect(merged.nodePadding).toBe(4);
    expect(merged.other).toBe(0.02);
  });

  it('merges chrome one level deep', () => {
    const spec = { ...base, overrides: { medium: { chrome: { title: 'Tablet' } } } };
    expect(applySankeyOverride(spec, 500).chrome).toEqual({ title: 'Tablet', source: 'LLNL' });
  });

  it('returns the spec untouched at full width or without a block for the breakpoint', () => {
    const spec = { ...base, overrides: { compact: { nodePadding: 4 } } };
    expect(applySankeyOverride(spec, 1280)).toBe(spec);
    expect(applySankeyOverride(spec, 500)).toBe(spec);
  });
});
