import { beforeEach, describe, expect, it, vi } from 'vitest';
import { attachGraphKeyboardNav, type KeyboardNavOptions } from '../keyboard';
import type { PositionedNode } from '../types';

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
  return canvas;
}

/**
 * Build a standard set of positioned nodes for directional testing.
 *
 *              up (400, 100)
 *               |
 *  left (100, 300) -- center (400, 300) -- right (700, 300)
 *               |
 *             down (400, 500)
 */
function makeCrossNodes(): PositionedNode[] {
  return [
    makeNode('center', 400, 300),
    makeNode('right', 700, 300),
    makeNode('left', 100, 300),
    makeNode('up', 400, 100),
    makeNode('down', 400, 500),
  ];
}

/** Adjacency where center connects to all four directions. */
function makeCrossAdjacency(): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  adj.set('center', new Set(['right', 'left', 'up', 'down']));
  adj.set('right', new Set(['center']));
  adj.set('left', new Set(['center']));
  adj.set('up', new Set(['center']));
  adj.set('down', new Set(['center']));
  return adj;
}

interface MockCallbacks {
  onSelect: ReturnType<typeof vi.fn>;
  onDeselect: ReturnType<typeof vi.fn>;
  onZoom: ReturnType<typeof vi.fn>;
  onFitAll: ReturnType<typeof vi.fn>;
  onFocusSearch: ReturnType<typeof vi.fn>;
}

function createOptions(overrides?: Partial<KeyboardNavOptions>): {
  options: KeyboardNavOptions;
  callbacks: MockCallbacks;
  canvas: HTMLCanvasElement;
} {
  const canvas = overrides?.canvas ?? createMockCanvas();
  const nodes = makeCrossNodes();
  const adjacency = makeCrossAdjacency();

  const callbacks: MockCallbacks = {
    onSelect: vi.fn(),
    onDeselect: vi.fn(),
    onZoom: vi.fn(),
    onFitAll: vi.fn(),
    onFocusSearch: vi.fn(),
  };

  const options: KeyboardNavOptions = {
    canvas,
    getNodes: () => nodes,
    getSelectedIds: () => [],
    getAdjacency: () => adjacency,
    onSelect: callbacks.onSelect,
    onDeselect: callbacks.onDeselect,
    onZoom: callbacks.onZoom,
    onFitAll: callbacks.onFitAll,
    onFocusSearch: callbacks.onFocusSearch,
    ...overrides,
  };

  return { options, callbacks, canvas };
}

