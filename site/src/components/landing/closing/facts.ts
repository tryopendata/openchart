/**
 * The rows of the landing page's closing facts table. Each fact restates what a
 * docs page or a file in the repository says and links to it, so a reader can
 * check it. Numbers carry a comment naming the file they come from.
 */
import { site } from "../../../config";

/** A docs page or a repository file that backs a fact. */
export type FactSource = { label: string; href: string };

/** One row: the topic, the fact in a sentence or two, and the files that back it. */
export type Fact = { topic: string; fact: string; sources: FactSource[] };

/** A repository file on GitHub, for facts no docs page covers. */
const blob = (path: string) => ({ label: path, href: `${site.repo}/blob/main/${path}` });

export const closingFacts: Fact[] = [
  {
    topic: "Accessibility",
    fact: 'Live charts get generated alt text, a visually hidden data table and arrow-key navigation, with no configuration, and each bar, slice and point carries a descriptive label. Static SVG carries role="img" and the same alt text.',
    sources: [{ label: "Accessibility", href: "/docs/output/accessibility/" }],
  },
  {
    topic: "Export",
    fact: "Charts export SVG, PNG and CSV. Tables export CSV with the current sort and search applied. GIF export replays the entrance animation.",
    sources: [{ label: "Export API", href: "/docs/api/export/" }],
  },
  {
    topic: "Bundle",
    fact: "ESM-only packages built on d3 modules. The 3D graph renderer and the GIF encoder are optional peer dependencies, installed only if you use them, and the GIF encoder loads only when a GIF is exported. Each wrapper takes its framework as a peer.",
    sources: [
      blob("packages/vanilla/package.json"),
      { label: "GIF export", href: "/docs/api/export/#animated-gif-export" },
    ],
  },
  {
    topic: "License",
    fact: `${site.license}, for every package.`,
    sources: [blob("LICENSE")],
  },
];
