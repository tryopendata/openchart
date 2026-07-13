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
// 1. Basic force-directed graph — who reviews whose pull requests
// ---------------------------------------------------------------------------

/**
 * A code-review network: an edge means "reviewed a PR for". Three teams sit at
 * the core (platform, web, data) with a handful of cross-team reviewers wiring
 * them together, so the force layout has real structure to pull apart.
 */
const reviewPairs: Array<[string, string]> = [
  // Platform team
  ['Ava', 'Liam'],
  ['Liam', 'Mia'],
  ['Mia', 'Ava'],
  ['Noah', 'Ava'],
  ['Noah', 'Liam'],
  // Web team
  ['Zoe', 'Ethan'],
  ['Ethan', 'Chloe'],
  ['Chloe', 'Zoe'],
  ['Leo', 'Chloe'],
  ['Leo', 'Ethan'],
  // Data team
  ['Isla', 'Owen'],
  ['Owen', 'Nora'],
  ['Nora', 'Isla'],
  ['Kai', 'Nora'],
  ['Kai', 'Owen'],
  // Cross-team reviewers stitch the three clusters together
  ['Mia', 'Zoe'],
  ['Chloe', 'Isla'],
  ['Owen', 'Ava'],
  ['Leo', 'Kai'],
  ['Noah', 'Isla'],
];

