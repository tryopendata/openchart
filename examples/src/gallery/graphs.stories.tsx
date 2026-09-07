/**
 * Graphs — force-directed network gallery page.
 *
 * Fourteen demos across four sections (Basics, Encoding & chrome, Scale &
 * interaction, Motion & API). Graphs render on a canvas via a web worker, so
 * the large scale demos are gated behind an explicit click: their spec is generated and the
 * <Graph> mounted only when the user asks, never on scroll or lazy-mount, so
 * offscreen 10k/20k-node simulations can't tank page performance.
 *
 * Graphs are the sanctioned exception to the real-data rule: the seeded
 * generators in `../graphs/helpers` are the data source and every demo is
 * labeled "Illustrative data".
 */

import type { GraphSpec } from '@opendata-ai/openchart-core';
import { MAX_3D_NODES } from '@opendata-ai/openchart-engine';
import { Graph, useGraph } from '@opendata-ai/openchart-react';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Demo, GalleryPage, Section } from '../components';
import { generateRandomGraph, generateScaleFreeGraph } from '../graphs/helpers';

const ILLUSTRATIVE = 'Illustrative data';

/** The 3D node ceiling, formatted for prose. Pinned to the engine constant. */
const NODE_GATE = MAX_3D_NODES.toLocaleString();

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gx-space-3)' }}>
      <div style={{ height: 460 }}>
        <Graph ref={ref} spec={searchSpec} />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--gx-space-3)',
          padding: 'var(--gx-space-3) var(--gx-space-4)',
          border: '1px solid var(--gx-border)',
          borderRadius: 'var(--gx-radius-control)',
          background: 'var(--gx-surface-raised)',
          fontSize: 'var(--gx-type-caption)',
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
            border: '1px solid var(--gx-border)',
            borderRadius: 'var(--gx-radius-control)',
            background: 'var(--gx-surface)',
            color: 'var(--gx-text)',
            fontSize: 'var(--gx-type-caption)',
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
            gap: 'var(--gx-space-3)',
            height: '100%',
            border: '1px dashed var(--gx-border)',
            borderRadius: 'var(--gx-radius-control)',
            background: 'var(--gx-surface-raised)',
            color: 'var(--gx-text-muted)',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: 'var(--gx-type-caption)' }}>
            {nodeCount.toLocaleString()} nodes, ~{(nodeCount * 2).toLocaleString()} edges
          </span>
          <button
            type="button"
            className="oc-spec-copy"
            onClick={() => setSpec(generateScaleFreeGraph(nodeCount))}
          >
            Load {nodeCount.toLocaleString()}-node graph
          </button>
          <span style={{ fontSize: 'var(--gx-type-caption)', color: 'var(--gx-text-muted)' }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gx-space-3)' }}>
      <div style={{ display: 'flex', gap: 'var(--gx-space-2)', flexWrap: 'wrap' }}>
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
                  { borderColor: 'var(--gx-accent)', color: 'var(--gx-accent-text)' }
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gx-space-3)' }}>
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
          gap: 'var(--gx-space-3)',
          padding: 'var(--gx-space-3) var(--gx-space-4)',
          border: '1px solid var(--gx-border)',
          borderRadius: 'var(--gx-radius-control)',
          background: 'var(--gx-surface-raised)',
          fontSize: 'var(--gx-type-caption)',
          color: 'var(--gx-text-muted)',
          fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
        }}
      >
        <span style={{ color: 'var(--gx-text-muted)' }}>clicked</span>
        {clicked ? (
          <span style={{ color: 'var(--gx-text)' }}>
            {clicked.label}
            {clicked.community ? ` — ${clicked.community}` : ''}
          </span>
        ) : (
          <span>none yet</span>
        )}
        <span style={{ marginLeft: 'auto', color: 'var(--gx-text-muted)' }}>
          hover: {hovered ?? '(none)'}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 8. Entrance & camera choreography — replayable reveal
// ---------------------------------------------------------------------------

/**
 * The entrance is default-ON: the camera starts pulled back and flies to the
 * fit while nodes stagger in. Remounting the <Graph> replays it; a key bump is
 * the simplest way to force a fresh mount.
 */
const choreographySpec: GraphSpec = {
  ...generateRandomGraph(48, 1.6, 4),
  encoding: { nodeColor: { field: 'community', type: 'nominal' } },
  layout: { type: 'force', clustering: { field: 'community' }, seed: 7 },
  animation: { enter: { duration: 900, stagger: true }, camera: { duration: 900 } },
  chrome: {
    title: 'Nodes Stagger In as the Camera Flies to Fit',
    subtitle: 'Entrance choreography is on by default — press replay to watch it again',
    source: ILLUSTRATIVE,
  },
};

