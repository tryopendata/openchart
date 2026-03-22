import { describe, expect, it } from 'vitest';
import { runCalculate } from '../calculate';

describe('runCalculate', () => {
  const data = [
    { x: 10, y: 3 },
    { x: -5, y: 2 },
    { x: 100, y: 0 },
  ];

  describe('binary operations with field2', () => {
    it('adds two fields', () => {
      const result = runCalculate(data, {
        calculate: { op: '+', field: 'x', field2: 'y' },
        as: 'sum',
      });
      expect(result[0].sum).toBe(13);
      expect(result[1].sum).toBe(-3);
    });

    it('subtracts two fields', () => {
      const result = runCalculate(data, {
        calculate: { op: '-', field: 'x', field2: 'y' },
        as: 'diff',
      });
      expect(result[0].diff).toBe(7);
    });

    it('multiplies two fields', () => {
      const result = runCalculate(data, {
        calculate: { op: '*', field: 'x', field2: 'y' },
        as: 'product',
      });
      expect(result[0].product).toBe(30);
    });

    it('divides two fields', () => {
      const result = runCalculate(data, {
        calculate: { op: '/', field: 'x', field2: 'y' },
        as: 'ratio',
      });
      expect(result[0].ratio).toBeCloseTo(10 / 3);
    });
  });

  describe('binary operations with value', () => {
    it('adds a constant', () => {
      const result = runCalculate(data, {
        calculate: { op: '+', field: 'x', value: 5 },
        as: 'result',
      });
      expect(result[0].result).toBe(15);
    });

    it('multiplies by a constant', () => {
      const result = runCalculate(data, {
        calculate: { op: '*', field: 'x', value: 2 },
        as: 'result',
      });
      expect(result[0].result).toBe(20);
    });
  });

  describe('division by zero', () => {
    it('returns NaN for division by zero', () => {
      const result = runCalculate(data, {
        calculate: { op: '/', field: 'x', field2: 'y' },
        as: 'ratio',
      });
      // Third row: x=100, y=0
      expect(result[2].ratio).toBeNaN();
    });
  });

  describe('unary operations', () => {
    it('abs', () => {
      const result = runCalculate(data, {
        calculate: { op: 'abs', field: 'x' },
        as: 'result',
      });
      expect(result[0].result).toBe(10);
      expect(result[1].result).toBe(5);
    });

    it('round', () => {
      const floatData = [{ v: 3.7 }, { v: 3.2 }];
      const result = runCalculate(floatData, {
        calculate: { op: 'round', field: 'v' },
        as: 'result',
      });
      expect(result[0].result).toBe(4);
      expect(result[1].result).toBe(3);
    });

    it('floor', () => {
      const floatData = [{ v: 3.9 }];
      const result = runCalculate(floatData, {
        calculate: { op: 'floor', field: 'v' },
        as: 'result',
      });
      expect(result[0].result).toBe(3);
    });

    it('ceil', () => {
      const floatData = [{ v: 3.1 }];
      const result = runCalculate(floatData, {
        calculate: { op: 'ceil', field: 'v' },
        as: 'result',
      });
      expect(result[0].result).toBe(4);
    });

    it('log', () => {
      const result = runCalculate([{ v: Math.E }], {
        calculate: { op: 'log', field: 'v' },
        as: 'result',
      });
      expect(result[0].result).toBeCloseTo(1);
    });

    it('sqrt', () => {
      const result = runCalculate([{ v: 16 }], {
        calculate: { op: 'sqrt', field: 'v' },
        as: 'result',
      });
      expect(result[0].result).toBe(4);
    });
  });

  it('preserves existing fields', () => {
    const result = runCalculate(data, {
      calculate: { op: 'abs', field: 'x' },
      as: 'absX',
    });
    expect(result[0].x).toBe(10);
    expect(result[0].y).toBe(3);
  });

  it('handles empty data', () => {
    const result = runCalculate([], {
      calculate: { op: '+', field: 'x', value: 1 },
      as: 'result',
    });
    expect(result).toHaveLength(0);
  });
});
