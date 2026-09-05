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
  NumberFormatter,
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
  defaultNumberFormatter,
  estimateTextWidth,
  resolveTheme,
} from '@opendata-ai/openchart-core';
import { emitSpecWarnings, expandSpecSugar } from '../compile/spec-sugar';
import { resolveAnimation } from '../compiler/animation';
import { compile as compileSpec } from '../compiler/index';
import { resolveFieldFormatter } from '../format/field-format';
import { resolveChromeLayout } from '../layout/shared';
import { ENTRY_GAP, measureLegendWrap, SWATCH_GAP, SWATCH_SIZE } from '../legend/wrap';
import { type ComputedNode, computeSankeyLayout, generateLinkPath } from './layout';
import type { NormalizedSankeySpec } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LABEL_GAP = 6;
const LINK_OPACITY_LIGHT = 0.5;
/**
 * Dark-mode link opacity. Light ribbons on a dark ground gain apparent weight,
 * so 0.75 turned every crossing into a solid slab; 0.6 keeps overlaps readable.
 */
const LINK_OPACITY_DARK = 0.6;
const NODE_CORNER_RADIUS = 2;
/** Gap between a node's name and its value tspan. */
const VALUE_GAP = 5;
/** Share of the drawing width either label gutter may claim. */
const MAX_LABEL_GUTTER = 0.35;
/** Id prefix for a synthetic "Other" bucket node (one per column). */
const OTHER_ID_PREFIX = '__oc_other_';

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

/** Resolved form of the opt-in `other` bucketing config. */
interface OtherConfig {
  threshold: number;
  label: string;
}

/** Normalize `other: 0.05` / `other: { threshold, label }` into one shape. */
function resolveOtherConfig(other: NormalizedSankeySpec['other']): OtherConfig | null {
  if (other == null) return null;
  const threshold = typeof other === 'number' ? other : other.threshold;
  if (!Number.isFinite(threshold) || threshold <= 0) return null;
  const label = (typeof other === 'object' ? other.label : undefined) ?? 'Other';
  return { threshold, label };
}

/**
 * Map sub-threshold nodes to a per-column "Other" bucket.
 *
 * The share is measured against the node's own column total, which is what a
 * reader compares against: a 4% node in a two-node column is not the same kind
 * of small as a 4% node in a column of thirty. A column with a single small node
 * is left alone -- renaming one node "Other" hides its identity and buys no
 * space.
 */
function bucketSmallNodes(nodes: ComputedNode[], cfg: OtherConfig): Map<string, string> {
  const byDepth = new Map<number, ComputedNode[]>();
  for (const node of nodes) {
    const depth = node.depth ?? 0;
    const group = byDepth.get(depth);
    if (group) group.push(node);
    else byDepth.set(depth, [node]);
  }

  const merged = new Map<string, string>();
  for (const [depth, group] of byDepth) {
    const total = group.reduce((sum, n) => sum + (n.value ?? 0), 0);
    if (total <= 0) continue;
    const small = group.filter((n) => (n.value ?? 0) / total < cfg.threshold);
    if (small.length < 2) continue;
    for (const node of small) merged.set(node.id, `${OTHER_ID_PREFIX}${depth}`);
  }
  return merged;
}

/**
 * Rewrite flow rows through an "Other" mapping, summing rows that collapse onto
 * the same source/target pair so the diagram's total flow is preserved. Rows
 * whose endpoints collapse onto each other would be self-loops and are dropped.
 */
function rewriteRowsForOther(
  data: Record<string, unknown>[],
  sourceField: string,
  targetField: string,
  valueField: string,
  merged: Map<string, string>,
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const index = new Map<string, Record<string, unknown>>();
  for (const row of data) {
    const src = String(row[sourceField]);
    const tgt = String(row[targetField]);
    const newSrc = merged.get(src) ?? src;
    const newTgt = merged.get(tgt) ?? tgt;
    if (newSrc === newTgt) continue;
    const key = `${newSrc}\u0000${newTgt}`;
    const value = Number(row[valueField]) || 0;
    const existing = index.get(key);
    if (existing) {
      existing[valueField] = (Number(existing[valueField]) || 0) + value;
      continue;
    }
    const next = { ...row, [sourceField]: newSrc, [targetField]: newTgt, [valueField]: value };
    index.set(key, next);
    out.push(next);
  }
  return out;
}

