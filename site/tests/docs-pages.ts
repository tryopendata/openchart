/**
 * The phase 4 docs pages: Guides, Building blocks and Reference, by section in
 * sidebar order, with the lane that wrote each one and the demo figures it
 * must carry. The build and browser tests read this list,
 * so a page missing from the build fails by name. `catalogReference` names the
 * reference page every Visualizations page must link to.
 */
import type { SectionId } from "../src/config";
import { catalogPages } from "./catalog-pages";

/** The build lanes of phase 4. */
export type Lane = "a" | "b" | "c" | "d" | "e";

/** One page: its URL slug inside the section, its title (the h1), its demo minimum and its lane. */
export type DocsPageEntry = { slug: string; title: string; minDemos: number; lane: Lane };

export const docsPages = {
  "get-started": [
    { slug: "introduction", title: "Introduction", minDemos: 2, lane: "c" },
    { slug: "getting-started", title: "Getting started", minDemos: 1, lane: "c" },
    { slug: "frameworks", title: "Frameworks", minDemos: 1, lane: "c" },
    { slug: "static-rendering", title: "Static rendering", minDemos: 1, lane: "c" },
    { slug: "bundle-size", title: "Bundle size", minDemos: 0, lane: "c" },
  ],
  agents: [
    { slug: "generating-specs", title: "Generating specs", minDemos: 0, lane: "c" },
    { slug: "agent-patterns", title: "Agent patterns", minDemos: 1, lane: "c" },
  ],
  recipes: [
    { slug: "dashboards", title: "Dashboards", minDemos: 1, lane: "c" },
    { slug: "ranking-and-change", title: "Ranking and change", minDemos: 1, lane: "c" },
  ],
  upgrading: [
    { slug: "migrating-v9", title: "Migrating to v9", minDemos: 0, lane: "c" },
    { slug: "migrating-v8", title: "Migrating to v8", minDemos: 0, lane: "c" },
  ],
  "the-spec": [
    { slug: "anatomy", title: "Anatomy of a spec", minDemos: 4, lane: "a" },
    { slug: "encoding", title: "Encoding channels", minDemos: 4, lane: "a" },
    { slug: "scales", title: "Field types and scales", minDemos: 4, lane: "a" },
    { slug: "axes", title: "Axes", minDemos: 3, lane: "a" },
    { slug: "transforms", title: "Transforms", minDemos: 3, lane: "a" },
  ],
  framing: [
    { slug: "chrome", title: "Title, subtitle and source", minDemos: 3, lane: "a" },
    { slug: "annotations", title: "Annotations", minDemos: 4, lane: "a" },
    { slug: "labels-legends", title: "Labels and legends", minDemos: 3, lane: "a" },
    { slug: "endpoint-labels", title: "Endpoint labels", minDemos: 3, lane: "a" },
  ],
  style: [
    { slug: "theming", title: "Theming and tokens", minDemos: 3, lane: "d" },
    { slug: "presets", title: "Presets", minDemos: 4, lane: "d" },
    { slug: "dark-mode", title: "Dark mode", minDemos: 2, lane: "d" },
    { slug: "color", title: "Color palettes", minDemos: 4, lane: "d" },
  ],
  behavior: [
    { slug: "motion", title: "Motion", minDemos: 3, lane: "b" },
    { slug: "responsive", title: "Responsive", minDemos: 3, lane: "d" },
    { slug: "interaction", title: "Interaction and events", minDemos: 3, lane: "b" },
    { slug: "edit-mode", title: "Edit mode", minDemos: 2, lane: "b" },
    { slug: "scrollytelling", title: "Scrollytelling", minDemos: 2, lane: "b" },
    { slug: "you-draw-it", title: "You draw it", minDemos: 2, lane: "d" },
  ],
  output: [
    { slug: "accessibility", title: "Accessibility", minDemos: 2, lane: "d" },
    { slug: "export", title: "Export", minDemos: 2, lane: "b" },
    { slug: "canvas", title: "Canvas mode", minDemos: 2, lane: "d" },
  ],
  spec: [
    { slug: "overview", title: "Spec reference", minDemos: 0, lane: "e" },
    { slug: "chart-spec", title: "ChartSpec", minDemos: 0, lane: "e" },
    { slug: "layer-spec", title: "LayerSpec", minDemos: 0, lane: "e" },
    { slug: "encoding", title: "Encoding", minDemos: 0, lane: "e" },
    { slug: "marks", title: "Marks", minDemos: 0, lane: "e" },
    { slug: "chrome", title: "Chrome, labels and legends", minDemos: 0, lane: "e" },
    { slug: "transforms", title: "Transforms", minDemos: 0, lane: "e" },
    { slug: "annotations", title: "Annotations", minDemos: 0, lane: "e" },
    { slug: "animation", title: "Animation", minDemos: 0, lane: "e" },
    { slug: "theme", title: "Theme", minDemos: 0, lane: "e" },
    { slug: "table-spec", title: "TableSpec", minDemos: 0, lane: "e" },
    { slug: "graph-spec", title: "GraphSpec", minDemos: 0, lane: "e" },
    { slug: "sankey-spec", title: "SankeySpec", minDemos: 0, lane: "e" },
    { slug: "tilemap-spec", title: "TileMapSpec", minDemos: 0, lane: "e" },
    { slug: "geomap-spec", title: "GeoMapSpec", minDemos: 0, lane: "e" },
    { slug: "barlist-spec", title: "BarListSpec", minDemos: 0, lane: "e" },
    { slug: "authoring", title: "Authoring and reader APIs", minDemos: 0, lane: "e" },
  ],
  api: [
    { slug: "vanilla", title: "Vanilla API", minDemos: 0, lane: "e" },
    { slug: "react", title: "React", minDemos: 0, lane: "e" },
    { slug: "vue", title: "Vue", minDemos: 0, lane: "e" },
    { slug: "svelte", title: "Svelte", minDemos: 0, lane: "e" },
    { slug: "events", title: "Events", minDemos: 0, lane: "e" },
    { slug: "export", title: "Export API", minDemos: 0, lane: "e" },
    { slug: "table-state", title: "Table state", minDemos: 0, lane: "e" },
  ],
  tokens: [
    { slug: "theming-tokens", title: "Theming tokens", minDemos: 0, lane: "e" },
    { slug: "design-system", title: "Design system", minDemos: 0, lane: "e" },
  ],
  "machine-readable": [
    { slug: "json-schema", title: "JSON Schema and llms.txt", minDemos: 0, lane: "e" },
  ],
} as const satisfies Partial<Record<SectionId, readonly DocsPageEntry[]>>;

