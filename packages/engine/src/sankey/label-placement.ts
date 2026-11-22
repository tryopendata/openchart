/**
 * Sankey node-label placement at narrow widths.
 *
 * A sankey normally labels its first column outside-left and its last column
 * outside-right, reserving a gutter on each side. On a phone those gutters eat
 * the diagram: two capped gutters leave the bands a quarter of the width. When
 * that happens the labels move onto the flow instead. First and interior
 * columns label just right of their node, the last column just left of its
 * node, every label wraps within the gap to the neighbouring column, and the
 * node's value sits on its own line below the name. Labels that share space are
 * then nudged apart so small neighbouring nodes never stack text on text.
 *
 * Everything here is pure geometry over measured text; the caller supplies the
 * measure so the engine and renderer wrap identically.
 */

import type { MeasureTextFn } from '@opendata-ai/openchart-core';
import { estimateTextWidth, wrapText } from '@opendata-ai/openchart-core';

/**
 * Smallest share of the plot width the flow may keep before labels move
 * inside. Below half, the bands are narrower than the text describing them,
 * which is the point at which a reader loses the flow.
 */
export const MIN_OUTSIDE_FLOW_SHARE = 0.5;

/** Horizontal gap between a node (or a neighbouring column) and its label. */
export const LABEL_GAP = 6;

/** Vertical gap kept between two label blocks that share horizontal space. */
const LABEL_STACK_GAP = 2;

/** Label gutter widths, in px, as measured for outside placement. */
export interface LabelGutters {
  left: number;
  right: number;
}

/** Which way the diagram's node labels sit. */
export type NodeLabelAlign = 'auto' | 'left' | 'right';

/**
 * Whether labels should move onto the flow: only under the default 'auto'
 * alignment, and only when the outside gutters would leave the flow less than
 * {@link MIN_OUTSIDE_FLOW_SHARE} of the plot width.
 */
export function shouldPlaceLabelsInside(
  align: NodeLabelAlign,
  plotWidth: number,
  gutters: LabelGutters,
): boolean {
  if (align !== 'auto' || plotWidth <= 0) return false;
  const flowWidth = plotWidth - gutters.left - gutters.right;
  return flowWidth < plotWidth * MIN_OUTSIDE_FLOW_SHARE;
}

