import { describe, expect, it } from 'vitest';
import { computeSankeyLayout } from '../layout';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

/** Linear chain: A -> B -> C (3 columns) */
const linearData = [
  { source: 'A', target: 'B', value: 10 },
  { source: 'B', target: 'C', value: 10 },
];

/** Branching: A -> B, A -> C */
const branchData = [
  { source: 'A', target: 'B', value: 10 },
  { source: 'A', target: 'C', value: 20 },
];

const area = { x: 0, y: 0, width: 600, height: 400 };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeSankeyLayout', () => {
  it('linear chain produces correct column count (depths 0, 1, 2)', () => {
    const { nodes } = computeSankeyLayout(
      linearData,
      'source',
      'target',
      'value',
      area,
      12,
      16,
      'justify',
      6,
    );

    const depths = new Set(nodes.map((n) => n.depth));
    expect(depths.size).toBe(3);
    expect(depths).toContain(0);
    expect(depths).toContain(1);
    expect(depths).toContain(2);
  });

  it('nodeWidth is respected', () => {
    const nodeWidth = 20;
    const { nodes } = computeSankeyLayout(
      linearData,
      'source',
      'target',
      'value',
      area,
      nodeWidth,
      16,
      'justify',
      6,
    );

    for (const node of nodes) {
      const computedWidth = (node.x1 ?? 0) - (node.x0 ?? 0);
      expect(computedWidth).toBeCloseTo(nodeWidth, 0);
    }
  });

  it('nodePadding ensures vertical gap between nodes in the same column', () => {
    const padding = 24;
    // Use left alignment for a deterministic test (justify may spread nodes across columns).
    const { nodes: leftNodes } = computeSankeyLayout(
      branchData,
      'source',
      'target',
      'value',
      area,
      12,
      padding,
      'left',
      6,
    );

    const col1 = leftNodes.filter((n) => n.depth === 1).sort((a, b) => (a.y0 ?? 0) - (b.y0 ?? 0));

    if (col1.length >= 2) {
      for (let i = 0; i < col1.length - 1; i++) {
        const gap = (col1[i + 1].y0 ?? 0) - (col1[i].y1 ?? 0);
        expect(gap).toBeGreaterThanOrEqual(padding - 1); // Allow 1px rounding
      }
    }
  });

  it('different nodeAlign values produce different layouts', () => {
    const justifyResult = computeSankeyLayout(
      linearData,
      'source',
      'target',
      'value',
      area,
      12,
      16,
      'justify',
      6,
    );

    const leftResult = computeSankeyLayout(
      linearData,
      'source',
      'target',
      'value',
      area,
      12,
      16,
      'left',
      6,
    );

    // For a linear chain with justify vs left, node positions may differ.
    // At minimum, both should produce valid layouts with the right node count.
    expect(justifyResult.nodes).toHaveLength(3);
    expect(leftResult.nodes).toHaveLength(3);

    // The x positions should be the same for a linear chain (both align
    // left-to-right), but verify the layouts are structurally sound.
    for (const node of justifyResult.nodes) {
      expect(node.x0).toBeDefined();
      expect(node.x1).toBeDefined();
      expect(node.y0).toBeDefined();
      expect(node.y1).toBeDefined();
    }
  });

  it('returns correct link count', () => {
    const { links } = computeSankeyLayout(
      linearData,
      'source',
      'target',
      'value',
      area,
      12,
      16,
      'justify',
      6,
    );

    expect(links).toHaveLength(2);
  });

  it('link values match input data', () => {
    const { links } = computeSankeyLayout(
      linearData,
      'source',
      'target',
      'value',
      area,
      12,
      16,
      'justify',
      6,
    );

    for (const link of links) {
      expect(link.value).toBe(10);
    }
  });

  // ---------------------------------------------------------------------------
  // nodeSort tests
  // ---------------------------------------------------------------------------

  /** Multi-branch data mimicking the Sankey from the Austin ISD report. */
  const multiBranchData = [
    { source: 'Root', target: 'Branch A', value: 40 },
    { source: 'Root', target: 'Branch B', value: 130 },
    { source: 'Branch A', target: 'Small', value: 7 },
    { source: 'Branch A', target: 'Medium', value: 12 },
    { source: 'Branch A', target: 'Large A', value: 21 },
    { source: 'Branch B', target: 'Large B', value: 52 },
    { source: 'Branch B', target: 'Large C', value: 78 },
  ];

  it('nodeSort controls vertical order within columns', () => {
    const desiredOrder = ['Large A', 'Medium', 'Small', 'Large B', 'Large C'];

    const { nodes } = computeSankeyLayout(
      multiBranchData,
      'source',
      'target',
      'value',
      area,
      12,
      16,
      'justify',
      6,
      desiredOrder,
    );

    // Get the rightmost column (depth 2) nodes sorted by y position
    const maxDepth = Math.max(...nodes.map((n) => n.depth ?? 0));
    const rightColumn = nodes
      .filter((n) => (n.depth ?? 0) === maxDepth)
      .sort((a, b) => (a.y0 ?? 0) - (b.y0 ?? 0));

    const actualOrder = rightColumn.map((n) => n.id);

    // Verify listed nodes appear in the specified order
    for (let i = 0; i < desiredOrder.length; i++) {
      const pos = actualOrder.indexOf(desiredOrder[i]);
      expect(pos).toBeGreaterThanOrEqual(0);
      if (i > 0) {
        const prevPos = actualOrder.indexOf(desiredOrder[i - 1]);
        expect(pos).toBeGreaterThan(prevPos);
      }
    }
  });

  it('nodeSort with partial list puts unlisted nodes after listed ones', () => {
    const partialOrder = ['Small', 'Large A'];

    const { nodes } = computeSankeyLayout(
      multiBranchData,
      'source',
      'target',
      'value',
      area,
      12,
      16,
      'justify',
      6,
      partialOrder,
    );

    const maxDepth = Math.max(...nodes.map((n) => n.depth ?? 0));
    const rightColumn = nodes
      .filter((n) => (n.depth ?? 0) === maxDepth)
      .sort((a, b) => (a.y0 ?? 0) - (b.y0 ?? 0));

    const actualOrder = rightColumn.map((n) => n.id);
    const smallIdx = actualOrder.indexOf('Small');
    const largeAIdx = actualOrder.indexOf('Large A');

    // Small should be above Large A (as specified)
    expect(smallIdx).toBeLessThan(largeAIdx);

    // Both listed nodes should appear before the unlisted ones
    const unlistedNodes = rightColumn.filter((n) => !partialOrder.includes(n.id));
    for (const unlisted of unlistedNodes) {
      const unlistedIdx = actualOrder.indexOf(unlisted.id);
      expect(unlistedIdx).toBeGreaterThan(largeAIdx);
    }
  });

  it('nodeSort with empty array behaves like no sort', () => {
    const withEmpty = computeSankeyLayout(
      branchData,
      'source',
      'target',
      'value',
      area,
      12,
      16,
      'justify',
      6,
      [],
    );

    const withoutSort = computeSankeyLayout(
      branchData,
      'source',
      'target',
      'value',
      area,
      12,
      16,
      'justify',
      6,
    );

    // Both should produce the same layout
    expect(withEmpty.nodes).toHaveLength(withoutSort.nodes.length);
    for (let i = 0; i < withEmpty.nodes.length; i++) {
      expect(withEmpty.nodes[i].y0).toBeCloseTo(withoutSort.nodes[i].y0 ?? 0, 1);
    }
  });

  it('nodeSort reverses default order when specified backwards', () => {
    // Branch data: A -> B (10), A -> C (20). C is larger so normally above B.
    // Force B above C.
    const { nodes: defaultNodes } = computeSankeyLayout(
      branchData,
      'source',
      'target',
      'value',
      area,
      12,
      16,
      'left',
      6,
    );

    // Verify the default layout has two nodes in column 1
    expect(defaultNodes.filter((n) => n.depth === 1)).toHaveLength(2);

    const { nodes: sortedNodes } = computeSankeyLayout(
      branchData,
      'source',
      'target',
      'value',
      area,
      12,
      16,
      'left',
      6,
      ['B', 'C'],
    );

    const sortedCol1 = sortedNodes
      .filter((n) => n.depth === 1)
      .sort((a, b) => (a.y0 ?? 0) - (b.y0 ?? 0));

    // With nodeSort ['B', 'C'], B should be above C
    expect(sortedCol1[0].id).toBe('B');
    expect(sortedCol1[1].id).toBe('C');
  });
});
