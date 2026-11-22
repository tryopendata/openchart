/**
 * Sankey node labels: where each node's name sits and whether its value is
 * drawn.
 *
 * Two placements. Outside (the default at wider sizes): under 'auto' the first
 * column labels left of its nodes and every other column right of them, each
 * label wrapping to the room before the frame edge. On the flow (narrow widths,
 * see label-placement.ts): every label sits beside its node over the bands,
 * with a halo, wrapped at the gap to the neighbouring column.
 *
 * The engine owns whether a node's value is drawn; the renderer draws whatever
 * value the layout carries. Three rules decide it:
 * - On the flow: the value gets its own line under the name, unless the column
 *   is too crowded for value lines (label-placement drops them first).
 * - Outside, interior column: kept only when name and value fit on one line
 *   before the next column.
 * - Outside, first or last column: kept unless it would push the last wrapped
 *   line past the label's room, which happens once a gutter reaches its 35%
 *   cap. The tooltip still carries the value.
 */

import type {
  MeasureTextFn,
  ResolvedTheme,
  SankeyNodeMark,
  TextStyle,
} from '@opendata-ai/openchart-core';
import { estimateTextWidth, wrapText } from '@opendata-ai/openchart-core';
import {
  columnEdges,
  type InsideLabel,
  LABEL_GAP,
  type LabelFrame,
  type LabelNode,
  type LabelTextMetrics,
  type NodeLabelAlign,
  placeInsideLabels,
} from './label-placement';
import type { ComputedNode } from './layout';

/** Line pitch of node labels, as a multiple of the font size. */
export const LABEL_LINE_HEIGHT = 1.3;

/** Gap between a node's name and its value on the same line. */
export const VALUE_GAP = 5;

/**
 * Whether a column's outside labels sit left of their nodes. Under 'auto' the
 * first column labels left and every other column right, so outside labels
 * never cross the flow; 'left' and 'right' put every label on that side.
 */
export function labelsLeftForDepth(
  depth: number,
  maxDepth: number,
  align: NodeLabelAlign,
): boolean {
  if (align === 'left') return true;
  if (align === 'right') return false;
  return depth === 0 && maxDepth > 0;
}

/** What resolving node labels needs from the compile. */
export interface NodeLabelContext {
  theme: ResolvedTheme;
  align: NodeLabelAlign;
  /** Place labels on the flow (narrow widths) instead of outside. */
  inside: boolean;
  /** The plot area labels must stay within. */
  frame: LabelFrame;
  /** Host text measure; the core estimate is used when absent. */
  measureText?: MeasureTextFn;
  /** The node value as drawn, in the column's shared precision. */
  formatValue: (value: number) => string;
}

/** One node's resolved label and, when drawn, its value. */
export interface ResolvedNodeLabel {
  label: SankeyNodeMark['label'];
  valueLabel?: SankeyNodeMark['valueLabel'];
}

/** Resolve every node's label and value, keyed by node id. */
export function resolveNodeLabels(
  nodes: readonly ComputedNode[],
  ctx: NodeLabelContext,
): Map<string, ResolvedNodeLabel> {
  const { theme } = ctx;
  const metrics: LabelTextMetrics = {
    fontSize: theme.fonts.sizes.small,
    fontWeight: theme.fonts.weights.medium,
    valueFontWeight: theme.fonts.weights.normal,
    lineHeight: theme.fonts.sizes.small * LABEL_LINE_HEIGHT,
    measureText: ctx.measureText,
  };
  const labelNodes: LabelNode[] = nodes.map((node) => ({
    id: node.id,
    depth: node.depth ?? 0,
    x0: node.x0 ?? 0,
    x1: node.x1 ?? 0,
    y0: node.y0 ?? 0,
    y1: node.y1 ?? 0,
    name: node.label ?? node.id,
    value: ctx.formatValue(node.value ?? 0),
  }));
  const valueStyle = valueStyleFor(theme);
  const resolved = new Map<string, ResolvedNodeLabel>();

  if (ctx.inside) {
    const placed = placeInsideLabels(labelNodes, ctx.frame, metrics);
    for (const node of labelNodes) {
      const spot = placed.get(node.id)!;
      resolved.set(node.id, {
        label: insideLabelMark(node.name, spot, theme),
        valueLabel: spot.showValue ? { text: node.value ?? '', style: valueStyle } : undefined,
      });
    }
    return resolved;
  }

  const maxDepth = labelNodes.reduce((max, n) => Math.max(max, n.depth), 0);
  const nextColumnLeft = new Map(
    [...columnEdges(labelNodes)].map(([depth, edges]) => [depth - 1, edges.left]),
  );
  for (const node of labelNodes) {
    const label = outsideLabelMark(node, maxDepth, ctx);
    const keepValue = outsideValueFits(node, label, maxDepth, nextColumnLeft, ctx.align, metrics);
    resolved.set(node.id, {
      label,
      valueLabel: keepValue ? { text: node.value ?? '', style: valueStyle } : undefined,
    });
  }
  return resolved;
}

