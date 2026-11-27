import { mergeThemeConfig } from '@opendata-ai/openchart-core';
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
  buildD3Formatter,
  computeChrome,
  defaultNumberFormatter,
  estimateTextWidth,
  resolveTheme,
} from '@opendata-ai/openchart-core';
import { emitSpecWarnings, expandTypedSpecSugar } from '../compile/spec-sugar';
import { resolveAnimation } from '../compiler/animation';
import { assertKindType, compileKind } from '../compiler/kind';
import { normalizeSankeySpec } from '../compiler/normalize';
import { validateSankeySpec } from '../compiler/validation/sankey';
import { finiteNumber } from '../data/finite-number';
import { resolveFieldFormatter } from '../format/field-format';
import { resolveChromeLayout } from '../layout/shared';
import { ENTRY_GAP, measureLegendWrap, SWATCH_GAP, SWATCH_SIZE } from '../legend/wrap';
import { LABEL_GAP, shouldPlaceLabelsInside } from './label-placement';
import { type ComputedNode, computeSankeyLayout, generateLinkPath } from './layout';
import { labelsLeftForDepth, resolveNodeLabels, VALUE_GAP } from './node-labels';
import { applySankeyOverride } from './overrides';
import type { NormalizedSankeySpec } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LINK_OPACITY_LIGHT = 0.5;
/**
 * Dark-mode link opacity. Light ribbons on a dark ground gain apparent weight,
 * so 0.75 turned every crossing into a solid slab; 0.6 keeps overlaps readable.
 */
const LINK_OPACITY_DARK = 0.6;
const NODE_CORNER_RADIUS = 2;
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
    const value = finiteNumber(row[valueField]);
    if (value === undefined || value <= 0) continue;
    const existing = index.get(key);
    if (existing) {
      existing[valueField] = (finiteNumber(existing[valueField]) ?? 0) + value;
      continue;
    }
    const next = { ...row, [sourceField]: newSrc, [targetField]: newTgt, [valueField]: value };
    index.set(key, next);
    out.push(next);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const SANKEY_KIND = {
  type: 'sankey',
  validate: validateSankeySpec,
  normalize: normalizeSankeySpec,
};

