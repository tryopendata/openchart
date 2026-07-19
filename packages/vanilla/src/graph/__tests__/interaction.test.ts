import { beforeEach, describe, expect, it } from 'vitest';
import type { InteractionCallbacks } from '../interaction';
import { GraphInteractionManager } from '../interaction';
import { SpatialIndex } from '../spatial-index';
import type { PositionedNode } from '../types';
import { ZoomTransform } from '../zoom';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(id: string, x: number, y: number, radius = 10): PositionedNode {
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

function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  // Mock getBoundingClientRect for coordinate conversion
  canvas.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  return canvas;
}

function createCallbacks(): InteractionCallbacks & {
  transformChanges: ZoomTransform[];
  hoverChanges: (string | null)[];
  selectionChanges: string[][];
  dragStarts: string[];
  drags: Array<{ nodeId: string; x: number; y: number }>;
  dragEnds: string[];
  doubleClicks: string[];
} {
  const state = {
    transformChanges: [] as ZoomTransform[],
    hoverChanges: [] as (string | null)[],
    selectionChanges: [] as string[][],
    dragStarts: [] as string[],
    drags: [] as Array<{ nodeId: string; x: number; y: number }>,
    dragEnds: [] as string[],
    doubleClicks: [] as string[],
    onTransformChange(t: ZoomTransform) {
      state.transformChanges.push(t);
    },
    onHoverChange(nodeId: string | null) {
      state.hoverChanges.push(nodeId);
    },
    onSelectionChange(nodeIds: string[]) {
      state.selectionChanges.push(nodeIds);
    },
    onNodeDragStart(nodeId: string) {
      state.dragStarts.push(nodeId);
    },
    onNodeDrag(nodeId: string, x: number, y: number) {
      state.drags.push({ nodeId, x, y });
    },
    onNodeDragEnd(nodeId: string) {
      state.dragEnds.push(nodeId);
    },
    onDoubleClick(nodeId: string) {
      state.doubleClicks.push(nodeId);
    },
  };
  return state;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GraphInteractionManager', () => {
  let canvas: HTMLCanvasElement;
  let spatialIndex: SpatialIndex;
  let callbacks: ReturnType<typeof createCallbacks>;
  let manager: GraphInteractionManager;

  beforeEach(() => {
    canvas = createMockCanvas();
    spatialIndex = new SpatialIndex();
    callbacks = createCallbacks();

    const nodes = [
      makeNode('center', 400, 300),
      makeNode('left', 100, 300),
      makeNode('right', 700, 300),
    ];
    spatialIndex.rebuild(nodes);

    manager = new GraphInteractionManager(canvas, spatialIndex, callbacks);
  });

  describe('zoom', () => {
    it('updates transform on wheel', () => {
      const wheelEvent = new WheelEvent('wheel', {
        deltaY: -100,
        clientX: 400,
        clientY: 300,
      });
      canvas.dispatchEvent(wheelEvent);

      expect(callbacks.transformChanges.length).toBe(1);
      const t = callbacks.transformChanges[0];
      expect(t.k).toBeGreaterThan(1);
    });

    it('zoom in increases scale', () => {
      // Negative deltaY = zoom in
      canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -200, clientX: 400, clientY: 300 }));
      const t = callbacks.transformChanges[0];
      expect(t.k).toBeGreaterThan(1);
    });

    it('zoom out decreases scale', () => {
      // Positive deltaY = zoom out
      canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 200, clientX: 400, clientY: 300 }));
      const t = callbacks.transformChanges[0];
      expect(t.k).toBeLessThan(1);
    });
  });

  describe('hover', () => {
    it('fires hover change on mousemove over a node', () => {
      // Move over node at (400, 300) with identity transform
      canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 400, clientY: 300 }));

      expect(callbacks.hoverChanges.length).toBeGreaterThan(0);
      expect(callbacks.hoverChanges[callbacks.hoverChanges.length - 1]).toBe('center');
    });

    it('fires null hover on mousemove over background', () => {
      canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 0, clientY: 0 }));

      expect(callbacks.hoverChanges.length).toBeGreaterThan(0);
      expect(callbacks.hoverChanges[callbacks.hoverChanges.length - 1]).toBeNull();
    });
  });

  describe('selection', () => {
    it('selects a node on click', () => {
      // Mousedown on node
      canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 400, clientY: 300 }));
      // Mouseup without moving (click)
      canvas.dispatchEvent(new MouseEvent('mouseup', { clientX: 400, clientY: 300 }));

      expect(callbacks.selectionChanges.length).toBe(1);
      expect(callbacks.selectionChanges[0]).toEqual(['center']);
    });

    it('clears selection on background click', () => {
      // First select a node
      canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 400, clientY: 300 }));
      canvas.dispatchEvent(new MouseEvent('mouseup', { clientX: 400, clientY: 300 }));

      // Then click background
      canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 0, clientY: 0 }));
      canvas.dispatchEvent(new MouseEvent('mouseup', { clientX: 0, clientY: 0 }));

      expect(callbacks.selectionChanges.length).toBe(2);
      expect(callbacks.selectionChanges[1]).toEqual([]);
    });

    it('setSelection replaces the internal set WITHOUT firing onSelectionChange', () => {
      // Select a node (fires once).
      canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 400, clientY: 300 }));
      canvas.dispatchEvent(new MouseEvent('mouseup', { clientX: 400, clientY: 300 }));
      expect(callbacks.selectionChanges.length).toBe(1);

      // Prune the selection — no callback fires (the mount owns downstream sync).
      manager.setSelection([]);
      expect(callbacks.selectionChanges.length).toBe(1);
    });

    it('a shift-click after setSelection prune does not resurrect the pruned id', () => {
      // Shift-click 'center' → selected {center}.
      canvas.dispatchEvent(
        new MouseEvent('mousedown', { clientX: 400, clientY: 300, shiftKey: true }),
      );
      canvas.dispatchEvent(
        new MouseEvent('mouseup', { clientX: 400, clientY: 300, shiftKey: true }),
      );
      expect(callbacks.selectionChanges.at(-1)).toEqual(['center']);

      // The mount prunes the selection (e.g. 'center' was deleted on update).
      manager.setSelection([]);

      // A later shift-click on 'left' must NOT bring 'center' back through the
      // internal set — it would if setSelection hadn't replaced it.
      canvas.dispatchEvent(
        new MouseEvent('mousedown', { clientX: 100, clientY: 300, shiftKey: true }),
      );
      canvas.dispatchEvent(
        new MouseEvent('mouseup', { clientX: 100, clientY: 300, shiftKey: true }),
      );
      expect(callbacks.selectionChanges.at(-1)).toEqual(['left']);
    });
  });

  describe('transform', () => {
    it('setTransform and getTransform work', () => {
      const t = new ZoomTransform(10, 20, 3);
      manager.setTransform(t);
      const got = manager.getTransform();
      expect(got.x).toBe(10);
      expect(got.y).toBe(20);
      expect(got.k).toBe(3);
    });
  });

  describe('cleanup', () => {
    it('destroy removes event listeners (no errors on subsequent events)', () => {
      manager.destroy();

      // Should not throw and should not trigger callbacks
      canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: 400, clientY: 300 }));
      expect(callbacks.transformChanges.length).toBe(0);
    });
  });
});
