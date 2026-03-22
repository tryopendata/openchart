import { describe, expect, it } from 'vitest';
import { isConditionalValueDef, resolveConditionalValue } from '../conditional';

describe('resolveConditionalValue', () => {
  it('returns condition value when test passes', () => {
    const result = resolveConditionalValue(
      { category: 'A', value: 10 },
      {
        condition: { test: { field: 'category', equal: 'A' }, value: 'red' },
        value: 'gray',
      },
    );
    expect(result).toBe('red');
  });

  it('returns default value when test fails', () => {
    const result = resolveConditionalValue(
      { category: 'B', value: 10 },
      {
        condition: { test: { field: 'category', equal: 'A' }, value: 'red' },
        value: 'gray',
      },
    );
    expect(result).toBe('gray');
  });

  it('evaluates multiple conditions in order', () => {
    const def = {
      condition: [
        { test: { field: 'value', gt: 90 }, value: 'red' },
        { test: { field: 'value', gt: 50 }, value: 'orange' },
        { test: { field: 'value', gt: 0 }, value: 'green' },
      ],
      value: 'gray',
    };

    expect(resolveConditionalValue({ value: 95 }, def)).toBe('red');
    expect(resolveConditionalValue({ value: 70 }, def)).toBe('orange');
    expect(resolveConditionalValue({ value: 25 }, def)).toBe('green');
    expect(resolveConditionalValue({ value: -5 }, def)).toBe('gray');
  });

  it('resolves field reference from condition', () => {
    const result = resolveConditionalValue(
      { category: 'A', label: 'Category A' },
      {
        condition: {
          test: { field: 'category', equal: 'A' },
          field: 'label',
        },
        value: 'unknown',
      },
    );
    expect(result).toBe('Category A');
  });

  it('returns undefined when no condition matches and no default', () => {
    const result = resolveConditionalValue(
      { v: 5 },
      {
        condition: { test: { field: 'v', gt: 100 }, value: 'high' },
      },
    );
    expect(result).toBeUndefined();
  });

  it('works with logical combinators in test', () => {
    const result = resolveConditionalValue(
      { x: 5, y: 15 },
      {
        condition: {
          test: {
            and: [
              { field: 'x', gt: 0 },
              { field: 'y', gt: 10 },
            ],
          },
          value: 'both-positive',
        },
        value: 'nope',
      },
    );
    expect(result).toBe('both-positive');
  });
});

describe('isConditionalValueDef', () => {
  it('returns true for conditional value defs', () => {
    expect(
      isConditionalValueDef({
        condition: { test: { field: 'x', gt: 0 }, value: 'red' },
        value: 'blue',
      }),
    ).toBe(true);
  });

  it('returns false for regular encoding channels', () => {
    expect(isConditionalValueDef({ field: 'x', type: 'quantitative' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isConditionalValueDef(null)).toBe(false);
  });

  it('returns false for primitives', () => {
    expect(isConditionalValueDef('hello')).toBe(false);
    expect(isConditionalValueDef(42)).toBe(false);
  });
});
