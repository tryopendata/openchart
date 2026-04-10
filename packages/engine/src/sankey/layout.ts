/**
 * d3-sankey layout wrapper.
 *
 * Extracts unique nodes from tabular data rows, configures the d3-sankey
 * generator, and returns computed node/link positions. Clones input data
 * before passing to d3-sankey since it mutates objects in place.
 */

import type { Rect, SankeyNodeAlign } from '@opendata-ai/openchart-core';
import type { SankeyExtraProperties, SankeyGraph, SankeyLink, SankeyNode } from 'd3-sankey';
import { sankey, sankeyCenter, sankeyJustify, sankeyLeft, sankeyRight } from 'd3-sankey';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Extra properties carried on our sankey nodes. */
interface NodeExtra extends SankeyExtraProperties {
  id: string;
  label: string;
}

/** Extra properties carried on our sankey links. */
interface LinkExtra extends SankeyExtraProperties {
  /** Original data row for this link. */
  data: Record<string, unknown>;
}

export type ComputedNode = SankeyNode<NodeExtra, LinkExtra>;
export type ComputedLink = SankeyLink<NodeExtra, LinkExtra>;

export interface SankeyLayoutResult {
  nodes: ComputedNode[];
  links: ComputedLink[];
}

// ---------------------------------------------------------------------------
// Alignment resolver
// ---------------------------------------------------------------------------

const ALIGN_MAP: Record<SankeyNodeAlign, typeof sankeyJustify> = {
  justify: sankeyJustify,
  left: sankeyLeft,
  right: sankeyRight,
  center: sankeyCenter,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run the d3-sankey layout algorithm on tabular flow data.
 *
 * @param data - Array of data rows (each row is a source-target-value flow).
 * @param sourceField - Field name for the source node.
 * @param targetField - Field name for the target node.
 * @param valueField - Field name for the flow value.
 * @param area - Drawing area rect (after chrome subtracted).
 * @param nodeWidth - Width of node rectangles in px.
 * @param nodePadding - Vertical padding between nodes in px.
 * @param nodeAlign - Node alignment strategy.
 * @param iterations - Number of layout relaxation iterations.
 * @returns Computed node and link positions.
 */
export function computeSankeyLayout(
  data: Record<string, unknown>[],
  sourceField: string,
  targetField: string,
  valueField: string,
  area: Rect,
  nodeWidth: number,
  nodePadding: number,
  nodeAlign: SankeyNodeAlign,
  iterations: number,
  nodeSort?: string[],
): SankeyLayoutResult {
  // Extract unique node IDs from source and target columns
  const nodeSet = new Set<string>();
  for (const row of data) {
    nodeSet.add(String(row[sourceField]));
    nodeSet.add(String(row[targetField]));
  }

  // Build node and link arrays (cloned so d3-sankey mutations don't affect input)
  const nodes: Array<{ id: string; label: string }> = [...nodeSet].map((id) => ({
    id,
    label: id,
  }));

  const links: Array<{
    source: string;
    target: string;
    value: number;
    data: Record<string, unknown>;
  }> = data.map((row) => ({
    source: String(row[sourceField]),
    target: String(row[targetField]),
    value: Number(row[valueField]) || 0,
    data: { ...row },
  }));

  // Configure and run d3-sankey
  const alignFn = ALIGN_MAP[nodeAlign] ?? sankeyJustify;

  const generator = sankey<SankeyGraph<NodeExtra, LinkExtra>, NodeExtra, LinkExtra>()
    .nodeId((d) => d.id)
    .nodeAlign(alignFn as unknown as (node: SankeyNode<NodeExtra, LinkExtra>, n: number) => number)
    .nodeWidth(nodeWidth)
    .nodePadding(nodePadding)
    .extent([
      [area.x, area.y],
      [area.x + area.width, area.y + area.height],
    ])
    .iterations(iterations);

  // Apply explicit node ordering when provided.
  // Builds a comparator from the ordered ID array so d3-sankey places nodes
  // top-to-bottom within each column according to the spec's nodeSort.
  if (nodeSort && nodeSort.length > 0) {
    const orderMap = new Map(nodeSort.map((id, i) => [id, i]));
    const fallback = nodeSort.length;
    generator.nodeSort(
      (a: SankeyNode<NodeExtra, LinkExtra>, b: SankeyNode<NodeExtra, LinkExtra>) =>
        (orderMap.get((a as unknown as NodeExtra).id) ?? fallback) -
        (orderMap.get((b as unknown as NodeExtra).id) ?? fallback),
    );
  }

  const graph = generator({
    nodes: nodes as unknown as Array<SankeyNode<NodeExtra, LinkExtra>>,
    links: links as unknown as Array<SankeyLink<NodeExtra, LinkExtra>>,
  });

  return {
    nodes: graph.nodes,
    links: graph.links,
  };
}

/**
 * Generate a filled ribbon SVG path for a sankey link.
 *
 * d3-sankey's sankeyLinkHorizontal() only produces a stroke centerline.
 * This generates a closed area path with two cubic bezier edges (top and
 * bottom) forming a ribbon whose width is proportional to flow value.
 *
 * The link object from d3-sankey provides:
 *   - y0: center y at source side
 *   - y1: center y at target side
 *   - width: thickness of the ribbon
 *   - source.x1: right edge of source node
 *   - target.x0: left edge of target node
 */
export function generateLinkPath(link: ComputedLink): string {
  const source = link.source as ComputedNode;
  const target = link.target as ComputedNode;

  const x0 = source.x1 ?? 0;
  const x1 = target.x0 ?? 0;
  const y0 = link.y0 ?? 0;
  const y1 = link.y1 ?? 0;
  const halfWidth0 = (link.width ?? 0) / 2;
  const halfWidth1 = halfWidth0;

  // Control point x at the horizontal midpoint for smooth S-curves
  const mx = (x0 + x1) / 2;

  // Top edge: left-to-right
  const topY0 = y0 - halfWidth0;
  const topY1 = y1 - halfWidth1;

  // Bottom edge: right-to-left
  const botY0 = y0 + halfWidth0;
  const botY1 = y1 + halfWidth1;

  return [
    `M${x0},${topY0}`,
    `C${mx},${topY0} ${mx},${topY1} ${x1},${topY1}`,
    `L${x1},${botY1}`,
    `C${mx},${botY1} ${mx},${botY0} ${x0},${botY0}`,
    'Z',
  ].join(' ');
}
