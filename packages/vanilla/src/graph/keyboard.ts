/**
 * Keyboard navigation for the graph canvas.
 *
 * Provides accessible keyboard control: Tab to focus, arrow keys to
 * navigate between adjacent nodes (following edges), Enter to select,
 * Escape to clear, +/- to zoom, Home to fit all, / to focus search.
 */

import type { PositionedNode } from './types';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface KeyboardNavOptions {
  canvas: HTMLCanvasElement;
  getNodes(): PositionedNode[];
  getSelectedIds(): string[];
  getAdjacency(): Map<string, Set<string>>;
  onSelect(nodeId: string): void;
  onDeselect(): void;
  onZoom(direction: 'in' | 'out'): void;
  onFitAll(): void;
  onFocusSearch?(): void;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Attach keyboard navigation to a graph canvas.
 * Returns a cleanup function that removes all listeners.
 */
export function attachGraphKeyboardNav(options: KeyboardNavOptions): () => void {
  const {
    canvas,
    getNodes,
    getSelectedIds,
    getAdjacency,
    onSelect,
    onDeselect,
    onZoom,
    onFitAll,
    onFocusSearch,
  } = options;

  let focusedNodeId: string | null = null;

  // Make canvas focusable
  if (!canvas.hasAttribute('tabindex')) {
    canvas.setAttribute('tabindex', '0');
  }

  function findNodeById(id: string): PositionedNode | undefined {
    return getNodes().find((n) => n.id === id);
  }

  /**
   * Given a set of neighbor node ids, pick the one that best matches
   * the arrow key direction relative to the current focused node.
   */
  function pickDirectionalNeighbor(
    fromNode: PositionedNode,
    neighborIds: Set<string>,
    direction: 'up' | 'down' | 'left' | 'right',
  ): string | null {
    const nodes = getNodes();
    const candidates = nodes.filter((n) => neighborIds.has(n.id));
    if (candidates.length === 0) return null;

    // Score each candidate by how well it matches the desired direction
    let best: PositionedNode | null = null;
    let bestScore = -Infinity;

    for (const c of candidates) {
      const dx = c.x - fromNode.x;
      const dy = c.y - fromNode.y;
      let score: number;

      switch (direction) {
        case 'right':
          score = dx - Math.abs(dy) * 0.5;
          break;
        case 'left':
          score = -dx - Math.abs(dy) * 0.5;
          break;
        case 'down':
          score = dy - Math.abs(dx) * 0.5;
          break;
        case 'up':
          score = -dy - Math.abs(dx) * 0.5;
          break;
      }

      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }

    return best?.id ?? null;
  }

  function onKeyDown(e: KeyboardEvent): void {
    switch (e.key) {
      case 'Tab': {
        // Focus first/selected node
        const selected = getSelectedIds();
        const nodes = getNodes();
        if (nodes.length === 0) return;

        if (selected.length > 0) {
          focusedNodeId = selected[0];
        } else if (!focusedNodeId || !findNodeById(focusedNodeId)) {
          focusedNodeId = nodes[0].id;
        }

        e.preventDefault();
        break;
      }

      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight': {
        if (!focusedNodeId) return;
        e.preventDefault();

        const focusedNode = findNodeById(focusedNodeId);
        if (!focusedNode) return;

        const adjacency = getAdjacency();
        const neighbors = adjacency.get(focusedNodeId);
        if (!neighbors || neighbors.size === 0) return;

        const dirMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
          ArrowUp: 'up',
          ArrowDown: 'down',
          ArrowLeft: 'left',
          ArrowRight: 'right',
        };

        const nextId = pickDirectionalNeighbor(focusedNode, neighbors, dirMap[e.key]);
        if (nextId) {
          focusedNodeId = nextId;
          onSelect(nextId);
        }
        break;
      }

      case 'Enter': {
        if (focusedNodeId) {
          e.preventDefault();
          const selected = getSelectedIds();
          if (selected.includes(focusedNodeId)) {
            onDeselect();
          } else {
            onSelect(focusedNodeId);
          }
        }
        break;
      }

      case 'Escape': {
        e.preventDefault();
        focusedNodeId = null;
        onDeselect();
        break;
      }

      case '+':
      case '=': {
        e.preventDefault();
        onZoom('in');
        break;
      }

      case '-':
      case '_': {
        e.preventDefault();
        onZoom('out');
        break;
      }

      case 'Home': {
        e.preventDefault();
        onFitAll();
        break;
      }

      case '/': {
        if (onFocusSearch) {
          e.preventDefault();
          onFocusSearch();
        }
        break;
      }
    }
  }

  canvas.addEventListener('keydown', onKeyDown);

  // Return cleanup function
  return () => {
    canvas.removeEventListener('keydown', onKeyDown);
  };
}
