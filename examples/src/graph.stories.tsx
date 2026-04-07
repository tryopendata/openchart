/**
 * Graph stories.
 *
 * Force-directed graphs: basic layouts, community clusters, visual encodings,
 * chrome elements, search, and scale/performance tests.
 */

import type { GraphSpec } from '@opendata-ai/openchart-core';
import { Graph } from '@opendata-ai/openchart-react';
import { useEffect, useRef, useState } from 'react';
import { generateRandomGraph } from './graphs/helpers';

// ---------------------------------------------------------------------------
// Basic Graph: 20 nodes, 30 edges, no clustering
// ---------------------------------------------------------------------------

const basicSpec: GraphSpec = {
  type: 'graph',
  nodes: Array.from({ length: 20 }, (_, i) => ({
    id: `n${i}`,
    label: `Node ${i}`,
  })),
  edges: [
    // Ring to ensure connectivity
    ...Array.from({ length: 20 }, (_, i) => ({
      source: `n${i}`,
      target: `n${(i + 1) % 20}`,
    })),
    // Cross-links for visual interest
    ...Array.from({ length: 10 }, (_, i) => ({
      source: `n${i}`,
      target: `n${(i + 7) % 20}`,
    })),
  ],
  layout: { type: 'force' as const, chargeStrength: -120, linkDistance: 40 },
};

export const BasicGraph = () => (
  <div className="story-chart story-h-viewport">
    <Graph spec={basicSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Community Clusters: 50 nodes, 80 edges, 4 communities
// ---------------------------------------------------------------------------

const communitySpec = generateRandomGraph(50, 1.6, 4);
communitySpec.chrome = {
  title: 'Community Clusters',
  subtitle: '50 nodes organized into 4 communities',
};

export const CommunityClusters = () => (
  <div className="story-chart story-h-viewport">
    <Graph spec={communitySpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Encoded Graph: nodeSize by weight, nodeColor by type, edgeWidth by confidence
// ---------------------------------------------------------------------------

const types = ['person', 'org', 'project', 'resource'];

const encodedSpec: GraphSpec = {
  type: 'graph',
  nodes: Array.from({ length: 30 }, (_, i) => ({
    id: `n${i}`,
    label: `Item ${i}`,
    weight: Math.round(Math.random() * 80 + 20),
    type: types[i % types.length],
  })),
  edges: Array.from({ length: 45 }, (_, i) => ({
    source: `n${i % 30}`,
    target: `n${(i * 7 + 3) % 30}`,
    confidence: Math.round(Math.random() * 100) / 100,
  })),
  encoding: {
    nodeSize: { field: 'weight' },
    nodeColor: { field: 'type' },
    edgeWidth: { field: 'confidence' },
  },
  layout: { type: 'force' as const, chargeStrength: -150, linkDistance: 35 },
  chrome: {
    title: 'Visual Encodings',
    subtitle: 'Size = weight, color = type, edge width = confidence',
  },
};

export const EncodedGraph = () => (
  <div className="story-chart story-h-viewport">
    <Graph spec={encodedSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// With Chrome: title, subtitle, source
// ---------------------------------------------------------------------------

const chromeSpec: GraphSpec = {
  type: 'graph',
  nodes: Array.from({ length: 15 }, (_, i) => ({
    id: `s${i}`,
    label: `Station ${i}`,
    ridership: Math.round(Math.random() * 50000 + 5000),
  })),
  edges: [
    // Line connectivity (ring)
    ...Array.from({ length: 15 }, (_, i) => ({
      source: `s${i}`,
      target: `s${(i + 1) % 15}`,
    })),
    // Express connections
    ...Array.from({ length: 5 }, (_, i) => ({
      source: `s${i}`,
      target: `s${(i + 5) % 15}`,
    })),
  ],
  layout: { type: 'force' as const, chargeStrength: -100, linkDistance: 50 },
  chrome: {
    title: 'Transit Network',
    subtitle: 'Station connections and ridership',
    source: 'Source: Metro Transit Authority',
  },
};

export const WithChrome = () => (
  <div className="story-chart story-h-viewport">
    <Graph spec={chromeSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Search Demo: 50 nodes with searchable labels
// ---------------------------------------------------------------------------

const searchSpec = generateRandomGraph(50, 1.5, 0);
searchSpec.nodes = searchSpec.nodes.map((node, i) => ({
  ...node,
  label:
    ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack'][i % 10] +
    ` ${Math.floor(i / 10) + 1}`,
}));
searchSpec.chrome = {
  title: 'Search Demo',
  subtitle: 'Use keyboard / to focus search, then type a name',
};

export const SearchDemo = () => (
  <div className="story-chart story-h-viewport">
    <Graph spec={searchSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Scale Tests
// ---------------------------------------------------------------------------

const spec1k = generateRandomGraph(1000, 1.5, 5);
spec1k.chrome = {
  title: '1,000 Nodes',
  subtitle: '5 communities, ~1500 edges',
};

export const Scale1kNodes = () => (
  <div className="story-chart story-h-viewport">
    <Graph spec={spec1k} />
  </div>
);

const spec5k = generateRandomGraph(5000, 1.5, 8);
spec5k.chrome = {
  title: '5,000 Nodes',
  subtitle: '8 communities, ~7500 edges',
};

export const Scale5kNodes = () => (
  <div className="story-chart story-h-viewport">
    <Graph spec={spec5k} />
  </div>
);

const spec10k = generateRandomGraph(10000, 1.5, 10);
spec10k.chrome = {
  title: '10,000 Nodes',
  subtitle: '10 communities, ~15000 edges',
};

function FPSCounter() {
  const [fps, setFps] = useState(0);
  const frames = useRef(0);
  const lastTime = useRef(performance.now());

  useEffect(() => {
    let raf: number;

    function tick() {
      frames.current++;
      const now = performance.now();
      if (now - lastTime.current >= 1000) {
        setFps(frames.current);
        frames.current = 0;
        lastTime.current = now;
      }
      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        background: 'rgba(0,0,0,0.7)',
        color: fps > 30 ? '#4ade80' : fps > 15 ? '#facc15' : '#ef4444',
        padding: '4px 10px',
        borderRadius: 4,
        fontFamily: 'monospace',
        fontSize: 14,
        fontWeight: 600,
        zIndex: 10,
      }}
    >
      {fps} FPS
    </div>
  );
}

export const Scale10kNodes = () => (
  <div className="story-chart story-h-viewport" style={{ position: 'relative' }}>
    <FPSCounter />
    <Graph spec={spec10k} />
  </div>
);

const spec20k = generateRandomGraph(20000, 1.5, 12);
spec20k.chrome = {
  title: '20,000 Nodes',
  subtitle: '12 communities, ~30000 edges',
};

export const Scale20kNodes = () => (
  <div className="story-chart story-h-viewport" style={{ position: 'relative' }}>
    <FPSCounter />
    <Graph spec={spec20k} />
  </div>
);
