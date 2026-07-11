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
  buildD3Formatter,
  computeChrome,
  estimateTextWidth,
  formatNumber,
  resolveTheme,
} from '@opendata-ai/openchart-core';
import { emitSpecWarnings } from '../compile/spec-sugar';
import { resolveAnimation } from '../compiler/animation';
import { compile as compileSpec } from '../compiler/index';
import { ENTRY_GAP, measureLegendWrap, SWATCH_GAP, SWATCH_SIZE } from '../legend/wrap';
import { type ComputedNode, computeSankeyLayout, generateLinkPath } from './layout';
import type { NormalizedSankeySpec } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LABEL_GAP = 6;
const LINK_OPACITY_LIGHT = 0.5;
const LINK_OPACITY_DARK = 0.75;
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
 * Default ('auto'): leftmost/middle columns label right, rightmost column labels left.
 * 'right': all labels to the right.  'left': all labels to the left.
 */
function computeNodeLabel(
  node: ComputedNode,
  maxDepth: number,
  theme: ResolvedTheme,
  nodeWidth: number,
  nodeLabelAlign: 'auto' | 'left' | 'right' = 'auto',
  containerWidth?: number,
  padding?: number,
): SankeyNodeMark['label'] {
  const depth = node.depth ?? 0;

  // Determine which side to place the label
  let placeLeft: boolean;
  if (nodeLabelAlign === 'left') {
    placeLeft = true;
  } else if (nodeLabelAlign === 'right') {
    placeLeft = false;
  } else {
    // 'auto': rightmost column goes left, everything else goes right
    placeLeft = depth === maxDepth;
  }

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

  // Compute maxWidth: space from label position to the container edge
  const pad = padding ?? 0;
  let maxWidth: number | undefined;
  if (containerWidth !== undefined) {
    if (placeLeft) {
      // Label goes left from x0: available space is from left padding to x0
      maxWidth = x0 - LABEL_GAP - pad;
    } else {
      // Label goes right from x1: available space is from x1 to right edge
      maxWidth = containerWidth - pad - (x1 + LABEL_GAP);
    }
    if (maxWidth !== undefined && maxWidth < 0) maxWidth = 0;
  }

  if (placeLeft) {
    return {
      text: node.label ?? node.id,
      x: x0 - LABEL_GAP,
      y: midY,
      style: { ...style, textAnchor: 'end', dominantBaseline: 'central' },
      visible: true,
      maxWidth,
    };
  }

  return {
    text: node.label ?? node.id,
    x: x1 + LABEL_GAP,
    y: midY,
    style: { ...style, textAnchor: 'start', dominantBaseline: 'central' },
    visible: true,
    maxWidth,
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
  const { spec: normalized, warnings } = compileSpec(spec);
  emitSpecWarnings(warnings);

  if (!('type' in normalized) || normalized.type !== 'sankey') {
    throw new Error(
      'compileSankey received a non-sankey spec. Use compileChart, compileTable, or compileGraph instead.',
    );
  }

  const sankeySpec = normalized as NormalizedSankeySpec;

  // Resolve watermark: explicit spec value wins, then options fallback, then default true.
  const rawWatermark = (spec as Record<string, unknown>).watermark;
  const watermark = rawWatermark !== undefined ? sankeySpec.watermark : (options.watermark ?? true);

  // 2. Resolve theme
  const mergedThemeConfig = options.theme
    ? { ...sankeySpec.theme, ...options.theme }
    : sankeySpec.theme;
  const lightTheme: ResolvedTheme = resolveTheme(mergedThemeConfig);
  let theme: ResolvedTheme = lightTheme;
  if (options.darkMode) {
    theme = adaptTheme(theme);
    // Sankey nodes and link gradients need vivid colors that stand out on dark
    // backgrounds. The adapted palette preserves contrast ratios designed for
    // text, but those contrast-matched colors are too dark for filled shapes.
    // Use the original light-theme categorical palette for node/link colors.
    theme = {
      ...theme,
      colors: { ...theme.colors, categorical: lightTheme.colors.categorical },
    };
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
    'full',
    undefined,
    watermark,
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
    return emptyLayout(fullArea, chrome, theme, options, watermark);
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
  const legendGap = 'entries' in legend && legend.entries.length > 0 ? 4 : 0;
  const area: Rect = {
    x: fullArea.x,
    y: fullArea.y + legend.bounds.height + legendGap,
    width: fullArea.width,
    height: fullArea.height - legend.bounds.height - legendGap,
  };

  if (area.height <= 0) {
    return emptyLayout(area, chrome, theme, options, watermark);
  }

  // 6. Run d3-sankey layout (may re-run once if labels overflow)
  const labelFontSize = theme.fonts.sizes.small;
  const labelFontWeight = theme.fonts.weights.normal;
  const nodeWidth = sankeySpec.nodeWidth ?? 12;

  let layoutArea: Rect = { ...area };
  let { nodes, links } = computeSankeyLayout(
    sankeySpec.data,
    sourceField,
    targetField,
    valueField,
    layoutArea,
    sankeySpec.nodeWidth,
    sankeySpec.nodePadding,
    sankeySpec.nodeAlign,
    sankeySpec.iterations,
    sankeySpec.nodeSort,
  );

  // 6b. Check if any right-side node labels overflow the right edge.
  const nodeLabelAlign = sankeySpec.nodeLabelAlign ?? 'auto';
  const maxDepthFirst = nodes.reduce((max, n) => Math.max(max, n.depth ?? 0), 0);
  const rightEdge = area.x + area.width;
  let maxOverflow = 0;
  for (const node of nodes) {
    const depth = node.depth ?? 0;
    // Skip nodes whose labels go left (they can't overflow the right edge)
    const labelsLeft =
      nodeLabelAlign === 'left' || (nodeLabelAlign === 'auto' && depth === maxDepthFirst);
    if (labelsLeft) continue;
    const labelX = (node.x1 ?? nodeWidth) + LABEL_GAP;
    const labelText = node.label ?? node.id;
    const labelWidth = estimateTextWidth(labelText, labelFontSize, labelFontWeight);
    const overflow = labelX + labelWidth - rightEdge;
    if (overflow > maxOverflow) maxOverflow = overflow;
  }

  // Re-run layout with tighter width if labels would clip
  if (maxOverflow > 0) {
    const margin = Math.ceil(maxOverflow) + 4; // small extra buffer
    layoutArea = {
      x: area.x,
      y: area.y,
      width: Math.max(area.width - margin, 40),
      height: area.height,
    };
    ({ nodes, links } = computeSankeyLayout(
      sankeySpec.data,
      sourceField,
      targetField,
      valueField,
      layoutArea,
      sankeySpec.nodeWidth,
      sankeySpec.nodePadding,
      sankeySpec.nodeAlign,
      sankeySpec.iterations,
      sankeySpec.nodeSort,
    ));
  }

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
      label: computeNodeLabel(
        node,
        maxDepth,
        theme,
        sankeySpec.nodeWidth,
        nodeLabelAlign,
        options.width,
        padding,
      ),
      nodeId: node.id,
      value: node.value ?? 0,
      depth,
      data: { id: node.id, label: node.label },
      aria: {
        role: 'img',
        label: `${node.label}: ${formatFlowValue(node.value ?? 0, sankeySpec.valueFormat)}`,
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
      fillOpacity:
        sankeySpec.linkOpacity ?? (options.darkMode ? LINK_OPACITY_DARK : LINK_OPACITY_LIGHT),
      sourceId: sourceNode.id,
      targetId: targetNode.id,
      width: link.width ?? 0,
      value: link.value,
      data: (link as unknown as { data: Record<string, unknown> }).data ?? {},
      aria: {
        role: 'img',
        label: `${sourceNode.label} to ${targetNode.label}: ${formatFlowValue(link.value, sankeySpec.valueFormat)}`,
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
  const tooltipDescriptors = buildTooltipDescriptors(nodeMarks, linkMarks, sankeySpec.valueFormat);

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
    watermark,
    measureText: options.measureText,
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

    // Compute row count via shared wrap geometry, then cap at 2 rows.
    const { rowCount } = measureLegendWrap(entries, availableWidth, labelStyle);
    const cappedRowCount = Math.min(rowCount, 2);
    const legendHeight = cappedRowCount * ROW_HEIGHT;

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
    swatchChipFill: theme.colors.annotationFill,
  };
}

// ---------------------------------------------------------------------------
// Tooltip builder
// ---------------------------------------------------------------------------

function formatFlowValue(value: number, valueFormat?: string): string {
  if (valueFormat) {
    const fmt = buildD3Formatter(valueFormat);
    if (fmt) return fmt(value);
  }
  return formatNumber(value);
}

function buildTooltipDescriptors(
  nodes: SankeyNodeMark[],
  links: SankeyLinkMark[],
  valueFormat?: string,
): Map<string, TooltipContent> {
  const descriptors = new Map<string, TooltipContent>();

  // Node tooltips: keyed by "node-{nodeId}" to match renderer data-mark-id
  for (const node of nodes) {
    const fields: TooltipField[] = [
      {
        label: 'Total flow',
        value: formatFlowValue(node.value, valueFormat),
      },
    ];
    descriptors.set(`node-${node.nodeId}`, {
      title: node.label.text,
      fields,
    });
  }

  // Link tooltips: keyed by "link-{sourceId}-{targetId}" to match renderer data-mark-id
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    const fields: TooltipField[] = [
      {
        label: 'Flow',
        value: formatFlowValue(link.value, valueFormat),
      },
    ];
    descriptors.set(`link-${link.sourceId}-${link.targetId}-${i}`, {
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
  watermark: boolean,
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
      swatchChipFill: theme.colors.annotationFill,
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
    watermark,
  };
}
