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
  LegendEntry,
  LegendLayout,
  ResolvedTheme,
  TextStyle,
  TooltipContent,
  TooltipField,
} from '@opendata-ai/openchart-core';
import { adaptTheme, computeChrome, resolveTheme } from '@opendata-ai/openchart-core';

import { compile as compileSpec } from '../compiler/index';
import type { NormalizedGraphSpec } from '../compiler/types';
import { applyCommunityColors, assignCommunities, buildCommunityColorMap } from './community';
import { resolveEdgeVisuals, resolveNodeVisuals } from './encoding';
import type { CompiledGraphNode, GraphCompilation, SimulationConfig } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SWATCH_SIZE = 12;
const SWATCH_GAP = 6;
const ENTRY_GAP = 16;

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
    // One entry per community
    entries = [...communityColorMap.entries()].map(([label, color]) => ({
      label,
      color,
      shape: 'circle' as const,
      active: true,
    }));
  } else {
    // Build legend from nodeColor encoding: group by the color field value
    // so each legend entry shows the categorical value (e.g. "Dataset", "bls")
    // rather than an arbitrary node label.
    const categoryColors = new Map<string, string>();
    for (const node of nodes) {
      const category = nodeColorField
        ? String(node.data[nodeColorField] ?? node.label ?? node.id)
        : (node.label ?? node.id);
      if (!categoryColors.has(category)) {
        categoryColors.set(category, node.fill);
      }
    }

    // Only show legend if there are multiple categories
    if (categoryColors.size <= 1) {
      entries = [];
    } else {
      entries = [...categoryColors.entries()].map(([label, color]) => ({
        label,
        color,
        shape: 'circle' as const,
        active: true,
      }));
    }
  }

  return {
    position: 'top',
    entries,
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    labelStyle,
    swatchSize: SWATCH_SIZE,
    swatchGap: SWATCH_GAP,
    entryGap: ENTRY_GAP,
  };
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
        value: typeof value === 'number' ? value.toLocaleString() : String(value),
      });
    }

    descriptors.set(node.id, {
      title: node.label ?? node.id,
      fields,
    });
  }

  return descriptors;
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
  const { spec: normalized } = compileSpec(spec);

  if (!('type' in normalized) || normalized.type !== 'graph') {
    throw new Error(
      'compileGraph received a non-graph spec. Use compileChart or compileTable instead.',
    );
  }

  const graphSpec = normalized as NormalizedGraphSpec;

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
  const legend = buildGraphLegend(
    compiledNodes,
    communityColorMap,
    useCommunitiesForLegend,
    theme,
    graphSpec.encoding.nodeColor?.field,
  );

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

  // 10. Build simulation config
  const collisionPadding = graphSpec.layout.collisionPadding ?? 2;
  const maxRadius =
    compiledNodes.length > 0
      ? Math.max(...compiledNodes.map((n) => n.radius))
      : DEFAULT_COLLISION_PADDING;
  const simulationConfig: SimulationConfig = {
    chargeStrength: graphSpec.layout.chargeStrength ?? -300,
    linkDistance: graphSpec.layout.linkDistance ?? 30,
    clustering: clusteringField ? { field: clusteringField, strength: 0.5 } : null,
    alphaDecay: 0.0228,
    velocityDecay: 0.4,
    collisionRadius: maxRadius + collisionPadding,
    collisionPadding,
    linkStrength: graphSpec.layout.linkStrength,
    centerForce: graphSpec.layout.centerForce,
  };

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
  };
}

/** Default padding for collision radius when there are no nodes. */
const DEFAULT_COLLISION_PADDING = 5;
