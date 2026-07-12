import { describe, expect, it } from 'vitest';
import { computeArrowheadPoints } from '../geometry';

describe('computeArrowheadPoints', () => {
  it('produces a downward-pointing arrow for a downward tangent', () => {
    const head = computeArrowheadPoints(100, 200, 0, 1);
    expect(head.tip).toEqual({ x: 100, y: 200 });
    // Base should be above the tip (tangent points down)
    expect(head.baseLeft.y).toBeLessThan(head.tip.y);
    expect(head.baseRight.y).toBeLessThan(head.tip.y);
    // Base corners symmetric around the tangent axis
    expect(head.baseLeft.x).toBeLessThan(head.tip.x);
    expect(head.baseRight.x).toBeGreaterThan(head.tip.x);
  });

  it('produces a rightward-pointing arrow for a rightward tangent', () => {
    const head = computeArrowheadPoints(200, 100, 1, 0);
    expect(head.tip).toEqual({ x: 200, y: 100 });
    // Base should be to the left of the tip
    expect(head.baseLeft.x).toBeLessThan(head.tip.x);
    expect(head.baseRight.x).toBeLessThan(head.tip.x);
  });

  it('respects custom length and halfWidth', () => {
    const defaultHead = computeArrowheadPoints(100, 200, 0, 1);
    const bigHead = computeArrowheadPoints(100, 200, 0, 1, 16, 8);

    // Bigger arrow should have base further from tip
    const defaultBaseDist = Math.abs(defaultHead.baseLeft.y - defaultHead.tip.y);
    const bigBaseDist = Math.abs(bigHead.baseLeft.y - bigHead.tip.y);
    expect(bigBaseDist).toBeGreaterThan(defaultBaseDist);

    // Bigger arrow should have wider base
    const defaultWidth = Math.abs(defaultHead.baseLeft.x - defaultHead.baseRight.x);
    const bigWidth = Math.abs(bigHead.baseLeft.x - bigHead.baseRight.x);
    expect(bigWidth).toBeGreaterThan(defaultWidth);
  });

  it('handles diagonal tangent', () => {
    const head = computeArrowheadPoints(100, 100, 1, 1);
    expect(head.tip).toEqual({ x: 100, y: 100 });
    // Base points should be behind the tip along the diagonal
    const baseMidX = (head.baseLeft.x + head.baseRight.x) / 2;
    const baseMidY = (head.baseLeft.y + head.baseRight.y) / 2;
    expect(baseMidX).toBeLessThan(head.tip.x);
    expect(baseMidY).toBeLessThan(head.tip.y);
  });

  it('uses defaults of length=7, halfWidth=3.5', () => {
    const head = computeArrowheadPoints(100, 200, 0, 1);
    // For a pure downward tangent, base is 7px above tip
    expect(head.baseLeft.y).toBeCloseTo(193);
    expect(head.baseRight.y).toBeCloseTo(193);
    // Base corners are 3.5px to each side
    expect(head.baseLeft.x).toBeCloseTo(96.5);
    expect(head.baseRight.x).toBeCloseTo(103.5);
  });

  it('handles zero-length tangent gracefully', () => {
    const head = computeArrowheadPoints(100, 100, 0, 0);
    expect(head.tip).toEqual({ x: 100, y: 100 });
    // Should not produce NaN
    expect(Number.isFinite(head.baseLeft.x)).toBe(true);
    expect(Number.isFinite(head.baseLeft.y)).toBe(true);
  });
});
