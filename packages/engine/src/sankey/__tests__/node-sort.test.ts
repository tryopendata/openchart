/**
 * Characterization test for sankey explicit `nodeSort`.
 *
 * Part of refactor/v7-cohesion step 1. Pins the `nodeSort` handling in
 * `packages/engine/src/sankey/layout.ts` around line 120, where an explicit
 * ordered-ID array is translated into a d3-sankey `nodeSort` comparator so
 * nodes stack top-to-bottom within each column following the user's order
 * rather than d3-sankey's default (data-insertion / value-based) ordering.
 */

import { describe, expect, it } from 'vitest';
import { computeSankeyLayout } from '../layout';

describe('sankey explicit nodeSort', () => {
  it('orders nodes within a column according to the nodeSort array', () => {
    // A, B, C all live in column 0 and flow into D in column 1.
    // Data-insertion order is A, B, C (the default d3-sankey order varies
    // with value anyway). Explicit nodeSort forces C, A, B top-to-bottom.
    const data = [
      { source: 'A', target: 'D', value: 10 },
      { source: 'B', target: 'D', value: 20 },
      { source: 'C', target: 'D', value: 15 },
    ];

    const { nodes } = computeSankeyLayout(
      data,
      'source',
      'target',
      'value',
      { x: 0, y: 0, width: 600, height: 400 },
      12,
      16,
      'justify',
      6,
      ['C', 'A', 'B'],
    );

    // Collect column-0 nodes, sort them by vertical position, and read back IDs.
    const col0 = nodes.filter((n) => n.depth === 0);
    expect(col0.map((n) => n.id).sort()).toEqual(['A', 'B', 'C']);

    const ordered = [...col0].sort((a, b) => (a.y0 ?? 0) - (b.y0 ?? 0)).map((n) => n.id);
    expect(ordered).toEqual(['C', 'A', 'B']);
  });
});
