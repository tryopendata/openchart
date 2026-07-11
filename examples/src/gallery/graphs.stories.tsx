/**
 * Graphs — force-directed network gallery page.
 *
 * Seven demos across three sections (Basics, Encoding & chrome, Scale &
 * interaction). Graphs render on a canvas via a web worker, so the large scale
 * demos are gated behind an explicit click: their spec is generated and the
 * <Graph> mounted only when the user asks, never on scroll or lazy-mount, so
 * offscreen 10k/20k-node simulations can't tank page performance.
 *
 * Graphs are the sanctioned exception to the real-data rule: the seeded
 * generators in `../graphs/helpers` are the data source and every demo is
 * labeled "Illustrative data".
 */

import type { GraphSpec } from '@opendata-ai/openchart-core';
import { Graph, useGraph } from '@opendata-ai/openchart-react';
import { useState } from 'react';
import { Demo, GalleryPage, Section } from '../components';
import { generateRandomGraph, generateScaleFreeGraph } from '../graphs/helpers';

const ILLUSTRATIVE = 'Illustrative data';

// ---------------------------------------------------------------------------
// 1. Basic force-directed graph — 20 nodes, ring + cross-links
// ---------------------------------------------------------------------------

const basicSpec: GraphSpec = {
  type: 'graph',
  nodes: Array.from({ length: 20 }, (_, i) => ({ id: `n${i}`, label: `Node ${i}` })),
  edges: [
    ...Array.from({ length: 20 }, (_, i) => ({ source: `n${i}`, target: `n${(i + 1) % 20}` })),
    ...Array.from({ length: 10 }, (_, i) => ({ source: `n${i}`, target: `n${(i + 7) % 20}` })),
  ],
  layout: { type: 'force', chargeStrength: -120, linkDistance: 40 },
  chrome: {
    title: 'A Force Layout Untangles a Small Network',
    subtitle: '20 nodes in a ring with a few cross-links',
    source: ILLUSTRATIVE,
  },
};

// ---------------------------------------------------------------------------
// 2. Community clusters — clustering pulls groups apart
// ---------------------------------------------------------------------------

const communitySpec: GraphSpec = {
  ...generateRandomGraph(60, 1.6, 4),
  encoding: { nodeColor: { field: 'community', type: 'nominal' } },
  layout: { type: 'force', clustering: { field: 'community' }, chargeStrength: -160 },
  chrome: {
    title: 'Clustering Surfaces the Group Structure',
    subtitle: '60 nodes across 4 communities, colored by group',
    source: ILLUSTRATIVE,
  },
};

// ---------------------------------------------------------------------------
// 3. Encoded graph — node size and color driven by data
// ---------------------------------------------------------------------------

const types = ['person', 'org', 'project', 'resource'];

const encodedSpec: GraphSpec = {
  type: 'graph',
  nodes: Array.from({ length: 30 }, (_, i) => ({
    id: `n${i}`,
    label: `Item ${i}`,
    weight: ((i * 37) % 80) + 20,
    kind: types[i % types.length],
  })),
  edges: Array.from({ length: 45 }, (_, i) => ({
    source: `n${i % 30}`,
    target: `n${(i * 7 + 3) % 30}`,
    confidence: ((i * 13) % 100) / 100,
  })),
  encoding: {
    nodeSize: { field: 'weight' },
    nodeColor: { field: 'kind' },
    edgeWidth: { field: 'confidence' },
  },
  layout: { type: 'force', chargeStrength: -150, linkDistance: 35 },
  chrome: {
    title: 'Three Channels, One Layout',
    subtitle: 'Node size = weight, node color = kind, edge width = confidence',
    source: ILLUSTRATIVE,
  },
};

// ---------------------------------------------------------------------------
// 4. Graph with chrome — editorial framing on a network
// ---------------------------------------------------------------------------

