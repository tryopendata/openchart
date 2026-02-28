import { describe, expect, it } from 'vitest';
import { SpatialIndex } from '../spatial-index';
import type { PositionedNode } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(id: string, x: number, y: number, radius = 5): PositionedNode {
  return {
    id,
    x,
    y,
    radius,
    fill: '#3b82f6',
    stroke: '#2563eb',
    strokeWidth: 1,
    label: id,
    labelPriority: 0.5,
    community: undefined,
    data: {},
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SpatialIndex', () => {
  describe('findNearest', () => {
    it('returns the correct nearest node', () => {
      const idx = new SpatialIndex();
      const nodes = [makeNode('a', 0, 0), makeNode('b', 100, 100), makeNode('c', 200, 200)];
      idx.rebuild(nodes);

      const result = idx.findNearest(10, 10);
      expect(result).not.toBeNull();
      expect(result!.id).toBe('a');
    });

    it('returns null for empty tree', () => {
      const idx = new SpatialIndex();
      expect(idx.findNearest(0, 0)).toBeNull();
    });

    it('respects maxDistance', () => {
      const idx = new SpatialIndex();
      const nodes = [makeNode('a', 100, 100, 5)];
      idx.rebuild(nodes);

      // Distance from (0,0) to node center is ~141, minus radius 5 = ~136
      const tooFar = idx.findNearest(0, 0, 10);
      expect(tooFar).toBeNull();

      // With a large enough distance, should find it
      const found = idx.findNearest(0, 0, 200);
      expect(found).not.toBeNull();
      expect(found!.id).toBe('a');
    });

    it('handles radius-based hit (clicking within a large node)', () => {
      const idx = new SpatialIndex();
      // Node at (100, 100) with radius 50
      const nodes = [makeNode('big', 100, 100, 50)];
      idx.rebuild(nodes);

      // Click at (120, 120) -- within the 50px radius of the node
      // Distance from center = ~28px, well within 50px radius
      const hit = idx.findNearest(120, 120, 0);
      // effectiveDist = max(0, 28.28 - 50) = 0, so it should be found with maxDistance=0
      expect(hit).not.toBeNull();
      expect(hit!.id).toBe('big');
    });

    it('prefers closer nodes even when a large node is present', () => {
      const idx = new SpatialIndex();
      const nodes = [makeNode('small-close', 10, 10, 5), makeNode('big-far', 200, 200, 50)];
      idx.rebuild(nodes);

      const result = idx.findNearest(12, 12);
      expect(result).not.toBeNull();
      expect(result!.id).toBe('small-close');
    });
  });

  describe('findInRect', () => {
    it('returns all nodes inside the rectangle', () => {
      const idx = new SpatialIndex();
      const nodes = [makeNode('a', 50, 50), makeNode('b', 150, 150), makeNode('c', 250, 250)];
      idx.rebuild(nodes);

      const result = idx.findInRect(0, 0, 200, 200);
      const ids = result.map((n) => n.id).sort();
      expect(ids).toEqual(['a', 'b']);
    });

    it('returns empty array for empty tree', () => {
      const idx = new SpatialIndex();
      const result = idx.findInRect(0, 0, 100, 100);
      expect(result).toEqual([]);
    });

    it('handles inverted coordinates (x2 < x1)', () => {
      const idx = new SpatialIndex();
      const nodes = [makeNode('a', 50, 50), makeNode('b', 150, 150)];
      idx.rebuild(nodes);

      // Inverted rect: same area as (0,0)-(200,200)
      const result = idx.findInRect(200, 200, 0, 0);
      expect(result.length).toBe(2);
    });

    it('returns correct subset', () => {
      const idx = new SpatialIndex();
      const nodes = [
        makeNode('origin', 0, 0),
        makeNode('top-right', 100, 0),
        makeNode('bottom-left', 0, 100),
        makeNode('center', 50, 50),
        makeNode('far', 500, 500),
      ];
      idx.rebuild(nodes);

      const result = idx.findInRect(0, 0, 60, 60);
      const ids = result.map((n) => n.id).sort();
      expect(ids).toEqual(['center', 'origin']);
    });
  });

  describe('generation tracking', () => {
    it('increments generation on rebuild', () => {
      const idx = new SpatialIndex();
      expect(idx.getGeneration()).toBe(0);

      idx.rebuild([makeNode('a', 0, 0)]);
      expect(idx.getGeneration()).toBe(1);

      idx.rebuild([makeNode('a', 10, 10)]);
      expect(idx.getGeneration()).toBe(2);
    });
  });
});
