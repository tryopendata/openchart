import type {
  GraphEdge,
  GraphEncoding,
  GraphNode,
  ResolvedTheme,
} from '@opendata-ai/openchart-core';
import { resolveTheme } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { darkenColor, resolveEdgeVisuals, resolveNodeVisuals } from '../encoding';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const theme: ResolvedTheme = resolveTheme({});

const basicNodes: GraphNode[] = [
  { id: 'a', value: 10, group: 'X', name: 'Alice' },
  { id: 'b', value: 50, group: 'X', name: 'Bob' },
  { id: 'c', value: 100, group: 'Y', name: 'Carol' },
];

const basicEdges: GraphEdge[] = [
  { source: 'a', target: 'b', weight: 1 },
  { source: 'b', target: 'c', weight: 5 },
  { source: 'a', target: 'c', weight: 10 },
];

// ---------------------------------------------------------------------------
// resolveNodeVisuals tests
// ---------------------------------------------------------------------------

describe('resolveNodeVisuals', () => {
  describe('node size scaling', () => {
    it('produces varying radii when nodeSize encoding is set', () => {
      const encoding: GraphEncoding = {
        nodeSize: { field: 'value', type: 'quantitative' },
      };

      const nodes = resolveNodeVisuals(basicNodes, encoding, basicEdges, theme);

      const radii = new Set(nodes.map((n) => n.radius));
      expect(radii.size).toBeGreaterThan(1);
    });

    it('maps min data value to min radius and max to max radius', () => {
      const encoding: GraphEncoding = {
        nodeSize: { field: 'value', type: 'quantitative' },
      };

      const nodes = resolveNodeVisuals(basicNodes, encoding, basicEdges, theme);

      const minNode = nodes.find((n) => n.data.value === 10)!;
      const maxNode = nodes.find((n) => n.data.value === 100)!;

      // Min value should get min radius (3px)
      expect(minNode.radius).toBeCloseTo(3, 0);
      // Max value should get max radius (12px)
      expect(maxNode.radius).toBeCloseTo(12, 0);
    });

    it('uses default radius when no nodeSize encoding', () => {
      const nodes = resolveNodeVisuals(basicNodes, {}, basicEdges, theme);

      for (const node of nodes) {
        expect(node.radius).toBe(5);
      }
    });
  });

  describe('node color categorical mapping', () => {
    it('assigns different colors to different categories', () => {
      const encoding: GraphEncoding = {
        nodeColor: { field: 'group', type: 'nominal' },
      };

      const nodes = resolveNodeVisuals(basicNodes, encoding, basicEdges, theme);

      const xNode = nodes.find((n) => n.data.group === 'X')!;
      const yNode = nodes.find((n) => n.data.group === 'Y')!;
      expect(xNode.fill).not.toBe(yNode.fill);
    });

    it('assigns same color to same category', () => {
      const encoding: GraphEncoding = {
        nodeColor: { field: 'group', type: 'nominal' },
      };

      const nodes = resolveNodeVisuals(basicNodes, encoding, basicEdges, theme);

      const xNodes = nodes.filter((n) => n.data.group === 'X');
      expect(xNodes[0].fill).toBe(xNodes[1].fill);
    });
  });

  describe('node color quantitative mapping', () => {
    it('assigns colors on a continuous scale', () => {
      const encoding: GraphEncoding = {
        nodeColor: { field: 'value', type: 'quantitative' },
      };

      const nodes = resolveNodeVisuals(basicNodes, encoding, basicEdges, theme);

      // Different values should produce different colors
      const colors = new Set(nodes.map((n) => n.fill));
      expect(colors.size).toBeGreaterThan(1);
    });
  });

  describe('label priority', () => {
    it('assigns higher priority to nodes with more connections', () => {
      // Node 'a' connects to b and c (degree 2)
      // Node 'b' connects to a and c (degree 2)
      // Node 'c' connects to b and a (degree 2)
      // All have same degree in this case, so let's create asymmetric edges
      const asymmetricEdges: GraphEdge[] = [
        { source: 'a', target: 'b' },
        { source: 'a', target: 'c' },
        { source: 'b', target: 'c' },
        { source: 'a', target: 'a' }, // self-loop increases degree of 'a'
      ];

      const nodes = resolveNodeVisuals(basicNodes, {}, asymmetricEdges, theme);

      const nodeA = nodes.find((n) => n.id === 'a')!;
      const nodeC = nodes.find((n) => n.id === 'c')!;

      // Node 'a' has degree 4 (connected to b, c, plus 2 from self-loop)
      // Node 'c' has degree 2
      expect(nodeA.labelPriority).toBeGreaterThan(nodeC.labelPriority);
    });

    it('highest degree node gets priority 1.0', () => {
      const hubEdges: GraphEdge[] = [
        { source: 'a', target: 'b' },
        { source: 'a', target: 'c' },
      ];

      const nodes = resolveNodeVisuals(basicNodes, {}, hubEdges, theme);

      const hub = nodes.find((n) => n.id === 'a')!;
      expect(hub.labelPriority).toBe(1.0);
    });

    it('uses field value when nodeLabelPriority is set', () => {
      const encoding: GraphEncoding = {
        nodeLabelPriority: { field: 'value', type: 'quantitative' },
      };

      const nodes = resolveNodeVisuals(basicNodes, encoding, basicEdges, theme);

      const nodeA = nodes.find((n) => n.id === 'a')!; // value: 10 (min)
      const nodeC = nodes.find((n) => n.id === 'c')!; // value: 100 (max)
      expect(nodeA.labelPriority).toBeCloseTo(0, 1);
      expect(nodeC.labelPriority).toBeCloseTo(1, 1);
    });

    it('falls back to degree-based priority when nodeLabelPriority omitted', () => {
      const hubEdges: GraphEdge[] = [
        { source: 'a', target: 'b' },
        { source: 'a', target: 'c' },
      ];

      const withChannel = resolveNodeVisuals(basicNodes, {}, hubEdges, theme);
      const hub = withChannel.find((n) => n.id === 'a')!;
      expect(hub.labelPriority).toBe(1.0);
    });

    it('alwaysShowLabel overrides nodeLabelPriority to Infinity', () => {
      const encoding: GraphEncoding = {
        nodeLabelPriority: { field: 'value', type: 'quantitative' },
      };
      const overrides = { a: { alwaysShowLabel: true } };

      const nodes = resolveNodeVisuals(basicNodes, encoding, basicEdges, theme, overrides);

      const nodeA = nodes.find((n) => n.id === 'a')!;
      expect(nodeA.labelPriority).toBe(Infinity);
    });

    it('respects scale.range override on nodeLabelPriority', () => {
      const encoding: GraphEncoding = {
        nodeLabelPriority: {
          field: 'value',
          type: 'quantitative',
          scale: { range: [0.5, 1] },
        },
      };

      const nodes = resolveNodeVisuals(basicNodes, encoding, basicEdges, theme);

      const nodeA = nodes.find((n) => n.id === 'a')!; // value: 10 (min)
      const nodeC = nodes.find((n) => n.id === 'c')!; // value: 100 (max)
      expect(nodeA.labelPriority).toBeCloseTo(0.5, 1);
      expect(nodeC.labelPriority).toBeCloseTo(1, 1);
    });

    it('non-numeric field values get priority 0', () => {
      const nodesWithString: GraphNode[] = [
        { id: 'a', importance: 'high' },
        { id: 'b', importance: 50 },
      ];
      const encoding: GraphEncoding = {
        nodeLabelPriority: { field: 'importance', type: 'quantitative' },
      };

      const nodes = resolveNodeVisuals(nodesWithString, encoding, [], theme);

      const nodeA = nodes.find((n) => n.id === 'a')!;
      expect(nodeA.labelPriority).toBe(0);
    });
  });

  describe('label resolution', () => {
    it('uses nodeLabel field when provided', () => {
      const encoding: GraphEncoding = {
        nodeLabel: { field: 'name' },
      };

      const nodes = resolveNodeVisuals(basicNodes, encoding, basicEdges, theme);

      expect(nodes.find((n) => n.id === 'a')!.label).toBe('Alice');
      expect(nodes.find((n) => n.id === 'b')!.label).toBe('Bob');
    });

    it('falls back to node id when no nodeLabel encoding', () => {
      const nodes = resolveNodeVisuals(basicNodes, {}, basicEdges, theme);

      expect(nodes.find((n) => n.id === 'a')!.label).toBe('a');
      expect(nodes.find((n) => n.id === 'b')!.label).toBe('b');
    });
  });

  describe('stroke color', () => {
    it('stroke is darker than fill', () => {
      const nodes = resolveNodeVisuals(basicNodes, {}, basicEdges, theme);

      for (const node of nodes) {
        // Both fill and stroke should be valid color strings
        expect(node.fill).toBeTruthy();
        expect(node.stroke).toBeTruthy();
        // Stroke should be different from fill (darkened)
        expect(node.stroke).not.toBe(node.fill);
      }
    });
  });

  describe('defaults when no encoding specified', () => {
    it('all nodes have same default radius', () => {
      const nodes = resolveNodeVisuals(basicNodes, {}, basicEdges, theme);

      for (const node of nodes) {
        expect(node.radius).toBe(5);
      }
    });

    it('all nodes have same default color', () => {
      const nodes = resolveNodeVisuals(basicNodes, {}, basicEdges, theme);

      const fills = new Set(nodes.map((n) => n.fill));
      expect(fills.size).toBe(1);
    });

    it('stroke width defaults to 1', () => {
      const nodes = resolveNodeVisuals(basicNodes, {}, basicEdges, theme);

      for (const node of nodes) {
        expect(node.strokeWidth).toBe(1);
      }
    });
  });

  describe('data preservation', () => {
    it('original node data is preserved in data field', () => {
      const nodes = resolveNodeVisuals(basicNodes, {}, basicEdges, theme);

      const nodeA = nodes.find((n) => n.id === 'a')!;
      expect(nodeA.data.value).toBe(10);
      expect(nodeA.data.group).toBe('X');
      expect(nodeA.data.name).toBe('Alice');
      expect(nodeA.data.id).toBe('a');
    });
  });
});

