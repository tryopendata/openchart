/**
 * Graph compilation pipeline.
 *
 * Takes a raw graph spec (unknown shape), validates, normalizes, resolves
 * encoding channels to visual properties, assigns communities, builds
 * legend/tooltips/a11y, and returns a GraphCompilation.
 *
 * The pipeline mirrors compileChart's structure:
 *   validate -> normalize -> resolve theme -> resolve visuals ->
 *   community assignment -> legend -> tooltips -> a11y -> return
 *
 * Key difference from charts: the output does NOT include x/y positions.
 * The force simulation in the adapter handles layout at runtime.
 */

import type {
  CompileOptions,
  GraphEncoding,
  LegendEntry,
  LegendLayout,
  ResolvedTheme,
  TextStyle,
  TooltipContent,
  TooltipField,
} from '@opendata-ai/openchart-core';
import {
  adaptTheme,
  computeChrome,
  defaultNumberFormatter,
  resolveTheme,
} from '@opendata-ai/openchart-core';
import { emitSpecWarnings } from '../compile/spec-sugar';
import { compile as compileSpec } from '../compiler/index';
import type { NormalizedGraphSpec } from '../compiler/types';
import { resolveGraphAnimation } from './animation';
import { applyCommunityColors, assignCommunities, buildCommunityColorMap } from './community';
import { resolveCategoricalDomain, resolveEdgeVisuals, resolveNodeVisuals } from './encoding';
import { resolveGraphInteraction } from './interaction';
import type {
  CompiledGraphEdge,
  CompiledGraphNode,
  GraphCompilation,
  SimulationConfig,
} from './types';

const graphNumberFormatter = defaultNumberFormatter({ allIntegers: false, surface: 'chart' });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SWATCH_SIZE = 12;
const SWATCH_GAP = 6;
const ENTRY_GAP = 16;

/** Repulsion preset → chargeStrength + velocityDecay. Raw layout fields win. */
const ENERGY_PRESETS = {
  gentle: { chargeStrength: -150, velocityDecay: 0.5 },
  balanced: { chargeStrength: -300, velocityDecay: 0.4 },
  energetic: { chargeStrength: -600, velocityDecay: 0.3 },
} as const;

/** Settle-speed preset → alphaDecay. */
const SETTLE_PRESETS = {
  quick: 0.05,
  balanced: 0.0228,
  thorough: 0.01,
} as const;

/** Warmup defaults: `true` → 100 ticks, 250ms budget. */
const DEFAULT_WARMUP_TICKS = 100;
const DEFAULT_WARMUP_BUDGET_MS = 250;

// ---------------------------------------------------------------------------
// Legend builder
// ---------------------------------------------------------------------------

/**
 * Build a legend from community assignments or nodeColor encoding.
 *
 * Built manually instead of reusing computeLegend (which assumes chart
 * encoding channels). Returns entries with color swatches and labels.
 * Position is placeholder (adapter determines actual placement).
 */
function buildGraphLegend(
  nodes: CompiledGraphNode[],
  communityColorMap: Map<string, string>,
  hasCommunities: boolean,
  theme: ResolvedTheme,
  nodeColorField?: string,
  legendOrder?: string[],
): LegendLayout {
  const labelStyle: TextStyle = {
    fontFamily: theme.fonts.family,
    fontSize: theme.fonts.sizes.small,
    fontWeight: theme.fonts.weights.normal,
    fill: theme.colors.text,
    lineHeight: 1.3,
  };

  let entries: LegendEntry[];

  if (hasCommunities && communityColorMap.size > 0) {
    // One entry per community, with node counts
    const counts = new Map<string, number>();
    for (const node of nodes) {
      if (node.community != null) {
        counts.set(node.community, (counts.get(node.community) ?? 0) + 1);
      }
    }
    entries = [...communityColorMap.entries()].map(([label, color]) => ({
      label,
      color,
      shape: 'circle' as const,
      active: true,
      count: counts.get(label) ?? 0,
    }));
  } else if (nodeColorField) {
    // Build legend from nodeColor encoding: group by the color field value
    // so each legend entry shows the categorical value (e.g. "Dataset", "bls")
    // rather than an arbitrary node label. Order follows the sort-resolved
    // domain so the legend agrees with fill assignment and highlight sets.
    const categoryColors = new Map<string, string>();
    const categoryCounts = new Map<string, number>();
    for (const node of nodes) {
      const category = String(node.data[nodeColorField] ?? node.label ?? node.id);
      if (!categoryColors.has(category)) {
        categoryColors.set(category, node.fill);
      }
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }

    // Only show legend if there are multiple categories
    entries =
      categoryColors.size <= 1
        ? []
        : (legendOrder ?? [...categoryColors.keys()])
            .filter((label) => categoryColors.has(label))
            .map((label) => ({
              label,
              color: categoryColors.get(label) as string,
              shape: 'circle' as const,
              active: true,
              count: categoryCounts.get(label) ?? 0,
            }));
  } else {
    // No communities and no color encoding: every node shares one fill, so a
    // legend would just list every node label against identical swatches.
    entries = [];
  }

  return {
    position: 'top',
    entries,
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    labelStyle,
    swatchSize: SWATCH_SIZE,
    swatchGap: SWATCH_GAP,
    entryGap: ENTRY_GAP,
    swatchChipFill: theme.colors.annotationFill,
  };
}

