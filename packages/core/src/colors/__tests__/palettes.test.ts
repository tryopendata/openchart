import { describe, expect, it } from 'vitest';
import {
  CATEGORICAL_PALETTE,
  DIVERGING_PALETTES,
  DIVERGING_RED_BLUE,
  SEQUENTIAL_BLUE,
  SEQUENTIAL_PALETTES,
} from '../palettes';

describe('palettes', () => {
  it('categorical palette has 10 colors', () => {
    expect(CATEGORICAL_PALETTE).toHaveLength(10);
  });

  it('categorical palette colors are valid hex', () => {
    for (const color of CATEGORICAL_PALETTE) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('sequential palettes have expected keys', () => {
    expect(Object.keys(SEQUENTIAL_PALETTES)).toEqual(
      expect.arrayContaining(['blue', 'green', 'orange', 'purple']),
    );
  });

  it('sequential palettes have 6 stops each', () => {
    for (const [_name, stops] of Object.entries(SEQUENTIAL_PALETTES)) {
      expect(stops.length).toBeGreaterThanOrEqual(5);
      expect(stops.length).toBeLessThanOrEqual(7);
      // Verify all stops are hex
      for (const stop of stops) {
        expect(stop).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it('diverging palettes have expected keys', () => {
    expect(Object.keys(DIVERGING_PALETTES)).toEqual(
      expect.arrayContaining(['redBlue', 'brownTeal']),
    );
  });

  it('diverging palettes have 7 stops (neutral midpoint)', () => {
    for (const stops of Object.values(DIVERGING_PALETTES)) {
      expect(stops).toHaveLength(7);
    }
  });

  it('named palette objects have matching names', () => {
    expect(SEQUENTIAL_BLUE.name).toBe('blue');
    expect(DIVERGING_RED_BLUE.name).toBe('redBlue');
  });
});
