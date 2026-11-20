/**
 * Small networks for the graph page, taken from the Ladle graphs gallery,
 * which marks all of them as illustrative: a code-review network of twelve
 * engineers in three teams, a research knowledge graph, and the Lexington
 * Avenue subway line with stations sized by weekday ridership.
 */
import type { GraphEdge, GraphNode } from "@opendata-ai/openchart-core";

/** The gallery's own source line for every network on this page. */
export const ILLUSTRATIVE = "Illustrative data";

/** Reviews inside each team, keyed by team. The gallery groups the pairs the same way. */
const REVIEW_PAIRS_BY_TEAM: Record<string, Array<[string, string]>> = {
  Platform: [
    ["Ava", "Liam"],
    ["Liam", "Mia"],
    ["Mia", "Ava"],
    ["Noah", "Ava"],
    ["Noah", "Liam"],
  ],
  Web: [
    ["Zoe", "Ethan"],
    ["Ethan", "Chloe"],
    ["Chloe", "Zoe"],
    ["Leo", "Chloe"],
    ["Leo", "Ethan"],
  ],
  Data: [
    ["Isla", "Owen"],
    ["Owen", "Nora"],
    ["Nora", "Isla"],
    ["Kai", "Nora"],
    ["Kai", "Owen"],
  ],
};

/** Reviews across teams, which tie the three clusters together. */
const CROSS_TEAM_REVIEWS: Array<[string, string]> = [
  ["Mia", "Zoe"],
  ["Chloe", "Isla"],
  ["Owen", "Ava"],
  ["Leo", "Kai"],
  ["Noah", "Isla"],
];

/** Twelve engineers, each with a `label` and a `team`. */
export const reviewNodes: GraphNode[] = Object.entries(REVIEW_PAIRS_BY_TEAM).flatMap(
  ([team, pairs]) => [...new Set(pairs.flat())].map((name) => ({ id: name, label: name, team })),
);

/** One edge per review, within and across teams. */
export const reviewEdges: GraphEdge[] = [
  ...Object.values(REVIEW_PAIRS_BY_TEAM).flat(),
  ...CROSS_TEAM_REVIEWS,
].map(([source, target]) => ({ source, target }));

/** Labs, researchers, projects and datasets, with a `kind` and a `citations` count. */
export const knowledgeNodes: GraphNode[] = [
  { id: "lab-vision", label: "Vision Lab", citations: 92, kind: "Lab" },
  { id: "lab-language", label: "Language Lab", citations: 88, kind: "Lab" },
  { id: "lab-robotics", label: "Robotics Lab", citations: 61, kind: "Lab" },
  { id: "p-chen", label: "Wei Chen", citations: 74, kind: "Researcher" },
  { id: "p-okafor", label: "Ada Okafor", citations: 68, kind: "Researcher" },
  { id: "p-silva", label: "Marco Silva", citations: 55, kind: "Researcher" },
  { id: "p-hoffman", label: "Ruth Hoffman", citations: 49, kind: "Researcher" },
  { id: "p-nakamura", label: "Yuki Nakamura", citations: 44, kind: "Researcher" },
  { id: "p-bello", label: "Ines Bello", citations: 38, kind: "Researcher" },
  { id: "p-dubois", label: "Luc Dubois", citations: 33, kind: "Researcher" },
  { id: "p-ferrari", label: "Gia Ferrari", citations: 27, kind: "Researcher" },
  { id: "proj-atlas", label: "Atlas", citations: 80, kind: "Project" },
  { id: "proj-lumen", label: "Lumen", citations: 66, kind: "Project" },
  { id: "proj-harbor", label: "Harbor", citations: 52, kind: "Project" },
  { id: "proj-cobalt", label: "Cobalt", citations: 41, kind: "Project" },
  { id: "proj-tessera", label: "Tessera", citations: 29, kind: "Project" },
  { id: "ds-imagenet", label: "ImageNet", citations: 96, kind: "Dataset" },
  { id: "ds-commoncrawl", label: "Common Crawl", citations: 84, kind: "Dataset" },
  { id: "ds-openstreet", label: "OpenStreetMap", citations: 58, kind: "Dataset" },
  { id: "ds-census", label: "US Census", citations: 47, kind: "Dataset" },
  { id: "ds-arxiv", label: "arXiv", citations: 39, kind: "Dataset" },
];