/**
 * Build edge legend entries for a nominal edgeColor encoding with >1 category.
 *
 * Returns undefined when there's no nominal edgeColor field or only one
 * category. Entries are ordered by the sort-resolved domain and carry counts;
 * the renderer draws them as non-interactive line swatches (this release only
 * node rows are interactive).
 */
function buildEdgeLegend(
  edges: CompiledGraphEdge[],
  encoding: GraphEncoding,
): LegendEntry[] | undefined {
  const field = encoding.edgeColor?.field;
  if (!field || (encoding.edgeColor?.type ?? 'nominal') === 'quantitative') return undefined;

  const categoryColors = new Map<string, string>();
  const categoryCounts = new Map<string, number>();
  for (const edge of edges) {
    const category = String(edge.data[field] ?? '');
    if (!categoryColors.has(category)) categoryColors.set(category, edge.stroke);
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  }
  if (categoryColors.size <= 1) return undefined;

  const order = resolveCategoricalDomain(
    edges.map((e) => String(e.data[field] ?? '')),
    encoding.edgeColor?.sort,
    encoding.edgeColor?.scale?.domain,
  );

  return order
    .filter((label) => categoryColors.has(label))
    .map((label) => ({
      label,
      color: categoryColors.get(label) as string,
      shape: 'line' as const,
      active: true,
      count: categoryCounts.get(label) ?? 0,
    }));
}

// ---------------------------------------------------------------------------
// Tooltip builder
// ---------------------------------------------------------------------------

/**
 * Build tooltip descriptors for each node.
 *
 * Keyed by node id. Shows all data fields, label, and community.
 */
function buildGraphTooltips(nodes: CompiledGraphNode[]): Map<string, TooltipContent> {
  const descriptors = new Map<string, TooltipContent>();

  for (const node of nodes) {
    const fields: TooltipField[] = [];

    // Add community if present
    if (node.community != null) {
      fields.push({
        label: 'Community',
        value: node.community,
        color: node.fill,
      });
    }

    // Add all data fields (excluding id since it's the title)
    for (const [key, value] of Object.entries(node.data)) {
      if (key === 'id') continue;
      if (value == null) continue;

      fields.push({
        label: key,
        value: typeof value === 'number' ? graphNumberFormatter(value) : String(value),
      });
    }

    descriptors.set(node.id, {
      title: node.label ?? node.id,
      fields,
    });
  }

  return descriptors;
}

/**
 * Build a tooltip for a single edge, on demand.
 *
 * Construction is LAZY (called for the one hovered edge), not an eager O(E)
 * descriptor map — edges outnumber nodes 5–10× and an eager map on every
 * compile (including updateVisuals) would be pure bloat. Shows source → target
 * and all non-structural data fields.
 */
