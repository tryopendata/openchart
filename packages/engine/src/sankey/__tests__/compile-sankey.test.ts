import { describe, expect, it } from 'vitest';
import { compileSankey } from '../../compile';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const basicSpec = {
  type: 'sankey' as const,
  data: [
    { from: 'A', to: 'C', amount: 10 },
    { from: 'B', to: 'C', amount: 20 },
    { from: 'C', to: 'D', amount: 15 },
    { from: 'C', to: 'E', amount: 15 },
  ],
  encoding: {
    source: { field: 'from', type: 'nominal' as const },
    target: { field: 'to', type: 'nominal' as const },
    value: { field: 'amount', type: 'quantitative' as const },
  },
};

const defaultOptions = { width: 600, height: 400 };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('compileSankey', () => {
  it('compiles a basic sankey and returns correct node/link counts', () => {
    const result = compileSankey(basicSpec, defaultOptions);

    // A, B, C, D, E = 5 nodes
    expect(result.nodes).toHaveLength(5);
    // A->C, B->C, C->D, C->E = 4 links
    expect(result.links).toHaveLength(4);
  });

  it('infers nodes from unique source/target values in data', () => {
    const result = compileSankey(basicSpec, defaultOptions);

    const nodeIds = result.nodes.map((n) => n.nodeId).sort();
    expect(nodeIds).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('node positions are valid (x >= 0, y >= 0, width > 0, height > 0)', () => {
    const result = compileSankey(basicSpec, defaultOptions);

    for (const node of result.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.width).toBeGreaterThan(0);
      expect(node.height).toBeGreaterThan(0);
    }
  });

  it('link paths are valid SVG path strings starting with M', () => {
    const result = compileSankey(basicSpec, defaultOptions);

    for (const link of result.links) {
      expect(link.path).toBeTruthy();
      expect(link.path[0]).toBe('M');
    }
  });

  it('nodes get default colors from theme categorical palette', () => {
    const result = compileSankey(basicSpec, defaultOptions);

    for (const node of result.nodes) {
      expect(node.fill).toBeTruthy();
      // Should be a color string (hex, rgb, etc.)
      expect(typeof node.fill).toBe('string');
    }

    // With 5 nodes and no color encoding, each node gets a different palette slot
    const fills = new Set(result.nodes.map((n) => n.fill));
    expect(fills.size).toBe(5);
  });

  it('color encoding groups nodes by category value', () => {
    const spec = {
      ...basicSpec,
      encoding: {
        ...basicSpec.encoding,
        color: { field: 'from', type: 'nominal' as const },
      },
    };
    const result = compileSankey(spec, defaultOptions);

    // Nodes that share the same color field value should share the same color.
    // "from" field: A has "A", B has "B", C is a target (gets the color of
    // the first row where it appears as source or target).
    const nodeA = result.nodes.find((n) => n.nodeId === 'A')!;
    const nodeB = result.nodes.find((n) => n.nodeId === 'B')!;
    // A and B have different "from" categories, so different colors
    expect(nodeA.fill).not.toBe(nodeB.fill);
  });

  describe('linkStyle', () => {
    it('gradient: sourceColor and targetColor differ (match connected nodes)', () => {
      const spec = { ...basicSpec, linkStyle: 'gradient' as const };
      const result = compileSankey(spec, defaultOptions);

      // Link from A->C: source and target have different colors
      const acLink = result.links.find((l) => l.sourceId === 'A' && l.targetId === 'C')!;
      const nodeA = result.nodes.find((n) => n.nodeId === 'A')!;
      const nodeC = result.nodes.find((n) => n.nodeId === 'C')!;
      expect(acLink.sourceColor).toBe(nodeA.fill);
      expect(acLink.targetColor).toBe(nodeC.fill);
    });

    it('source: both colors equal source node fill', () => {
      const spec = { ...basicSpec, linkStyle: 'source' as const };
      const result = compileSankey(spec, defaultOptions);

      const acLink = result.links.find((l) => l.sourceId === 'A' && l.targetId === 'C')!;
      const nodeA = result.nodes.find((n) => n.nodeId === 'A')!;
      expect(acLink.sourceColor).toBe(nodeA.fill);
      expect(acLink.targetColor).toBe(nodeA.fill);
    });

    it('target: both colors equal target node fill', () => {
      const spec = { ...basicSpec, linkStyle: 'target' as const };
      const result = compileSankey(spec, defaultOptions);

      const acLink = result.links.find((l) => l.sourceId === 'A' && l.targetId === 'C')!;
      const nodeC = result.nodes.find((n) => n.nodeId === 'C')!;
      expect(acLink.sourceColor).toBe(nodeC.fill);
      expect(acLink.targetColor).toBe(nodeC.fill);
    });

    it('neutral: both colors are the same muted value', () => {
      const spec = { ...basicSpec, linkStyle: 'neutral' as const };
      const result = compileSankey(spec, defaultOptions);

      for (const link of result.links) {
        expect(link.sourceColor).toBe(link.targetColor);
      }

      // All neutral links share the same color
      const colors = new Set(result.links.map((l) => l.sourceColor));
      expect(colors.size).toBe(1);
    });
  });

  describe('chrome', () => {
    it('resolves title and subtitle in output', () => {
      const spec = {
        ...basicSpec,
        chrome: {
          title: 'Energy Flow',
          subtitle: 'US energy sources to end uses',
        },
      };
      const result = compileSankey(spec, defaultOptions);

      expect(result.chrome.title).toBeDefined();
      expect(result.chrome.title!.text).toBe('Energy Flow');
      expect(result.chrome.subtitle).toBeDefined();
      expect(result.chrome.subtitle!.text).toBe('US energy sources to end uses');
    });
  });

  describe('legend', () => {
    it('entries match unique node colors when color encoding is set', () => {
      const spec = {
        ...basicSpec,
        encoding: {
          ...basicSpec.encoding,
          color: { field: 'from', type: 'nominal' as const },
        },
      };
      const result = compileSankey(spec, defaultOptions);

      // Legend should have entries for the unique color categories
      expect(result.legend.entries.length).toBeGreaterThan(0);
      for (const entry of result.legend.entries) {
        expect(entry.label).toBeTruthy();
        expect(entry.color).toBeTruthy();
      }
    });

    it('has no legend entries when no color encoding is set', () => {
      const result = compileSankey(basicSpec, defaultOptions);

      // Without color encoding, no legend needed
      expect(result.legend.entries).toHaveLength(0);
    });
  });

  describe('tooltip descriptors', () => {
    it('contains entries for nodes keyed as node-{id}', () => {
      const result = compileSankey(basicSpec, defaultOptions);

      expect(result.tooltipDescriptors.has('node-A')).toBe(true);
      expect(result.tooltipDescriptors.has('node-B')).toBe(true);
      expect(result.tooltipDescriptors.has('node-C')).toBe(true);
      expect(result.tooltipDescriptors.has('node-D')).toBe(true);
      expect(result.tooltipDescriptors.has('node-E')).toBe(true);
    });

    it('contains entries for links keyed as link-{source}-{target}-{index}', () => {
      const result = compileSankey(basicSpec, defaultOptions);

      // Keys include index suffix for uniqueness with duplicate source-target pairs
      const linkKeys = [...result.tooltipDescriptors.keys()].filter((k) => k.startsWith('link-'));
      expect(linkKeys.length).toBe(4);
      // Each key should have a numeric suffix
      for (const key of linkKeys) {
        expect(key).toMatch(/link-.+-\d+$/);
      }
    });

    it('node tooltip has title and flow field', () => {
      const result = compileSankey(basicSpec, defaultOptions);

      const tooltip = result.tooltipDescriptors.get('node-A')!;
      expect(tooltip.title).toBeTruthy();
      expect(tooltip.fields.length).toBeGreaterThan(0);
      expect(tooltip.fields.some((f) => f.label === 'Total flow')).toBe(true);
    });

    it('link tooltip has title and flow field', () => {
      const result = compileSankey(basicSpec, defaultOptions);

      // Get the first link tooltip (keyed with index suffix)
      const linkKey = [...result.tooltipDescriptors.keys()].find((k) => k.startsWith('link-'));
      expect(linkKey).toBeTruthy();
      const tooltip = result.tooltipDescriptors.get(linkKey!)!;
      expect(tooltip.title).toContain('\u2192'); // arrow character
      expect(tooltip.fields.some((f) => f.label === 'Flow')).toBe(true);
    });
  });

  describe('animation', () => {
    it('node animation indices increase left-to-right by column depth', () => {
      const result = compileSankey(basicSpec, defaultOptions);

      // Group nodes by depth
      const byDepth = new Map<number, number[]>();
      for (const node of result.nodes) {
        const indices = byDepth.get(node.depth) ?? [];
        indices.push(node.animationIndex);
        byDepth.set(node.depth, indices);
      }

      // All indices in a shallower column should be less than all indices
      // in a deeper column
      const depths = [...byDepth.keys()].sort((a, b) => a - b);
      for (let i = 0; i < depths.length - 1; i++) {
        const currentMax = Math.max(...byDepth.get(depths[i])!);
        const nextMin = Math.min(...byDepth.get(depths[i + 1])!);
        expect(currentMax).toBeLessThan(nextMin);
      }
    });

    it('link animation indices come after all node indices', () => {
      const spec = { ...basicSpec, animation: true };
      const result = compileSankey(spec, defaultOptions);

      const maxNodeIndex = Math.max(...result.nodes.map((n) => n.animationIndex));
      const minLinkIndex = Math.min(...result.links.map((l) => l.animationIndex));
      expect(minLinkIndex).toBeGreaterThan(maxNodeIndex);
    });
  });

  describe('a11y', () => {
    it('generates descriptive alt text', () => {
      const result = compileSankey(basicSpec, defaultOptions);

      expect(result.a11y.altText).toContain('5 nodes');
      expect(result.a11y.altText).toContain('4 links');
    });

    it('has a data table fallback', () => {
      const result = compileSankey(basicSpec, defaultOptions);

      expect(result.a11y.dataTableFallback.length).toBeGreaterThan(0);
    });
  });

  describe('dimensions', () => {
    it('reflects the compile options', () => {
      const result = compileSankey(basicSpec, defaultOptions);

      expect(result.dimensions.width).toBe(600);
      expect(result.dimensions.height).toBe(400);
    });
  });

  describe('dark mode', () => {
    it('applies dark mode theme when option is set', () => {
      const result = compileSankey(basicSpec, { ...defaultOptions, darkMode: true });

      expect(result.theme.isDark).toBe(true);
    });
  });

  describe('validation', () => {
    it('throws when data is empty', () => {
      const spec = {
        ...basicSpec,
        data: [],
      };

      expect(() => compileSankey(spec, defaultOptions)).toThrow();
    });

    it('throws when source encoding is missing', () => {
      const spec = {
        ...basicSpec,
        encoding: {
          target: { field: 'to', type: 'nominal' as const },
          value: { field: 'amount', type: 'quantitative' as const },
        },
      };

      expect(() => compileSankey(spec, defaultOptions)).toThrow();
    });

    it('throws when target encoding is missing', () => {
      const spec = {
        ...basicSpec,
        encoding: {
          source: { field: 'from', type: 'nominal' as const },
          value: { field: 'amount', type: 'quantitative' as const },
        },
      };

      expect(() => compileSankey(spec, defaultOptions)).toThrow();
    });

    it('throws when value encoding is missing', () => {
      const spec = {
        ...basicSpec,
        encoding: {
          source: { field: 'from', type: 'nominal' as const },
          target: { field: 'to', type: 'nominal' as const },
        },
      };

      expect(() => compileSankey(spec, defaultOptions)).toThrow();
    });

    it('throws for non-sankey specs', () => {
      const chartSpec = {
        mark: 'bar' as const,
        data: [{ x: 1, y: 2 }],
        encoding: {
          x: { field: 'x', type: 'quantitative' as const },
          y: { field: 'y', type: 'quantitative' as const },
        },
      };

      expect(() => compileSankey(chartSpec, defaultOptions)).toThrow(/non-sankey spec/);
    });
  });

  describe('special characters in node names', () => {
    it('compiles with spaces and $ in node names', () => {
      const spec = {
        type: 'sankey' as const,
        data: [
          { from: 'Income $104k', to: 'Essential costs', amount: 50 },
          { from: 'Income $104k', to: 'Taxes & fees', amount: 20 },
          { from: 'Essential costs', to: 'Housing #1', amount: 30 },
          { from: 'Essential costs', to: 'Food (groceries)', amount: 20 },
        ],
        encoding: {
          source: { field: 'from', type: 'nominal' as const },
          target: { field: 'to', type: 'nominal' as const },
          value: { field: 'amount', type: 'quantitative' as const },
        },
      };

      const result = compileSankey(spec, defaultOptions);
      expect(result.nodes.length).toBe(5);
      expect(result.links.length).toBe(4);
      // Node IDs should preserve the original names
      expect(result.nodes.some((n) => n.nodeId === 'Income $104k')).toBe(true);
      expect(result.nodes.some((n) => n.nodeId === 'Taxes & fees')).toBe(true);
    });
  });

  describe('dark mode colors', () => {
    it('preserves vivid categorical colors in dark mode', () => {
      const spec = {
        ...basicSpec,
        theme: { colors: ['#38bdf8', '#f87171', '#4ade80'] },
      };

      const lightResult = compileSankey(spec, defaultOptions);
      const darkResult = compileSankey(spec, { ...defaultOptions, darkMode: true });

      // Dark mode should use the same vivid node colors, not dark-adapted ones
      const lightColors = lightResult.nodes.map((n) => n.fill);
      const darkColors = darkResult.nodes.map((n) => n.fill);
      expect(darkColors).toEqual(lightColors);
    });

    it('uses higher link opacity in dark mode', () => {
      const lightResult = compileSankey(basicSpec, defaultOptions);
      const darkResult = compileSankey(basicSpec, { ...defaultOptions, darkMode: true });

      const lightOpacity = lightResult.links[0].fillOpacity;
      const darkOpacity = darkResult.links[0].fillOpacity;
      expect(darkOpacity).toBeGreaterThan(lightOpacity);
    });
  });

  describe('valueFormat', () => {
    it('formats tooltip values when valueFormat is set', () => {
      const spec = { ...basicSpec, valueFormat: '.0f%' };
      const result = compileSankey(spec, defaultOptions);

      // Check that node tooltips use the format
      const nodeTooltip = result.tooltipDescriptors.get('node-C');
      expect(nodeTooltip?.fields[0].value).toContain('%');
    });

    it('uses default formatting when valueFormat is undefined', () => {
      const result = compileSankey(basicSpec, defaultOptions);

      const nodeTooltip = result.tooltipDescriptors.get('node-C');
      expect(nodeTooltip?.fields[0].value).not.toContain('%');
    });

    it('falls back to default on invalid format string', () => {
      const spec = { ...basicSpec, valueFormat: 'not-a-format' };
      // Should not throw
      const result = compileSankey(spec, defaultOptions);
      expect(result.nodes.length).toBeGreaterThan(0);
    });
  });

  /**
   * The node values are a column the reader scans down. Formatting each one
   * independently drops trailing zeros per node, so an energy sankey printed
   * "Transport 28" beside "Industry 32.70" -- the same quantity in two
   * registers, which reads as two different precisions in the data.
   */
  describe('node value precision', () => {
    const valuesFor = (
      data: Array<Record<string, unknown>>,
      extra: Record<string, unknown> = {},
    ): string[] => {
      const result = compileSankey({ ...basicSpec, ...extra, data } as typeof basicSpec, {
        width: 900,
        height: 500,
      });
      return result.nodes.map((n) => n.valueLabel?.text ?? '');
    };

    it('gives every node the same decimal count', () => {
      // Node totals: A 24.6, B 9.8, C 34.4 -> mixed decimals before the fix.
      const labels = valuesFor([
        { from: 'A', to: 'C', amount: 24.6 },
        { from: 'B', to: 'C', amount: 9.8 },
        { from: 'C', to: 'D', amount: 28 },
        { from: 'C', to: 'E', amount: 6.4 },
      ]);
      expect(labels).toContain('28.0');
      expect(labels).toContain('24.6');
      expect(labels).toContain('34.4');
      expect(labels).not.toContain('28');
    });

    it('shows no decimals when the data is integer-only', () => {
      const labels = valuesFor([
        { from: 'A', to: 'C', amount: 10 },
        { from: 'B', to: 'C', amount: 20 },
        { from: 'C', to: 'D', amount: 30 },
      ]);
      expect(labels).toContain('10');
      expect(labels).toContain('30');
      for (const label of labels) {
        expect(label).not.toContain('.');
      }
    });

    it('leaves an explicit value format alone', () => {
      const labels = valuesFor(
        [
          { from: 'A', to: 'C', amount: 24.6 },
          { from: 'B', to: 'C', amount: 9.8 },
          { from: 'C', to: 'D', amount: 28 },
          { from: 'C', to: 'E', amount: 6.4 },
        ],
        {
          encoding: {
            source: { field: 'from', type: 'nominal' as const },
            target: { field: 'to', type: 'nominal' as const },
            value: { field: 'amount', type: 'quantitative' as const, format: '.0f' },
          },
        },
      );
      expect(labels).toContain('28');
      expect(labels).toContain('25');
    });
  });

  describe('linkOpacity', () => {
    it('uses custom linkOpacity when specified', () => {
      const spec = { ...basicSpec, linkOpacity: 0.9 };
      const result = compileSankey(spec, defaultOptions);

      expect(result.links[0].fillOpacity).toBe(0.9);
    });

    it('uses default opacity when linkOpacity is not set', () => {
      const result = compileSankey(basicSpec, defaultOptions);
      // Light mode default
      expect(result.links[0].fillOpacity).toBe(0.5);
    });
  });

  describe('dimensions', () => {
    it('dimensions match the provided container size', () => {
      const result = compileSankey(basicSpec, { width: 600, height: 800 });
      expect(result.dimensions.width).toBe(600);
      expect(result.dimensions.height).toBe(800);
    });

    it('chromeLayout: grow returns a taller SVG than subtract for the same spec', () => {
      const chromeSpec = {
        ...basicSpec,
        chrome: { title: 'Flows', subtitle: 'Chrome adds height' },
      };
      const subtract = compileSankey({ ...chromeSpec, chromeLayout: 'subtract' }, defaultOptions);
      const grow = compileSankey({ ...chromeSpec, chromeLayout: 'grow' }, defaultOptions);

      expect(subtract.dimensions.height).toBe(defaultOptions.height);
      expect(grow.dimensions.height).toBeGreaterThan(subtract.dimensions.height);
      // Default (omitted) stays subtract.
      const omitted = compileSankey(chromeSpec, defaultOptions);
      expect(omitted.dimensions.height).toBe(subtract.dimensions.height);
    });
  });
});

// ---------------------------------------------------------------------------
// Label anatomy (Phase 6): outside-left first column, outside-right last,
// value tspan in tabular ink
// ---------------------------------------------------------------------------

describe('sankey label anatomy', () => {
  const byId = (result: ReturnType<typeof compileSankey>, id: string) =>
    result.nodes.find((n) => n.nodeId === id)!;

  it('labels the first column outside-left and every other column right', () => {
    const result = compileSankey(basicSpec, defaultOptions);

    // A and B are depth 0.
    for (const id of ['A', 'B']) {
      const node = byId(result, id);
      expect(node.label.style.textAnchor).toBe('end');
      expect(node.label.x).toBeLessThan(node.x);
    }
    // C (middle) and D/E (last) label to the right of their node.
    for (const id of ['C', 'D', 'E']) {
      const node = byId(result, id);
      expect(node.label.style.textAnchor).toBe('start');
      expect(node.label.x).toBeGreaterThan(node.x + node.width - 1);
    }
  });

  it('reserves a left gutter so first-column labels stay inside the frame', () => {
    const longSpec = {
      ...basicSpec,
      data: [
        { from: 'Residential and commercial buildings', to: 'C', amount: 10 },
        { from: 'B', to: 'C', amount: 20 },
        { from: 'C', to: 'D', amount: 30 },
      ],
    };
    const result = compileSankey(longSpec, defaultOptions);
    const node = byId(result, 'Residential and commercial buildings');
    // The gutter is real space: the node no longer starts at the padding edge.
    expect(node.x).toBeGreaterThan(40);
    expect(node.label.maxWidth).toBeGreaterThan(0);
  });

  it('the left gutter never claims more than 35% of the width', () => {
    const hugeLabel = 'x'.repeat(400);
    const result = compileSankey(
      { ...basicSpec, data: [{ from: hugeLabel, to: 'C', amount: 10 }] },
      defaultOptions,
    );
    const node = byId(result, hugeLabel);
    expect(node.x).toBeLessThan(defaultOptions.width * 0.4);
  });

  it('carries the node value as a separate tabular tspan', () => {
    const result = compileSankey(basicSpec, defaultOptions);
    const c = byId(result, 'C');

    expect(c.valueLabel?.text).toBe('30');
    expect(c.valueLabel?.style.fontVariant).toBe('tabular-nums');
    // Value ink is quieter than the name's.
    expect(c.valueLabel?.style.fill).not.toBe(c.label.style.fill);
    // The name itself carries no value text.
    expect(c.label.text).toBe('C');
  });

  it('drops the interior value tspan when it would run into the next column', () => {
    // A long interior name at a narrow width leaves no room for the value
    // between the middle column and the next one.
    const longMiddle = {
      ...basicSpec,
      data: basicSpec.data.map((r) => ({
        ...r,
        from: r.from === 'C' ? 'Electricity generation' : r.from,
        to: r.to === 'C' ? 'Electricity generation' : r.to,
      })),
    };
    const narrow = compileSankey(longMiddle, { width: 300, height: 400 });
    const c = narrow.nodes.find((n) => n.nodeId === 'Electricity generation')!;
    const d = narrow.nodes.find((n) => n.nodeId === 'D')!;
    const a = narrow.nodes.find((n) => n.nodeId === 'A')!;

    expect(c.valueLabel).toBeUndefined();
    // Outside-placed columns keep theirs: their gutter was reserved for it.
    expect(d.valueLabel?.text).toBe('15');
    expect(a.valueLabel?.text).toBe('10');
  });

  it('draws nodes as solid blocks (no stroke)', () => {
    const result = compileSankey(basicSpec, defaultOptions);
    for (const node of result.nodes) expect(node.stroke).toBe('none');
  });

  it('dark mode links sit at 0.6, light at 0.5', () => {
    const light = compileSankey(basicSpec, defaultOptions);
    const dark = compileSankey(basicSpec, { ...defaultOptions, darkMode: true });
    expect(light.links[0].fillOpacity).toBe(0.5);
    expect(dark.links[0].fillOpacity).toBe(0.6);
  });
});

// ---------------------------------------------------------------------------
// Opt-in "Other" bucketing
// ---------------------------------------------------------------------------

describe('sankey other bucketing', () => {
  const longTail = {
    type: 'sankey' as const,
    data: [
      { from: 'Big', to: 'Sink', amount: 900 },
      { from: 'Small1', to: 'Sink', amount: 10 },
      { from: 'Small2', to: 'Sink', amount: 10 },
      { from: 'Small3', to: 'Sink', amount: 10 },
    ],
    encoding: {
      source: { field: 'from', type: 'nominal' as const },
      target: { field: 'to', type: 'nominal' as const },
      value: { field: 'amount', type: 'quantitative' as const },
    },
  };

  const totalFlow = (result: ReturnType<typeof compileSankey>) =>
    result.links.reduce((sum, l) => sum + l.value, 0);

  it('is off by default: every node in the data is drawn', () => {
    const result = compileSankey(longTail, defaultOptions);
    expect(result.nodes.map((n) => n.nodeId).sort()).toEqual([
      'Big',
      'Sink',
      'Small1',
      'Small2',
      'Small3',
    ]);
  });

  it('merges sub-threshold nodes per column and preserves total flow', () => {
    const before = compileSankey(longTail, defaultOptions);
    const after = compileSankey({ ...longTail, other: 0.05 }, defaultOptions);

    const labels = after.nodes.map((n) => n.label.text).sort();
    expect(labels).toEqual(['Big', 'Other', 'Sink']);
    expect(totalFlow(after)).toBe(totalFlow(before));

    const other = after.nodes.find((n) => n.label.text === 'Other')!;
    expect(other.value).toBe(30);
    expect(other.data.merged).toEqual(['Small1', 'Small2', 'Small3']);
  });

  it('accepts a custom label', () => {
    const after = compileSankey(
      { ...longTail, other: { threshold: 0.05, label: 'All others' } },
      defaultOptions,
    );
    expect(after.nodes.some((n) => n.label.text === 'All others')).toBe(true);
  });

  it('leaves a column with a single small node alone', () => {
    const oneSmall = {
      ...longTail,
      data: [
        { from: 'Big', to: 'Sink', amount: 900 },
        { from: 'Small1', to: 'Sink', amount: 10 },
      ],
    };
    const after = compileSankey({ ...oneSmall, other: 0.05 }, defaultOptions);
    expect(after.nodes.map((n) => n.nodeId).sort()).toEqual(['Big', 'Sink', 'Small1']);
  });
});
