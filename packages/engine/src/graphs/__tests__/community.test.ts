import { resolveTheme } from '@opendata-ai/core';
import { describe, expect, it } from 'vitest';
import { applyCommunityColors, assignCommunities, buildCommunityColorMap } from '../community';
import type { CompiledGraphNode } from '../types';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const theme = resolveTheme({});

function makeNodes(): CompiledGraphNode[] {
  return [
    {
      id: 'a',
      radius: 5,
      fill: '#aaa',
      stroke: '#888',
      strokeWidth: 1,
      label: 'A',
      labelPriority: 0.5,
      community: undefined,
      data: { id: 'a', group: 'X', department: 'eng' },
    },
    {
      id: 'b',
      radius: 5,
      fill: '#bbb',
      stroke: '#999',
      strokeWidth: 1,
      label: 'B',
      labelPriority: 0.3,
      community: undefined,
      data: { id: 'b', group: 'X', department: 'eng' },
    },
    {
      id: 'c',
      radius: 5,
      fill: '#ccc',
      stroke: '#aaa',
      strokeWidth: 1,
      label: 'C',
      labelPriority: 0.8,
      community: undefined,
      data: { id: 'c', group: 'Y', department: 'sales' },
    },
    {
      id: 'd',
      radius: 5,
      fill: '#ddd',
      stroke: '#bbb',
      strokeWidth: 1,
      label: 'D',
      labelPriority: 0.2,
      community: undefined,
      data: { id: 'd' }, // no group field
    },
  ];
}

// ---------------------------------------------------------------------------
// assignCommunities tests
// ---------------------------------------------------------------------------

describe('assignCommunities', () => {
  it('assigns community labels from the specified field', () => {
    const nodes = makeNodes();
    assignCommunities(nodes, 'group');

    expect(nodes[0].community).toBe('X');
    expect(nodes[1].community).toBe('X');
    expect(nodes[2].community).toBe('Y');
  });

  it('leaves community undefined when field is missing on a node', () => {
    const nodes = makeNodes();
    assignCommunities(nodes, 'group');

    // Node 'd' doesn't have the 'group' field
    expect(nodes[3].community).toBeUndefined();
  });

  it('does nothing when clusteringField is undefined', () => {
    const nodes = makeNodes();
    assignCommunities(nodes, undefined);

    for (const node of nodes) {
      expect(node.community).toBeUndefined();
    }
  });

  it('handles non-string field values by converting to string', () => {
    const nodes = makeNodes();
    // Add a numeric field value
    nodes[0].data.numericGroup = 42;
    assignCommunities(nodes, 'numericGroup');

    expect(nodes[0].community).toBe('42');
  });
});

// ---------------------------------------------------------------------------
// buildCommunityColorMap tests
// ---------------------------------------------------------------------------

describe('buildCommunityColorMap', () => {
  it('creates a color for each unique community', () => {
    const nodes = makeNodes();
    assignCommunities(nodes, 'group');

    const colorMap = buildCommunityColorMap(nodes, theme);

    expect(colorMap.size).toBe(2);
    expect(colorMap.has('X')).toBe(true);
    expect(colorMap.has('Y')).toBe(true);
  });

  it('uses categorical palette colors', () => {
    const nodes = makeNodes();
    assignCommunities(nodes, 'group');

    const colorMap = buildCommunityColorMap(nodes, theme);

    const colors = [...colorMap.values()];
    const palette = theme.colors.categorical;

    // First two communities should get first two palette colors
    expect(colors[0]).toBe(palette[0]);
    expect(colors[1]).toBe(palette[1]);
  });

  it('returns empty map when no communities assigned', () => {
    const nodes = makeNodes();
    // Don't assign communities

    const colorMap = buildCommunityColorMap(nodes, theme);

    expect(colorMap.size).toBe(0);
  });

  it('wraps around palette when more communities than colors', () => {
    // Create enough nodes with unique communities to exceed palette size
    const manyNodes: CompiledGraphNode[] = [];
    const paletteSize = theme.colors.categorical.length;

    for (let i = 0; i < paletteSize + 2; i++) {
      manyNodes.push({
        id: `n${i}`,
        radius: 5,
        fill: '#ccc',
        stroke: '#aaa',
        strokeWidth: 1,
        label: `Node ${i}`,
        labelPriority: 0,
        community: `community-${i}`,
        data: { id: `n${i}` },
      });
    }

    const colorMap = buildCommunityColorMap(manyNodes, theme);

    expect(colorMap.size).toBe(paletteSize + 2);
    // The (paletteSize + 1)th community should wrap to palette[0]
    const wrappedColor = [...colorMap.values()][paletteSize];
    expect(wrappedColor).toBe(theme.colors.categorical[0]);
  });
});

// ---------------------------------------------------------------------------
// applyCommunityColors tests
// ---------------------------------------------------------------------------

describe('applyCommunityColors', () => {
  it('overrides node fill with community color', () => {
    const nodes = makeNodes();
    assignCommunities(nodes, 'group');

    const colorMap = buildCommunityColorMap(nodes, theme);
    const xColor = colorMap.get('X')!;

    applyCommunityColors(nodes, colorMap);

    expect(nodes[0].fill).toBe(xColor);
    expect(nodes[1].fill).toBe(xColor);
  });

  it('overrides node stroke with darkened community color', () => {
    const nodes = makeNodes();
    assignCommunities(nodes, 'group');

    const colorMap = buildCommunityColorMap(nodes, theme);
    const originalStroke0 = nodes[0].stroke;

    applyCommunityColors(nodes, colorMap);

    // Stroke should have changed from original
    expect(nodes[0].stroke).not.toBe(originalStroke0);
    // Stroke should be different from fill (darkened)
    expect(nodes[0].stroke).not.toBe(nodes[0].fill);
  });

  it('leaves nodes without communities unchanged', () => {
    const nodes = makeNodes();
    assignCommunities(nodes, 'group');

    const originalFill = nodes[3].fill;
    const originalStroke = nodes[3].stroke;

    const colorMap = buildCommunityColorMap(nodes, theme);
    applyCommunityColors(nodes, colorMap);

    // Node 'd' has no group field, community is undefined
    expect(nodes[3].fill).toBe(originalFill);
    expect(nodes[3].stroke).toBe(originalStroke);
  });

  it('nodes in the same community have the same color', () => {
    const nodes = makeNodes();
    assignCommunities(nodes, 'group');

    const colorMap = buildCommunityColorMap(nodes, theme);
    applyCommunityColors(nodes, colorMap);

    // Nodes a and b are both in community 'X'
    expect(nodes[0].fill).toBe(nodes[1].fill);
    expect(nodes[0].stroke).toBe(nodes[1].stroke);
  });
});