function keydown(canvas: HTMLCanvasElement, key: string): void {
  canvas.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('attachGraphKeyboardNav', () => {
  let canvas: HTMLCanvasElement;
  let callbacks: MockCallbacks;
  let cleanup: () => void;

  beforeEach(() => {
    const setup = createOptions();
    canvas = setup.canvas;
    callbacks = setup.callbacks;
    cleanup = attachGraphKeyboardNav(setup.options);
  });

  // -----------------------------------------------------------------------
  // Tab focus
  // -----------------------------------------------------------------------

  describe('Tab', () => {
    it('focuses the first node when none selected', () => {
      // Tab should set internal focus to first node (center). It does not
      // call onSelect on its own -- the focus is internal. Arrow keys after
      // Tab will use the focused node for navigation.
      keydown(canvas, 'Tab');

      // Verify focus by pressing ArrowRight, which should navigate from
      // center to right and call onSelect('right').
      keydown(canvas, 'ArrowRight');
      expect(callbacks.onSelect).toHaveBeenCalledWith('right');
    });

    it('focuses the selected node when one is already selected', () => {
      const {
        options,
        callbacks: cbs,
        canvas: c,
      } = createOptions({
        getSelectedIds: () => ['left'],
      });
      const cl = attachGraphKeyboardNav(options);

      keydown(c, 'Tab');
      // Now focused on 'left'. ArrowRight from left should navigate to center.
      keydown(c, 'ArrowRight');
      expect(cbs.onSelect).toHaveBeenCalledWith('center');

      cl();
    });

    it('does nothing when there are no nodes', () => {
      const {
        options,
        callbacks: cbs,
        canvas: c,
      } = createOptions({
        getNodes: () => [],
      });
      const cl = attachGraphKeyboardNav(options);

      keydown(c, 'Tab');
      // No error, no callbacks fired
      expect(cbs.onSelect).not.toHaveBeenCalled();

      cl();
    });
  });

  // -----------------------------------------------------------------------
  // Arrow key navigation
  // -----------------------------------------------------------------------

  describe('ArrowKey navigation', () => {
    // First Tab to set focus to center, then test arrow keys
    function focusCenter(): void {
      keydown(canvas, 'Tab');
    }

    it('ArrowRight navigates to the right neighbor', () => {
      focusCenter();
      keydown(canvas, 'ArrowRight');
      expect(callbacks.onSelect).toHaveBeenCalledWith('right');
    });

    it('ArrowLeft navigates to the left neighbor', () => {
      focusCenter();
      keydown(canvas, 'ArrowLeft');
      expect(callbacks.onSelect).toHaveBeenCalledWith('left');
    });

    it('ArrowUp navigates to the up neighbor', () => {
      focusCenter();
      keydown(canvas, 'ArrowUp');
      expect(callbacks.onSelect).toHaveBeenCalledWith('up');
    });

    it('ArrowDown navigates to the down neighbor', () => {
      focusCenter();
      keydown(canvas, 'ArrowDown');
      expect(callbacks.onSelect).toHaveBeenCalledWith('down');
    });

    it('does nothing when no node is focused', () => {
      // No Tab pressed, so no focus. Arrow keys should be no-ops.
      keydown(canvas, 'ArrowRight');
      expect(callbacks.onSelect).not.toHaveBeenCalled();
    });

    it('does nothing when there are no neighbors', () => {
      const isolated = [makeNode('alone', 400, 300)];
      const emptyAdj = new Map<string, Set<string>>();
      emptyAdj.set('alone', new Set());

      const {
        options,
        callbacks: cbs,
        canvas: c,
      } = createOptions({
        getNodes: () => isolated,
        getAdjacency: () => emptyAdj,
      });
      const cl = attachGraphKeyboardNav(options);

      keydown(c, 'Tab');
      keydown(c, 'ArrowRight');
      expect(cbs.onSelect).not.toHaveBeenCalled();

      cl();
    });

    it('does nothing when adjacency has no entry for focused node', () => {
      const isolated = [makeNode('alone', 400, 300)];
      const emptyAdj = new Map<string, Set<string>>();
      // No entry at all for 'alone'

      const {
        options,
        callbacks: cbs,
        canvas: c,
      } = createOptions({
        getNodes: () => isolated,
        getAdjacency: () => emptyAdj,
      });
      const cl = attachGraphKeyboardNav(options);

      keydown(c, 'Tab');
      keydown(c, 'ArrowRight');
      expect(cbs.onSelect).not.toHaveBeenCalled();

      cl();
    });
  });

  // -----------------------------------------------------------------------
  // Enter toggles selection
  // -----------------------------------------------------------------------

  describe('Enter', () => {
    it('selects the focused node when not already selected', () => {
      keydown(canvas, 'Tab'); // focus center
      keydown(canvas, 'Enter');
      expect(callbacks.onSelect).toHaveBeenCalledWith('center');
    });

    it('deselects the focused node when already selected', () => {
      const {
        options,
        callbacks: cbs,
        canvas: c,
      } = createOptions({
        getSelectedIds: () => ['center'],
      });
      const cl = attachGraphKeyboardNav(options);

      keydown(c, 'Tab'); // focus goes to selected node 'center'
      keydown(c, 'Enter');
      expect(cbs.onDeselect).toHaveBeenCalled();
      expect(cbs.onSelect).not.toHaveBeenCalled();

      cl();
    });

    it('does nothing when no node is focused', () => {
      keydown(canvas, 'Enter');
      expect(callbacks.onSelect).not.toHaveBeenCalled();
      expect(callbacks.onDeselect).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Escape clears focus and selection
  // -----------------------------------------------------------------------

  describe('Escape', () => {
    it('clears focus and calls onDeselect', () => {
      keydown(canvas, 'Tab'); // focus center
      keydown(canvas, 'Escape');

      expect(callbacks.onDeselect).toHaveBeenCalled();

      // Focus is cleared, so arrow keys should do nothing
      keydown(canvas, 'ArrowRight');
      expect(callbacks.onSelect).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Zoom keys
  // -----------------------------------------------------------------------

  describe('zoom keys', () => {
    it('+ triggers zoom in', () => {
      keydown(canvas, '+');
      expect(callbacks.onZoom).toHaveBeenCalledWith('in');
    });

    it('= triggers zoom in', () => {
      keydown(canvas, '=');
      expect(callbacks.onZoom).toHaveBeenCalledWith('in');
    });

    it('- triggers zoom out', () => {
      keydown(canvas, '-');
      expect(callbacks.onZoom).toHaveBeenCalledWith('out');
    });

    it('_ triggers zoom out', () => {
      keydown(canvas, '_');
      expect(callbacks.onZoom).toHaveBeenCalledWith('out');
    });
  });

  // -----------------------------------------------------------------------
  // Home / fit all
  // -----------------------------------------------------------------------

  describe('Home', () => {
    it('triggers fitAll', () => {
      keydown(canvas, 'Home');
      expect(callbacks.onFitAll).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // / search focus
  // -----------------------------------------------------------------------

  describe('/ (search)', () => {
    it('triggers focusSearch when provided', () => {
      keydown(canvas, '/');
      expect(callbacks.onFocusSearch).toHaveBeenCalled();
    });

    it('does not throw when onFocusSearch is not provided', () => {
      const { options, canvas: c } = createOptions();
      // Remove the onFocusSearch callback
      delete (options as Partial<KeyboardNavOptions>).onFocusSearch;
      const cl = attachGraphKeyboardNav(options);

      expect(() => keydown(c, '/')).not.toThrow();

      cl();
    });
  });

  // -----------------------------------------------------------------------
  // Canvas tabindex
  // -----------------------------------------------------------------------

  describe('tabindex', () => {
    it('sets tabindex="0" on canvas if not already set', () => {
      const c = createMockCanvas();
      const { options } = createOptions({ canvas: c });
      const cl = attachGraphKeyboardNav(options);

      expect(c.getAttribute('tabindex')).toBe('0');

      cl();
    });

    it('preserves existing tabindex', () => {
      const c = createMockCanvas();
      c.setAttribute('tabindex', '-1');
      const { options } = createOptions({ canvas: c });
      const cl = attachGraphKeyboardNav(options);

      expect(c.getAttribute('tabindex')).toBe('-1');

      cl();
    });
  });

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  describe('cleanup', () => {
    it('removes the keydown listener', () => {
      cleanup();

      keydown(canvas, '+');
      expect(callbacks.onZoom).not.toHaveBeenCalled();

      keydown(canvas, 'Home');
      expect(callbacks.onFitAll).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // pickDirectionalNeighbor scoring
  // -----------------------------------------------------------------------

  describe('directional scoring', () => {
    it('right prefers positive dx even with some dy offset', () => {
      // Center at (0, 0). Two neighbors: one slightly up-right, one slightly down-left.
      const nodes = [
        makeNode('center', 0, 0),
        makeNode('up-right', 100, -30), // dx=100, dy=-30 -> score = 100 - 15 = 85
        makeNode('down-left', -50, 20), // dx=-50, dy=20 -> score = -50 - 10 = -60
      ];
      const adj = new Map<string, Set<string>>();
      adj.set('center', new Set(['up-right', 'down-left']));
      adj.set('up-right', new Set(['center']));
      adj.set('down-left', new Set(['center']));

      const {
        options,
        callbacks: cbs,
        canvas: c,
      } = createOptions({
        getNodes: () => nodes,
        getAdjacency: () => adj,
      });
      const cl = attachGraphKeyboardNav(options);

      keydown(c, 'Tab');
      keydown(c, 'ArrowRight');
      expect(cbs.onSelect).toHaveBeenCalledWith('up-right');

      cl();
    });

    it('left prefers negative dx', () => {
      const nodes = [
        makeNode('center', 0, 0),
        makeNode('far-left', -200, 10), // -dx = 200, penalty = 5 -> 195
        makeNode('slight-right', 50, -10), // -dx = -50, penalty = 5 -> -55
      ];
      const adj = new Map<string, Set<string>>();
      adj.set('center', new Set(['far-left', 'slight-right']));
      adj.set('far-left', new Set(['center']));
      adj.set('slight-right', new Set(['center']));

      const {
        options,
        callbacks: cbs,
        canvas: c,
      } = createOptions({
        getNodes: () => nodes,
        getAdjacency: () => adj,
      });
      const cl = attachGraphKeyboardNav(options);

      keydown(c, 'Tab');
      keydown(c, 'ArrowLeft');
      expect(cbs.onSelect).toHaveBeenCalledWith('far-left');

      cl();
    });

    it('down prefers positive dy', () => {
      const nodes = [
        makeNode('center', 0, 0),
        makeNode('below', 20, 150), // dy=150, penalty for dx=10 -> 140
        makeNode('above', -10, -100), // dy=-100, penalty for dx=5 -> -105
      ];
      const adj = new Map<string, Set<string>>();
      adj.set('center', new Set(['below', 'above']));
      adj.set('below', new Set(['center']));
      adj.set('above', new Set(['center']));

      const {
        options,
        callbacks: cbs,
        canvas: c,
      } = createOptions({
        getNodes: () => nodes,
        getAdjacency: () => adj,
      });
      const cl = attachGraphKeyboardNav(options);

      keydown(c, 'Tab');
      keydown(c, 'ArrowDown');
      expect(cbs.onSelect).toHaveBeenCalledWith('below');

      cl();
    });

    it('up prefers negative dy', () => {
      const nodes = [
        makeNode('center', 0, 0),
        makeNode('above', 15, -200), // -dy=200, penalty for dx=7.5 -> 192.5
        makeNode('below', -5, 80), // -dy=-80, penalty for dx=2.5 -> -82.5
      ];
      const adj = new Map<string, Set<string>>();
      adj.set('center', new Set(['above', 'below']));
      adj.set('above', new Set(['center']));
      adj.set('below', new Set(['center']));

      const {
        options,
        callbacks: cbs,
        canvas: c,
      } = createOptions({
        getNodes: () => nodes,
        getAdjacency: () => adj,
      });
      const cl = attachGraphKeyboardNav(options);

      keydown(c, 'Tab');
      keydown(c, 'ArrowUp');
      expect(cbs.onSelect).toHaveBeenCalledWith('above');

      cl();
    });

    it('picks closest match when two neighbors are in the same direction', () => {
      // Two nodes to the right, one closer and better aligned
      const nodes = [
        makeNode('center', 0, 0),
        makeNode('near-right', 100, 0), // dx=100, dy=0 -> score 100
        makeNode('far-right', 300, 50), // dx=300, dy=50 -> score 300 - 25 = 275
      ];
      const adj = new Map<string, Set<string>>();
      adj.set('center', new Set(['near-right', 'far-right']));
      adj.set('near-right', new Set(['center']));
      adj.set('far-right', new Set(['center']));

      const {
        options,
        callbacks: cbs,
        canvas: c,
      } = createOptions({
        getNodes: () => nodes,
        getAdjacency: () => adj,
      });
      const cl = attachGraphKeyboardNav(options);

      keydown(c, 'Tab');
      keydown(c, 'ArrowRight');
      // far-right has higher score (275 > 100) due to larger dx
      expect(cbs.onSelect).toHaveBeenCalledWith('far-right');

      cl();
    });

    it('penalizes perpendicular offset in scoring', () => {
      // Two candidates to the right: one perfectly aligned, one with big y offset
      const nodes = [
        makeNode('center', 0, 0),
        makeNode('aligned', 80, 0), // dx=80, dy=0 -> score 80
        makeNode('offset', 100, 200), // dx=100, dy=200 -> score 100 - 100 = 0
      ];
      const adj = new Map<string, Set<string>>();
      adj.set('center', new Set(['aligned', 'offset']));
      adj.set('aligned', new Set(['center']));
      adj.set('offset', new Set(['center']));

      const {
        options,
        callbacks: cbs,
        canvas: c,
      } = createOptions({
        getNodes: () => nodes,
        getAdjacency: () => adj,
      });
      const cl = attachGraphKeyboardNav(options);

      keydown(c, 'Tab');
      keydown(c, 'ArrowRight');
      // aligned (80) beats offset (0) because the perpendicular penalty kicks in
      expect(cbs.onSelect).toHaveBeenCalledWith('aligned');

      cl();
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('Tab keeps focus if the focused node still exists', () => {
      // Tab once to focus center
      keydown(canvas, 'Tab');
      // Tab again -- focusedNodeId is still valid, should keep it
      keydown(canvas, 'Tab');
      // Arrow right from center should still go to right
      keydown(canvas, 'ArrowRight');
      expect(callbacks.onSelect).toHaveBeenCalledWith('right');
    });

    it('Tab refocuses to first node if focused node was removed', () => {
      const mutableNodes = [...makeCrossNodes()];
      const {
        options,
        callbacks: cbs,
        canvas: c,
      } = createOptions({
        getNodes: () => mutableNodes,
      });
      const cl = attachGraphKeyboardNav(options);

      // Tab to focus center (first node)
      keydown(c, 'Tab');
      // Navigate right to focus on 'right'
      keydown(c, 'ArrowRight');
      expect(cbs.onSelect).toHaveBeenCalledWith('right');

      // Remove the 'right' node from the list
      const rightIdx = mutableNodes.findIndex((n) => n.id === 'right');
      mutableNodes.splice(rightIdx, 1);

      // Tab again -- focused node 'right' no longer exists via findNodeById,
      // so Tab falls through to refocus on nodes[0] which is 'center'
      keydown(c, 'Tab');

      // Enter to confirm we're focused on center
      keydown(c, 'Enter');
      expect(cbs.onSelect).toHaveBeenLastCalledWith('center');

      cl();
    });

    it('sequential navigation updates focus correctly', () => {
      // Tab to center, then right, then the focus should be on 'right'
      keydown(canvas, 'Tab');
      keydown(canvas, 'ArrowRight');
      expect(callbacks.onSelect).toHaveBeenCalledWith('right');

      // From 'right', the only neighbor is 'center'
      keydown(canvas, 'ArrowLeft');
      expect(callbacks.onSelect).toHaveBeenCalledWith('center');
    });
  });
});
