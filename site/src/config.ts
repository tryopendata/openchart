import type { DocsArea } from "./lib/docs-types";

// Public product metadata. Every landing section reads from here; a section whose
// value is empty (null or an empty list) doesn't render.

export type Link = { label: string; href: string };
export type InstallOption = { label: string; command: string };
export type Feature = { title: string; body: string };
export type Logo = { name: string; href: string; logo: string };
export type DemoLine = { prompt?: boolean; text: string };

const repo = "https://github.com/tryopendata/openchart";

export const site = {
  name: "OpenChart",
  tagline: "Charts, tables and maps from a JSON spec.",
  description:
    "OpenChart renders editorial-quality charts, tables, graphs and maps from a declarative spec, with wrappers for React, Vue and Svelte.",
  /** Absolute production URL: canonicals, the sitemap, OG images and llms.txt use it. */
  url: "https://openchart.steamfield.io",
  repo,
  /** Current release, shown in the header. Empty hides it. */
  version: "9.0.0",
  announcement: null as Link | null,
  install: [
    { label: "npm", command: "npm install @opendata-ai/openchart-react" },
    { label: "bun", command: "bun add @opendata-ai/openchart-react" },
    { label: "pnpm", command: "pnpm add @opendata-ai/openchart-react" },
  ] as InstallOption[],
  demo: {
    title: "A bar chart from a spec",
    lines: [
      { prompt: true, text: "npm install @opendata-ai/openchart-react" },
      { text: '<Chart spec={{ mark: "bar", data, encoding: { x: ..., y: ... } }} />' },
    ] as DemoLine[],
  },
  features: [] as Feature[],
  usedBy: [] as Logo[],
  sponsors: { href: `${repo}/sponsors`, logos: [] as Logo[] },
  social: [{ label: "GitHub", href: repo }] as Link[],
  /** Header links after Docs. An entry renders only once its page exists. */
  nav: [] as Link[],
  /** Footer link columns. */
  footer: [
    {
      title: "Docs",
      links: [
        { label: "Getting started", href: "/docs/get-started/getting-started/" },
        { label: "llms.txt", href: "/llms.txt" },
      ],
    },
    {
      title: "Project",
      links: [
        { label: "GitHub", href: repo },
        { label: "Releases", href: `${repo}/releases` },
      ],
    },
  ] as { title: string; links: Link[] }[],
  releasesUrl: `${repo}/releases`,
  license: "MIT",
  /** Components that hydrate on the landing page. The build test fails on any other island. */
  islands: ["InstallTabs"],
};

/** The docs areas and their sidebar sections, in display order. A page's `section` frontmatter must be one of these section ids. */
export const docsAreas = [
  {
    id: "guides",
    label: "Guides",
    sections: [
      { id: "get-started", label: "Get started" },
      { id: "agents", label: "Working with agents" },
      { id: "recipes", label: "Recipes" },
      { id: "upgrading", label: "Upgrading" },
    ],
  },
  {
    id: "visualizations",
    label: "Visualizations",
    sections: [
      { id: "comparison", label: "Comparison" },
      { id: "change-over-time", label: "Change over time" },
      { id: "part-to-whole", label: "Part to whole" },
      { id: "distribution", label: "Distribution" },
      { id: "correlation", label: "Correlation" },
      { id: "flow", label: "Flow and networks" },
      { id: "maps", label: "Maps" },
      { id: "tables", label: "Tables" },
      { id: "composition", label: "Composition" },
    ],
  },
  {
    id: "building-blocks",
    label: "Building blocks",
    sections: [
      { id: "the-spec", label: "The spec" },
      { id: "framing", label: "Framing" },
      { id: "style", label: "Style" },
      { id: "behavior", label: "Behavior" },
      { id: "output", label: "Output" },
    ],
  },
  {
    id: "reference",
    label: "Reference",
    sections: [
      { id: "spec", label: "Spec" },
      { id: "api", label: "API" },
      { id: "tokens", label: "Tokens" },
      { id: "machine-readable", label: "JSON Schema and llms.txt" },
    ],
  },
] as const satisfies readonly DocsArea[];

/** Every docs section id, across all areas. */
export type SectionId = (typeof docsAreas)[number]["sections"][number]["id"];

/** The section ids of the Visualizations area: the intents a chart is filed under. */
export type VisualizationSectionId = Extract<
  (typeof docsAreas)[number],
  { id: "visualizations" }
>["sections"][number]["id"];

if (!["https:", "http:"].includes(new URL(site.url).protocol)) {
  throw new Error("Set site.url to an absolute HTTP or HTTPS production URL.");
}