const basicSpec: GraphSpec = {
  type: 'graph',
  nodes: [...new Set(reviewPairs.flat())].map((name) => ({ id: name, label: name })),
  edges: reviewPairs.map(([source, target]) => ({ source, target })),
  layout: { type: 'force', chargeStrength: -120, linkDistance: 40 },
  chrome: {
    title: 'A Force Layout Untangles a Small Network',
    subtitle: 'Fifteen engineers; an edge means one reviewed the other’s pull request',
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
// 3. Encoded graph — a research knowledge graph, three channels at once
// ---------------------------------------------------------------------------

/**
 * A knowledge graph over a research org: people belong to labs, labs fund
 * projects, projects consume datasets. `citations` drives node size, `kind`
 * drives color, and `confidence` (how well-established the link is) drives
 * edge width — three data fields, three visual channels, one layout.
 */
type KnowledgeNode = { id: string; label: string; citations: number; kind: string };

const knowledgeNodes: KnowledgeNode[] = [
  // Labs
  { id: 'lab-vision', label: 'Vision Lab', citations: 92, kind: 'Lab' },
  { id: 'lab-language', label: 'Language Lab', citations: 88, kind: 'Lab' },
  { id: 'lab-robotics', label: 'Robotics Lab', citations: 61, kind: 'Lab' },
  // Researchers
  { id: 'p-chen', label: 'Wei Chen', citations: 74, kind: 'Researcher' },
  { id: 'p-okafor', label: 'Ada Okafor', citations: 68, kind: 'Researcher' },
  { id: 'p-silva', label: 'Marco Silva', citations: 55, kind: 'Researcher' },
  { id: 'p-hoffman', label: 'Ruth Hoffman', citations: 49, kind: 'Researcher' },
  { id: 'p-nakamura', label: 'Yuki Nakamura', citations: 44, kind: 'Researcher' },
  { id: 'p-bello', label: 'Ines Bello', citations: 38, kind: 'Researcher' },
  { id: 'p-dubois', label: 'Luc Dubois', citations: 33, kind: 'Researcher' },
  { id: 'p-ferrari', label: 'Gia Ferrari', citations: 27, kind: 'Researcher' },
  // Projects
  { id: 'proj-atlas', label: 'Atlas', citations: 80, kind: 'Project' },
  { id: 'proj-lumen', label: 'Lumen', citations: 66, kind: 'Project' },
  { id: 'proj-harbor', label: 'Harbor', citations: 52, kind: 'Project' },
  { id: 'proj-cobalt', label: 'Cobalt', citations: 41, kind: 'Project' },
  { id: 'proj-tessera', label: 'Tessera', citations: 29, kind: 'Project' },
  // Datasets
  { id: 'ds-imagenet', label: 'ImageNet', citations: 96, kind: 'Dataset' },
  { id: 'ds-commoncrawl', label: 'Common Crawl', citations: 84, kind: 'Dataset' },
  { id: 'ds-openstreet', label: 'OpenStreetMap', citations: 58, kind: 'Dataset' },
  { id: 'ds-census', label: 'US Census', citations: 47, kind: 'Dataset' },
  { id: 'ds-arxiv', label: 'arXiv', citations: 39, kind: 'Dataset' },
];

const knowledgeEdges: Array<{ source: string; target: string; confidence: number }> = [
  // Researchers -> labs (affiliation, well established)
  { source: 'p-chen', target: 'lab-vision', confidence: 0.98 },
  { source: 'p-okafor', target: 'lab-language', confidence: 0.96 },
  { source: 'p-silva', target: 'lab-robotics', confidence: 0.95 },
  { source: 'p-hoffman', target: 'lab-vision', confidence: 0.93 },
  { source: 'p-nakamura', target: 'lab-language', confidence: 0.91 },
  { source: 'p-bello', target: 'lab-robotics', confidence: 0.88 },
  { source: 'p-dubois', target: 'lab-vision', confidence: 0.72 },
  { source: 'p-ferrari', target: 'lab-language', confidence: 0.64 },
  // Labs -> projects (funding)
  { source: 'lab-vision', target: 'proj-atlas', confidence: 0.9 },
  { source: 'lab-vision', target: 'proj-cobalt', confidence: 0.61 },
  { source: 'lab-language', target: 'proj-lumen', confidence: 0.87 },
  { source: 'lab-language', target: 'proj-tessera', confidence: 0.55 },
  { source: 'lab-robotics', target: 'proj-harbor', confidence: 0.83 },
  { source: 'lab-robotics', target: 'proj-cobalt', confidence: 0.48 },
  // Researchers -> projects (contribution)
  { source: 'p-chen', target: 'proj-atlas', confidence: 0.86 },
  { source: 'p-hoffman', target: 'proj-atlas', confidence: 0.7 },
  { source: 'p-okafor', target: 'proj-lumen', confidence: 0.82 },
  { source: 'p-nakamura', target: 'proj-lumen', confidence: 0.59 },
  { source: 'p-silva', target: 'proj-harbor', confidence: 0.78 },
  { source: 'p-bello', target: 'proj-harbor', confidence: 0.51 },
  { source: 'p-dubois', target: 'proj-cobalt', confidence: 0.43 },
  { source: 'p-ferrari', target: 'proj-tessera', confidence: 0.37 },
  // Projects -> datasets (consumption)
  { source: 'proj-atlas', target: 'ds-imagenet', confidence: 0.94 },
  { source: 'proj-atlas', target: 'ds-openstreet', confidence: 0.46 },
  { source: 'proj-lumen', target: 'ds-commoncrawl', confidence: 0.92 },
  { source: 'proj-lumen', target: 'ds-arxiv', confidence: 0.68 },
  { source: 'proj-harbor', target: 'ds-openstreet', confidence: 0.81 },
  { source: 'proj-harbor', target: 'ds-census', confidence: 0.57 },
  { source: 'proj-cobalt', target: 'ds-imagenet', confidence: 0.65 },
  { source: 'proj-cobalt', target: 'ds-census', confidence: 0.4 },
  { source: 'proj-tessera', target: 'ds-arxiv', confidence: 0.53 },
  { source: 'proj-tessera', target: 'ds-commoncrawl', confidence: 0.35 },
];

const encodedSpec: GraphSpec = {
  type: 'graph',
  nodes: knowledgeNodes,
  edges: knowledgeEdges,
  encoding: {
    nodeSize: { field: 'citations' },
    nodeColor: { field: 'kind' },
    nodeLabel: { field: 'label' },
    edgeWidth: { field: 'confidence' },
  },
  layout: { type: 'force', chargeStrength: -150, linkDistance: 35 },
  chrome: {
    title: 'Three Channels, One Layout',
    subtitle: 'Size = citations, color = entity kind, edge width = link confidence',
    source: ILLUSTRATIVE,
  },
};

// ---------------------------------------------------------------------------
// 4. Graph with chrome — editorial framing on a network
// ---------------------------------------------------------------------------

/**
 * The Lexington Avenue line as a graph. Local service (the 6) runs the corridor
 * stop by stop; express service (the 4/5) skips ahead, so the express edges are
 * the shortcuts that fold the line in on itself. Stations are sized by weekday
 * ridership. Express stops are the ones the 4/5 actually serve.
 */
const lexStations: Array<{ id: string; label: string; ridership: number; express: boolean }> = [
  { id: 'brooklyn-bridge', label: 'Brooklyn Bridge', ridership: 21000, express: true },
  { id: 'canal', label: 'Canal St', ridership: 12000, express: false },
  { id: 'spring', label: 'Spring St', ridership: 8000, express: false },
  { id: 'bleecker', label: 'Bleecker St', ridership: 14000, express: false },
  { id: 'astor', label: 'Astor Pl', ridership: 11000, express: false },
  { id: 'union-square', label: '14 St–Union Sq', ridership: 45000, express: true },
  { id: '23rd', label: '23 St', ridership: 13000, express: false },
  { id: '28th', label: '28 St', ridership: 9000, express: false },
  { id: '33rd', label: '33 St', ridership: 16000, express: false },
  { id: 'grand-central', label: 'Grand Central', ridership: 42000, express: true },
  { id: '51st', label: '51 St', ridership: 18000, express: false },
  { id: '59th', label: '59 St', ridership: 27000, express: true },
  { id: '68th', label: '68 St–Hunter', ridership: 15000, express: false },
  { id: '77th', label: '77 St', ridership: 10000, express: false },
  { id: '86th', label: '86 St', ridership: 24000, express: true },
];

const expressStops = lexStations.filter((s) => s.express);

const chromeSpec: GraphSpec = {
  type: 'graph',
  nodes: lexStations,
  edges: [
    // Local service: every station in corridor order.
    ...lexStations.slice(0, -1).map((station, i) => ({
      source: station.id,
      target: lexStations[i + 1].id,
    })),
    // Express service: skips the locals, short-circuiting the corridor.
    ...expressStops.slice(0, -1).map((station, i) => ({
      source: station.id,
      target: expressStops[i + 1].id,
    })),
  ],
  encoding: { nodeSize: { field: 'ridership' }, nodeLabel: { field: 'label' } },
  layout: { type: 'force', chargeStrength: -100, linkDistance: 50 },
  chrome: {
    title: 'A Transit Line as a Graph',
    subtitle:
      'Lexington Avenue stations sized by weekday ridership; express trains skip the locals',
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