/** A node's position and label text, as the placer needs them. */
export interface LabelNode {
  id: string;
  depth: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** Display name (the label's text). */
  name: string;
  /** Formatted value drawn on its own line under the name, when there is one. */
  value?: string;
}

/** Horizontal extent of one column of nodes. */
export interface ColumnEdges {
  left: number;
  right: number;
}

/** Leftmost x0 and rightmost x1 of each column, keyed by depth. */
export function columnEdges(nodes: readonly LabelNode[]): Map<number, ColumnEdges> {
  const edges = new Map<number, ColumnEdges>();
  for (const node of nodes) {
    const current = edges.get(node.depth);
    if (!current) edges.set(node.depth, { left: node.x0, right: node.x1 });
    else {
      current.left = Math.min(current.left, node.x0);
      current.right = Math.max(current.right, node.x1);
    }
  }
  return edges;
}

/** Text measurement for node labels. */
export interface LabelTextMetrics {
  fontSize: number;
  /** Weight of the name lines. */
  fontWeight: number;
  /** Weight of the value line. */
  valueFontWeight: number;
  /** Line pitch in px (font size times line height). */
  lineHeight: number;
  /** Host text measure; the core estimate is used when absent. */
  measureText?: MeasureTextFn;
}

/** Width of a string at the label size, with the host measure when there is one. */
function textWidth(text: string, fontWeight: number, metrics: LabelTextMetrics): number {
  return metrics.measureText
    ? metrics.measureText(text, metrics.fontSize, fontWeight).width
    : estimateTextWidth(text, metrics.fontSize, fontWeight);
}

/** Width of the widest single word of a name. */
function longestWordWidth(name: string, metrics: LabelTextMetrics): number {
  let widest = 0;
  for (const word of name.split(/\s+/)) {
    widest = Math.max(widest, textWidth(word, metrics.fontWeight, metrics));
  }
  return widest;
}

/**
 * The width a label may wrap to: the room before the neighbouring column when
 * its longest word fits there, otherwise the room to the frame's edge, so one
 * long word is never broken or shrunk.
 */
export function boundedLabelWidth(
  name: string,
  columnRoom: number,
  frameRoom: number,
  metrics: LabelTextMetrics,
): number {
  const room = longestWordWidth(name, metrics) <= columnRoom ? columnRoom : frameRoom;
  return Math.max(room, 0);
}

/** One label moved onto the flow. */
export interface InsideLabel {
  /** Anchor x: just right of the node (start) or just left of it (end). */
  x: number;
  /** Vertical centre of the whole block (name lines plus value line). */
  y: number;
  anchor: 'start' | 'end';
  maxWidth: number;
  /** The name, wrapped to `maxWidth`. The value line follows these. */
  lines: string[];
}

/** The plot's bounds the labels must stay within. */
export interface LabelFrame {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Place every node's label on the flow and spread the labels so no two blocks
 * overlap. Each block is the wrapped name plus the value line.
 */
export function placeInsideLabels(
  nodes: readonly LabelNode[],
  frame: LabelFrame,
  metrics: LabelTextMetrics,
): Map<string, InsideLabel> {
  const maxDepth = nodes.reduce((max, n) => Math.max(max, n.depth), 0);
  const edges = columnEdges(nodes);
  const placed = new Map<string, InsideLabel>();
  const blocks: LabelBlock[] = [];

  for (const node of nodes) {
    const label = insideLabelFor(node, maxDepth, edges, frame, metrics);
    placed.set(node.id, label);
    blocks.push(blockOf(node, label, metrics));
  }

  for (const [id, centre] of spreadLabelBlocks(blocks, frame.top, frame.bottom)) {
    const label = placed.get(id);
    if (label) label.y = centre;
  }
  return placed;
}

/** Anchor, width and wrapped name of one inside label, before spreading. */
function insideLabelFor(
  node: LabelNode,
  maxDepth: number,
  edges: Map<number, ColumnEdges>,
  frame: LabelFrame,
  metrics: LabelTextMetrics,
): InsideLabel {
  const centre = (node.y0 + node.y1) / 2;
  const isLast = node.depth === maxDepth && maxDepth > 0;

  if (isLast) {
    const x = node.x0 - LABEL_GAP;
    const previous = edges.get(node.depth - 1);
    const columnRoom = previous ? x - (previous.right + LABEL_GAP) : x - frame.left;
    const maxWidth = boundedLabelWidth(node.name, columnRoom, x - frame.left, metrics);
    return { x, y: centre, anchor: 'end', maxWidth, lines: wrapName(node.name, maxWidth, metrics) };
  }

  const x = node.x1 + LABEL_GAP;
  const next = edges.get(node.depth + 1);
  const columnRoom = next ? next.left - LABEL_GAP - x : frame.right - x;
  const maxWidth = boundedLabelWidth(node.name, columnRoom, frame.right - x, metrics);
  return { x, y: centre, anchor: 'start', maxWidth, lines: wrapName(node.name, maxWidth, metrics) };
}

function wrapName(name: string, maxWidth: number, metrics: LabelTextMetrics): string[] {
  return wrapText(name, metrics.fontSize, metrics.fontWeight, maxWidth, metrics.measureText);
}

/** The space one placed label takes: its lines and value, out from its anchor. */
function blockOf(node: LabelNode, label: InsideLabel, metrics: LabelTextMetrics): LabelBlock {
  const widths = label.lines.map((line) => textWidth(line, metrics.fontWeight, metrics));
  if (node.value) widths.push(textWidth(node.value, metrics.valueFontWeight, metrics));
  const width = Math.max(0, ...widths);
  const lineCount = label.lines.length + (node.value ? 1 : 0);
  return {
    id: node.id,
    centre: label.y,
    height: lineCount * metrics.lineHeight,
    left: label.anchor === 'start' ? label.x : label.x - width,
    right: label.anchor === 'start' ? label.x + width : label.x,
  };
}

/** A placed label block: its wanted vertical centre, height and horizontal extent. */
export interface LabelBlock {
  id: string;
  centre: number;
  height: number;
  left: number;
  right: number;
}

/** Whether two blocks share any horizontal span, and so cannot share a row. */
function shareSpan(a: LabelBlock, b: LabelBlock): boolean {
  return a.left < b.right && b.left < a.right;
}

/**
 * Nudge label blocks apart so no two that share horizontal space overlap.
 * Blocks in one column always share it; a label right of one column and a
 * label left of the next meet in the same gap and share it only when their
 * text reaches across. A top-to-bottom sweep pushes each block below the
 * sharing blocks above it, then a bottom-to-top sweep pulls any run that
 * spilled past the bottom back inside. Returns each block's new centre by id.
 */
export function spreadLabelBlocks(
  blocks: readonly LabelBlock[],
  top: number,
  bottom: number,
): Map<string, number> {
  const sorted = [...blocks].sort((a, b) => a.centre - b.centre);
  const tops = sorted.map((b) => b.centre - b.height / 2);

  for (let i = 0; i < sorted.length; i++) {
    let floor = top;
    for (let j = 0; j < i; j++) {
      if (shareSpan(sorted[i], sorted[j])) {
        floor = Math.max(floor, tops[j] + sorted[j].height + LABEL_STACK_GAP);
      }
    }
    tops[i] = Math.max(tops[i], floor);
  }
  for (let i = sorted.length - 1; i >= 0; i--) {
    let ceiling = bottom;
    for (let j = i + 1; j < sorted.length; j++) {
      if (shareSpan(sorted[i], sorted[j])) ceiling = Math.min(ceiling, tops[j] - LABEL_STACK_GAP);
    }
    tops[i] = Math.min(tops[i], ceiling - sorted[i].height);
  }

  return new Map(sorted.map((b, i) => [b.id, tops[i] + b.height / 2]));
}
