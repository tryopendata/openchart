import { describe, expect, it } from 'vitest';
import { evaluatePredicate } from '../predicates';

describe('evaluatePredicate', () => {
  describe('FieldPredicate: equal', () => {
    it('matches equal string value', () => {
      expect(evaluatePredicate({ name: 'Alice' }, { field: 'name', equal: 'Alice' })).toBe(true);
    });

    it('rejects non-equal value', () => {
      expect(evaluatePredicate({ name: 'Bob' }, { field: 'name', equal: 'Alice' })).toBe(false);
    });

    it('matches equal numeric value', () => {
      expect(evaluatePredicate({ age: 30 }, { field: 'age', equal: 30 })).toBe(true);
    });
  });

  describe('FieldPredicate: lt/lte/gt/gte', () => {
    it('lt: value less than threshold', () => {
      expect(evaluatePredicate({ v: 5 }, { field: 'v', lt: 10 })).toBe(true);
      expect(evaluatePredicate({ v: 10 }, { field: 'v', lt: 10 })).toBe(false);
    });

    it('lte: value less than or equal', () => {
      expect(evaluatePredicate({ v: 10 }, { field: 'v', lte: 10 })).toBe(true);
      expect(evaluatePredicate({ v: 11 }, { field: 'v', lte: 10 })).toBe(false);
    });

    it('gt: value greater than threshold', () => {
      expect(evaluatePredicate({ v: 15 }, { field: 'v', gt: 10 })).toBe(true);
      expect(evaluatePredicate({ v: 10 }, { field: 'v', gt: 10 })).toBe(false);
    });

    it('gte: value greater than or equal', () => {
      expect(evaluatePredicate({ v: 10 }, { field: 'v', gte: 10 })).toBe(true);
      expect(evaluatePredicate({ v: 9 }, { field: 'v', gte: 10 })).toBe(false);
    });
  });

  describe('FieldPredicate: range', () => {
    it('includes values within range', () => {
      expect(evaluatePredicate({ v: 5 }, { field: 'v', range: [1, 10] })).toBe(true);
    });

    it('includes boundary values', () => {
      expect(evaluatePredicate({ v: 1 }, { field: 'v', range: [1, 10] })).toBe(true);
      expect(evaluatePredicate({ v: 10 }, { field: 'v', range: [1, 10] })).toBe(true);
    });

    it('excludes values outside range', () => {
      expect(evaluatePredicate({ v: 0 }, { field: 'v', range: [1, 10] })).toBe(false);
      expect(evaluatePredicate({ v: 11 }, { field: 'v', range: [1, 10] })).toBe(false);
    });
  });

  describe('FieldPredicate: oneOf', () => {
    it('matches values in the set', () => {
      expect(evaluatePredicate({ c: 'red' }, { field: 'c', oneOf: ['red', 'blue'] })).toBe(true);
    });

    it('rejects values not in the set', () => {
      expect(evaluatePredicate({ c: 'green' }, { field: 'c', oneOf: ['red', 'blue'] })).toBe(false);
    });
  });

  describe('FieldPredicate: valid', () => {
    it('valid=true passes for normal values', () => {
      expect(evaluatePredicate({ v: 42 }, { field: 'v', valid: true })).toBe(true);
      expect(evaluatePredicate({ v: 'hello' }, { field: 'v', valid: true })).toBe(true);
    });

    it('valid=true rejects null/undefined/NaN', () => {
      expect(evaluatePredicate({ v: null }, { field: 'v', valid: true })).toBe(false);
      expect(evaluatePredicate({ v: undefined }, { field: 'v', valid: true })).toBe(false);
      expect(evaluatePredicate({ v: NaN }, { field: 'v', valid: true })).toBe(false);
    });

    it('valid=false passes for null/undefined/NaN', () => {
      expect(evaluatePredicate({ v: null }, { field: 'v', valid: false })).toBe(true);
      expect(evaluatePredicate({ v: NaN }, { field: 'v', valid: false })).toBe(true);
    });

    it('valid=false rejects normal values', () => {
      expect(evaluatePredicate({ v: 42 }, { field: 'v', valid: false })).toBe(false);
    });
  });

  describe('LogicalAnd', () => {
    it('passes when all conditions match', () => {
      const pred = {
        and: [
          { field: 'v', gt: 5 },
          { field: 'v', lt: 15 },
        ],
      };
      expect(evaluatePredicate({ v: 10 }, pred)).toBe(true);
    });

    it('fails when any condition fails', () => {
      const pred = {
        and: [
          { field: 'v', gt: 5 },
          { field: 'v', lt: 15 },
        ],
      };
      expect(evaluatePredicate({ v: 20 }, pred)).toBe(false);
    });
  });

  describe('LogicalOr', () => {
    it('passes when any condition matches', () => {
      const pred = {
        or: [
          { field: 'c', equal: 'red' },
          { field: 'c', equal: 'blue' },
        ],
      };
      expect(evaluatePredicate({ c: 'blue' }, pred)).toBe(true);
    });

    it('fails when no condition matches', () => {
      const pred = {
        or: [
          { field: 'c', equal: 'red' },
          { field: 'c', equal: 'blue' },
        ],
      };
      expect(evaluatePredicate({ c: 'green' }, pred)).toBe(false);
    });
  });

  describe('LogicalNot', () => {
    it('inverts a passing condition', () => {
      expect(evaluatePredicate({ v: 5 }, { not: { field: 'v', gt: 10 } })).toBe(true);
    });

    it('inverts a failing condition', () => {
      expect(evaluatePredicate({ v: 15 }, { not: { field: 'v', gt: 10 } })).toBe(false);
    });
  });

  describe('nested logical combinators', () => {
    it('handles and inside or', () => {
      const pred = {
        or: [
          {
            and: [
              { field: 'x', gt: 0 },
              { field: 'x', lt: 10 },
            ],
          },
          { field: 'x', equal: 100 },
        ],
      };
      expect(evaluatePredicate({ x: 5 }, pred)).toBe(true);
      expect(evaluatePredicate({ x: 100 }, pred)).toBe(true);
      expect(evaluatePredicate({ x: 50 }, pred)).toBe(false);
    });

    it('handles not inside and', () => {
      const pred = {
        and: [{ field: 'x', gt: 0 }, { not: { field: 'x', equal: 5 } }],
      };
      expect(evaluatePredicate({ x: 3 }, pred)).toBe(true);
      expect(evaluatePredicate({ x: 5 }, pred)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('missing field returns true for no-op predicate', () => {
      // A field predicate with no comparison operators defaults to true
      expect(evaluatePredicate({ other: 1 }, { field: 'v' })).toBe(true);
    });
  });
});
