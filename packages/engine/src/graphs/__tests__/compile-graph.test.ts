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

  describe('with explicit scale domain/range', () => {
    it('uses explicit domain and range for nominal nodeColor', () => {
      const spec = {
        ...makeBasicGraphSpec(),
        encoding: {
          nodeColor: {
            field: 'group',
            type: 'nominal' as const,
            scale: {
              domain: ['X', 'Y'],
              range: ['#ff0000', '#00ff00'],
            },
          },
        },
      };
      const result = compileGraph(spec, compileOptions);

      const xNode = result.nodes.find((n) => n.data.group === 'X')!;
      const yNode = result.nodes.find((n) => n.data.group === 'Y')!;
      expect(xNode.fill).toBe('#ff0000');
      expect(yNode.fill).toBe('#00ff00');
    });

    it('falls back to auto-derived domain when scale is omitted', () => {
      const result = compileGraph(makeEncodedGraphSpec(), compileOptions);

      const xNode = result.nodes.find((n) => n.data.group === 'X')!;
      const yNode = result.nodes.find((n) => n.data.group === 'Y')!;
      // Should still produce different colors (auto-derived)
      expect(xNode.fill).not.toBe(yNode.fill);
    });

    it('explicit domain controls color ordering', () => {
      // Reversed domain order should swap colors
      const spec = {
        ...makeBasicGraphSpec(),
        encoding: {
          nodeColor: {
            field: 'group',
            type: 'nominal' as const,
            scale: {
              domain: ['Y', 'X'],
              range: ['#ff0000', '#00ff00'],
            },
          },
        },
      };
      const result = compileGraph(spec, compileOptions);

      const xNode = result.nodes.find((n) => n.data.group === 'X')!;
      const yNode = result.nodes.find((n) => n.data.group === 'Y')!;
      expect(xNode.fill).toBe('#00ff00');
      expect(yNode.fill).toBe('#ff0000');
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

  describe('legend', () => {
    it('is empty when there is no color encoding and no clustering', () => {
      // Every node shares one fill, so a legend would list each node label
      // against an identical swatch and communicate nothing.
      const result = compileGraph(makeBasicGraphSpec(), compileOptions);

      expect(result.legend.entries).toEqual([]);
    });

    it('entries come from the nodeColor field, not node labels', () => {
      const result = compileGraph(makeEncodedGraphSpec(), compileOptions);

      const labels = result.legend.entries.map((e) => e.label).sort();
      expect(labels).toEqual(['X', 'Y']);
    });

    it('is empty when the nodeColor field has only one category', () => {
      const spec = makeEncodedGraphSpec();
      for (const node of spec.nodes) node.group = 'X';
      const result = compileGraph(spec, compileOptions);

      expect(result.legend.entries).toEqual([]);
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

  describe('seedNode', () => {
    it('gives the seed a ring and an always-on label', () => {
      const result = compileGraph({ ...makeBasicGraphSpec(), seedNode: 'a' }, compileOptions);

      const seed = result.nodes.find((n) => n.id === 'a')!;
      expect(seed.stroke).toBe(result.theme.colors.text);
      expect(seed.strokeWidth).toBe(2);
      expect(seed.labelPriority).toBe(Number.POSITIVE_INFINITY);

      const other = result.nodes.find((n) => n.id === 'b')!;
      expect(other.strokeWidth).not.toBe(2);
      expect(other.labelPriority).not.toBe(Number.POSITIVE_INFINITY);
    });

    it('does not force a radius, so nodeSize still wins', () => {
      const withSeed = compileGraph({ ...makeEncodedGraphSpec(), seedNode: 'a' }, compileOptions);
      const withoutSeed = compileGraph(makeEncodedGraphSpec(), compileOptions);

      expect(withSeed.nodes.find((n) => n.id === 'a')!.radius).toBe(
        withoutSeed.nodes.find((n) => n.id === 'a')!.radius,
      );
    });

    it('applies seedNode.style over the seed defaults', () => {
      const result = compileGraph(
        { ...makeBasicGraphSpec(), seedNode: { id: 'a', style: { radius: 20, stroke: '#f00' } } },
        compileOptions,
      );

      const seed = result.nodes.find((n) => n.id === 'a')!;
      expect(seed.radius).toBe(20);
      expect(seed.stroke).toBe('#f00');
      // Untouched by style, so the seed default stands.
      expect(seed.strokeWidth).toBe(2);
    });

    it('lets an explicit nodeOverrides entry beat seedNode.style', () => {
      const result = compileGraph(
        {
          ...makeBasicGraphSpec(),
          seedNode: { id: 'a', style: { stroke: '#f00', strokeWidth: 8 } },
          nodeOverrides: { a: { stroke: '#0f0' } },
        },
        compileOptions,
      );

      const seed = result.nodes.find((n) => n.id === 'a')!;
      expect(seed.stroke).toBe('#0f0');
      // Not present on the override, so seedNode.style still applies.
      expect(seed.strokeWidth).toBe(8);
    });

    it('does not let an explicit undefined in nodeOverrides clobber a seed default', () => {
      const result = compileGraph(
        {
          ...makeBasicGraphSpec(),
          seedNode: 'a',
          nodeOverrides: { a: { alwaysShowLabel: undefined, stroke: undefined } },
        },
        compileOptions,
      );

      const seed = result.nodes.find((n) => n.id === 'a')!;
      expect(seed.labelPriority).toBe(Number.POSITIVE_INFINITY);
      expect(seed.stroke).toBe(result.theme.colors.text);
    });

    it('publishes seedNodeIds', () => {
      expect(compileGraph(makeBasicGraphSpec(), compileOptions).seedNodeIds).toEqual([]);
      expect(
        compileGraph({ ...makeBasicGraphSpec(), seedNode: 'a' }, compileOptions).seedNodeIds,
      ).toEqual(['a']);
      expect(
        compileGraph({ ...makeBasicGraphSpec(), seedNode: { id: 'c' } }, compileOptions)
          .seedNodeIds,
      ).toEqual(['c']);
    });

    it('warns and no-ops for an unknown seed id instead of throwing', () => {
      const warnings: string[] = [];
      const result = compileGraph(
        { ...makeBasicGraphSpec(), seedNode: 'nope' },
        {
          ...compileOptions,
          onWarn: (m: string) => warnings.push(m),
        },
      );

      expect(result.seedNodeIds).toEqual([]);
      expect(warnings.some((w) => w.includes('seedNode "nope"'))).toBe(true);
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
