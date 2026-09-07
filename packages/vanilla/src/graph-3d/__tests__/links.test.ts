/**
 * Unit tests for the per-link scene objects.
 *
 * `widthAsAlpha` is the above-threshold half of the `edgeWidth` encoding and
 * has no other coverage: past `LINK_WIDTH_MAX_EDGES` the mount stops building
 * cylinders and the width becomes a resting-opacity ramp instead, so this is
 * the only place the encoding survives on a hairball.
 */

import type { CompiledGraphEdge } from '@opendata-ai/openchart-engine';
import { describe, expect, it, vi } from 'vitest';

vi.mock('three', async () => await import('./three-fake'));

import { applyLinkVisuals, createLinkObject, linkShapeMatches, widthAsAlpha } from '../links';

function edge(overrides: Partial<CompiledGraphEdge> = {}): CompiledGraphEdge {
  return {
    source: 'a',
    target: 'b',
    stroke: '#888888',
    strokeWidth: 1,
    ...overrides,
  } as CompiledGraphEdge;
}

describe('widthAsAlpha', () => {
  it('maps the widest edge to 1 and the narrowest to the floor', () => {
    const alpha = widthAsAlpha([edge({ strokeWidth: 1 }), edge({ strokeWidth: 4 })], 0.15);
    expect(alpha.get(0)).toBeCloseTo(0.15);
    expect(alpha.get(1)).toBeCloseTo(1);
  });

  it('quantizes to four steps so a hairball reads as tiers, not noise', () => {
    const widths = [1, 1.2, 1.4, 2, 2.6, 3, 3.6, 4];
    const alpha = widthAsAlpha(
      widths.map((w) => edge({ strokeWidth: w })),
      0.15,
    );
    expect(new Set(alpha.values()).size).toBeLessThanOrEqual(4);
  });

  it('is monotone in stroke width', () => {
    const alpha = widthAsAlpha(
      [1, 2, 3, 4].map((w) => edge({ strokeWidth: w })),
      0.15,
    );
    const values = [0, 1, 2, 3].map((i) => alpha.get(i) as number);
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
  });

  it('gives every edge full alpha when they all have the same width', () => {
    const alpha = widthAsAlpha([edge(), edge(), edge()], 0.15);
    expect([...alpha.values()]).toEqual([1, 1, 1]);
  });

  it('returns an empty map for an empty edge list', () => {
    expect(widthAsAlpha([]).size).toBe(0);
  });
});

describe('applyLinkVisuals', () => {
  it('swaps the cylinder geometry when the encoded width changes', () => {
    const obj = createLinkObject(edge({ strokeWidth: 2 }), true, 0.3);
    const before = obj.geometry;
    applyLinkVisuals(obj, edge({ strokeWidth: 8 }), true);
    expect(obj.geometry).not.toBe(before);
    expect(
      (obj.geometry as unknown as { parameters: { radiusTop: number } }).parameters.radiusTop,
    ).toBe(4);
    // The mesh has to see the new geometry, not just the bookkeeping record.
    expect((obj.object as unknown as { geometry: unknown }).geometry).toBe(obj.geometry);
  });

  it('leaves the geometry alone when the width is unchanged', () => {
    const obj = createLinkObject(edge({ strokeWidth: 2 }), true, 0.3);
    const before = obj.geometry;
    applyLinkVisuals(obj, edge({ strokeWidth: 2, stroke: '#ff0000' }), true);
    expect(obj.geometry).toBe(before);
    expect((obj.material.color as unknown as { value: string }).value).toBe('#ff0000');
  });

  it('swaps a solid line material for a dashed one when the style changes', () => {
    const obj = createLinkObject(edge(), false, 0.4);
    expect(obj.dashed).toBe(false);
    applyLinkVisuals(obj, edge({ style: 'dashed' }), false);
    expect(obj.dashed).toBe(true);
    expect((obj.material as unknown as { type: string }).type).toBe('LineDashedMaterial');
    expect((obj.object as unknown as { material: unknown }).material).toBe(obj.material);
    // The emphasis alpha survives the swap.
    expect(obj.material.opacity).toBeCloseTo(0.4);
  });

  it('rebuilds the material when the dash pattern changes between dash styles', () => {
    const obj = createLinkObject(edge({ style: 'dashed' }), false, 0.4);
    const before = obj.material;
    applyLinkVisuals(obj, edge({ style: 'dotted' }), false);
    expect(obj.material).not.toBe(before);
    expect((obj.material as unknown as { dashSize: number }).dashSize).toBeLessThan(
      (before as unknown as { dashSize: number }).dashSize,
    );
  });
});

describe('linkShapeMatches', () => {
  it('reports the shape class the object actually has', () => {
    const line = createLinkObject(edge(), false, 0.3);
    const cylinder = createLinkObject(edge(), true, 0.3);
    expect(linkShapeMatches(line, false)).toBe(true);
    expect(linkShapeMatches(line, true)).toBe(false);
    expect(linkShapeMatches(cylinder, true)).toBe(true);
    expect(linkShapeMatches(cylinder, false)).toBe(false);
  });
});