/** A manifest page with its page id ("<section>/<slug>") and section. */
export type DocsPage = DocsPageEntry & { id: string; section: keyof typeof docsPages };

/** Every manifest page, in section and sidebar order. */
export const docsPageList: DocsPage[] = Object.entries(docsPages).flatMap(([section, pages]) =>
  pages.map((page: DocsPageEntry) => ({
    ...page,
    id: `${section}/${page.slug}`,
    section: section as keyof typeof docsPages,
  })),
);

/** Every manifest page id, "<section>/<slug>". */
export const docsPageIds: string[] = docsPageList.map(({ id }) => id);

type CatalogSection = keyof typeof catalogPages;
type CatalogPageId = {
  [Section in CatalogSection]: `${Section}/${(typeof catalogPages)[Section][number]}`;
}[CatalogSection];

/** The reference page each section's catalog pages link to, before the exceptions below. */
const REFERENCE_BY_SECTION: Record<CatalogSection, string> = {
  comparison: "spec/marks",
  "change-over-time": "spec/marks",
  "part-to-whole": "spec/marks",
  distribution: "spec/marks",
  correlation: "spec/encoding",
  flow: "spec/sankey-spec",
  maps: "spec/geomap-spec",
  tables: "spec/table-spec",
  composition: "spec/layer-spec",
};

/** Catalog pages whose reference page differs from their section's. */
const REFERENCE_EXCEPTIONS: Partial<Record<CatalogPageId, string>> = {
  "comparison/bar-list": "spec/barlist-spec",
  "change-over-time/race": "output/export",
  "distribution/histogram": "spec/transforms",
  "distribution/density": "spec/transforms",
  "correlation/trendlines": "spec/layer-spec",
  "flow/graph": "spec/graph-spec",
  "maps/tile-map": "spec/tilemap-spec",
  "composition/facets": "spec/encoding",
  "composition/dashboard-tiles": "recipes/dashboards",
};

/** Each Visualizations page id to the page id it must link to for its fields. */
export const catalogReference: Readonly<Record<CatalogPageId, string>> = Object.fromEntries(
  Object.entries(catalogPages).flatMap(([section, slugs]) =>
    slugs.map((slug) => {
      const id = `${section}/${slug}` as CatalogPageId;
      return [id, REFERENCE_EXCEPTIONS[id] ?? REFERENCE_BY_SECTION[section as CatalogSection]];
    }),
  ),
) as Record<CatalogPageId, string>;