function ChoreographyGraph() {
  const [runId, setRunId] = useState(0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gx-space-3)' }}>
      <div style={{ height: 460 }}>
        {/* key bump forces a fresh mount, replaying the entrance from scratch */}
        <Graph key={runId} spec={choreographySpec} />
      </div>
      <div style={{ display: 'flex', gap: 'var(--gx-space-2)' }}>
        <button type="button" className="oc-spec-copy" onClick={() => setRunId((n) => n + 1)}>
          Replay entrance
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 9. Camera API — programmatic pan/zoom flights + live camera readout
// ---------------------------------------------------------------------------

const cameraSpec: GraphSpec = {
  ...generateRandomGraph(60, 1.5, 4),
  encoding: {
    nodeColor: { field: 'community', type: 'nominal' },
    nodeLabel: { field: 'label' },
  },
  layout: { type: 'force', clustering: { field: 'community' }, seed: 13 },
  chrome: {
    title: 'Drive the Camera From Code',
    subtitle:
      'zoomToNode, flyTo, and centerAt animate the viewport — gestures feed the same camera',
    source: ILLUSTRATIVE,
  },
};

function CameraGraph() {
  const { ref, zoomToNode, flyTo, centerAt, zoomToFit } = useGraph();
  const [camera, setCamera] = useState({ x: 0, y: 0, k: 1 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gx-space-3)' }}>
      <div style={{ height: 460 }}>
        <Graph ref={ref} spec={cameraSpec} onCameraChange={setCamera} />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--gx-space-2)',
          flexWrap: 'wrap',
        }}
      >
        <button type="button" className="oc-spec-copy" onClick={() => zoomToNode('n0')}>
          Fly to Ava
        </button>
        <button
          type="button"
          className="oc-spec-copy"
          onClick={() => zoomToNode('n7', { scale: 3 })}
        >
          Fly to Leo ×3
        </button>
        <button type="button" className="oc-spec-copy" onClick={() => flyTo({ x: 0, y: 0, k: 2 })}>
          Punch in ×2
        </button>
        <button type="button" className="oc-spec-copy" onClick={() => centerAt(0, 0)}>
          Recenter
        </button>
        <button type="button" className="oc-spec-copy" onClick={() => zoomToFit()}>
          Zoom to fit
        </button>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 'var(--gx-type-caption)',
            color: 'var(--gx-text-muted)',
            fontFamily:
              'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
          }}
        >
          x {camera.x.toFixed(0)} y {camera.y.toFixed(0)} k {camera.k.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 10. Interactive legend — click a category to isolate it
// ---------------------------------------------------------------------------

const legendSpec: GraphSpec = {
  ...generateRandomGraph(70, 1.5, 5),
  encoding: { nodeColor: { field: 'community', type: 'nominal' } },
  layout: { type: 'force', clustering: { field: 'community' }, seed: 11 },
  legend: { interactive: true, counts: true },
  chrome: {
    title: 'Click a Legend Category to Isolate It',
    subtitle: 'The built-in legend is interactive by default; toggles dim the rest',
    source: ILLUSTRATIVE,
  },
};

function LegendGraph() {
  const [active, setActive] = useState<string[]>([]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gx-space-3)' }}>
      <div style={{ height: 460 }}>
        <Graph
          spec={legendSpec}
          onLegendToggle={(values) => setActive(values)}
          onLegendHover={() => {}}
        />
      </div>
      <div
        style={{
          padding: 'var(--gx-space-3) var(--gx-space-4)',
          border: '1px solid var(--gx-border)',
          borderRadius: 'var(--gx-radius-control)',
          background: 'var(--gx-surface-raised)',
          fontSize: 'var(--gx-type-caption)',
          color: 'var(--gx-text-muted)',
          fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
        }}
      >
        active categories: {active.length ? active.join(', ') : '(all)'}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 10b. Host-driven legend — the sidebar owns the UI, openchart owns the focus
// ---------------------------------------------------------------------------

/**
 * `legend: false` turns the built-in legend off; `getLegend()` hands the same
 * resolved model to a custom sidebar. Clicks set the sticky filter, hovers
 * layer a transient highlight over it, and `seedNode` stays lit through both.
 */
const hostLegendSpec: GraphSpec = {
  ...generateRandomGraph(70, 1.5, 4),
  encoding: { nodeColor: { field: 'community', type: 'nominal' } },
  layout: { type: 'force', clustering: { field: 'community' }, seed: 7 },
  legend: false,
  seedNode: 'n0',
  chrome: {
    title: 'Your Legend, Our Focus Model',
    subtitle: 'Click to filter, hover to preview inside the filter; the seed node stays lit',
    source: ILLUSTRATIVE,
  },
};

function HostLegendGraph() {
  const { ref, getLegend, setActiveCategories, getActiveCategories, highlight, clearHighlight } =
    useGraph();
  const [rows, setRows] = useState<Array<{ label: string; color: string; count?: number }>>([]);
  const [active, setActive] = useState<string[]>([]);

  // The legend model is only resolvable after the graph mounts, so poll frames
  // until it resolves rather than guessing at one. A single rAF would leave the
  // sidebar permanently empty if the graph wasn't mounted by that frame.
  useEffect(() => {
    let frame = 0;
    let id = 0;
    const read = () => {
      const legend = getLegend();
      if (legend) {
        setRows(legend.nodes);
        return;
      }
      if (++frame < 60) id = requestAnimationFrame(read);
    };
    id = requestAnimationFrame(read);
    return () => cancelAnimationFrame(id);
  }, [getLegend]);

  const toggle = (label: string) => {
    const current = getActiveCategories();
    const next = current.includes(label) ? current.filter((v) => v !== label) : [...current, label];
    setActiveCategories(next);
    setActive(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gx-space-3)' }}>
      <div style={{ display: 'flex', gap: 'var(--gx-space-3)', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, height: 460 }}>
          <Graph ref={ref} spec={hostLegendSpec} />
        </div>
        <div
          style={{
            width: 200,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--gx-space-1)',
            padding: 'var(--gx-space-3)',
            border: '1px solid var(--gx-border)',
            borderRadius: 'var(--gx-radius-control)',
            background: 'var(--gx-surface-raised)',
          }}
        >
          {rows.map((row) => (
            <button
              key={row.label}
              type="button"
              onClick={() => toggle(row.label)}
              onMouseEnter={() => highlight({ category: { field: 'community', value: row.label } })}
              onMouseLeave={() => clearHighlight()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--gx-space-2)',
                padding: 'var(--gx-space-1) var(--gx-space-2)',
                border: 'none',
                borderRadius: 'var(--gx-radius-control)',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 'var(--gx-type-caption)',
                color: 'var(--gx-text)',
                textAlign: 'left',
                opacity: active.length === 0 || active.includes(row.label) ? 1 : 0.45,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: row.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ flex: 1 }}>{row.label}</span>
              <span style={{ color: 'var(--gx-text-muted)' }}>{row.count}</span>
            </button>
          ))}
        </div>
      </div>
      <div
        style={{
          padding: 'var(--gx-space-3) var(--gx-space-4)',
          border: '1px solid var(--gx-border)',
          borderRadius: 'var(--gx-radius-control)',
          background: 'var(--gx-surface-raised)',
          fontSize: 'var(--gx-type-caption)',
          color: 'var(--gx-text-muted)',
          fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
        }}
      >
        filter: {active.length ? active.join(', ') : '(all)'} · seed: n0
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 11. Highlight API — programmatic emphasis via useGraph()
// ---------------------------------------------------------------------------

const highlightSpec: GraphSpec = {
  ...generateRandomGraph(60, 1.6, 4),
  encoding: { nodeColor: { field: 'community', type: 'nominal' } },
  layout: { type: 'force', clustering: { field: 'community' }, seed: 3 },
  chrome: {
    title: 'Emphasize a Set Without Recompiling',
    subtitle: 'highlight() eases a focus crossfade; clearHighlight() drops it',
    source: ILLUSTRATIVE,
  },
};

function HighlightGraph() {
  const { ref, highlight, clearHighlight } = useGraph();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gx-space-3)' }}>
      <div style={{ height: 460 }}>
        <Graph ref={ref} spec={highlightSpec} />
      </div>
      <div style={{ display: 'flex', gap: 'var(--gx-space-2)', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="oc-spec-copy"
          onClick={() => highlight({ category: { field: 'community', value: 'Community 1' } })}
        >
          Highlight Community 1
        </button>
        <button
          type="button"
          className="oc-spec-copy"
          onClick={() => highlight({ neighborsOf: 'n0', includeSelf: true })}
        >
          Highlight neighbors of n0
        </button>
        <button type="button" className="oc-spec-copy" onClick={() => clearHighlight()}>
          Clear
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 12. Seeded layout — deterministic, reproducible positions
// ---------------------------------------------------------------------------

/** Same spec + same seed ⇒ identical settled layout, across reshapes. */
const seededSpec: GraphSpec = {
  ...generateRandomGraph(40, 1.5, 3),
  encoding: { nodeColor: { field: 'community', type: 'nominal' } },
  layout: { type: 'force', clustering: { field: 'community' }, seed: 42 },
  animation: false,
  chrome: {
    title: 'A Seed Makes the Layout Reproducible',
    subtitle: 'layout.seed pins start positions — both panels settle identically',
    source: ILLUSTRATIVE,
  },
};

function SeededGraph() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 'var(--gx-space-3)',
      }}
    >
      {/* Two independent mounts of the same seeded spec settle to the same shape. */}
      <div style={{ height: 360 }}>
        <Graph spec={seededSpec} />
      </div>
      <div style={{ height: 360 }}>
        <Graph spec={seededSpec} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 13. Update transitions — add / remove nodes without a reset
// ---------------------------------------------------------------------------

/** Small evolving network; buttons mutate the node/edge set and update() tweens. */
function UpdateGraph() {
  const [count, setCount] = useState(6);

  // Build a ring of `count` nodes with an extra hub in the middle.
  const spec: GraphSpec = {
    type: 'graph',
    nodes: [
      { id: 'hub', label: 'Hub', community: 'core' },
      ...Array.from({ length: count }, (_, i) => ({
        id: `r${i}`,
        label: `Node ${i + 1}`,
        community: 'ring',
      })),
    ],
    edges: [
      ...Array.from({ length: count }, (_, i) => ({ source: 'hub', target: `r${i}` })),
      ...Array.from({ length: count }, (_, i) => ({
        source: `r${i}`,
        target: `r${(i + 1) % count}`,
      })),
    ],
    encoding: { nodeColor: { field: 'community', type: 'nominal' } },
    layout: { type: 'force', seed: 5 },
    chrome: {
      title: 'Add and Remove Nodes; the Layout Tweens',
      subtitle: 'update() diffs the spec — survivors keep their spots, enterers fade in',
      source: ILLUSTRATIVE,
    },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gx-space-3)' }}>
      <div style={{ height: 460 }}>
        <Graph spec={spec} />
      </div>
      <div style={{ display: 'flex', gap: 'var(--gx-space-2)', alignItems: 'center' }}>
        <button
          type="button"
          className="oc-spec-copy"
          onClick={() => setCount((n) => Math.min(n + 2, 16))}
        >
          Add nodes
        </button>
        <button
          type="button"
          className="oc-spec-copy"
          onClick={() => setCount((n) => Math.max(n - 2, 3))}
        >
          Remove nodes
        </button>
        <span style={{ fontSize: 'var(--gx-type-caption)', color: 'var(--gx-text-muted)' }}>
          {count + 1} nodes
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 14. Cursor repulsion — nodes drift away from the pointer
// ---------------------------------------------------------------------------

const cursorSpec: GraphSpec = {
  ...generateRandomGraph(50, 1.4, 3),
  encoding: { nodeColor: { field: 'community', type: 'nominal' } },
  layout: { type: 'force', clustering: { field: 'community' }, seed: 9 },
  interaction: { cursorRepulsion: { radius: 90, strength: 1 }, springyDrag: true },
  chrome: {
    title: 'Nodes Drift Away From the Cursor',
    subtitle: 'Opt-in cursorRepulsion + springyDrag; move the pointer over the graph',
    source: ILLUSTRATIVE,
  },
};

// ---------------------------------------------------------------------------
// 15-18. Three dimensions — the same specs, rendered with WebGL
// ---------------------------------------------------------------------------

/**
 * The 3D subpath, loaded once and shared by every demo on this page.
 *
 * It is a side-effect import that pulls three.js in, so a static import would
 * put three.js on the gallery's critical path for every visitor, 3D demos or
 * not. Deferring it to an effect keeps it out of the initial bundle graph, and
 * memoizing the promise at module scope means the six demos share one request.
 */
let graph3DImport: Promise<unknown> | null = null;

type Graph3DStatus = 'loading' | 'ready' | 'failed';

/**
 * Tracks the subpath import: `'ready'` once `registerGraphRenderer(3, ...)` has
 * run, `'failed'` if the chunk never arrived.
 *
 * A rejected promise stays rejected forever, so the failure path drops the
 * module-scope memo: without that, one flaky chunk request would leave every
 * 3D demo on the page stuck on the placeholder for the rest of the session.
 * `retry()` re-runs the effect, which starts a fresh import.
 */
function useGraph3D(): { status: Graph3DStatus; retry: () => void } {
  const [status, setStatus] = useState<Graph3DStatus>('loading');
  const mounted = useRef(true);
  const load = useCallback(() => {
    setStatus('loading');
    const pending = (graph3DImport ??= import('@opendata-ai/openchart-react/graph-3d'));
    pending.then(
      () => {
        if (mounted.current) setStatus('ready');
      },
      (error: unknown) => {
        if (graph3DImport === pending) graph3DImport = null;
        console.error('3D graph renderer failed to load', error);
        if (mounted.current) setStatus('failed');
      },
    );
  }, []);
  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, [load]);
  return { status, retry: load };
}

/** Fills the box the graph will take, so nothing reflows when it swaps in. */
function Graph3DPlaceholder({
  failed = false,
  onRetry,
}: {
  failed?: boolean;
  onRetry?: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--gx-space-2)',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        color: 'var(--gx-text-muted)',
        fontSize: 'var(--gx-type-caption)',
      }}
    >
      {failed ? 'Could not load the WebGL renderer' : 'Loading WebGL renderer…'}
      {failed && onRetry ? (
        <button type="button" className="oc-spec-copy" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

/**
 * Holds a `dimensions: 3` graph back until the renderer is registered.
 *
 * Mount is synchronous, so `createGraph` throws if a 3D spec reaches it before
 * the subpath has registered.
 *
 * Only for graphs that are 3D for their whole life. A demo that toggles
 * dimensions calls `useGraph3D()` directly instead: wrapping just the 3D side
 * would change the element type at that position, and React would then unmount
 * the whole subtree (detaching the container before the vanilla instance's
 * `destroy()` runs) rather than swapping the instance inside a stable one.
 */
function Graph3DReady({ children }: { children: ReactNode }) {
  const { status, retry } = useGraph3D();
  if (status === 'ready') return <>{children}</>;
  return <Graph3DPlaceholder failed={status === 'failed'} onRetry={retry} />;
}

/**
 * `dimensions: 3` swaps the Canvas renderer for the WebGL one. The spec is
 * otherwise unchanged, and the whole handle (search, highlight, legend, camera,
 * update) behaves the same. three.js ships on its own subpath, so the
 * `Graph3DReady` gate above is what makes these mount.
 */
const basic3DSpec: GraphSpec = {
  ...basicSpec,
  dimensions: 3,
  chrome: {
    title: 'The Same Network, With Room to Breathe',
    subtitle: 'Drag to orbit, scroll to dolly; the spec is the 2D one plus dimensions: 3',
    source: ILLUSTRATIVE,
  },
};

const communities3DSpec: GraphSpec = {
  ...generateRandomGraph(120, 1.6, 5),
  dimensions: 3,
  encoding: { nodeColor: { field: 'community', type: 'nominal' } },
  layout: { type: 'force', clustering: { field: 'community' }, chargeStrength: -220, seed: 3 },
  chrome: {
    title: 'A Third Axis Keeps Communities Apart',
    subtitle: '120 nodes in 5 clusters; the cluster force works in x, y and z',
    source: ILLUSTRATIVE,
  },
};

// -- Seeded 3D: the full opendata /graph shape -------------------------------

const seededBase = generateRandomGraph(70, 1.5, 4);

const seededAdjacency = (() => {
  const map = new Map<string, string[]>();
  const push = (a: string, b: string) => {
    const list = map.get(a);
    if (list) list.push(b);
    else map.set(a, [b]);
  };
  for (const e of seededBase.edges) {
    push(e.source, e.target);
    push(e.target, e.source);
  }
  return map;
})();

/** Relatedness = 1 / (1 + hops from the seed), the shape the route encodes. */
function relatednessFrom(seedId: string): Map<string, number> {
  const depth = new Map<string, number>([[seedId, 0]]);
  const queue = [seedId];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    const d = depth.get(id) ?? 0;
    for (const next of seededAdjacency.get(id) ?? []) {
      if (depth.has(next)) continue;
      depth.set(next, d + 1);
      queue.push(next);
    }
  }
  const out = new Map<string, number>();
  for (const node of seededBase.nodes) {
    out.set(node.id, 1 / (1 + (depth.get(node.id) ?? 6)));
  }
  return out;
}

const SEED_ROTATION = ['n0', 'n11', 'n27', 'n44'];

function buildSeeded3DSpec(seedId: string): GraphSpec {
  const relatedness = relatednessFrom(seedId);
  return {
    type: 'graph',
    dimensions: 3,
    nodes: seededBase.nodes.map((n) => ({ ...n, relatedness: relatedness.get(n.id) ?? 0.15 })),
    edges: seededBase.edges,
    encoding: {
      nodeColor: { field: 'community', type: 'nominal' },
      nodeOpacity: { field: 'relatedness', type: 'quantitative' },
    },
    layout: {
      type: 'force',
      clustering: { field: 'community' },
      chargeStrength: -500,
      linkDistance: 100,
      linkStrength: 0.3,
      collisionPadding: 4,
      warmup: 30,
      seed: 7,
    },
    seedNode: seedId,
    nodeOverrides: { [seedId]: { fill: '#22c55e', radius: 10, alwaysShowLabel: true } },
    legend: false,
    interaction: { hover: { mode: 'neighbors' } },
    animation: { enter: { duration: 1000, stagger: true } },
    // A transparent background lets the page show through the WebGL canvas; an
    // explicit text color keeps the sprite labels readable in either theme.
    theme: { colors: { background: 'transparent', text: '#94a3b8' } },
    chrome: {
      title: 'Seeded Neighborhood in Three Dimensions',
      subtitle: 'Opacity is relatedness to the green seed; double-click a node to re-seed',
      source: ILLUSTRATIVE,
    },
  };
}

const seeded3DSpec = buildSeeded3DSpec(SEED_ROTATION[0]);

function Seeded3DGraph() {
  const {
    ref,
    getLegend,
    setActiveCategories,
    getActiveCategories,
    highlight,
    clearHighlight,
    search,
    clearSearch,
    selectNode,
  } = useGraph();
  const [rows, setRows] = useState<Array<{ label: string; color: string; count?: number }>>([]);
  const [active, setActive] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [seedId, setSeedId] = useState(SEED_ROTATION[0]);
  const [selected, setSelected] = useState<string | null>(null);

  // The legend model resolves only after the graph mounts, so poll frames
  // rather than guessing at one.
  useEffect(() => {
    let frame = 0;
    let id = 0;
    const read = () => {
      const legend = getLegend();
      if (legend) {
        setRows(legend.nodes);
        return;
      }
      if (++frame < 60) id = requestAnimationFrame(read);
    };
    id = requestAnimationFrame(read);
    return () => cancelAnimationFrame(id);
  }, [getLegend]);

  // Passing a new spec is the update path: <Graph> diffs it and calls
  // update() on the instance, so survivors keep their positions.
  const spec = useMemo(() => buildSeeded3DSpec(seedId), [seedId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gx-space-3)' }}>
      <div style={{ display: 'flex', gap: 'var(--gx-space-3)', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, height: 520 }}>
          <Graph3DReady>
            <Graph
              ref={ref}
              spec={spec}
              legend={false}
              onNodeClick={(node) => {
                const id = String(node.id);
                setSelected(id);
                selectNode(id);
              }}
              onNodeDoubleClick={(node) => setSeedId(String(node.id))}
            />
          </Graph3DReady>
        </div>
        <div
          style={{
            width: 200,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--gx-space-2)',
            padding: 'var(--gx-space-3)',
            border: '1px solid var(--gx-border)',
            borderRadius: 'var(--gx-radius-control)',
            background: 'var(--gx-surface-raised)',
          }}
        >
          <input
            type="text"
            value={query}
            placeholder="Search nodes"
            onChange={(e) => {
              const q = e.target.value;
              setQuery(q);
              if (q) search(q);
              else clearSearch();
            }}
            style={{
              padding: '6px 10px',
              border: '1px solid var(--gx-border)',
              borderRadius: 'var(--gx-radius-control)',
              background: 'var(--gx-surface)',
              color: 'var(--gx-text)',
              fontSize: 'var(--gx-type-caption)',
            }}
          />
          {rows.map((row) => (
            <button
              key={row.label}
              type="button"
              onClick={() => {
                const current = getActiveCategories();
                const next = current.includes(row.label)
                  ? current.filter((v) => v !== row.label)
                  : [...current, row.label];
                setActiveCategories(next);
                setActive(next);
              }}
              onMouseEnter={() => highlight({ category: { field: 'community', value: row.label } })}
              onMouseLeave={() => clearHighlight()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--gx-space-2)',
                padding: 'var(--gx-space-1) var(--gx-space-2)',
                border: '1px solid transparent',
                borderRadius: 'var(--gx-radius-control)',
                background: 'transparent',
                color: 'var(--gx-text)',
                fontSize: 'var(--gx-type-caption)',
                cursor: 'pointer',
                opacity: active.length === 0 || active.includes(row.label) ? 1 : 0.45,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: row.color,
                  flexShrink: 0,
                }}
              />
              <span>{row.label}</span>
            </button>
          ))}
          <button
            type="button"
            className="oc-spec-copy"
            onClick={() =>
              setSeedId(SEED_ROTATION[(SEED_ROTATION.indexOf(seedId) + 1) % SEED_ROTATION.length])
            }
          >
            Re-seed
          </button>
        </div>
      </div>
      <div style={{ fontSize: 'var(--gx-type-caption)', color: 'var(--gx-text-muted)' }}>
        Seed: <strong>{seedId}</strong>
        {selected ? ` · selected ${selected}` : ''}
      </div>
    </div>
  );
}

