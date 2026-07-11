import { describe, expect, it } from 'vitest';
import { deepMergeSpec } from '../deep-merge';

describe('deepMergeSpec', () => {
  it('merges nested plain objects key by key', () => {
    const base = { encoding: { x: { field: 'a' }, y: { field: 'b' } }, chrome: { title: 'X' } };
    const patch = { encoding: { y: { field: 'c' } } };
    expect(deepMergeSpec(base, patch)).toEqual({
      encoding: { x: { field: 'a' }, y: { field: 'c' } },
      chrome: { title: 'X' },
    });
  });

  it('replaces arrays wholesale rather than merging by index', () => {
    const base = { annotations: [{ type: 'text', text: 'old' }] };
    const patch = { annotations: [{ type: 'refline', y: 5 }] };
    expect(deepMergeSpec(base, patch)).toEqual({
      annotations: [{ type: 'refline', y: 5 }],
    });
  });

  it('leaves target untouched when patch value is undefined', () => {
    const base = { chrome: { title: 'X' } };
    expect(deepMergeSpec(base, { chrome: { title: undefined } })).toEqual({
      chrome: { title: 'X' },
    });
  });

  it('overwrites with null explicitly', () => {
    const base = { encoding: { color: { field: 'a' } } };
    expect(deepMergeSpec(base, { encoding: { color: null } })).toEqual({
      encoding: { color: null },
    });
  });

  it('does not mutate the source objects', () => {
    const base = { encoding: { x: { field: 'a' } } };
    const patch = { encoding: { x: { field: 'b' } } };
    const result = deepMergeSpec(base, patch);
    expect(result).not.toBe(base);
    expect(base.encoding.x.field).toBe('a');
  });

  it('cumulative patches compose left to right', () => {
    let spec: Record<string, unknown> = { mark: 'line', encoding: { y: { field: 'a' } } };
    const patches = [{ chrome: { title: 'Step 1' } }, { encoding: { y: { field: 'b' } } }];
    for (const p of patches) spec = deepMergeSpec(spec, p);
    expect(spec).toEqual({
      mark: 'line',
      encoding: { y: { field: 'b' } },
      chrome: { title: 'Step 1' },
    });
  });
});
