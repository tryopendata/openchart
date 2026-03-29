/**
 * Sankey diagram compilation pipeline.
 *
 * Takes a raw sankey spec (unknown shape), validates, normalizes, resolves
 * theme, computes chrome, runs d3-sankey layout, builds marks with colors
 * and labels, and returns a SankeyLayout.
 *
 * Pipeline:
 *   validate -> normalize -> resolve theme -> dark mode adapt ->
 *   compute chrome -> compute drawing area -> d3-sankey layout ->
 *   build node marks -> build link marks -> legend -> tooltips ->
 *   a11y -> animation -> return SankeyLayout
 */

import type {
  CompileOptions,
  LegendEntry,
  LegendLayout,
  Rect,
  ResolvedAnimation,
  ResolvedTheme,
  SankeyLayout,
  SankeyLinkMark,
  SankeyNodeMark,
  TextStyle,
  TooltipContent,
  TooltipField,
} from '@opendata-ai/openchart-core';
import {
  adaptTheme,
  computeChrome,
  estimateTextWidth,
  formatNumber,
  resolveTheme,
} from '@opendata-ai/openchart-core';

import { resolveAnimation } from '../compiler/animation';
import { compile as compileSpec } from '../compiler/index';
import { type ComputedNode, computeSankeyLayout, generateLinkPath } from './layout';
import type { NormalizedSankeySpec } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SWATCH_SIZE = 12;
const SWATCH_GAP = 6;
const ENTRY_GAP = 16;
const LABEL_GAP = 6;
const LINK_OPACITY = 0.35;
const NODE_CORNER_RADIUS = 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Assign a color from the categorical palette, cycling through it. */
function pickColor(palette: string[], index: number): string {
  return palette[index % palette.length];
}

/**
 * Build a color map for nodes.
 * If encoding.color is specified, groups by that field's value.
 * Otherwise, assigns by unique node ID cycling the palette.
 * Accepts any array with `id` field (works with ComputedNode[] or plain objects).
 */
function buildNodeColorMap(
  nodes: Array<{ id: string }>,
  palette: string[],
  colorField: string | undefined,
  data: Record<string, unknown>[],
  sourceField: string,
  targetField: string,
): Map<string, string> {
  const colorMap = new Map<string, string>();

  if (colorField) {
    // Build a mapping from node ID to color category value
    const nodeCategoryMap = new Map<string, string>();
    for (const row of data) {
      const src = String(row[sourceField]);
      const tgt = String(row[targetField]);
      const cat = String(row[colorField]);
      if (!nodeCategoryMap.has(src)) nodeCategoryMap.set(src, cat);
      if (!nodeCategoryMap.has(tgt)) nodeCategoryMap.set(tgt, cat);
    }

    // Assign colors by unique category
    const categoryIndex = new Map<string, number>();
    let nextIdx = 0;
    for (const node of nodes) {
      const category = nodeCategoryMap.get(node.id) ?? node.id;
      if (!categoryIndex.has(category)) {
        categoryIndex.set(category, nextIdx++);
      }
      colorMap.set(node.id, pickColor(palette, categoryIndex.get(category)!));
    }
  } else {
    // Default: assign colors cycling through palette by node order
    for (let i = 0; i < nodes.length; i++) {
      colorMap.set(nodes[i].id, pickColor(palette, i));
    }
  }

  return colorMap;
}

/**
 * Get colors for a link based on the linkStyle strategy.
 */
function getLinkColors(
  linkStyle: string,
  sourceColor: string,
  targetColor: string,
  neutralColor: string,
): { sourceColor: string; targetColor: string } {
  switch (linkStyle) {
    case 'source':
      return { sourceColor, targetColor: sourceColor };
    case 'target':
      return { sourceColor: targetColor, targetColor };
    case 'neutral':
      return { sourceColor: neutralColor, targetColor: neutralColor };
    default:
      return { sourceColor, targetColor };
  }
}

/**
 * Determine label position for a node based on its column depth.
 * Leftmost column: label to the right.
 * Rightmost column: label to the left.
 * Middle columns: label to the right (default).
 */