// -- Scale 3D: the node gate, exactly at the limit ---------------------------

const scale3DPanelSpec: GraphSpec = {
  ...generateScaleFreeGraph(MAX_3D_NODES),
  dimensions: 3,
};

function Scale3DGraph() {
  const [spec, setSpec] = useState<GraphSpec | null>(null);

  return (
    <div style={{ height: 600, position: 'relative' }}>
      {spec ? (
        <Graph3DReady>
          <Graph spec={spec} />
        </Graph3DReady>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--gx-space-3)',
            height: '100%',
            border: '1px dashed var(--gx-border)',
            borderRadius: 'var(--gx-radius-control)',
            background: 'var(--gx-surface-raised)',
            color: 'var(--gx-text-muted)',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: 'var(--gx-type-caption)' }}>
            {NODE_GATE} nodes, ~{MAX_3D_NODES * 2} edges — the 3D node ceiling
          </span>
          <button
            type="button"
            className="oc-spec-copy"
            onClick={() =>
              setSpec({
                ...generateScaleFreeGraph(MAX_3D_NODES),
                dimensions: 3,
                animation: false,
                chrome: {
                  title: 'Two Thousand Nodes on the Main Thread',
                  subtitle: 'The 3D gate: above this the spec warns and falls back to 2D',
                  source: ILLUSTRATIVE,
                },
              })
            }
          >
            Load the {NODE_GATE}-node graph
          </button>
          <span style={{ fontSize: 'var(--gx-type-caption)' }}>
            The 3D simulation runs on the main thread — nothing starts until you ask
          </span>
        </div>
      )}
    </div>
  );
}

