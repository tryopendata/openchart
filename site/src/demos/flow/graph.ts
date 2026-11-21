/**
 * Demos for the graph page (docs/flow/graph). Specs follow the Ladle graphs
 * gallery and docs/graphs.md, on the small illustrative networks in
 * networks.ts. Every force layout sets `layout.seed`, so the graph settles into
 * the same shape on every visit. Graphs draw on a canvas and have no static
 * SVG, so each figure reserves its height until the page's script mounts it.
 */
import { defineDemo } from "../types";
import {
  ILLUSTRATIVE,
  knowledgeEdges,
  knowledgeNodes,
  lexEdges,
  lexStations,
  reviewEdges,
  reviewNodes,
} from "./networks";

const label = { field: "label" } as const;

export const basicGraph = defineDemo({
  id: "flow/graph-basic",
  title: "A code-review network",
  source: { label: ILLUSTRATIVE },
  height: 420,
  spec: {
    type: "graph",
    nodes: reviewNodes,
    edges: reviewEdges,
    encoding: { nodeLabel: label },
    layout: { type: "force", chargeStrength: -120, linkDistance: 40, seed: 7 },
    chrome: {
      title: "Twelve engineers and who reviewed whose code",
      subtitle: "An edge means one engineer reviewed the other's pull request",
    },
  },
});

export const clusteredGraph = defineDemo({
  id: "flow/graph-clusters",
  title: "The code-review network grouped by team",
  source: { label: ILLUSTRATIVE },
  height: 420,
  spec: {
    type: "graph",
    nodes: reviewNodes,
    edges: reviewEdges,
    encoding: { nodeColor: { field: "team", type: "nominal" }, nodeLabel: label },
    layout: {
      type: "force",
      clustering: { field: "team" },
      chargeStrength: -120,
      linkDistance: 40,
      seed: 7,
    },
    chrome: {
      title: "Three teams of four, linked by five cross-team reviews",
      subtitle: "Colored and clustered by team",
    },
  },
});

export const encodedGraph = defineDemo({
  id: "flow/graph-encoded",
  title: "A research knowledge graph",
  source: { label: ILLUSTRATIVE },
  height: 460,
  spec: {
    type: "graph",
    nodes: knowledgeNodes,
    edges: knowledgeEdges,
    encoding: {
      nodeSize: { field: "citations" },
      nodeColor: { field: "kind" },
      nodeLabel: label,
      edgeWidth: { field: "confidence" },
    },
    layout: { type: "force", chargeStrength: -150, linkDistance: 35, seed: 3 },
    chrome: {
      title: "Labs fund projects, and projects use datasets",
      subtitle: "Size is citations, color is the kind of entity, edge width is link confidence",
    },
  },
});

export const transitGraph = defineDemo({
  id: "flow/graph-transit",
  title: "The Lexington Avenue line as a graph",
  source: { label: ILLUSTRATIVE },
  height: 460,
  spec: {
    type: "graph",
    nodes: lexStations,
    edges: lexEdges,
    encoding: {
      nodeSize: { field: "ridership" },
      nodeLabel: label,
      edgeStyle: { field: "service", type: "nominal" },
    },
    seedNode: "grand-central",
    layout: { type: "force", chargeStrength: -100, linkDistance: 50, seed: 5 },
    chrome: {
      title: "Express service skips ten of the fifteen stations",
      subtitle: "Stations sized by weekday ridership; Grand Central is the seed node",
    },
  },
});
