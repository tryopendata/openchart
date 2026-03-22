import { describe, expect, it } from 'vitest';
import { compileGraph } from '../compile-graph';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

function makeBasicGraphSpec() {
  return {
    type: 'graph' as const,
    nodes: [
      { id: 'a', group: 'X', value: 10, name: 'Alice' },
      { id: 'b', group: 'X', value: 20, name: 'Bob' },
      { id: 'c', group: 'Y', value: 30, name: 'Carol' },
      { id: 'd', group: 'Y', value: 40, name: 'Dave' },
    ],
    edges: [
      { source: 'a', target: 'b', weight: 1 },
      { source: 'b', target: 'c', weight: 2 },
      { source: 'c', target: 'd', weight: 3 },
      { source: 'a', target: 'c', weight: 1 },
    ],
  };
}

function makeEncodedGraphSpec() {
  return {
    ...makeBasicGraphSpec(),
    encoding: {
      nodeSize: { field: 'value', type: 'quantitative' as const },
      nodeColor: { field: 'group', type: 'nominal' as const },
      nodeLabel: { field: 'name' },
      edgeWidth: { field: 'weight', type: 'quantitative' as const },
    },
  };
}

function makeClusteredGraphSpec() {
  return {
    ...makeBasicGraphSpec(),
    layout: {
      type: 'force' as const,
      clustering: { field: 'group' },
      chargeStrength: -200,
      linkDistance: 50,
    },
  };
}

const compileOptions = { width: 600, height: 400 };

// ---------------------------------------------------------------------------
// Full pipeline tests
// ---------------------------------------------------------------------------