const chromeSpec: GraphSpec = {
  type: 'graph',
  nodes: Array.from({ length: 15 }, (_, i) => ({
    id: `s${i}`,
    label: `Station ${i}`,
    ridership: ((i * 6100) % 45000) + 5000,
  })),
  edges: [
    ...Array.from({ length: 15 }, (_, i) => ({ source: `s${i}`, target: `s${(i + 1) % 15}` })),
    ...Array.from({ length: 5 }, (_, i) => ({ source: `s${i}`, target: `s${(i + 5) % 15}` })),
  ],
  encoding: { nodeSize: { field: 'ridership' } },
  layout: { type: 'force', chargeStrength: -100, linkDistance: 50 },
  chrome: {
    title: 'A Transit Map as a Graph',
    subtitle: 'Stations sized by ridership; express links cross the ring',
    source: ILLUSTRATIVE,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 5. Search — built-in node search + imperative useGraph() control
// ---------------------------------------------------------------------------

const searchSpec: GraphSpec = {
  ...generateRandomGraph(50, 1.5, 3),
  encoding: { nodeColor: { field: 'community', type: 'nominal' } },
  layout: { type: 'force', clustering: { field: 'community' } },
  chrome: {
    title: 'Find a Node by Name',
    subtitle: 'Press / to focus the built-in search, or use the buttons below',
    source: ILLUSTRATIVE,
  },
};

function SearchGraph() {
  const { ref, search, clearSearch, zoomToFit } = useGraph();
  const [query, setQuery] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-3)' }}>
      <div style={{ height: 460 }}>
        <Graph ref={ref} spec={searchSpec} />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--oc-space-3)',
          padding: 'var(--oc-space-3) var(--oc-space-4)',
          border: '1px solid var(--oc-border)',
          borderRadius: 'var(--oc-radius-control)',
          background: 'var(--oc-surface-raised)',
          fontSize: 'var(--oc-type-caption)',
        }}
      >
        <input
          type="text"
          value={query}
          placeholder="Type a name, e.g. Ava"
          onChange={(e) => {
            const q = e.target.value;
            setQuery(q);
            if (q) search(q);
            else clearSearch();
          }}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '6px 10px',
            border: '1px solid var(--oc-border)',
            borderRadius: 'var(--oc-radius-control)',
            background: 'var(--oc-surface)',
            color: 'var(--oc-text)',
            fontSize: 'var(--oc-type-caption)',
          }}
        />
        <button
          type="button"
          className="oc-spec-copy"
          onClick={() => {
            setQuery('');
            clearSearch();
            zoomToFit();
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6. Scale demos — click-to-load (never auto-mount)
// ---------------------------------------------------------------------------

/** One scale tier. The graph is generated + mounted only after a click. */
function ScaleGraph({ nodeCount, height }: { nodeCount: number; height: number }) {
  const [spec, setSpec] = useState<GraphSpec | null>(null);

  return (
    <div style={{ height, position: 'relative' }}>
      {spec ? (
        <Graph spec={spec} />
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--oc-space-3)',
            height: '100%',
            border: '1px dashed var(--oc-border)',
            borderRadius: 'var(--oc-radius-control)',
            background: 'var(--oc-surface-raised)',
            color: 'var(--oc-text-muted)',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: 'var(--oc-type-caption)' }}>
            {nodeCount.toLocaleString()} nodes, ~{(nodeCount * 2).toLocaleString()} edges
          </span>
          <button
            type="button"
            className="oc-spec-copy"
            onClick={() => setSpec(generateScaleFreeGraph(nodeCount))}
          >
            Load {nodeCount.toLocaleString()}-node graph
          </button>
          <span style={{ fontSize: 'var(--oc-type-caption)', color: 'var(--oc-text-muted)' }}>
            Generated + rendered on click — nothing runs until you ask
          </span>
        </div>
      )}
    </div>
  );
}

const SCALE_TIERS = [1000, 5000, 10000, 20000] as const;

/**
 * A representative spec for the spec panel only. It clears the 200KB cap so the
 * Demo shows a stub ("spec omitted — N rows, X KB") and the copy button emits
 * the generator snippet instead of megabytes of JSON. This graph is never
 * rendered — the tiers each mount their own on click.
 */
const scalePanelSpec: GraphSpec = generateScaleFreeGraph(5000);

function ScaleDemos() {
  const [tier, setTier] = useState<(typeof SCALE_TIERS)[number]>(1000);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-3)' }}>
      <div style={{ display: 'flex', gap: 'var(--oc-space-2)', flexWrap: 'wrap' }}>
        {SCALE_TIERS.map((n) => (
          <button
            key={n}
            type="button"
            className="oc-spec-copy"
            aria-pressed={tier === n}
            onClick={() => setTier(n)}
            style={
              tier === n
                ? // accent-text (not raw accent) for the label: raw accent as
                  // text fails WCAG AA contrast on the surface.
                  { borderColor: 'var(--oc-accent)', color: 'var(--oc-accent-text)' }
                : undefined
            }
          >
            {n.toLocaleString()}
          </button>
        ))}
      </div>
      {/* key remounts the tier so switching resets to the click-gated placeholder */}
      <ScaleGraph key={tier} nodeCount={tier} height={520} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 7. Interactive — node click / hover readout
// ---------------------------------------------------------------------------

