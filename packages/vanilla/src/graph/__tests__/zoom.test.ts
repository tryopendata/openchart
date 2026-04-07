import { describe, expect, it } from 'vitest';
import type { PositionedNode } from '../types';
import { ZoomTransform } from '../zoom';

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
    label: undefined,
    labelPriority: 0.5,
    community: undefined,
    data: {},
  };
}

// ---------------------------------------------------------------------------
// Tests: screenToGraph / graphToScreen inverse
// ---------------------------------------------------------------------------

describe('ZoomTransform', () => {
  describe('coordinate conversion', () => {
    it('screenToGraph and graphToScreen are inverse at identity', () => {
      const t = ZoomTransform.identity();
      const screen = { x: 100, y: 200 };
      const graph = t.screenToGraph(screen.x, screen.y);
      const back = t.graphToScreen(graph.x, graph.y);
      expect(back.x).toBeCloseTo(screen.x);
      expect(back.y).toBeCloseTo(screen.y);
    });

    it('screenToGraph and graphToScreen are inverse with pan', () => {
      const t = new ZoomTransform(50, -30, 1);
      const screen = { x: 200, y: 150 };
      const graph = t.screenToGraph(screen.x, screen.y);
      const back = t.graphToScreen(graph.x, graph.y);
      expect(back.x).toBeCloseTo(screen.x);
      expect(back.y).toBeCloseTo(screen.y);
    });

    it('screenToGraph and graphToScreen are inverse with zoom', () => {
      const t = new ZoomTransform(0, 0, 2.5);
      const screen = { x: 300, y: 400 };
      const graph = t.screenToGraph(screen.x, screen.y);
      const back = t.graphToScreen(graph.x, graph.y);
      expect(back.x).toBeCloseTo(screen.x);
      expect(back.y).toBeCloseTo(screen.y);
    });

    it('screenToGraph and graphToScreen are inverse with pan+zoom', () => {
      const t = new ZoomTransform(100, -50, 3);
      const screen = { x: 250, y: 175 };
      const graph = t.screenToGraph(screen.x, screen.y);
      const back = t.graphToScreen(graph.x, graph.y);
      expect(back.x).toBeCloseTo(screen.x);
      expect(back.y).toBeCloseTo(screen.y);
    });

    it('graphToScreen follows gx * k + x formula', () => {
      const t = new ZoomTransform(10, 20, 2);
      const result = t.graphToScreen(5, 10);
      expect(result.x).toBe(5 * 2 + 10); // 20
      expect(result.y).toBe(10 * 2 + 20); // 40
    });

    it('screenToGraph follows (sx - x) / k formula', () => {
      const t = new ZoomTransform(10, 20, 2);
      const result = t.screenToGraph(20, 40);
      expect(result.x).toBe((20 - 10) / 2); // 5
      expect(result.y).toBe((40 - 20) / 2); // 10
    });
  });

  // -------------------------------------------------------------------------
  // zoomAt preserves pivot point
  // -------------------------------------------------------------------------

  describe('zoomAt', () => {
    it('preserves the pivot point position', () => {
      const t = new ZoomTransform(50, 100, 1);
      const pivotX = 200;
      const pivotY = 150;

      // Graph point under the pivot before
      const before = t.screenToGraph(pivotX, pivotY);

      // Zoom to 2x at the pivot
      const t2 = t.zoomAt(2, pivotX, pivotY);

      // Graph point under the pivot after
      const after = t2.screenToGraph(pivotX, pivotY);

      expect(after.x).toBeCloseTo(before.x, 5);
      expect(after.y).toBeCloseTo(before.y, 5);
    });

    it('preserves pivot at high zoom', () => {
      const t = new ZoomTransform(0, 0, 1);
      const pivot = { x: 400, y: 300 };

      const before = t.screenToGraph(pivot.x, pivot.y);
      const t2 = t.zoomAt(10, pivot.x, pivot.y);
      const after = t2.screenToGraph(pivot.x, pivot.y);

      expect(after.x).toBeCloseTo(before.x, 5);
      expect(after.y).toBeCloseTo(before.y, 5);
    });

    it('updates the scale', () => {
      const t = ZoomTransform.identity();
      const t2 = t.zoomAt(3, 100, 100);
      expect(t2.k).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // pan
  // -------------------------------------------------------------------------

  describe('pan', () => {
    it('adds delta to x and y', () => {
      const t = new ZoomTransform(10, 20, 1);
      const t2 = t.pan(5, -3);
      expect(t2.x).toBe(15);
      expect(t2.y).toBe(17);
      expect(t2.k).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // fitBounds
  // -------------------------------------------------------------------------

  describe('fitBounds', () => {
    it('returns identity for empty node array', () => {
      const { transform: t } = ZoomTransform.fitBounds([], 800, 600);
      expect(t.x).toBe(0);
      expect(t.y).toBe(0);
      expect(t.k).toBe(1);
    });

    it('centers a single node', () => {
      const nodes = [makeNode('a', 0, 0)];
      const { transform: t } = ZoomTransform.fitBounds(nodes, 800, 600, 40);
      // Single node at origin should be centered
      // Transform should put graph origin at screen center
      const screen = t.graphToScreen(0, 0);
      expect(screen.x).toBeCloseTo(400);
      expect(screen.y).toBeCloseTo(300);
    });

    it('fits a spread of nodes within the canvas', () => {
      const nodes = [makeNode('a', -200, -100), makeNode('b', 200, 100)];
      const { transform: t } = ZoomTransform.fitBounds(nodes, 800, 600, 40);

      // Both nodes should map to within the canvas bounds (with padding)
      const sa = t.graphToScreen(-200, -100);
      const sb = t.graphToScreen(200, 100);

      expect(sa.x).toBeGreaterThanOrEqual(40);
      expect(sa.y).toBeGreaterThanOrEqual(40);
      expect(sb.x).toBeLessThanOrEqual(760);
      expect(sb.y).toBeLessThanOrEqual(560);
    });

    it('produces correct scale for known graph bounds', () => {
      // Graph spans 400x200, canvas 800x600, padding 0
      const nodes = [makeNode('a', 0, 0, 0), makeNode('b', 400, 200, 0)];
      const { transform: t } = ZoomTransform.fitBounds(nodes, 800, 600, 0);
      // Scale capped at 1 (never zoom in past natural size)
      expect(t.k).toBeCloseTo(1);
    });

    it('returns contentHeight matching scaled graph bounds plus padding', () => {
      const nodes = [makeNode('a', 0, 0, 0), makeNode('b', 400, 200, 0)];
      const { contentHeight } = ZoomTransform.fitBounds(nodes, 800, 600, 40);
      // k = min(1, 720/400, 520/200) = 1 (capped)
      // contentHeight = 200 * 1 + 80 = 280
      expect(contentHeight).toBeCloseTo(280);
    });
  });

  // -------------------------------------------------------------------------
  // identity
  // -------------------------------------------------------------------------

  describe('identity', () => {
    it('has x=0, y=0, k=1', () => {
      const t = ZoomTransform.identity();
      expect(t.x).toBe(0);
      expect(t.y).toBe(0);
      expect(t.k).toBe(1);
    });
  });
});