// -- Over the gate: 3D asked for, 2D delivered -------------------------------

const overGate3DPanelSpec: GraphSpec = {
  ...generateScaleFreeGraph(MAX_3D_NODES + 1),
  dimensions: 3,
};

/**
 * One node past the ceiling. `compileGraph` resolves `numDimensions` to 2 and
 * warns, so what mounts is the Canvas renderer.
 *
 * The warning is surfaced by patching `console.warn`, not by a prop: `<Graph>`
 * has no `onWarn`, and the vanilla mount's default warn sink is `console.warn`.
 * The patch is installed before the click that mounts the graph and removed on
 * unmount, so it never outlives this demo.
 */
function OverGate3DGraph() {
  const [spec, setSpec] = useState<GraphSpec | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    const original = console.warn;
    console.warn = (...args: unknown[]) => {
      const text = args.map(String).join(' ');
      if (text.includes('dimensions: 3')) setWarnings((prev) => [...prev, text]);
      original(...args);
    };
    return () => {
      console.warn = original;
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gx-space-3)' }}>
      <div style={{ height: 520, position: 'relative' }}>
        {spec ? (
          // Deliberately NOT wrapped in Graph3DReady: this spec is over the
          // node gate, so compilation resolves it to 2D and the mount never
          // consults the 3D registry. Gating it would make the 2D fallback this
          // demo exists to show depend on the WebGL chunk loading.
          <Graph spec={spec} />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--gx-space-3)',
              height: '100%',
              border: '1px dashed var(--gx-border)',
              borderRadius: 'var(--gx-radius-control)',
              background: 'var(--gx-surface-raised)',
              color: 'var(--gx-text-muted)',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: 'var(--gx-type-caption)' }}>
              {(MAX_3D_NODES + 1).toLocaleString()} nodes with dimensions: 3 — one over the gate
            </span>
            <button
              type="button"
              className="oc-spec-copy"
              onClick={() =>
                setSpec({
                  ...generateScaleFreeGraph(MAX_3D_NODES + 1),
                  dimensions: 3,
                  animation: false,
                  chrome: {
                    title: 'Asked for 3D, Rendered in 2D',
                    subtitle: `One node past MAX_3D_NODES (${NODE_GATE}); the spec warns and falls back`,
                    source: ILLUSTRATIVE,
                  },
                })
              }
            >
              Load the over-gate graph
            </button>
          </div>
        )}
      </div>
      {warnings.length > 0 && (
        <pre
          style={{
            margin: 0,
            padding: 'var(--gx-space-3)',
            border: '1px solid var(--gx-border)',
            borderRadius: 'var(--gx-radius-control)',
            background: 'var(--gx-surface-raised)',
            color: 'var(--gx-text-muted)',
            fontSize: 'var(--gx-type-caption)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {warnings.join('\n')}
        </pre>
      )}
    </div>
  );
}