const WRONG_TYPE =
  'compileSankey received a non-sankey spec. Use compileChart, compileTable, or compileGraph instead.';

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
  assertKindType(spec, SANKEY_KIND.type, WRONG_TYPE);
  const sugarWarnings: string[] = [];
  // The active breakpoint's override block merges in first, so everything
  // after (validation included) sees the spec as it applies at this width.
  const expandedSpec = expandTypedSpecSugar(
    applySankeyOverride(spec, options.width),
    sugarWarnings,
  );
  const { spec: sankeySpec, warnings } = compileKind(expandedSpec, SANKEY_KIND, WRONG_TYPE);
  emitSpecWarnings([...sugarWarnings, ...warnings], options.onWarn);

  // Resolve format: encoding-level (v8 canonical) wins over deprecated top-level valueFormat
  const resolvedValueFormat = sankeySpec.encoding.value.format;

  // Resolve watermark: explicit spec value wins, then options fallback, then default true.
  const rawWatermark = spec.watermark;
  const watermark = rawWatermark !== undefined ? sankeySpec.watermark : (options.watermark ?? true);

  // 2. Resolve theme
  const mergedThemeConfig = mergeThemeConfig(sankeySpec.theme, options.theme);
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
    sankeySpec.chrome,
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
  let missingFlowCount = 0;
  let negativeFlowCount = 0;
  let zeroFlowCount = 0;
  const measuredData = sankeySpec.data.filter((row) => {
    const value = finiteNumber(row[valueField]);
    if (value === undefined) missingFlowCount++;
    else if (value < 0) negativeFlowCount++;
    else if (value === 0) zeroFlowCount++;
    else return true;
    return false;
  });
  const omittedCount = missingFlowCount + negativeFlowCount + zeroFlowCount;
  if (omittedCount > 0) {
    const reasons = [
      missingFlowCount > 0 ? `${missingFlowCount} missing, nonnumeric, or nonfinite` : '',
      negativeFlowCount > 0 ? `${negativeFlowCount} negative` : '',
      zeroFlowCount > 0 ? `${zeroFlowCount} zero-width` : '',
    ].filter(Boolean);
    emitSpecWarnings(
      [
        `Sankey omitted ${omittedCount} flow rows from "${valueField}" (${reasons.join(', ')}). ` +
          'Sankey geometry requires positive finite values. Supply measured positive amounts; zero flows have no drawable width.',
      ],
      options.onWarn,
    );
  }
  if (measuredData.length === 0) {
    return emptyLayout(fullArea, chrome, theme, { ...options, height: grownHeight }, watermark);
  }
  const flowFmt = resolveFieldFormatter({
    surfaceFormat: resolvedValueFormat,
    values: measuredData.map((r) => r[valueField]),
  });

  // 5b. Pre-compute legend to reserve vertical space
  //     We need the color map first, so build a temporary one from raw data
  const tempNodeIds = new Set<string>();
  for (const row of measuredData) {
    tempNodeIds.add(String(row[sourceField]));
    tempNodeIds.add(String(row[targetField]));
  }
  const tempColorMap = buildNodeColorMap(
    [...tempNodeIds].map((id) => ({ id })),
    theme.colors.categorical,
    colorField,
    measuredData,
    sourceField,
    targetField,
  );
  const legend = buildSankeyLegend(
    tempColorMap,
    colorField,
    measuredData,
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
  // Label room is reserved from the host's real text measure when it gives one:
  // the estimate runs narrower than most web fonts draw, and a gutter sized from
  // it lets the outermost labels run past the frame.
  const textWidth = (text: string, fontWeight: number): number =>
    options.measureText
      ? options.measureText(text, labelFontSize, fontWeight).width
      : estimateTextWidth(text, labelFontSize, fontWeight);
  const nodeLabelAlign = sankeySpec.nodeLabelAlign ?? 'auto';

  let workingData = measuredData;
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

  // Node values are a *column* the reader scans down, so they all take one
  // precision. Formatting each independently drops trailing zeros per node and
  // prints "Transport 28" beside "Industry 32.70" -- the same quantity written
  // two ways, which reads as two different levels of precision in the data.
  const nodeFmt = resolveNodeValueFormatter(nodes, resolvedValueFormat, flowFmt);

  // 6b. Reserve label gutters. Outside-left labels on the first column and
  //     outside-right labels on the last need room the layout does not know
  //     about, so measure the widest block on each side and re-run the layout
  //     inside the remaining extent. Each gutter is capped so a long name can
  //     never squeeze the flow itself out of the frame.
  const labelBlockWidth = (node: ComputedNode): number => {
    const name = node.label ?? node.id;
    const nameWidth = textWidth(name, labelFontWeight);
    const valueWidth = textWidth(formatFlowValue(node.value ?? 0, nodeFmt), valueFontWeight);
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

  // At narrow widths the gutters would squeeze the flow, so labels move onto
  // it instead and the nodes keep the full width.
  const gutters = measureGutters(nodes);
  const labelsInside = shouldPlaceLabelsInside(nodeLabelAlign, area.width, gutters);
  if (!labelsInside && (gutters.left > 0 || gutters.right > 0)) {
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

  // 8. Resolve each node's label and whether its value is drawn.
  const nodeLabels = resolveNodeLabels(nodes, {
    theme,
    align: nodeLabelAlign,
    inside: labelsInside,
    frame: { left: area.x, right: area.x + area.width, top: area.y, bottom: area.y + area.height },
    measureText: options.measureText,
    formatValue: (value) => formatFlowValue(value, nodeFmt),
  });

  // 9. Build SankeyNodeMark[]
  const nodeMarks: SankeyNodeMark[] = nodes.map((node) => {
    const fill = nodeColorMap.get(node.id) ?? theme.colors.categorical[0];
    const depth = node.depth ?? 0;
    const merged = otherMembers.get(node.id);
    const valueText = formatFlowValue(node.value ?? 0, nodeFmt);
    const { label, valueLabel } = nodeLabels.get(node.id)!;

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
      label,
      valueLabel,
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
  const tooltipDescriptors = buildTooltipDescriptors(nodeMarks, linkMarks, flowFmt, nodeFmt);

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
// Node value precision
// ---------------------------------------------------------------------------

/** Most decimal places a derived node format is allowed to show. */
const MAX_UNIFORM_DECIMALS = 2;

/**
 * Decimal places a value actually carries, ignoring float dust.
 *
 * Node values are sums of link values, so 24.6 + 9.8 lands on
 * 34.400000000000006. Rounding to the cap first collapses the dust; anything
 * finer than the cap is not shown anyway.
 */
function decimalPlaces(value: number): number {
  const rounded = Number(value.toFixed(MAX_UNIFORM_DECIMALS));
  if (Number.isInteger(rounded)) return 0;
  const text = String(rounded);
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
}

/**
 * One fixed-decimal formatter for the whole node column, derived from the data.
 *
 * Falls back to the per-value formatter in the three cases where a fixed
 * decimal count would be worse than the mixed one:
 * - an explicit `encoding.value.format`, which is the author's call;
 * - values at or above the abbreviation threshold, where the default switches
 *   to "1.2k" and a fixed format would print "1,234,000.00";
 * - values too small to survive the cap, which would all render as "0".
 */
function resolveNodeValueFormatter(
  nodes: readonly ComputedNode[],
  explicitFormat: string | undefined,
  fallback: NumberFormatter,
): NumberFormatter {
  if (explicitFormat) return fallback;

  const values = nodes.map((n) => n.value ?? 0).filter((v) => Number.isFinite(v));
  if (values.length === 0) return fallback;
  if (values.some((v) => Math.abs(v) >= 1000)) return fallback;
  if (values.some((v) => v !== 0 && Math.abs(v) < 0.005)) return fallback;

  let decimals = 0;
  for (const v of values) {
    decimals = Math.max(decimals, decimalPlaces(v));
    if (decimals >= MAX_UNIFORM_DECIMALS) break;
  }
  return buildD3Formatter(`,.${decimals}f`) ?? fallback;
}

// ---------------------------------------------------------------------------
// Tooltip builder
// ---------------------------------------------------------------------------

const defaultFmt = /* @__PURE__ */ defaultNumberFormatter();

function formatFlowValue(value: number, formatter?: NumberFormatter | null): string {
  if (formatter) return formatter(value);
  return defaultFmt(value);
}

function buildTooltipDescriptors(
  nodes: SankeyNodeMark[],
  links: SankeyLinkMark[],
  formatter?: NumberFormatter | null,
  // Node totals share the column's precision, so a node's tooltip agrees with
  // the number drawn next to it. Links keep the per-value formatter.
  nodeFormatter?: NumberFormatter | null,
): Map<string, TooltipContent> {
  const descriptors = new Map<string, TooltipContent>();

  for (const node of nodes) {
    const fields: TooltipField[] = [
      {
        label: 'Total flow',
        value: formatFlowValue(node.value, nodeFormatter ?? formatter),
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