/**
 * Determine label position for a node based on its column depth.
 * Default ('auto'): leftmost/middle columns label right, rightmost column labels left.
 * 'right': all labels to the right.  'left': all labels to the left.
 */
function labelsLeftForDepth(
  depth: number,
  maxDepth: number,
  nodeLabelAlign: 'auto' | 'left' | 'right',
): boolean {
  if (nodeLabelAlign === 'left') return true;
  if (nodeLabelAlign === 'right') return false;
  // 'auto': the first column labels outside-left and the last outside-right, so
  // the flow itself is never crossed by type. Interior columns label right.
  if (depth === 0 && maxDepth > 0) return true;
  return false;
}

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
  const placeLeft = labelsLeftForDepth(depth, maxDepth, nodeLabelAlign);

  const style: TextStyle = {
    fontFamily: theme.fonts.family,
    fontSize: theme.fonts.sizes.small,
    fontWeight: theme.fonts.weights.medium,
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
  // 1. Expand deprecated top-level sugar (valueFormat -> encoding.value.format)
  // before validation, then validate + normalize via the shared compiler pipeline.
  const sugarWarnings: string[] = [];
  const expandedSpec =
    spec && typeof spec === 'object' && !Array.isArray(spec)
      ? expandSpecSugar(spec as Record<string, unknown>, sugarWarnings)
      : spec;
  const { spec: normalized, warnings } = compileSpec(expandedSpec);
  emitSpecWarnings([...sugarWarnings, ...warnings], options.onWarn);

  if (!('type' in normalized) || normalized.type !== 'sankey') {
    throw new Error(
      'compileSankey received a non-sankey spec. Use compileChart, compileTable, or compileGraph instead.',
    );
  }

  const sankeySpec = normalized as NormalizedSankeySpec;

  // Resolve format: encoding-level (v8 canonical) wins over deprecated top-level valueFormat
  const resolvedValueFormat = sankeySpec.encoding.value.format ?? sankeySpec.valueFormat;

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

  // 4. Compute drawing area. In 'grow' mode the plot keeps the full height
  // budget (chrome is not subtracted) and the returned SVG height grows by the
  // chrome height. In the default 'subtract' mode both are unchanged.
  const padding = theme.spacing.padding;
  // Read chromeLayout from the raw spec: normalizeSankeySpec does not carry it
  // through, and SankeySpec has no chromeLayout field, so the option default is
  // the primary control (a user-authored spec.chromeLayout still wins here).
  const chromeLayout = resolveChromeLayout(
    spec as { chromeLayout?: 'subtract' | 'grow' } | undefined,
    options,
  );
  const grownHeight =
    chromeLayout === 'grow'
      ? options.height + chrome.topHeight + chrome.bottomHeight
      : options.height;
  const fullArea: Rect = {
    x: padding,
    y: padding + chrome.topHeight,
    width: options.width - padding * 2,
    height:
      chromeLayout === 'grow'
        ? options.height - padding * 2
        : options.height - chrome.topHeight - chrome.bottomHeight - padding * 2,
  };

  // Guard against negative dimensions
  if (fullArea.width <= 0 || fullArea.height <= 0) {
    return emptyLayout(fullArea, chrome, theme, { ...options, height: grownHeight }, watermark);
  }

  // 5. Extract encoding fields
  const sourceField = sankeySpec.encoding.source.field;
  const targetField = sankeySpec.encoding.target.field;
  const valueField = sankeySpec.encoding.value.field;
  const colorField = sankeySpec.encoding.color?.field;
  const flowFmt = resolveFieldFormatter({
    surfaceFormat: resolvedValueFormat,
    values: sankeySpec.data.map((r) => r[valueField]),
  });

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
    return emptyLayout(area, chrome, theme, { ...options, height: grownHeight }, watermark);
  }

  // 6. Run d3-sankey layout (re-runs when "Other" bucketing or label gutters
  //    change the graph or the extent it is laid out in).
  const labelFontSize = theme.fonts.sizes.small;
  const labelFontWeight = theme.fonts.weights.medium;
  const valueFontWeight = theme.fonts.weights.normal;
  const nodeLabelAlign = sankeySpec.nodeLabelAlign ?? 'auto';

  let workingData = sankeySpec.data;
  const runLayout = (rect: Rect) =>
    computeSankeyLayout(
      workingData,
      sourceField,
      targetField,
      valueField,
      rect,
      sankeySpec.nodeWidth,
      sankeySpec.nodePadding,
      sankeySpec.nodeAlign,
      sankeySpec.iterations,
      sankeySpec.nodeSort,
    );

  let layoutArea: Rect = { ...area };
  let { nodes, links } = runLayout(layoutArea);

  // 6a. Opt-in "Other" bucketing. Needs the first layout because a node's share
  //     is measured against its own column, and columns come from the layout.
  const otherConfig = resolveOtherConfig(sankeySpec.other);
  const otherLabels = new Map<string, string>();
  const otherMembers = new Map<string, string[]>();
  if (otherConfig) {
    const merged = bucketSmallNodes(nodes, otherConfig);
    if (merged.size > 0) {
      for (const [nodeId, otherId] of merged) {
        otherLabels.set(otherId, otherConfig.label);
        const members = otherMembers.get(otherId);
        if (members) members.push(nodeId);
        else otherMembers.set(otherId, [nodeId]);
      }
      workingData = rewriteRowsForOther(workingData, sourceField, targetField, valueField, merged);
      ({ nodes, links } = runLayout(layoutArea));
    }
  }

  const applyOtherLabels = (list: ComputedNode[]): void => {
    if (otherLabels.size === 0) return;
    for (const node of list) {
      const label = otherLabels.get(node.id);
      if (label) node.label = label;
    }
  };
  applyOtherLabels(nodes);

  // 6b. Reserve label gutters. Outside-left labels on the first column and
  //     outside-right labels on the last need room the layout does not know
  //     about, so measure the widest block on each side and re-run the layout
  //     inside the remaining extent. Each gutter is capped so a long name can
  //     never squeeze the flow itself out of the frame.
  const labelBlockWidth = (node: ComputedNode): number => {
    const name = node.label ?? node.id;
    const nameWidth = estimateTextWidth(name, labelFontSize, labelFontWeight);
    const valueWidth = estimateTextWidth(
      formatFlowValue(node.value ?? 0, flowFmt),
      labelFontSize,
      valueFontWeight,
    );
    return nameWidth + VALUE_GAP + valueWidth;
  };

  const measureGutters = (list: ComputedNode[]): { left: number; right: number } => {
    const maxDepth = list.reduce((max, n) => Math.max(max, n.depth ?? 0), 0);
    const cap = area.width * MAX_LABEL_GUTTER;
    let left = 0;
    let right = 0;
    for (const node of list) {
      const depth = node.depth ?? 0;
      const width = labelBlockWidth(node) + LABEL_GAP;
      if (labelsLeftForDepth(depth, maxDepth, nodeLabelAlign)) {
        // Space needed to the left of the node, minus what already exists.
        const need = width - ((node.x0 ?? 0) - area.x);
        if (need > left) left = need;
      } else {
        const need = width - (area.x + area.width - (node.x1 ?? 0));
        if (need > right) right = need;
      }
    }
    return {
      left: Math.min(Math.max(left, 0), cap),
      right: Math.min(Math.max(right, 0), cap),
    };
  };

  const gutters = measureGutters(nodes);
  if (gutters.left > 0 || gutters.right > 0) {
    const left = Math.ceil(gutters.left);
    const right = Math.ceil(gutters.right);
    layoutArea = {
      x: area.x + left,
      y: area.y,
      width: Math.max(area.width - left - right, 40),
      height: area.height,
    };
    ({ nodes, links } = runLayout(layoutArea));
    applyOtherLabels(nodes);
  }

  // 7. Build node color map
  const nodeColorMap = buildNodeColorMap(
    nodes,
    theme.colors.categorical,
    colorField,
    workingData,
    sourceField,
    targetField,
  );
  // An "Other" bucket is a residual, not a category: it takes neutral ink so it
  // never competes with the real flows for attention.
  for (const otherId of otherMembers.keys()) {
    nodeColorMap.set(otherId, theme.colors.neutral[300]);
  }

  // 8. Compute max depth for label positioning
  const maxDepth = nodes.reduce((max, n) => Math.max(max, n.depth ?? 0), 0);

  // 9. Build SankeyNodeMark[]
  const valueStyle: TextStyle = {
    fontFamily: theme.fonts.family,
    fontSize: theme.fonts.sizes.small,
    fontWeight: theme.fonts.weights.normal,
    fill: theme.colors.axis,
    fontVariant: 'tabular-nums',
    lineHeight: 1.3,
  };

  // Left edge of each column, so an interior label knows how much room it has
  // before it runs into the next column.
  const columnX0 = new Map<number, number>();
  for (const node of nodes) {
    const d = node.depth ?? 0;
    const x0 = node.x0 ?? 0;
    const current = columnX0.get(d);
    if (current === undefined || x0 < current) columnX0.set(d, x0);
  }

  /**
   * Interior labels are drawn inside the flow, between their own node and the
   * next column, so they get the value tspan only when it actually fits there.
   * Outside-placed labels (first and last column) always keep theirs -- their
   * gutter was reserved for exactly this width.
   */
  const valueLabelFor = (
    node: ComputedNode,
    depth: number,
    text: string,
  ): SankeyNodeMark['valueLabel'] => {
    const placedLeft = labelsLeftForDepth(depth, maxDepth, nodeLabelAlign);
    if (placedLeft || depth === maxDepth) return { text, style: valueStyle };
    const nextColumn = columnX0.get(depth + 1);
    if (nextColumn === undefined) return { text, style: valueStyle };
    const available = nextColumn - LABEL_GAP - ((node.x1 ?? 0) + LABEL_GAP);
    const needed =
      estimateTextWidth(node.label ?? node.id, labelFontSize, labelFontWeight) +
      VALUE_GAP +
      estimateTextWidth(text, labelFontSize, valueFontWeight);
    return needed <= available ? { text, style: valueStyle } : undefined;
  };

  const nodeMarks: SankeyNodeMark[] = nodes.map((node) => {
    const fill = nodeColorMap.get(node.id) ?? theme.colors.categorical[0];
    const depth = node.depth ?? 0;
    const merged = otherMembers.get(node.id);
    const valueText = formatFlowValue(node.value ?? 0, flowFmt);

    return {
      type: 'sankeyNode' as const,
      x: node.x0 ?? 0,
      y: node.y0 ?? 0,
      width: (node.x1 ?? 0) - (node.x0 ?? 0),
      height: (node.y1 ?? 0) - (node.y0 ?? 0),
      fill,
      // Explicit: a node is a solid block of flow, not an outlined box. Without
      // this the renderer inherits whatever stroke the SVG context carries.
      stroke: 'none',
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
      valueLabel: valueLabelFor(node, depth, valueText),
      nodeId: node.id,
      value: node.value ?? 0,
      depth,
      data: merged
        ? { id: node.id, label: node.label, merged }
        : { id: node.id, label: node.label },
      aria: {
        role: 'img',
        label: `${node.label}: ${valueText}`,
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
        label: `${sourceNode.label} to ${targetNode.label}: ${formatFlowValue(link.value, flowFmt)}`,
      },
      // Links animate after nodes
      animationIndex: nodeMarks.length + i,
    };
  });

  // 12. Rebuild legend with final color map (temp map may differ in node order)
  const finalLegend = buildSankeyLegend(
    nodeColorMap,
    colorField,
    workingData,
    sourceField,
    targetField,
    theme,
    fullArea,
  );

  // 13. Build tooltip descriptors
  const tooltipDescriptors = buildTooltipDescriptors(nodeMarks, linkMarks, flowFmt);

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
      height: grownHeight,
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

const defaultFmt = defaultNumberFormatter();

function formatFlowValue(value: number, formatter?: NumberFormatter | null): string {
  if (formatter) return formatter(value);
  return defaultFmt(value);
}

function buildTooltipDescriptors(
  nodes: SankeyNodeMark[],
  links: SankeyLinkMark[],
  formatter?: NumberFormatter | null,
): Map<string, TooltipContent> {
  const descriptors = new Map<string, TooltipContent>();

  for (const node of nodes) {
    const fields: TooltipField[] = [
      {
        label: 'Total flow',
        value: formatFlowValue(node.value, formatter),
      },
    ];
    descriptors.set(`node-${node.nodeId}`, {
      title: node.label.text,
      fields,
    });
  }

  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    const fields: TooltipField[] = [
      {
        label: 'Flow',
        value: formatFlowValue(link.value, formatter),
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