export function buildEdgeTooltip(edge: CompiledGraphEdge): TooltipContent {
  const fields: TooltipField[] = [];
  for (const [key, value] of Object.entries(edge.data)) {
    if (key === 'source' || key === 'target') continue;
    if (value == null) continue;
    fields.push({
      label: key,
      value: typeof value === 'number' ? graphNumberFormatter(value) : String(value),
    });
  }
  return {
    title: `${edge.source} → ${edge.target}`,
    fields,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compile a graph spec into a GraphCompilation.
 *
 * Pipeline:
 * 1. Validate + normalize via the shared compiler pipeline
 * 2. Resolve theme (merge spec + options, apply dark mode)
 * 3. Resolve node visuals (size, color, label, stroke)
 * 4. Assign communities if layout.clustering is set
 * 5. Apply community colors (override nodeColor)
 * 6. Resolve edge visuals (width, color)
 * 7. Build legend from communities or nodeColor
 * 8. Build tooltip descriptors for each node
 * 9. Build a11y metadata
 * 10. Build simulation config from spec layout
 * 11. Build chrome from spec + theme
 * 12. Return GraphCompilation
 *
 * @param spec - Raw graph spec (validated at runtime).
 * @param options - Compile options (width, height, theme, darkMode).
 * @returns GraphCompilation with resolved visual properties.
 * @throws Error if spec is invalid or not a graph type.
 */
export function compileGraph(spec: unknown, options: CompileOptions): GraphCompilation {
  // 1. Validate + normalize
  const { spec: normalized, warnings } = compileSpec(spec);
  emitSpecWarnings(warnings, options.onWarn);

  if (!('type' in normalized) || normalized.type !== 'graph') {
    throw new Error(
      'compileGraph received a non-graph spec. Use compileChart or compileTable instead.',
    );
  }

  const graphSpec = normalized as NormalizedGraphSpec;

  // Warn (don't error) when `sort` is set on a quantitative color channel —
  // ordering a continuous domain is a no-op and usually a spec mistake.
  for (const [name, ch] of [
    ['nodeColor', graphSpec.encoding.nodeColor],
    ['edgeColor', graphSpec.encoding.edgeColor],
  ] as const) {
    if (ch?.sort != null && ch.type === 'quantitative') {
      options.onWarn?.(
        `encoding.${name}.sort is ignored for a quantitative field (sort only orders categorical domains).`,
      );
    }
  }

  // Resolve watermark: explicit spec value wins, then options fallback, then default true.
  const rawWatermark = (spec as Record<string, unknown>).watermark;
  const watermark = rawWatermark !== undefined ? graphSpec.watermark : (options.watermark ?? true);

  // 2. Resolve theme
  const mergedThemeConfig = options.theme
    ? { ...graphSpec.theme, ...options.theme }
    : graphSpec.theme;
  let theme: ResolvedTheme = resolveTheme(mergedThemeConfig);
  if (options.darkMode) {
    theme = adaptTheme(theme);
  }

  // 3. Resolve node visuals
  const compiledNodes = resolveNodeVisuals(
    graphSpec.nodes,
    graphSpec.encoding,
    graphSpec.edges,
    theme,
    graphSpec.nodeOverrides,
  );

  // 4. Assign communities (for force simulation grouping)
  const clusteringField = graphSpec.layout.clustering?.field;
  const hasCommunities = !!clusteringField;
  assignCommunities(compiledNodes, clusteringField);

  // 5. Apply community colors only when no explicit nodeColor encoding is set.
  // When the consumer specifies nodeColor (e.g. by nodeType or provider), that
  // encoding should drive both fill colors and legend entries.
  const hasNodeColorEncoding = !!graphSpec.encoding.nodeColor?.field;
  let communityColorMap = new Map<string, string>();
  if (hasCommunities && !hasNodeColorEncoding) {
    communityColorMap = buildCommunityColorMap(compiledNodes, theme);
    applyCommunityColors(compiledNodes, communityColorMap);
  }

  // 6. Resolve edge visuals
  const compiledEdges = resolveEdgeVisuals(graphSpec.edges, graphSpec.encoding, theme);

  // 7. Build legend (use nodeColor encoding colors when present, community otherwise)
  const useCommunitiesForLegend = hasCommunities && !hasNodeColorEncoding;
  const nodeColorField = graphSpec.encoding.nodeColor?.field;
  // Sort-resolved category order so legend + highlight sets agree.
  const legendOrder = nodeColorField
    ? resolveCategoricalDomain(
        compiledNodes.map((n) => String(n.data[nodeColorField] ?? n.label ?? n.id)),
        graphSpec.encoding.nodeColor?.sort,
        graphSpec.encoding.nodeColor?.scale?.domain,
      )
    : undefined;
  const legend = buildGraphLegend(
    compiledNodes,
    communityColorMap,
    useCommunitiesForLegend,
    theme,
    nodeColorField,
    legendOrder,
  );
  const edgeLegend = buildEdgeLegend(compiledEdges, graphSpec.encoding);

  // Legend field: the category source. nodeColor field, else the clustering
  // field (community legend), else null.
  const legendField =
    nodeColorField ?? (useCommunitiesForLegend ? (clusteringField ?? null) : null);

  // Capture nodeColor.highlight → initial emphasis set (against the resolved domain).
  let initialHighlight: { field: string; values: string[] } | undefined;
  if (nodeColorField && graphSpec.encoding.nodeColor?.highlight != null) {
    const raw = graphSpec.encoding.nodeColor.highlight;
    const requested = Array.isArray(raw) ? raw : [raw];
    const available = new Set(legendOrder ?? []);
    const values = requested.filter((v) => available.has(v));
    if (values.length > 0) initialHighlight = { field: nodeColorField, values };
  }

  // 8. Build tooltips
  const tooltipDescriptors = buildGraphTooltips(compiledNodes);

  // 9. Build a11y metadata
  const communityCount = communityColorMap.size;
  const altParts = [
    `Network graph with ${compiledNodes.length} nodes and ${compiledEdges.length} edges`,
  ];
  if (communityCount > 0) {
    altParts.push(`organized into ${communityCount} communities`);
  }
  const a11y = {
    altText: altParts.join(', '),
    dataTableFallback: compiledNodes.map((n) => [n.id, n.community ?? '', n.label ?? '']),
    role: 'img',
    keyboardNavigable: compiledNodes.length > 0,
  };

  // 10. Build simulation config. Energy/settle presets provide defaults; raw
  // layout fields (chargeStrength) always win over a preset.
  const collisionPadding = graphSpec.layout.collisionPadding ?? 2;
  const maxRadius =
    compiledNodes.length > 0
      ? Math.max(...compiledNodes.map((n) => n.radius))
      : DEFAULT_COLLISION_PADDING;

  const energyPreset = graphSpec.layout.energy
    ? ENERGY_PRESETS[graphSpec.layout.energy]
    : ENERGY_PRESETS.balanced;
  const settlePreset = graphSpec.layout.settle
    ? SETTLE_PRESETS[graphSpec.layout.settle]
    : SETTLE_PRESETS.balanced;

  // Warmup defaults ON: undefined/true → default ticks, number → explicit tick
  // count, false → 0. It lives in layout (not animation) so `animation: false`
  // still gets the off-screen settle instead of the explosive first frames.
  const warmupRaw = graphSpec.layout.warmup;
  const warmupTicks =
    warmupRaw === false
      ? 0
      : typeof warmupRaw === 'number'
        ? Math.max(0, Math.floor(warmupRaw))
        : DEFAULT_WARMUP_TICKS;

  const simulationConfig: SimulationConfig = {
    chargeStrength: graphSpec.layout.chargeStrength ?? energyPreset.chargeStrength,
    linkDistance: graphSpec.layout.linkDistance ?? 30,
    clustering: clusteringField ? { field: clusteringField, strength: 0.5 } : null,
    alphaDecay: settlePreset,
    velocityDecay: energyPreset.velocityDecay,
    collisionRadius: maxRadius + collisionPadding,
    collisionPadding,
    linkStrength: graphSpec.layout.linkStrength,
    centerForce: graphSpec.layout.centerForce,
    seed: graphSpec.layout.seed,
    warmupTicks,
    warmupBudgetMs: DEFAULT_WARMUP_BUDGET_MS,
  };

  // Resolve motion + interaction (default-ON animation, defaulted interaction).
  const animation = resolveGraphAnimation(graphSpec.animation);
  const interaction = resolveGraphInteraction(graphSpec.interaction);

  // 11. Build chrome
  const chrome = computeChrome(
    {
      title: graphSpec.chrome.title,
      subtitle: graphSpec.chrome.subtitle,
      source: graphSpec.chrome.source,
      byline: graphSpec.chrome.byline,
      footer: graphSpec.chrome.footer,
    },
    theme,
    options.width,
    options.measureText,
    'full',
    undefined,
    watermark,
  );

  // 12. Return compilation
  return {
    nodes: compiledNodes,
    edges: compiledEdges,
    legend,
    chrome,
    tooltipDescriptors,
    a11y,
    theme,
    dimensions: {
      width: options.width,
      height: options.height,
    },
    simulationConfig,
    watermark,
    animation,
    interaction,
    legendField,
    initialHighlight,
    edgeLegend,
  };
}

/** Default padding for collision radius when there are no nodes. */
const DEFAULT_COLLISION_PADDING = 5;
