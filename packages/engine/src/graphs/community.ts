/**
 * Community assignment and color mapping for graph clustering.
 *
 * When a graph spec has layout.clustering.field, nodes are grouped into
 * communities based on their data values for that field. Each community
 * gets a color from the theme's categorical palette. Community colors
 * override nodeColor encoding when clustering is active.
 */

import type { ResolvedTheme } from '@opendata-ai/openchart-core';
import { darkenColor } from './encoding';
import type { CompiledGraphNode } from './types';

// ---------------------------------------------------------------------------
// Community assignment
// ---------------------------------------------------------------------------

/**
 * Assign community labels to compiled nodes based on a clustering field.
 *
 * Reads node.data[clusteringField] as the community label. If the field
 * is missing on a node, community remains undefined.
 *
 * Mutates nodes in-place for efficiency (no copy needed since we just
 * built them in the compilation pipeline).
 */
export function assignCommunities(
  nodes: CompiledGraphNode[],
  clusteringField: string | undefined,
): void {
  if (!clusteringField) return;

  for (const node of nodes) {
    const value = node.data[clusteringField];
    node.community = value != null ? String(value) : undefined;
  }
}

// ---------------------------------------------------------------------------
// Community color mapping
// ---------------------------------------------------------------------------

/**
 * Build a map from community label to color.
 *
 * Collects unique community values (in order of first appearance),
 * then assigns theme categorical colors round-robin.
 */
export function buildCommunityColorMap(
  nodes: CompiledGraphNode[],
  theme: ResolvedTheme,
): Map<string, string> {
  const colorMap = new Map<string, string>();
  const palette = theme.colors.categorical;
  let colorIndex = 0;

  for (const node of nodes) {
    if (node.community != null && !colorMap.has(node.community)) {
      colorMap.set(node.community, palette[colorIndex % palette.length]);
      colorIndex++;
    }
  }

  return colorMap;
}

// ---------------------------------------------------------------------------
// Apply community colors
// ---------------------------------------------------------------------------

/**
 * Override node fill and stroke colors with community colors.
 *
 * Only affects nodes that have a community assignment. Nodes without
 * a community keep their existing fill/stroke from encoding resolution.
 *
 * Mutates nodes in-place.
 */
export function applyCommunityColors(
  nodes: CompiledGraphNode[],
  colorMap: Map<string, string>,
): void {
  for (const node of nodes) {
    if (node.community != null) {
      const communityColor = colorMap.get(node.community);
      if (communityColor) {
        node.fill = communityColor;
        node.stroke = darkenColor(communityColor);
      }
    }
  }
}