function computeNodeLabel(
  node: ComputedNode,
  maxDepth: number,
  theme: ResolvedTheme,
  nodeWidth: number,
): SankeyNodeMark['label'] {
  const depth = node.depth ?? 0;
  const isRightmost = depth === maxDepth;

  const style: TextStyle = {
    fontFamily: theme.fonts.family,
    fontSize: theme.fonts.sizes.small,
    fontWeight: theme.fonts.weights.normal,
    fill: theme.colors.text,
    lineHeight: 1.3,
  };

  const x0 = node.x0 ?? 0;
  const x1 = node.x1 ?? nodeWidth;
  const y0 = node.y0 ?? 0;
  const y1 = node.y1 ?? 0;
  const midY = (y0 + y1) / 2;

  if (isRightmost) {
    // Label to the left of the node
    return {
      text: node.label ?? node.id,
      x: x0 - LABEL_GAP,
      y: midY,
      style: { ...style, textAnchor: 'end', dominantBaseline: 'central' },
      visible: true,
    };
  }

  // Label to the right of the node (leftmost and middle columns)
  return {
    text: node.label ?? node.id,
    x: x1 + LABEL_GAP,
    y: midY,
    style: { ...style, textAnchor: 'start', dominantBaseline: 'central' },
    visible: true,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compile a sankey spec into a SankeyLayout.
 *
 * @param spec - Raw sankey spec (validated at runtime).
 * @param options - Compile options (width, height, theme, darkMode).
 * @returns SankeyLayout with all computed positions and visual properties.
 * @throws Error if spec is invalid or not a sankey type.
 */
export function compileSankey(spec: unknown, options: CompileOptions): SankeyLayout {
  // 1. Validate + normalize via the shared compiler pipeline
  const { spec: normalized } = compileSpec(spec);

  if (!('type' in normalized) || normalized.type !== 'sankey') {
    throw new Error(
      'compileSankey received a non-sankey spec. Use compileChart, compileTable, or compileGraph instead.',
    );
  }

  const sankeySpec = normalized as NormalizedSankeySpec;

  // 2. Resolve theme
  const mergedThemeConfig = options.theme
    ? { ...sankeySpec.theme, ...options.theme }
    : sankeySpec.theme;
  let theme: ResolvedTheme = resolveTheme(mergedThemeConfig);
  if (options.darkMode) {
    theme = adaptTheme(theme);
  }

  // 3. Compute chrome
  const chrome = computeChrome(
    {
      title: sankeySpec.chrome.title,
      subtitle: sankeySpec.chrome.subtitle,
      source: sankeySpec.chrome.source,
      byline: sankeySpec.chrome.byline,
      footer: sankeySpec.chrome.footer,
    },
    theme,
    options.width,
    options.measureText,
  );

  // 4. Compute drawing area (total space minus chrome)
  const padding = theme.spacing.padding;
  const fullArea: Rect = {
    x: padding,
    y: padding + chrome.topHeight,
    width: options.width - padding * 2,
    height: options.height - chrome.topHeight - chrome.bottomHeight - padding * 2,
  };

  // Guard against negative dimensions
  if (fullArea.width <= 0 || fullArea.height <= 0) {
    return emptyLayout(fullArea, chrome, theme, options);
  }

  // 5. Extract encoding fields
  const sourceField = sankeySpec.encoding.source.field;
  const targetField = sankeySpec.encoding.target.field;
  const valueField = sankeySpec.encoding.value.field;
  const colorField = sankeySpec.encoding.color?.field;

  // 5b. Pre-compute legend to reserve vertical space
  //     We need the color map first, so build a temporary one from raw data
  const tempNodeIds = new Set<string>();
  for (const row of sankeySpec.data) {
    tempNodeIds.add(String(row[sourceField]));
    tempNodeIds.add(String(row[targetField]));
  }
  const tempColorMap = buildNodeColorMap(
    [...tempNodeIds].map((id) => ({ id })),
    theme.colors.categorical,
    colorField,
    sankeySpec.data,
    sourceField,
    targetField,
  );
  const legend = buildSankeyLegend(
    tempColorMap,
    colorField,
    sankeySpec.data,
    sourceField,
    targetField,
    theme,
    fullArea,
  );

  // Reserve legend space by shrinking the drawing area
  const legendGap = legend.entries.length > 0 ? 4 : 0;
  const area: Rect = {
    x: fullArea.x,
    y: fullArea.y + legend.bounds.height + legendGap,
    width: fullArea.width,
    height: fullArea.height - legend.bounds.height - legendGap,
  };

  if (area.height <= 0) {
    return emptyLayout(area, chrome, theme, options);
  }

  // 6. Run d3-sankey layout
  const { nodes, links } = computeSankeyLayout(
    sankeySpec.data,
    sourceField,
    targetField,
    valueField,
    area,
    sankeySpec.nodeWidth,
    sankeySpec.nodePadding,
    sankeySpec.nodeAlign,
    sankeySpec.iterations,
  );

  // 7. Build node color map
  const nodeColorMap = buildNodeColorMap(
    nodes,
    theme.colors.categorical,
    colorField,
    sankeySpec.data,
    sourceField,
    targetField,
  );

  // 8. Compute max depth for label positioning
  const maxDepth = nodes.reduce((max, n) => Math.max(max, n.depth ?? 0), 0);

  // 9. Build SankeyNodeMark[]
  const nodeMarks: SankeyNodeMark[] = nodes.map((node) => {
    const fill = nodeColorMap.get(node.id) ?? theme.colors.categorical[0];
    const depth = node.depth ?? 0;

    return {
      type: 'sankeyNode' as const,
      x: node.x0 ?? 0,
      y: node.y0 ?? 0,
      width: (node.x1 ?? 0) - (node.x0 ?? 0),
      height: (node.y1 ?? 0) - (node.y0 ?? 0),
      fill,
      cornerRadius: NODE_CORNER_RADIUS,
      label: computeNodeLabel(node, maxDepth, theme, sankeySpec.nodeWidth),
      nodeId: node.id,
      value: node.value ?? 0,
      depth,
      data: { id: node.id, label: node.label },
      aria: {
        role: 'img',
        label: `${node.label}: ${formatNumber(node.value ?? 0)}`,
      },
      animationIndex: 0, // Reassigned below after sorting by depth
    };
  });

  // 10. Assign node animation indices by column (left-to-right, top-to-bottom within column)
  nodeMarks.sort((a, b) => a.depth - b.depth || a.y - b.y);
  for (let i = 0; i < nodeMarks.length; i++) {
    nodeMarks[i].animationIndex = i;
  }

  // 11. Build SankeyLinkMark[]
  const neutralColor = theme.colors.gridline;
  const linkMarks: SankeyLinkMark[] = links.map((link, i) => {
    const sourceNode = link.source as ComputedNode;
    const targetNode = link.target as ComputedNode;
    const srcColor = nodeColorMap.get(sourceNode.id) ?? theme.colors.categorical[0];
    const tgtColor = nodeColorMap.get(targetNode.id) ?? theme.colors.categorical[0];
    const colors = getLinkColors(sankeySpec.linkStyle, srcColor, tgtColor, neutralColor);

    return {
      type: 'sankeyLink' as const,
      path: generateLinkPath(link),
      sourceColor: colors.sourceColor,
      targetColor: colors.targetColor,
      fillOpacity: LINK_OPACITY,
      sourceId: sourceNode.id,
      targetId: targetNode.id,
      width: link.width ?? 0,
      value: link.value,
      data: (link as unknown as { data: Record<string, unknown> }).data ?? {},
      aria: {
        role: 'img',
        label: `${sourceNode.label} to ${targetNode.label}: ${formatNumber(link.value)}`,
      },
      // Links animate after nodes
      animationIndex: nodeMarks.length + i,
    };
  });

  // 12. Rebuild legend with final color map (temp map may differ in node order)
  const finalLegend = buildSankeyLegend(
    nodeColorMap,
    colorField,
    sankeySpec.data,
    sourceField,
    targetField,
    theme,
    fullArea,
  );

  // 13. Build tooltip descriptors
  const tooltipDescriptors = buildTooltipDescriptors(nodeMarks, linkMarks);

  // 14. Build a11y metadata
  const a11y = {
    altText: `Sankey diagram with ${nodeMarks.length} nodes and ${linkMarks.length} links`,
    dataTableFallback: linkMarks.map((l) => [l.sourceId, l.targetId, String(l.value)]),
    role: 'img',
    keyboardNavigable: nodeMarks.length > 0,
  };

  // 15. Resolve animation
  const resolvedAnimation: ResolvedAnimation | undefined = resolveAnimation(sankeySpec.animation);

  return {
    area,
    chrome,
    nodes: nodeMarks,
    links: linkMarks,
    legend: finalLegend,
    tooltipDescriptors,
    a11y,
    theme,
    dimensions: {
      width: options.width,
      height: options.height,
    },
    animation: resolvedAnimation,
  };
}

// ---------------------------------------------------------------------------
// Legend builder
// ---------------------------------------------------------------------------

function buildSankeyLegend(
  nodeColorMap: Map<string, string>,
  colorField: string | undefined,
  data: Record<string, unknown>[],
  sourceField: string,
  targetField: string,
  theme: ResolvedTheme,
  area: Rect,
): LegendLayout {
  const labelStyle: TextStyle = {
    fontFamily: theme.fonts.family,
    fontSize: theme.fonts.sizes.small,
    fontWeight: theme.fonts.weights.normal,
    fill: theme.colors.text,
    lineHeight: 1.3,
  };

  let entries: LegendEntry[];

  if (colorField) {
    // Group by color field value for legend entries
    const categoryColors = new Map<string, string>();
    const nodeCategoryMap = new Map<string, string>();
    for (const row of data) {
      const src = String(row[sourceField]);
      const tgt = String(row[targetField]);
      const cat = String(row[colorField]);
      if (!nodeCategoryMap.has(src)) nodeCategoryMap.set(src, cat);
      if (!nodeCategoryMap.has(tgt)) nodeCategoryMap.set(tgt, cat);
    }
    for (const [nodeId, category] of nodeCategoryMap) {
      if (!categoryColors.has(category)) {
        categoryColors.set(category, nodeColorMap.get(nodeId) ?? theme.colors.categorical[0]);
      }
    }

    entries = [...categoryColors.entries()].map(([label, color]) => ({
      label,
      color,
      shape: 'square' as const,
      active: true,
    }));
  } else {
    // No color encoding: no legend needed (nodes are individually colored)
    entries = [];
  }

  // Compute bounds for horizontal top legend
  let bounds = { x: 0, y: 0, width: 0, height: 0 };

  if (entries.length > 0) {
    const ROW_HEIGHT = SWATCH_SIZE + 4;
    const availableWidth = area.width;

    // Compute row count by simulating horizontal wrapping
    let rowCount = 1;
    let rowX = 0;
    for (const entry of entries) {
      const labelWidth = estimateTextWidth(entry.label, labelStyle.fontSize, labelStyle.fontWeight);
      const entryWidth = SWATCH_SIZE + SWATCH_GAP + labelWidth + ENTRY_GAP;
      if (rowX > 0 && rowX + entryWidth > availableWidth) {
        rowCount++;
        rowX = entryWidth;
      } else {
        rowX += entryWidth;
      }
    }

    // Cap at 2 rows max
    rowCount = Math.min(rowCount, 2);
    const legendHeight = rowCount * ROW_HEIGHT;

    bounds = {
      x: area.x,
      y: area.y,
      width: availableWidth,
      height: legendHeight,
    };
  }

  return {
    position: 'top',
    entries,
    bounds,
    labelStyle,
    swatchSize: SWATCH_SIZE,
    swatchGap: SWATCH_GAP,
    entryGap: ENTRY_GAP,
  };
}

// ---------------------------------------------------------------------------
// Tooltip builder
// ---------------------------------------------------------------------------

function buildTooltipDescriptors(
  nodes: SankeyNodeMark[],
  links: SankeyLinkMark[],
): Map<string, TooltipContent> {
  const descriptors = new Map<string, TooltipContent>();

  // Node tooltips: keyed by "node-{nodeId}" to match renderer data-mark-id
  for (const node of nodes) {
    const fields: TooltipField[] = [
      {
        label: 'Total flow',
        value: formatNumber(node.value),
      },
    ];
    descriptors.set(`node-${node.nodeId}`, {
      title: node.label.text,
      fields,
    });
  }

  // Link tooltips: keyed by "link-{sourceId}-{targetId}" to match renderer data-mark-id
  for (const link of links) {
    const fields: TooltipField[] = [
      {
        label: 'Flow',
        value: formatNumber(link.value),
      },
    ];
    descriptors.set(`link-${link.sourceId}-${link.targetId}`, {
      title: `${link.sourceId} \u2192 ${link.targetId}`,
      fields,
    });
  }

  return descriptors;
}

// ---------------------------------------------------------------------------
// Empty layout fallback
// ---------------------------------------------------------------------------

function emptyLayout(
  area: Rect,
  chrome: ReturnType<typeof computeChrome>,
  theme: ResolvedTheme,
  options: CompileOptions,
): SankeyLayout {
  return {
    area,
    chrome,
    nodes: [],
    links: [],
    legend: {
      position: 'top',
      entries: [],
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      labelStyle: {
        fontFamily: theme.fonts.family,
        fontSize: theme.fonts.sizes.small,
        fontWeight: theme.fonts.weights.normal,
        fill: theme.colors.text,
        lineHeight: 1.3,
      },
      swatchSize: SWATCH_SIZE,
      swatchGap: SWATCH_GAP,
      entryGap: ENTRY_GAP,
    },
    tooltipDescriptors: new Map(),
    a11y: {
      altText: 'Empty sankey diagram',
      dataTableFallback: [],
      role: 'img',
      keyboardNavigable: false,
    },
    theme,
    dimensions: {
      width: options.width,
      height: options.height,
    },
  };
}
