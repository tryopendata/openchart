import corePackage from "../../packages/core/package.json" with { type: "json" };
import type { DocsArea } from "./lib/docs-types";

// Public product metadata: identity, install commands, navigation and the docs
// areas. The landing page's own copy lives in src/landing/copy.ts.

export type Link = { label: string; href: string };
export type InstallOption = { label: string; command: string };

const repo = "https://github.com/tryopendata/openchart";

/** Where "Read the docs" links go: the first page a new reader needs. */
export const DOCS_HOME = "/docs/get-started/getting-started/";

export const site = {
  name: "OpenChart",
  tagline: "Charts, tables and maps from a JSON spec.",
  description:
    "OpenChart renders charts, tables, graphs and maps from a declarative JSON spec, with wrappers for React, Vue and Svelte.",
  /** Absolute production URL: canonicals, the sitemap, OG images and llms.txt use it. */
  url: "https://openchart.steamfield.io",
  repo,
  /** Current release, shown in the header: the core package's version, which every package shares. */
  version: corePackage.version,
  install: [
    { label: "npm", command: "npm install @opendata-ai/openchart-react" },
    { label: "bun", command: "bun add @opendata-ai/openchart-react" },
    { label: "pnpm", command: "pnpm add @opendata-ai/openchart-react" },
  ] as InstallOption[],
  social: [{ label: "GitHub", href: repo }] as Link[],
  /** Header links between Docs and the social links, in order. Every entry renders, so list built pages only. */
  nav: [
    { label: "Examples", href: "/examples/" },
    { label: "Blog", href: "/blog/" },
  ] as Link[],
  /** Footer link columns. */
  footer: [
    {
      title: "Docs",
      links: [
        { label: "Getting started", href: DOCS_HOME },
        { label: "llms.txt", href: "/llms.txt" },
      ],
    },
    {
      title: "Read",
      links: [
        { label: "Examples", href: "/examples/" },
        { label: "Blog", href: "/blog/" },
        { label: "RSS", href: "/blog/rss.xml" },
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
  license: "Apache-2.0",
  /** Components that hydrate on the landing page. The build test fails on any other island. */
  islands: [
    "HeroDesk",
    "VocabularyWall",
    "PresetScrub",
    "ChartStoryScroll",
    "MotionReplay",
    "PlaybackFigure",
    "ResizeFrame",
    "PublishDesk",
    "AgentSession",
    "InstallTabs",
  ],
};

/** One blog tag: the id a post lists in its `tags` frontmatter and the label its tag page shows. */
export type BlogTag = { readonly id: string; readonly label: string };

/**
 * The blog's tags, in display order. A post may use only these ids: the blog
 * schema rejects any other and lists the valid ones. Add a tag here first.
 */
export const blogTags = [
  { id: "chart-choice", label: "Chart choice" },
  { id: "annotation", label: "Annotation" },
  { id: "color", label: "Color" },
  { id: "maps", label: "Maps" },
  { id: "tables", label: "Tables" },
  { id: "accessibility", label: "Accessibility" },
  { id: "climate", label: "Climate" },
  { id: "developers", label: "Developers" },
] as const satisfies readonly BlogTag[];

/** A tag id from `blogTags`. */
export type BlogTagId = (typeof blogTags)[number]["id"];

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