/** The quieter tabular style values are drawn in. */
function valueStyleFor(theme: ResolvedTheme): TextStyle {
  return {
    fontFamily: theme.fonts.family,
    fontSize: theme.fonts.sizes.small,
    fontWeight: theme.fonts.weights.normal,
    fill: theme.colors.axis,
    fontVariant: 'tabular-nums',
    lineHeight: LABEL_LINE_HEIGHT,
  };
}

/** The label style for names, anchored on one side. */
function nameStyle(theme: ResolvedTheme, anchor: 'start' | 'end'): TextStyle {
  return {
    fontFamily: theme.fonts.family,
    fontSize: theme.fonts.sizes.small,
    fontWeight: theme.fonts.weights.medium,
    fill: theme.colors.text,
    lineHeight: LABEL_LINE_HEIGHT,
    textAnchor: anchor,
    dominantBaseline: 'central',
  };
}

/**
 * A label placed on the flow. It carries its wrapped name lines (the renderer
 * stacks the value on its own line below them, the block centred on `y`) and
 * a halo in the background colour so it reads over any band.
 */
function insideLabelMark(
  text: string,
  placed: InsideLabel,
  theme: ResolvedTheme,
): SankeyNodeMark['label'] {
  return {
    text,
    lines: placed.lines,
    x: placed.x,
    y: placed.y,
    style: nameStyle(theme, placed.anchor),
    visible: true,
    maxWidth: placed.maxWidth,
    halo: true,
  };
}

/** An outside label, beside its node and wrapping to the room before the frame edge. */
function outsideLabelMark(
  node: LabelNode,
  maxDepth: number,
  ctx: NodeLabelContext,
): SankeyNodeMark['label'] {
  const y = (node.y0 + node.y1) / 2;
  if (labelsLeftForDepth(node.depth, maxDepth, ctx.align)) {
    const x = node.x0 - LABEL_GAP;
    return {
      text: node.name,
      x,
      y,
      style: nameStyle(ctx.theme, 'end'),
      visible: true,
      maxWidth: Math.max(x - ctx.frame.left, 0),
    };
  }
  const x = node.x1 + LABEL_GAP;
  return {
    text: node.name,
    x,
    y,
    style: nameStyle(ctx.theme, 'start'),
    visible: true,
    maxWidth: Math.max(ctx.frame.right - x, 0),
  };
}

/** Whether an outside label keeps its value (the interior and edge rules above). */
function outsideValueFits(
  node: LabelNode,
  label: SankeyNodeMark['label'],
  maxDepth: number,
  nextColumnLeft: Map<number, number>,
  align: NodeLabelAlign,
  metrics: LabelTextMetrics,
): boolean {
  const width = (text: string, weight: number) =>
    metrics.measureText
      ? metrics.measureText(text, metrics.fontSize, weight).width
      : estimateTextWidth(text, metrics.fontSize, weight);
  const valueWidth = VALUE_GAP + width(node.value ?? '', metrics.valueFontWeight);
  const placedLeft = labelsLeftForDepth(node.depth, maxDepth, align);
  const nextColumn = nextColumnLeft.get(node.depth);
  if (!placedLeft && node.depth !== maxDepth && nextColumn !== undefined) {
    const available = nextColumn - LABEL_GAP - (node.x1 + LABEL_GAP);
    return width(label.text, metrics.fontWeight) + valueWidth <= available;
  }
  if (label.maxWidth === undefined || label.maxWidth <= 0) return true;
  const lines = wrapText(
    label.text,
    metrics.fontSize,
    metrics.fontWeight,
    label.maxWidth,
    metrics.measureText,
  );
  const lastLine = lines[lines.length - 1] ?? '';
  return width(lastLine, metrics.fontWeight) + valueWidth <= label.maxWidth;
}