// -- 2D / 3D toggle: the wrapper remount -------------------------------------

const toggleBase = generateRandomGraph(90, 1.7, 4);

function buildToggleSpec(dimensions: 2 | 3): GraphSpec {
  return {
    type: 'graph',
    dimensions,
    nodes: toggleBase.nodes,
    edges: toggleBase.edges,
    encoding: { nodeColor: { field: 'community', type: 'nominal' } },
    layout: { type: 'force', clustering: { field: 'community' }, chargeStrength: -260, seed: 11 },
    animation: { enter: { duration: 1000, stagger: true } },
    chrome: {
      title: dimensions === 3 ? 'The Same Graph, Three Axes' : 'The Same Graph, Two Axes',
      subtitle: 'Only `dimensions` changes; every other field is identical',
      source: ILLUSTRATIVE,
    },
  };
}

/**
 * A dimension change is a remount, never an `update()`: the two renderers own
 * different surfaces and vanilla's `update()` has no path back through the
 * shell. The wrappers put `spec.dimensions` in their mount key, so flipping it
 * tears the instance down and builds the other renderer — which is why both
 * sides play their entrance rather than cross-fading.
 */
function Toggle2D3DGraph() {
  const [dimensions, setDimensions] = useState<2 | 3>(2);
  const spec = useMemo(() => buildToggleSpec(dimensions), [dimensions]);
  // Kicks the subpath import off on mount, so the 3D side is usually already
  // registered by the time the button is pressed.
  const { status: status3D, retry: retry3D } = useGraph3D();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gx-space-3)' }}>
      <div>
        <button
          type="button"
          className="oc-spec-copy"
          onClick={() => setDimensions((d) => (d === 2 ? 3 : 2))}
        >
          Switch to {dimensions === 2 ? '3D' : '2D'}
        </button>
      </div>
      <div style={{ height: 520 }}>
        {dimensions === 3 && status3D !== 'ready' ? (
          <Graph3DPlaceholder failed={status3D === 'failed'} onRetry={retry3D} />
        ) : (
          <Graph spec={spec} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default { title: 'Graphs' };

// ---------------------------------------------------------------------------
// 19. Update transitions in 3D — the same choreography, in WebGL
// ---------------------------------------------------------------------------

/** Hub-and-ring graph over a sliding window of node ids. */
function build3DUpdateSpec(count: number, offset: number): GraphSpec {
  const ids = Array.from({ length: count }, (_, i) => `s${offset + i}`);
  return {
    type: 'graph',
    dimensions: 3,
    nodes: [
      { id: 'hub', label: 'Hub', community: 'core' },
      ...ids.map((id, i) => ({ id, label: `Node ${offset + i + 1}`, community: 'ring' })),
    ],
    edges: [
      ...ids.map((id) => ({ source: 'hub', target: id })),
      ...ids.map((id, i) => ({ source: id, target: ids[(i + 1) % ids.length] })),
    ],
    encoding: { nodeColor: { field: 'community', type: 'nominal' } },
    layout: { type: 'force', seed: 5 },
    chrome: {
      title: 'The Layout Tweens in Three Dimensions Too',
      subtitle: 'update() reheats locally: survivors drift, enterers slide in, leavers ghost out',
      source: ILLUSTRATIVE,
    },
  };
}

const update3DSpec = build3DUpdateSpec(8, 0);

/**
 * The 2D update demo against the WebGL renderer, plus the re-seed case that
 * motivated it: swapping half the node set at once is what loading a different
 * subgraph does, and it is the change most likely to read as a snap.
 */
function Update3DGraph() {
  const [count, setCount] = useState(8);
  const [offset, setOffset] = useState(0);
  const spec = useMemo(() => build3DUpdateSpec(count, offset), [count, offset]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gx-space-3)' }}>
      <div style={{ height: 480 }} data-testid="update-3d-surface">
        <Graph3DReady>
          <Graph spec={spec} />
        </Graph3DReady>
      </div>
      <div style={{ display: 'flex', gap: 'var(--gx-space-2)', alignItems: 'center' }}>
        <button
          type="button"
          className="oc-spec-copy"
          onClick={() => setCount((n) => Math.min(n + 2, 18))}
        >
          Add nodes
        </button>
        <button
          type="button"
          className="oc-spec-copy"
          onClick={() => setCount((n) => Math.max(n - 2, 4))}
        >
          Remove nodes
        </button>
        <button
          type="button"
          className="oc-spec-copy"
          onClick={() => setOffset((o) => o + Math.floor(count / 2))}
        >
          Re-seed neighborhood
        </button>
        <span style={{ fontSize: 'var(--gx-type-caption)', color: 'var(--gx-text-muted)' }}>
          {count + 1} nodes
        </span>
      </div>
    </div>
  );
}

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

    <Section
      id="motion-and-api"
      title="Motion & API"
      lede="Graphs animate on load and expose a full imperative API: fly the camera, emphasize a set, and evolve the data without a reset. Motion is on by default and respects prefers-reduced-motion."
    >
      <Demo
        id="choreography"
        title="Entrance & camera choreography"
        description="The camera starts pulled back and flies to fit while nodes stagger in. Press replay to remount and watch it again."
        specForPanel={choreographySpec}
        height={560}
      >
        <ChoreographyGraph />
      </Demo>
      <Demo
        id="camera"
        title="Camera API (pan & zoom)"
        description="zoomToNode, flyTo, and centerAt animate the viewport from code; drag and scroll-zoom drive the same camera, and onCameraChange feeds the live readout below."
        specForPanel={cameraSpec}
        height={560}
      >
        <CameraGraph />
      </Demo>
      <Demo
        id="legend"
        title="Interactive legend"
        description="The built-in legend is interactive by default: click a category to isolate it. onLegendToggle reports the active set."
        specForPanel={legendSpec}
        height={560}
      >
        <LegendGraph />
      </Demo>
      <Demo
        id="host-legend"
        title="Host-driven legend + seed node"
        description="legend: false hands the legend model to your own sidebar via getLegend(). Clicks set the sticky filter with setActiveCategories(); hovers layer a transient highlight() inside it, and releasing returns to the filtered view. seedNode: 'n0' stays lit through both while its neighbors dim."
        specForPanel={hostLegendSpec}
        height={560}
      >
        <HostLegendGraph />
      </Demo>
      <Demo
        id="highlight"
        title="Highlight API"
        description="highlight() eases a focus crossfade over a category or a node's neighborhood — no recompile. It layers over any standing category filter; clearHighlight() drops the transient layer and returns to that filter."
        specForPanel={highlightSpec}
        height={560}
      >
        <HighlightGraph />
      </Demo>
      <Demo
        id="seeded"
        title="Seeded layout (deterministic)"
        description="layout.seed pins start positions so the same spec settles to the same shape every time. Both panels here render identically."
        specForPanel={seededSpec}
      >
        <SeededGraph />
      </Demo>
      <Demo
        id="update"
        title="Update transitions (add / remove nodes)"
        description="update() diffs the spec: surviving nodes keep their positions, new nodes fade in, removed nodes ghost out — no camera reset."
        height={560}
      >
        <UpdateGraph />
      </Demo>
      <Demo
        id="cursor-repulsion"
        title="Cursor repulsion"
        description="Opt-in cursorRepulsion pushes nodes away from the pointer; springyDrag adds weight to node drags. Move the pointer over the graph."
        spec={cursorSpec}
        height={480}
      />
    </Section>

    <Section
      id="three-dimensions"
      title="3D"
      lede="dimensions: 3 renders the same spec with WebGL. Communities that a flat projection stacks on top of one another get room to separate, and the whole handle — search, legend filter, highlight, camera, update — behaves as it does in 2D. three.js loads from its own subpath, so 2D bundles never pay for it."
    >
      <Demo
        id="basic-3d"
        title="A force layout in three dimensions"
        description="The Basics spec with one field added. Drag to orbit, scroll to dolly; labels appear for the nodes nearest the camera."
        specForPanel={basic3DSpec}
        height={520}
      >
        <Graph3DReady>
          <Graph spec={basic3DSpec} />
        </Graph3DReady>
      </Demo>
      <Demo
        id="communities-3d"
        title="Community clusters in 3D"
        description="The cluster force pulls each community toward its own centroid in x, y and z, so groups that overlap in a flat projection separate along depth."
        specForPanel={communities3DSpec}
        height={520}
      >
        <Graph3DReady>
          <Graph spec={communities3DSpec} />
        </Graph3DReady>
      </Demo>
      <Demo
        id="seeded-3d"
        title="Seeded neighborhood + host legend"
        description="The full imperative surface against the WebGL renderer: nodeOpacity encodes relatedness to the green seed, the legend is the host's own via getLegend()/setActiveCategories()/highlight(), the search box drives search(), and Re-seed (or a double-click on any node) calls update() — survivors keep their positions while the new neighborhood settles."
        specForPanel={seeded3DSpec}
        height={600}
      >
        <Seeded3DGraph />
      </Demo>
      <Demo
        id="scale-3d"
        title={`Scale: ${NODE_GATE} nodes (click to load)`}
        description={`The 3D simulation runs on the main thread, so the renderer caps at ${NODE_GATE} nodes; above that a spec warns and renders in 2D. The ceiling is measured, not guessed: on the reference GPU an idle 3,000-node scene held 22-27fps against a 30fps floor while ${NODE_GATE} held 38-44fps. Mounted only on click, with animation off.`}
        specForPanel={scale3DPanelSpec}
        generatorSnippet={`import { generateScaleFreeGraph } from './graphs/helpers';\n\nconst spec = { ...generateScaleFreeGraph(${MAX_3D_NODES}), dimensions: 3, animation: false };\n\n// <Graph spec={spec} />`}
        height={680}
      >
        <Scale3DGraph />
      </Demo>
      <Demo
        id="over-gate-3d"
        title="Over the gate: 3D falls back to 2D"
        description={`One node past the ceiling. compileGraph resolves numDimensions to 2 and warns, so the Canvas renderer mounts instead — no WebGL context, no three.js scene. <Graph> has no onWarn prop, so the demo patches console.warn (the vanilla mount's default warn sink) while it is on screen and prints what it caught below the graph.`}
        specForPanel={overGate3DPanelSpec}
        generatorSnippet={`import { generateScaleFreeGraph } from './graphs/helpers';\n\n// MAX_3D_NODES is ${MAX_3D_NODES}; one more falls back to 2D with a warning.\nconst spec = { ...generateScaleFreeGraph(${MAX_3D_NODES + 1}), dimensions: 3, animation: false };\n\n// <Graph spec={spec} />`}
        height={720}
      >
        <OverGate3DGraph />
      </Demo>
      <Demo
        id="update-3d"
        title="Update transitions in 3D"
        description="The same diff as the 2D demo, against WebGL: no synchronous warmup, the center force is suspended for the cooldown and the reheat is scaled by how much actually changed. Re-seed swaps half the node set at once — the opendata case — and it still settles rather than snapping."
        specForPanel={update3DSpec}
        height={640}
      >
        <Update3DGraph />
      </Demo>
      <Demo
        id="toggle-2d-3d"
        title="Switching dimensions"
        description="One spec, one button, two renderers. A dimension change is a remount rather than an update(): the framework wrappers carry spec.dimensions in their mount key, so the old instance is destroyed (releasing its WebGL context) and the new one plays its own entrance."
        specForPanel={buildToggleSpec(3)}
        height={640}
      >
        <Toggle2D3DGraph />
      </Demo>
    </Section>
  </GalleryPage>
);
