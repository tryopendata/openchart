import { describe, expect, it } from 'vitest';
import { endpointPrecisionStep } from '../precision';

describe('endpoint set precision', () => {
  it.each([
    [[5, 2.8, 0.8], 0.1],
    [['5', '2.8'], 0.1],
    [['1000000', '2800000'], 1],
    [['', false, true], 1],
    [[0, -5, 10], 1],
    [[-0.01, 5], 0.01],
    [[1e-7, 2], 0.01],
    [[1e4, 2], 1],
    [[null, Number.NaN, Number.POSITIVE_INFINITY], 1],
  ])('resolves %j to shared step %s', (values, step) => {
    expect(endpointPrecisionStep(values)).toBe(step);
  });
});
