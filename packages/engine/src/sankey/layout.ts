/**
 * d3-sankey layout wrapper.
 *
 * Extracts unique nodes from tabular data rows, configures the d3-sankey
 * generator, and returns computed node/link positions. Clones input data
 * before passing to d3-sankey since it mutates objects in place.
 */

import type { Rect, SankeyNodeAlign } from '@opendata-ai/openchart-core';
import type { SankeyExtraProperties, SankeyGraph, SankeyLink, SankeyNode } from 'd3-sankey';
import {
  sankey,
  sankeyCenter,
  sankeyJustify,
  sankeyLeft,
  sankeyLinkHorizontal,
  sankeyRight,
} from 'd3-sankey';

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
 * Generate an SVG path string for a sankey link using d3-sankey's
 * horizontal link shape generator.
 */
export function generateLinkPath(link: ComputedLink): string {
  const pathGen = sankeyLinkHorizontal<NodeExtra, LinkExtra>();
  return pathGen(link) ?? '';
}
