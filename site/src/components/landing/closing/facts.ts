/**
 * The rows of the landing page's closing facts table. Each fact restates what a
 * file in the repository says and links to that file, so a reader can check it.
 * Numbers carry a comment naming the file they come from.
 */
import { site } from "../../../config";

/** A file in the repository that backs a fact. */
export type FactSource = { label: string; href: string };

/** One row: the topic, the fact in a sentence or two, and the files that back it. */
export type Fact = { topic: string; fact: string; sources: FactSource[] };

// These link to GitHub until the site publishes accessibility and integration pages; they move to those pages then.
const blob = (path: string, anchor = "") => ({
  label: path,
  href: `${site.repo}/blob/main/${path}${anchor}`,
});

export const closingFacts: Fact[] = [
  {
    topic: "Accessibility",
    fact: 'Live charts get generated alt text, a visually hidden data table and arrow-key navigation, with no configuration, and each bar, slice and point carries a descriptive label. Static SVG carries role="img" and the same alt text.',
    sources: [blob("docs/accessibility.md")],
  },
  {
    topic: "Export",
    fact: "Charts export SVG, PNG and CSV. Tables export CSV with the current sort and search applied. GIF export replays the entrance animation.",
    sources: [blob("docs/integration-guide.md", "#export")],
  },
  {
    topic: "Bundle",
    fact: "ESM-only packages built on d3 modules. The 3D graph renderer and the GIF encoder are optional peer dependencies, installed only if you use them, and the GIF encoder loads only when a GIF is exported. Each wrapper takes its framework as a peer.",
    sources: [
      blob("packages/vanilla/package.json"),
      { ...blob("docs/integration-guide.md", "#animated-gif-export"), label: "GIF export" },
    ],
  },
  {
    topic: "License",
    fact: `${site.license}, for every package.`,
    sources: [blob("LICENSE")],
  },
];
