import { describe, expect, it } from 'vitest';
import { joinDataToFeatures } from '../join';

describe('unambiguous geography joins', () => {
  const features = [
    { id: 'US', properties: {} },
    { id: 'france', properties: {} },
  ];
  it('leaves duplicate keys uncolored instead of selecting the last observation', () => {
    const result = joinDataToFeatures(
      features,
      [
        { id: 'US', value: 10 },
        { id: 'US', value: 30 },
      ],
      'id',
      'id',
    );
    expect(result.joined.has('US')).toBe(false);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: 'DUPLICATE_DATA_KEYS', context: { keys: ['US'] } }),
    );
  });
  it('keeps exact case matches but rejects ambiguous case-insensitive fallbacks', () => {
    const result = joinDataToFeatures(
      features,
      [
        { id: 'US', value: 10 },
        { id: 'France', value: 20 },
        { id: 'FRANCE', value: 30 },
      ],
      'id',
      'id',
    );
    expect(result.joined.get('US')?.value).toBe(10);
    expect(result.joined.has('france')).toBe(false);
    expect(result.warnings.some((warning) => warning.code === 'AMBIGUOUS_DATA_KEYS')).toBe(true);
    expect(
      joinDataToFeatures(features, [{ id: 'France', value: 20 }], 'id', 'id').joined.get('france')
        ?.value,
    ).toBe(20);
  });
  it('does not match absent keys to a geographic identifier spelled null', () => {
    const result = joinDataToFeatures(
      [{ id: 'null', properties: {} }],
      [{ id: null }, { id: '' }],
      'id',
      'id',
    );
    expect(result.joined.size).toBe(0);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: 'MISSING_DATA_KEYS', context: { count: 2 } }),
    );
  });
});
