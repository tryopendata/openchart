/**
 * Tests for mark key utilities: serializeKeyValue() and dedupeKeys().
 */

import { describe, expect, it } from 'vitest';
import { dedupeKeys, serializeKeyValue } from '../keys';

// ---------------------------------------------------------------------------
// serializeKeyValue
// ---------------------------------------------------------------------------

describe('serializeKeyValue', () => {
  it('serializes strings as-is', () => {
    expect(serializeKeyValue('hello')).toBe('hello');
    expect(serializeKeyValue('')).toBe('');
  });

  it('serializes numbers to string', () => {
    expect(serializeKeyValue(42)).toBe('42');
    expect(serializeKeyValue(0)).toBe('0');
    expect(serializeKeyValue(-3.14)).toBe('-3.14');
  });

  it('serializes booleans to string', () => {
    expect(serializeKeyValue(true)).toBe('true');
    expect(serializeKeyValue(false)).toBe('false');
  });

  it('serializes null to sentinel', () => {
    expect(serializeKeyValue(null)).toBe('∅');
  });

  it('serializes undefined to sentinel', () => {
    expect(serializeKeyValue(undefined)).toBe('∅');
  });

  it('serializes Date to epoch ms (not locale string)', () => {
    const d = new Date('2024-01-15T00:00:00Z');
    const result = serializeKeyValue(d);
    expect(result).toBe(String(d.getTime()));
    // Confirm it's purely numeric
    expect(Number(result)).toBe(d.getTime());
    // Confirm it does NOT use Date.toString
    expect(result).not.toContain('Jan');
    expect(result).not.toContain('Mon');
  });

  it('two Dates with same epoch produce same key', () => {
    const d1 = new Date('2024-06-01T12:00:00Z');
    const d2 = new Date(d1.getTime());
    expect(serializeKeyValue(d1)).toBe(serializeKeyValue(d2));
  });
});

// ---------------------------------------------------------------------------
// dedupeKeys
// ---------------------------------------------------------------------------

describe('dedupeKeys', () => {
  it('passes unique keys through unchanged', () => {
    expect(dedupeKeys(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('suffixes duplicates with occurrence index', () => {
    expect(dedupeKeys(['a', 'a', 'a'])).toEqual(['a\x010', 'a\x011', 'a\x012']);
  });

  it('only suffixes keys that appear more than once', () => {
    expect(dedupeKeys(['a', 'b', 'a'])).toEqual(['a\x010', 'b', 'a\x011']);
  });

  it('handles empty array', () => {
    expect(dedupeKeys([])).toEqual([]);
  });

  it('handles single element', () => {
    expect(dedupeKeys(['x'])).toEqual(['x']);
  });

  it('handles multiple duplicate groups', () => {
    expect(dedupeKeys(['x', 'y', 'x', 'y', 'z'])).toEqual([
      'x\x010',
      'y\x010',
      'x\x011',
      'y\x011',
      'z',
    ]);
  });
});