const interactiveSpec: GraphSpec = {
  ...generateRandomGraph(40, 1.5, 4),
  encoding: { nodeColor: { field: 'community', type: 'nominal' } },
  layout: { type: 'force', clustering: { field: 'community' } },
  chrome: {
    title: 'Click or Hover a Node',
    subtitle: 'onNodeClick and onNodeHover drive a live readout',
    source: ILLUSTRATIVE,
  },
};

function InteractiveGraph() {
  const [clicked, setClicked] = useState<{ label: string; community?: string } | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-3)' }}>
      <div style={{ height: 460 }}>
        <Graph
          spec={interactiveSpec}
          onNodeClick={(node) =>
            setClicked({ label: String(node.label), community: node.community as string })
          }
          onNodeHover={(node) => setHovered(node ? String(node.label) : null)}
        />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--oc-space-3)',
          padding: 'var(--oc-space-3) var(--oc-space-4)',
          border: '1px solid var(--oc-border)',
          borderRadius: 'var(--oc-radius-control)',
          background: 'var(--oc-surface-raised)',
          fontSize: 'var(--oc-type-caption)',
          color: 'var(--oc-text-muted)',
          fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
        }}
      >
        <span style={{ color: 'var(--oc-text-muted)' }}>clicked</span>
        {clicked ? (
          <span style={{ color: 'var(--oc-text)' }}>
            {clicked.label}
            {clicked.community ? ` — ${clicked.community}` : ''}
          </span>
        ) : (
          <span>none yet</span>
        )}
        <span style={{ marginLeft: 'auto', color: 'var(--oc-text-muted)' }}>
          hover: {hovered ?? '(none)'}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default { title: 'Graphs' };

export const Graphs = () => (
  <GalleryPage
    title="Graphs"
    lede="Force-directed graphs render relationships — who connects to whom, how tightly, in what clusters. OpenChart draws them on a canvas with a web-worker simulation, so layouts stay smooth from twenty nodes to twenty thousand. Node size, color, and edge width read straight off your data. All demos here use seeded illustrative networks."
  >
    <Section
      id="basics"
      title="Basics"
      lede="A physics simulation pushes unrelated nodes apart and pulls linked ones together, revealing structure that a table can't show."
    >
      <Demo
        id="basic"
        title="Force-directed graph"
        description="The default layout: repulsion untangles the network so connected nodes settle near one another."
        spec={basicSpec}
        height={480}
      />
      <Demo
        id="communities"
        title="Community clusters"
        description="A clustering force groups nodes by a category field, and color reinforces the grouping."
        spec={communitySpec}
        height={480}
      />
    </Section>

    <Section
      id="encoding"
      title="Encoding & chrome"
      lede="Map data fields to node size, node color, and edge width the same way charts map to x/y — then wrap the network in editorial chrome."
    >
      <Demo
        id="encoded"
        title="Encoded graph"
        description="nodeSize, nodeColor, and edgeWidth encodings turn three data fields into visual channels on one layout."
        spec={encodedSpec}
        height={480}
      />
      <Demo
        id="chrome"
        title="Graph with chrome"
        description="Title, subtitle, source, and byline frame the network like any other OpenChart figure."
        spec={chromeSpec}
        height={480}
      />
    </Section>

    <Section
      id="scale-and-interaction"
      title="Scale & interaction"
      lede="Search, click, and hover are built in. The scale tiers stay inert until you click — large simulations never run offscreen."
    >
      <Demo
        id="search"
        title="Search (built-in node search)"
        description="Press / to focus the graph's own search box, or drive it imperatively with the useGraph() hook: matching nodes highlight and the rest dim."
        specForPanel={searchSpec}
        height={560}
      >
        <SearchGraph />
      </Demo>
      <Demo
        id="scale"
        title="Scale: 1k / 5k / 10k / 20k nodes (click to load)"
        description="Each tier generates a scale-free (Barabasi-Albert) network and mounts the graph only on click, so nothing heavy runs until you ask. The spec panel copies the generator call, not megabytes of JSON."
        specForPanel={scalePanelSpec}
        generatorSnippet={
          "import { generateScaleFreeGraph } from './graphs/helpers';\n\n// 1k / 5k / 10k / 20k — pick a tier\nconst spec = generateScaleFreeGraph(20000);\n\n// <Graph spec={spec} />"
        }
        height={600}
      >
        <ScaleDemos />
      </Demo>
      <Demo
        id="interactive"
        title="Interactive (click & hover)"
        description="onNodeClick and onNodeHover surface the node datum; here they feed a live readout below the graph."
        specForPanel={interactiveSpec}
        height={560}
      >
        <InteractiveGraph />
      </Demo>
    </Section>
  </GalleryPage>
);
