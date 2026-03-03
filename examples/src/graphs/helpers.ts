/**
 * Graph story helpers: random graph generators for Ladle stories.
 *
 * Provides two generators:
 * - generateRandomGraph: random nodes with optional communities
 * - generateScaleFreeGraph: preferential attachment (Barabasi-Albert model)
 */

import type { GraphSpec } from '@opendata-ai/openchart-core';

// ---------------------------------------------------------------------------
// Deterministic pseudo-random (seeded for stable stories)
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Random graph
// ---------------------------------------------------------------------------

/**
 * Generate a random graph with optional community structure.
 *
 * @param nodeCount - Number of nodes.
 * @param edgeFactor - Edges = edgeFactor * nodeCount.
 * @param communityCount - If > 0, assign nodes to communities and prefer intra-community edges.
 */
export function generateRandomGraph(
  nodeCount: number,
  edgeFactor: number = 1.5,
  communityCount: number = 0,
): GraphSpec {
  const rand = mulberry32(42 + nodeCount);
  const communityNames =
    communityCount > 0
      ? Array.from({ length: communityCount }, (_, i) => `Community ${i + 1}`)
      : [];

  const nodes = Array.from({ length: nodeCount }, (_, i) => {
    const node: Record<string, unknown> = {
      id: `n${i}`,
      label: `Node ${i}`,
    };
    if (communityNames.length > 0) {
      node.community = communityNames[i % communityNames.length];
    }
    // Add a weight field for encoding demos
    node.weight = Math.round(rand() * 100);
    return node;
  });

  const edgeCount = Math.floor(edgeFactor * nodeCount);
  const edgeSet = new Set<string>();
  const edges: Array<{ source: string; target: string; confidence?: number }> = [];

  for (let i = 0; i < edgeCount; i++) {
    let source: number;
    let target: number;
    let attempts = 0;

    do {
      if (communityNames.length > 0 && rand() < 0.7) {
        // Prefer intra-community edges
        const communityIdx = Math.floor(rand() * communityNames.length);
        const communityNodes = nodes
          .map((n, idx) => ({ idx, community: n.community }))
          .filter((n) => n.community === communityNames[communityIdx]);
        if (communityNodes.length >= 2) {
          source = communityNodes[Math.floor(rand() * communityNodes.length)].idx;
          target = communityNodes[Math.floor(rand() * communityNodes.length)].idx;
        } else {
          source = Math.floor(rand() * nodeCount);
          target = Math.floor(rand() * nodeCount);
        }
      } else {
        source = Math.floor(rand() * nodeCount);
        target = Math.floor(rand() * nodeCount);
      }
      attempts++;
    } while ((source === target || edgeSet.has(`${source}-${target}`)) && attempts < 100);

    if (source !== target && !edgeSet.has(`${source}-${target}`)) {
      edgeSet.add(`${source}-${target}`);
      edgeSet.add(`${target}-${source}`);
      edges.push({
        source: `n${source}`,
        target: `n${target}`,
        confidence: Math.round(rand() * 100) / 100,
      });
    }
  }

  const spec: GraphSpec = {
    type: 'graph',
    nodes,
    edges,
  };

  if (communityNames.length > 0) {
    spec.layout = {
      clustering: { field: 'community' },
    };
  }

  return spec;
}

// ---------------------------------------------------------------------------
// Scale-free graph (Barabasi-Albert)
// ---------------------------------------------------------------------------

/**
 * Generate a scale-free graph using preferential attachment.
 *
 * Each new node connects to 2 existing nodes with probability proportional
 * to their degree. This produces hub-and-spoke topology typical of real
 * networks (social, web, citation).
 *
 * @param nodeCount - Number of nodes.
 */
export function generateScaleFreeGraph(nodeCount: number): GraphSpec {
  const rand = mulberry32(99 + nodeCount);
  const m = 2; // edges per new node

  // Start with a small complete graph (m+1 nodes)
  const nodes: Array<{ id: string; label: string; weight: number }> = [];
  const edges: Array<{ source: string; target: string }> = [];
  const degree: number[] = [];

  // Initial seed: m+1 fully connected nodes
  for (let i = 0; i <= m; i++) {
    nodes.push({ id: `n${i}`, label: `Node ${i}`, weight: 0 });
    degree.push(0);
    for (let j = 0; j < i; j++) {
      edges.push({ source: `n${j}`, target: `n${i}` });
      degree[j]++;
      degree[i]++;
    }
  }

  // Add remaining nodes with preferential attachment
  for (let i = m + 1; i < nodeCount; i++) {
    nodes.push({ id: `n${i}`, label: `Node ${i}`, weight: 0 });
    degree.push(0);

    const totalDegree = degree.reduce((a, b) => a + b, 0);
    const connected = new Set<number>();

    let attempts = 0;
    while (connected.size < m && attempts < 1000) {
      attempts++;
      // Pick a node proportional to degree
      let r = rand() * totalDegree;
      for (let j = 0; j < i; j++) {
        r -= degree[j];
        if (r <= 0 && !connected.has(j)) {
          connected.add(j);
          edges.push({ source: `n${j}`, target: `n${i}` });
          degree[j]++;
          degree[i]++;
          break;
        }
      }
    }
  }

  // Set weight = degree for node sizing
  for (let i = 0; i < nodes.length; i++) {
    nodes[i].weight = degree[i];
  }

  return {
    type: 'graph',
    nodes,
    edges,
  };
}