/** [source, target, confidence]: affiliation, funding, contribution and dataset use. */
const KNOWLEDGE_LINKS: Array<[string, string, number]> = [
  ["p-chen", "lab-vision", 0.98],
  ["p-okafor", "lab-language", 0.96],
  ["p-silva", "lab-robotics", 0.95],
  ["p-hoffman", "lab-vision", 0.93],
  ["p-nakamura", "lab-language", 0.91],
  ["p-bello", "lab-robotics", 0.88],
  ["p-dubois", "lab-vision", 0.72],
  ["p-ferrari", "lab-language", 0.64],
  ["lab-vision", "proj-atlas", 0.9],
  ["lab-vision", "proj-cobalt", 0.61],
  ["lab-language", "proj-lumen", 0.87],
  ["lab-language", "proj-tessera", 0.55],
  ["lab-robotics", "proj-harbor", 0.83],
  ["lab-robotics", "proj-cobalt", 0.48],
  ["p-chen", "proj-atlas", 0.86],
  ["p-hoffman", "proj-atlas", 0.7],
  ["p-okafor", "proj-lumen", 0.82],
  ["p-nakamura", "proj-lumen", 0.59],
  ["p-silva", "proj-harbor", 0.78],
  ["p-bello", "proj-harbor", 0.51],
  ["p-dubois", "proj-cobalt", 0.43],
  ["p-ferrari", "proj-tessera", 0.37],
  ["proj-atlas", "ds-imagenet", 0.94],
  ["proj-atlas", "ds-openstreet", 0.46],
  ["proj-lumen", "ds-commoncrawl", 0.92],
  ["proj-lumen", "ds-arxiv", 0.68],
  ["proj-harbor", "ds-openstreet", 0.81],
  ["proj-harbor", "ds-census", 0.57],
  ["proj-cobalt", "ds-imagenet", 0.65],
  ["proj-cobalt", "ds-census", 0.4],
  ["proj-tessera", "ds-arxiv", 0.53],
  ["proj-tessera", "ds-commoncrawl", 0.35],
];

/** Edges with a `confidence` from 0 to 1. */
export const knowledgeEdges: GraphEdge[] = KNOWLEDGE_LINKS.map(([source, target, confidence]) => ({
  source,
  target,
  confidence,
}));

/** Lexington Avenue stations south to north, with weekday ridership and express service. */
export const lexStations: GraphNode[] = [
  { id: "brooklyn-bridge", label: "Brooklyn Bridge", ridership: 21000, express: true },
  { id: "canal", label: "Canal St", ridership: 12000, express: false },
  { id: "spring", label: "Spring St", ridership: 8000, express: false },
  { id: "bleecker", label: "Bleecker St", ridership: 14000, express: false },
  { id: "astor", label: "Astor Pl", ridership: 11000, express: false },
  { id: "union-square", label: "14 St-Union Sq", ridership: 45000, express: true },
  { id: "23rd", label: "23 St", ridership: 13000, express: false },
  { id: "28th", label: "28 St", ridership: 9000, express: false },
  { id: "33rd", label: "33 St", ridership: 16000, express: false },
  { id: "grand-central", label: "Grand Central", ridership: 42000, express: true },
  { id: "51st", label: "51 St", ridership: 18000, express: false },
  { id: "59th", label: "59 St", ridership: 27000, express: true },
  { id: "68th", label: "68 St-Hunter", ridership: 15000, express: false },
  { id: "77th", label: "77 St", ridership: 10000, express: false },
  { id: "86th", label: "86 St", ridership: 24000, express: true },
];

/** Consecutive pairs of a list: [a, b, c] gives [a, b] and [b, c]. */
function consecutive<T>(items: T[]): Array<[T, T]> {
  return items.slice(1).map((item, index) => [items[index] as T, item]);
}

const expressStops = lexStations.filter((station) => station.express === true);

/** Local service links every station in order; express service links the express stops. */
export const lexEdges: GraphEdge[] = [
  ...consecutive(lexStations).map(([from, to]) => ({
    source: from.id,
    target: to.id,
    service: "Local",
  })),
  ...consecutive(expressStops).map(([from, to]) => ({
    source: from.id,
    target: to.id,
    service: "Express",
  })),
];