// ---------------------------------------------------------------------------
// nodeOverrides tests
// ---------------------------------------------------------------------------

describe('nodeOverrides', () => {
  it('overrides fill color for a specific node', () => {
    const overrides = { a: { fill: '#ff0000' } };
    const nodes = resolveNodeVisuals(basicNodes, {}, basicEdges, theme, overrides);

    const nodeA = nodes.find((n) => n.id === 'a')!;
    expect(nodeA.fill).toBe('#ff0000');

    // Other nodes should not be affected
    const nodeB = nodes.find((n) => n.id === 'b')!;
    expect(nodeB.fill).not.toBe('#ff0000');
  });

  it('overrides radius for a specific node', () => {
    const overrides = { b: { radius: 15 } };
    const nodes = resolveNodeVisuals(basicNodes, {}, basicEdges, theme, overrides);

    const nodeB = nodes.find((n) => n.id === 'b')!;
    expect(nodeB.radius).toBe(15);
  });

  it('overrides strokeWidth and stroke', () => {
    const overrides = { c: { strokeWidth: 3, stroke: '#00ff00' } };
    const nodes = resolveNodeVisuals(basicNodes, {}, basicEdges, theme, overrides);

    const nodeC = nodes.find((n) => n.id === 'c')!;
    expect(nodeC.strokeWidth).toBe(3);
    expect(nodeC.stroke).toBe('#00ff00');
  });

  it('alwaysShowLabel sets labelPriority to Infinity', () => {
    const overrides = { a: { alwaysShowLabel: true } };
    const nodes = resolveNodeVisuals(basicNodes, {}, basicEdges, theme, overrides);

    const nodeA = nodes.find((n) => n.id === 'a')!;
    expect(nodeA.labelPriority).toBe(Infinity);
  });

  it('does not affect nodes without overrides', () => {
    const overrides = { a: { fill: '#ff0000', radius: 25 } };
    const nodes = resolveNodeVisuals(basicNodes, {}, basicEdges, theme, overrides);

    const nodeB = nodes.find((n) => n.id === 'b')!;
    const nodeC = nodes.find((n) => n.id === 'c')!;
    // Default radius
    expect(nodeB.radius).toBe(5);
    expect(nodeC.radius).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// resolveEdgeVisuals tests
// ---------------------------------------------------------------------------

describe('resolveEdgeVisuals', () => {
  describe('edge width scaling', () => {
    it('produces varying widths when edgeWidth encoding is set', () => {
      const encoding: GraphEncoding = {
        edgeWidth: { field: 'weight', type: 'quantitative' },
      };

      const edges = resolveEdgeVisuals(basicEdges, encoding, theme);

      const widths = new Set(edges.map((e) => e.strokeWidth));
      expect(widths.size).toBeGreaterThan(1);
    });

    it('larger weight values produce thicker edges', () => {
      const encoding: GraphEncoding = {
        edgeWidth: { field: 'weight', type: 'quantitative' },
      };

      const edges = resolveEdgeVisuals(basicEdges, encoding, theme);

      const heaviest = edges.find((e) => e.data.weight === 10)!;
      const lightest = edges.find((e) => e.data.weight === 1)!;
      expect(heaviest.strokeWidth).toBeGreaterThan(lightest.strokeWidth);
    });

    it('uses default width when no edgeWidth encoding', () => {
      const edges = resolveEdgeVisuals(basicEdges, {}, theme);

      for (const edge of edges) {
        expect(edge.strokeWidth).toBe(1);
      }
    });
  });

  describe('edge color', () => {
    it('uses theme axis color with opacity when no encoding', () => {
      const edges = resolveEdgeVisuals(basicEdges, {}, theme);

      for (const edge of edges) {
        expect(edge.stroke).toContain('rgba');
      }
    });
  });

  describe('defaults', () => {
    it('style defaults to solid', () => {
      const edges = resolveEdgeVisuals(basicEdges, {}, theme);

      for (const edge of edges) {
        expect(edge.style).toBe('solid');
      }
    });

    it('source and target are preserved', () => {
      const edges = resolveEdgeVisuals(basicEdges, {}, theme);

      expect(edges[0].source).toBe('a');
      expect(edges[0].target).toBe('b');
    });
  });

  describe('edge style mapping', () => {
    it('maps field values to solid/dashed/dotted via ordinal mapping', () => {
      const styledEdges: GraphEdge[] = [
        { source: 'a', target: 'b', kind: 'friend' },
        { source: 'b', target: 'c', kind: 'colleague' },
        { source: 'a', target: 'c', kind: 'family' },
      ];
      const encoding: GraphEncoding = {
        edgeStyle: { field: 'kind' },
      };

      const edges = resolveEdgeVisuals(styledEdges, encoding, theme);

      // Three unique values should map to solid, dashed, dotted
      const styles = edges.map((e) => e.style);
      expect(styles).toContain('solid');
      expect(styles).toContain('dashed');
      expect(styles).toContain('dotted');
    });

    it('wraps around when more unique values than style options', () => {
      const styledEdges: GraphEdge[] = [
        { source: 'a', target: 'b', kind: 'one' },
        { source: 'b', target: 'c', kind: 'two' },
        { source: 'a', target: 'c', kind: 'three' },
        { source: 'a', target: 'b', kind: 'four' },
      ];
      const encoding: GraphEncoding = {
        edgeStyle: { field: 'kind' },
      };

      const edges = resolveEdgeVisuals(styledEdges, encoding, theme);

      // 4th unique value wraps back to 'solid'
      const fourthEdge = edges.find((e) => e.data.kind === 'four')!;
      expect(fourthEdge.style).toBe('solid');
    });

    it('assigns styles in ascending label order regardless of data order', () => {
      const styledEdges: GraphEdge[] = [
        { source: 'a', target: 'b', kind: 'zeta' },
        { source: 'b', target: 'c', kind: 'alpha' },
        { source: 'a', target: 'c', kind: 'mid' },
      ];
      const edges = resolveEdgeVisuals(styledEdges, { edgeStyle: { field: 'kind' } }, theme);

      // Sorted domain [alpha, mid, zeta] → solid, dashed, dotted.
      expect(edges.find((e) => e.data.kind === 'alpha')!.style).toBe('solid');
      expect(edges.find((e) => e.data.kind === 'mid')!.style).toBe('dashed');
      expect(edges.find((e) => e.data.kind === 'zeta')!.style).toBe('dotted');
    });

    it('sort: null keeps first-seen data order for style assignment', () => {
      const styledEdges: GraphEdge[] = [
        { source: 'a', target: 'b', kind: 'zeta' },
        { source: 'b', target: 'c', kind: 'alpha' },
      ];
      const edges = resolveEdgeVisuals(
        styledEdges,
        { edgeStyle: { field: 'kind', sort: null } },
        theme,
      );

      expect(edges.find((e) => e.data.kind === 'zeta')!.style).toBe('solid');
      expect(edges.find((e) => e.data.kind === 'alpha')!.style).toBe('dashed');
    });

    it('defaults to solid when no edgeStyle encoding', () => {
      const edges = resolveEdgeVisuals(basicEdges, {}, theme);

      for (const edge of edges) {
        expect(edge.style).toBe('solid');
      }
    });
  });

  describe('data preservation', () => {
    it('original edge data is preserved', () => {
      const edges = resolveEdgeVisuals(basicEdges, {}, theme);

      const firstEdge = edges[0];
      expect(firstEdge.data.weight).toBe(1);
    });
  });
});

// ---------------------------------------------------------------------------
// darkenColor tests
// ---------------------------------------------------------------------------

describe('darkenColor', () => {
  it('darkens a hex color', () => {
    const original = '#ffffff';
    const darkened = darkenColor(original, 0.2);

    // White darkened by 20% should be #cccccc
    expect(darkened).toBe('#cccccc');
  });

  it('handles 3-char hex shorthand', () => {
    const result = darkenColor('#fff', 0.2);
    expect(result).toBe('#cccccc');
  });

  it('returns original for invalid hex', () => {
    expect(darkenColor('not-a-color')).toBe('not-a-color');
  });
});
