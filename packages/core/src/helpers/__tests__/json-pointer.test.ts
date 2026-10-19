import { describe, expect, it } from 'vitest';
import { encodePointerToken, jsonPointer } from '../json-pointer';

describe('jsonPointer', () => {
  it('escapes tokens per RFC 6901 and treats no tokens as the root', () => {
    expect(encodePointerToken('a/b~c')).toBe('a~1b~0c');
    expect(encodePointerToken('~1')).toBe('~01');
    expect(jsonPointer('data', 0, 'a/b')).toBe('/data/0/a~1b');
    expect(jsonPointer('')).toBe('/');
    expect(jsonPointer()).toBe('');
  });
});
