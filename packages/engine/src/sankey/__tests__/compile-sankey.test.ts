import { describe, expect, it } from 'vitest';
import { compileSankey } from '../../compile';
import { validateSpec } from '../../compiler/validate';
import { LABEL_GAP } from '../label-placement';

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

/** The default theme's frame padding, in px. */
const THEME_PADDING = 20;

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

    const palette = result.theme.colors.categorical;
    for (const node of result.nodes) {
      expect(palette).toContain(node.fill);
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
      // One entry per unique `from` value, each with its own color...
      expect(result.legend.entries.map((e) => e.label)).toEqual(['A', 'B', 'C']);
      const legendColors = result.legend.entries.map((e) => e.color);
      expect(new Set(legendColors).size).toBe(3);
      // ...and every node is painted with one of those colors.
      for (const node of result.nodes) {
        expect(legendColors).toContain(node.fill);
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
      expect(tooltip.title).toBe('A');
      // A's only flow is A -> C (10).
      expect(tooltip.fields).toEqual([{ label: 'Total flow', value: '10' }]);
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

  describe('encoding.value.format', () => {
    it('formats tooltip values when the channel format is set', () => {
      const spec = {
        ...basicSpec,
        encoding: { ...basicSpec.encoding, value: { ...basicSpec.encoding.value, format: '.0f%' } },
      };
      const result = compileSankey(spec, defaultOptions);

      // Check that node tooltips use the format
      const nodeTooltip = result.tooltipDescriptors.get('node-C');
      expect(nodeTooltip?.fields[0].value).toContain('%');
    });

    it('uses default formatting when the channel format is omitted', () => {
      const result = compileSankey(basicSpec, defaultOptions);

      const nodeTooltip = result.tooltipDescriptors.get('node-C');
      expect(nodeTooltip?.fields[0].value).not.toContain('%');
    });

    it('falls back to default on invalid format string', () => {
      const spec = {
        ...basicSpec,
        encoding: {
          ...basicSpec.encoding,
          value: { ...basicSpec.encoding.value, format: 'not-a-format' },
        },
      };
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

  it("sizes the gutters with the host's text measure when it gives one", () => {
    const longSpec = {
      ...basicSpec,
      data: [
        { from: 'Residential buildings', to: 'C', amount: 10 },
        { from: 'B', to: 'C', amount: 20 },
        { from: 'C', to: 'D', amount: 30 },
      ],
    };
    const estimated = byId(compileSankey(longSpec, defaultOptions), 'Residential buildings');
    // A font that draws every character 8px wide, wider than the estimate assumes.
    const wideFont = (text: string, fontSize: number) => ({
      width: text.length * 8,
      height: fontSize,
    });
    const measured = byId(
      compileSankey(longSpec, { ...defaultOptions, measureText: wideFont }),
      'Residential buildings',
    );
    expect(measured.x).toBeGreaterThan(estimated.x);
    // The room left of the node, past the 6px label gap and the 20px theme
    // padding, holds "Residential buildings" (21 characters at 8px), the 5px
    // value gap and "10" (2 characters at 8px): 189px.
    expect(measured.x - LABEL_GAP - THEME_PADDING).toBeGreaterThanOrEqual(21 * 8 + 5 + 2 * 8);
  });

  it("caps the measured gutter at 35% of the plot when the host's measure is given", () => {
    const hugeLabel = 'x'.repeat(400);
    const wideFont = (text: string, fontSize: number) => ({
      width: text.length * 8,
      height: fontSize,
    });
    const result = compileSankey(
      { ...basicSpec, data: [{ from: hugeLabel, to: 'C', amount: 10 }] },
      { ...defaultOptions, measureText: wideFont },
    );
    const plotWidth = defaultOptions.width - THEME_PADDING * 2;
    expect(byId(result, hugeLabel).x).toBe(THEME_PADDING + Math.ceil(plotWidth * 0.35));
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

describe('Sankey finite flow geometry', () => {
  it.each([
    null,
    undefined,
    '',
    '  ',
    false,
    true,
    NaN,
    Infinity,
    -Infinity,
    'Infinity',
    'bad',
    -10,
    0,
    '0',
  ])('returns an empty finite figure with an actionable warning for %s flow', (amount) => {
    const warnings: string[] = [];
    const layout = compileSankey(
      { ...basicSpec, data: [{ from: 'A', to: 'B', amount }] },
      {
        ...defaultOptions,
        onWarn: (message) => warnings.push(message),
      },
    );
    expect(layout.nodes).toEqual([]);
    expect(layout.links).toEqual([]);
    expect(Object.values(layout.area).every(Number.isFinite)).toBe(true);
    expect(layout.a11y.keyboardNavigable).toBe(false);
    expect(warnings.join(' ')).toContain('positive finite');
    expect(warnings.join(' ')).toContain('amount');
  });

  it('retains measured flows and original rows while excluding invalid flow nodes and legends', () => {
    const validRows = [
      { from: 'A', to: 'B', amount: ' 10 ', group: 'Measured' },
      { from: 'B', to: 'C', amount: 10, group: 'Measured' },
    ];
    const invalidRows = [null, '', false, Infinity, -1, 0].map((amount, index) => ({
      from: `invalid-${index}`,
      to: 'C',
      amount,
      group: 'Missing',
    }));
    const layout = compileSankey(
      {
        ...basicSpec,
        data: [...validRows, ...invalidRows],
        encoding: { ...basicSpec.encoding, color: { field: 'group', type: 'nominal' } },
      },
      { ...defaultOptions, onWarn: () => {} },
    );
    expect(layout.nodes.map((node) => node.nodeId).sort()).toEqual(['A', 'B', 'C']);
    expect(layout.links).toHaveLength(2);
    for (const link of layout.links) {
      expect(link.path).not.toMatch(/NaN|Infinity/);
      expect(link.value).toBe(10);
    }
    for (const node of layout.nodes) {
      expect([node.x, node.y, node.width, node.height].every(Number.isFinite)).toBe(true);
    }
    expect(JSON.stringify(layout.legend)).not.toContain('Missing');
    expect(validRows[0].amount).toBe(' 10 ');
  });
});

// ---------------------------------------------------------------------------
// Labels on the flow at narrow widths
// ---------------------------------------------------------------------------

/** US electricity generation in 2024 (LLNL, quads): fuels in, sectors out. */
const electricity = {
  type: 'sankey' as const,
  data: [
    { source: 'Solar', target: 'Electricity generation', value: 0.75 },
    { source: 'Nuclear', target: 'Electricity generation', value: 8.17 },
    { source: 'Hydro', target: 'Electricity generation', value: 0.83 },
    { source: 'Wind', target: 'Electricity generation', value: 1.54 },
    { source: 'Natural gas', target: 'Electricity generation', value: 13.94 },
    { source: 'Coal', target: 'Electricity generation', value: 7.01 },
    { source: 'Biomass', target: 'Electricity generation', value: 0.32 },
    { source: 'Geothermal', target: 'Electricity generation', value: 0.05 },
    { source: 'Petroleum', target: 'Electricity generation', value: 0.17 },
    { source: 'Net electricity imports', target: 'Electricity generation', value: 0.01 },
    { source: 'Electricity generation', target: 'Residential', value: 5.06 },
    { source: 'Electricity generation', target: 'Commercial', value: 4.95 },
    { source: 'Electricity generation', target: 'Industrial', value: 3.53 },
    { source: 'Electricity generation', target: 'Transportation', value: 0.02 },
    { source: 'Electricity generation', target: 'Rejected energy', value: 19.21 },
  ],
  encoding: {
    source: { field: 'source', type: 'nominal' as const },
    target: { field: 'target', type: 'nominal' as const },
    value: { field: 'value', type: 'quantitative' as const },
  },
};

describe('sankey labels at phone widths', () => {
  const phone = { width: 360, height: 640 };
  const byId = (result: ReturnType<typeof compileSankey>, id: string) =>
    result.nodes.find((n) => n.nodeId === id)!;

  it('moves labels onto the flow and gives the nodes the full width', () => {
    const result = compileSankey(electricity, phone);
    const coal = byId(result, 'Coal');
    const rejected = byId(result, 'Rejected energy');

    expect(coal.x).toBe(THEME_PADDING);
    expect(rejected.x + rejected.width).toBe(phone.width - THEME_PADDING);
    // First column: just right of the node. Last column: just left of it.
    expect(coal.label).toMatchObject({ x: coal.x + coal.width + LABEL_GAP, halo: true });
    expect(coal.label.style.textAnchor).toBe('start');
    expect(rejected.label).toMatchObject({ x: rejected.x - LABEL_GAP, halo: true });
    expect(rejected.label.style.textAnchor).toBe('end');
    // The value rides along on its own line.
    expect(coal.label.lines).toEqual(['Coal']);
    expect(coal.valueLabel?.text).toBe('7.01');
  });

  it('wraps an interior label before the next column', () => {
    const result = compileSankey(electricity, phone);
    const hub = byId(result, 'Electricity generation');
    const nextColumn = Math.min(...result.nodes.filter((n) => n.depth === 2).map((n) => n.x));

    expect(hub.label.lines).toEqual(['Electricity', 'generation']);
    expect(hub.label.x + hub.label.maxWidth!).toBeLessThanOrEqual(nextColumn - LABEL_GAP);
  });

  it.each([
    [360, 12],
    [360, 14],
    [430, 12],
  ])('keeps every label block in a column clear of the next at %ipx, %ipx type', (width, size) => {
    const result = compileSankey(
      { ...electricity, theme: { fonts: { sizes: { small: size } } } },
      { width, height: 640 },
    );
    const lineHeight = size * 1.3;
    const blocks = result.nodes.map((n) => {
      const height = ((n.label.lines?.length ?? 1) + 1) * lineHeight;
      return { depth: n.depth, top: n.label.y - height / 2, bottom: n.label.y + height / 2 };
    });
    for (const a of blocks) {
      for (const b of blocks) {
        if (a === b || a.depth !== b.depth) continue;
        expect(a.bottom <= b.top || b.bottom <= a.top).toBe(true);
      }
    }
  });

  it('keeps outside labels at desktop widths', () => {
    const result = compileSankey(electricity, { width: 1280, height: 640 });
    const coal = byId(result, 'Coal');
    expect(coal.label.style.textAnchor).toBe('end');
    expect(coal.label.x).toBeLessThan(coal.x);
    expect(coal.label.lines).toBeUndefined();
    expect(coal.label.halo).toBeUndefined();
  });

  it("keeps the author's label side at any width", () => {
    const result = compileSankey({ ...electricity, nodeLabelAlign: 'right' as const }, phone);
    for (const node of result.nodes) {
      expect(node.label.lines).toBeUndefined();
      expect(node.label.style.textAnchor).toBe('start');
    }
  });
});

describe('sankey edge values', () => {
  const byId = (result: ReturnType<typeof compileSankey>, id: string) =>
    result.nodes.find((n) => n.nodeId === id)!;
  // One word too long for a gutter at its 35% cap.
  const capped = {
    ...basicSpec,
    data: [
      { from: 'Coal', to: 'Rejectedenergyfromthermalpowerstations', amount: 62.27 },
      { from: 'Coal', to: 'Homes', amount: 3.5 },
    ],
  };

  it('leaves off an outside value that would run past the frame', () => {
    const result = compileSankey(capped, { width: 800, height: 300 });
    expect(byId(result, 'Rejectedenergyfromthermalpowerstations').valueLabel).toBeUndefined();
  });

  it('keeps an outside value that fits beside the name', () => {
    const result = compileSankey(capped, { width: 800, height: 300 });
    expect(byId(result, 'Homes').valueLabel?.text).toBe('3.50');
  });
});

describe('sankey interior labels at wider widths', () => {
  it('keep the room to the frame edge, as outside labels always have', () => {
    const spec = {
      ...basicSpec,
      data: basicSpec.data.map((r) => ({
        ...r,
        from: r.from === 'C' ? 'Electricity generation' : r.from,
        to: r.to === 'C' ? 'Electricity generation' : r.to,
      })),
    };
    const result = compileSankey(spec, { width: 300, height: 400 });
    const hub = result.nodes.find((n) => n.nodeId === 'Electricity generation')!;
    expect(hub.label.lines).toBeUndefined();
    expect(hub.label.x + hub.label.maxWidth!).toBe(300 - THEME_PADDING);
  });
});

// ---------------------------------------------------------------------------
// Breakpoint overrides
// ---------------------------------------------------------------------------

describe('sankey overrides', () => {
  const withOverrides = {
    ...electricity,
    chrome: { title: 'Desktop title', source: 'LLNL' },
    overrides: {
      compact: { other: 0.03, chrome: { title: 'Phone title' } },
      medium: { nodePadding: 4 },
    },
  };
  const labels = (result: ReturnType<typeof compileSankey>) =>
    result.nodes.map((n) => n.label.text);

  it('folds small nodes into "Other" only on phones', () => {
    const phone = compileSankey(withOverrides, { width: 360, height: 640 });
    const desktop = compileSankey(withOverrides, { width: 1280, height: 640 });
    const tablet = compileSankey(withOverrides, { width: 500, height: 640 });

    expect(labels(phone)).toContain('Other');
    expect(labels(phone)).not.toContain('Geothermal');
    expect(labels(desktop)).toContain('Geothermal');
    expect(labels(desktop)).not.toContain('Other');
    expect(labels(tablet)).toContain('Geothermal');
  });

  it('merges chrome one level deep at its breakpoint', () => {
    const phone = compileSankey(withOverrides, { width: 360, height: 640 });
    const desktop = compileSankey(withOverrides, { width: 1280, height: 640 });

    expect(phone.chrome.title?.text).toBe('Phone title');
    expect(phone.chrome.source?.text).toBe('LLNL');
    expect(desktop.chrome.title?.text).toBe('Desktop title');
  });

  it('applies a medium block only between 400 and 700px', () => {
    const gap = (result: ReturnType<typeof compileSankey>) => {
      const column = result.nodes.filter((n) => n.depth === 2).sort((a, b) => a.y - b.y);
      return column[1].y - (column[0].y + column[0].height);
    };
    const tablet = compileSankey(withOverrides, { width: 500, height: 640 });
    const plainTablet = compileSankey(electricity, { width: 500, height: 640 });
    const desktop = compileSankey(withOverrides, { width: 1280, height: 640 });
    const plainDesktop = compileSankey(electricity, { width: 1280, height: 640 });
    expect(gap(tablet)).toBeLessThan(gap(plainTablet));
    expect(gap(desktop)).toBeCloseTo(gap(plainDesktop));
  });

  it('rejects an unknown breakpoint', () => {
    expect(() =>
      compileSankey(
        { ...electricity, overrides: { phone: { other: 0.03 } } },
        { width: 360, height: 640 },
      ),
    ).toThrow(/unknown breakpoint "phone"/);
  });

  it.each([
    ['a field overrides cannot set', { data: [] }, '/overrides/compact/data'],
    ['a type swap', { type: 'line' }, '/overrides/compact/type'],
    ['a typo', { nodePaddng: 4 }, '/overrides/compact/nodePaddng'],
    ['a non-numeric padding', { nodePadding: 'x' }, '/overrides/compact/nodePadding'],
    ['a negative padding', { nodePadding: -2 }, '/overrides/compact/nodePadding'],
    ['an out-of-range other', { other: 5 }, '/overrides/compact/other'],
    ['an unknown label side', { nodeLabelAlign: 'top' }, '/overrides/compact/nodeLabelAlign'],
    ['a nodeSort of numbers', { nodeSort: [1, 2] }, '/overrides/compact/nodeSort'],
  ])('rejects %s at every width, naming its path', (_name, block, path) => {
    const spec = { ...electricity, overrides: { compact: block } };
    const result = validateSpec(spec);
    expect(result.errors.map((e) => e.path)).toEqual([path]);
    // A desktop compile, where the block is not active, fails too.
    expect(() => compileSankey(spec, { width: 1280, height: 640 })).toThrow(/overrides\.compact/);
  });
});