describe('compileGraph', () => {
  it('returns a valid GraphCompilation shape', () => {
    const result = compileGraph(makeBasicGraphSpec(), compileOptions);

    expect(result.nodes).toBeDefined();
    expect(result.edges).toBeDefined();
    expect(result.legend).toBeDefined();
    expect(result.chrome).toBeDefined();
    expect(result.tooltipDescriptors).toBeDefined();
    expect(result.a11y).toBeDefined();
    expect(result.theme).toBeDefined();
    expect(result.dimensions).toBeDefined();
    expect(result.simulationConfig).toBeDefined();
  });

  it('compiles correct number of nodes and edges', () => {
    const result = compileGraph(makeBasicGraphSpec(), compileOptions);

    expect(result.nodes).toHaveLength(4);
    expect(result.edges).toHaveLength(4);
  });

  it('has correct total dimensions', () => {
    const result = compileGraph(makeBasicGraphSpec(), compileOptions);

    expect(result.dimensions.width).toBe(600);
    expect(result.dimensions.height).toBe(400);
  });

  it('nodes have resolved visual properties', () => {
    const result = compileGraph(makeBasicGraphSpec(), compileOptions);

    for (const node of result.nodes) {
      expect(node.id).toBeTruthy();
      expect(node.radius).toBeGreaterThan(0);
      expect(node.fill).toBeTruthy();
      expect(node.stroke).toBeTruthy();
      expect(node.strokeWidth).toBeGreaterThan(0);
      expect(node.data).toBeDefined();
    }
  });

  it('edges have resolved visual properties', () => {
    const result = compileGraph(makeBasicGraphSpec(), compileOptions);

    for (const edge of result.edges) {
      expect(edge.source).toBeTruthy();
      expect(edge.target).toBeTruthy();
      expect(edge.stroke).toBeTruthy();
      expect(edge.strokeWidth).toBeGreaterThan(0);
      expect(edge.style).toBe('solid');
      expect(edge.data).toBeDefined();
    }
  });

  describe('with encoding', () => {
    it('applies nodeSize encoding to produce varying radii', () => {
      const result = compileGraph(makeEncodedGraphSpec(), compileOptions);

      const radii = result.nodes.map((n) => n.radius);
      const uniqueRadii = new Set(radii);
      expect(uniqueRadii.size).toBeGreaterThan(1);
    });

    it('applies nodeColor encoding to produce varying fill colors', () => {
      const result = compileGraph(makeEncodedGraphSpec(), compileOptions);

      const groupXNode = result.nodes.find((n) => n.data.group === 'X')!;
      const groupYNode = result.nodes.find((n) => n.data.group === 'Y')!;
      expect(groupXNode.fill).not.toBe(groupYNode.fill);
    });

    it('applies nodeLabel encoding for labels', () => {
      const result = compileGraph(makeEncodedGraphSpec(), compileOptions);

      const alice = result.nodes.find((n) => n.id === 'a')!;
      expect(alice.label).toBe('Alice');
    });

    it('applies edgeWidth encoding to produce varying stroke widths', () => {
      const result = compileGraph(makeEncodedGraphSpec(), compileOptions);

      const widths = result.edges.map((e) => e.strokeWidth);
      const uniqueWidths = new Set(widths);
      expect(uniqueWidths.size).toBeGreaterThan(1);
    });
  });

  describe('with community clustering', () => {
    it('assigns communities to nodes', () => {
      const result = compileGraph(makeClusteredGraphSpec(), compileOptions);

      const groupXNodes = result.nodes.filter((n) => n.community === 'X');
      const groupYNodes = result.nodes.filter((n) => n.community === 'Y');
      expect(groupXNodes).toHaveLength(2);
      expect(groupYNodes).toHaveLength(2);
    });

    it('community colors override node colors', () => {
      const result = compileGraph(makeClusteredGraphSpec(), compileOptions);

      // Nodes in the same community should share a color
      const xNodes = result.nodes.filter((n) => n.community === 'X');
      expect(xNodes[0].fill).toBe(xNodes[1].fill);

      // Different communities should have different colors
      const yNode = result.nodes.find((n) => n.community === 'Y')!;
      expect(xNodes[0].fill).not.toBe(yNode.fill);
    });

    it('legend entries match communities', () => {
      const result = compileGraph(makeClusteredGraphSpec(), compileOptions);

      expect(result.legend.entries).toHaveLength(2);
      const labels = result.legend.entries.map((e) => e.label).sort();
      expect(labels).toEqual(['X', 'Y']);
    });
  });

  describe('tooltips', () => {
    it('generates tooltip descriptors for each node', () => {
      const result = compileGraph(makeBasicGraphSpec(), compileOptions);

      expect(result.tooltipDescriptors.size).toBe(4);
      expect(result.tooltipDescriptors.has('a')).toBe(true);
      expect(result.tooltipDescriptors.has('b')).toBe(true);
      expect(result.tooltipDescriptors.has('c')).toBe(true);
      expect(result.tooltipDescriptors.has('d')).toBe(true);
    });

    it('tooltip has a title and data fields', () => {
      const result = compileGraph(makeBasicGraphSpec(), compileOptions);

      const tooltip = result.tooltipDescriptors.get('a')!;
      expect(tooltip.title).toBeTruthy();
      expect(tooltip.fields.length).toBeGreaterThan(0);
    });

    it('tooltip includes community when clustering is active', () => {
      const result = compileGraph(makeClusteredGraphSpec(), compileOptions);

      const tooltip = result.tooltipDescriptors.get('a')!;
      const communityField = tooltip.fields.find((f) => f.label === 'Community');
      expect(communityField).toBeDefined();
      expect(communityField!.value).toBe('X');
    });
  });

  describe('a11y', () => {
    it('generates descriptive alt text', () => {
      const result = compileGraph(makeBasicGraphSpec(), compileOptions);

      expect(result.a11y.altText).toContain('4 nodes');
      expect(result.a11y.altText).toContain('4 edges');
    });

    it('alt text mentions communities when clustering is active', () => {
      const result = compileGraph(makeClusteredGraphSpec(), compileOptions);

      expect(result.a11y.altText).toContain('communities');
    });

    it('has a data table fallback', () => {
      const result = compileGraph(makeBasicGraphSpec(), compileOptions);

      expect(result.a11y.dataTableFallback).toHaveLength(4);
    });

    it('is keyboard navigable when nodes exist', () => {
      const result = compileGraph(makeBasicGraphSpec(), compileOptions);

      expect(result.a11y.keyboardNavigable).toBe(true);
    });
  });

  describe('simulationConfig', () => {
    it('reflects default layout parameters', () => {
      const result = compileGraph(makeBasicGraphSpec(), compileOptions);

      expect(result.simulationConfig.chargeStrength).toBe(-300);
      expect(result.simulationConfig.linkDistance).toBe(30);
      expect(result.simulationConfig.alphaDecay).toBeCloseTo(0.0228);
      expect(result.simulationConfig.velocityDecay).toBeCloseTo(0.4);
    });

    it('reflects custom layout parameters', () => {
      const result = compileGraph(makeClusteredGraphSpec(), compileOptions);

      expect(result.simulationConfig.chargeStrength).toBe(-200);
      expect(result.simulationConfig.linkDistance).toBe(50);
    });

    it('includes clustering config when set', () => {
      const result = compileGraph(makeClusteredGraphSpec(), compileOptions);

      expect(result.simulationConfig.clustering).not.toBeNull();
      expect(result.simulationConfig.clustering!.field).toBe('group');
    });

    it('clustering is null when not set', () => {
      const result = compileGraph(makeBasicGraphSpec(), compileOptions);

      expect(result.simulationConfig.clustering).toBeNull();
    });

    it('collision radius accounts for max node radius', () => {
      const result = compileGraph(makeBasicGraphSpec(), compileOptions);

      const maxRadius = Math.max(...result.nodes.map((n) => n.radius));
      expect(result.simulationConfig.collisionRadius).toBe(maxRadius + 2);
    });
  });

  describe('chrome', () => {
    it('resolves chrome text elements', () => {
      const spec = {
        ...makeBasicGraphSpec(),
        chrome: {
          title: 'Network Graph',
          source: 'Test Data',
        },
      };
      const result = compileGraph(spec, compileOptions);

      expect(result.chrome.title).toBeDefined();
      expect(result.chrome.title!.text).toBe('Network Graph');
      expect(result.chrome.source).toBeDefined();
      expect(result.chrome.source!.text).toBe('Test Data');
    });
  });

  describe('dark mode', () => {
    it('applies dark mode theme when option is set', () => {
      const result = compileGraph(makeBasicGraphSpec(), { ...compileOptions, darkMode: true });

      expect(result.theme.isDark).toBe(true);
    });
  });

  describe('error handling', () => {
    it('throws for non-graph specs', () => {
      const chartSpec = {
        mark: 'point' as const,
        data: [{ x: 1, y: 2 }],
        encoding: {
          x: { field: 'x', type: 'quantitative' as const },
          y: { field: 'y', type: 'quantitative' as const },
        },
      };

      expect(() => compileGraph(chartSpec, compileOptions)).toThrow(
        /compileGraph received a non-graph spec/,
      );
    });

    it('throws for invalid specs', () => {
      expect(() => compileGraph({}, compileOptions)).toThrow();
    });
  });
});
