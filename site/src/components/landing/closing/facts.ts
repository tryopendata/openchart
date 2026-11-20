/**
 * The rows of the landing page's closing facts table. Each fact restates what a
 * file in the repository says and links to that file, so a reader can check it.
 * Numbers carry a comment naming the file they come from.
 */
import { site } from "../../../config";

/** One row: the topic, the fact in a sentence or two, and the file that backs it. */
export type Fact = { topic: string; fact: string; backedBy: { label: string; href: string } };

const blob = (path: string) => `${site.repo}/blob/main/${path}`;

export const closingFacts: Fact[] = [
  {
    topic: "Accessibility",
    fact: 'Live charts get generated alt text, a visually hidden data table, a label on every mark and arrow-key navigation, with no configuration. Static SVG carries role="img" and the same alt text.',
    backedBy: { label: "docs/accessibility.md", href: blob("docs/accessibility.md") },
  },
  {
    topic: "Export",
    fact: "Charts export SVG, PNG and CSV. Tables export CSV with the current sort and search applied. GIF export replays the entrance animation through the optional gifenc encoder, loaded only when called.",
    backedBy: {
      label: "docs/integration-guide.md",
      href: `${blob("docs/integration-guide.md")}#export`,
    },
  },
  {
    topic: "Bundle",
    fact: "ESM-only packages built on d3 modules. The 3D graph renderer and the GIF encoder are optional peer dependencies, so a chart never loads them, and each wrapper takes its framework as a peer.",
    backedBy: { label: "packages/*/package.json", href: blob("packages/vanilla/package.json") },
  },
  {
    topic: "License",
    // Six: the packages under packages/ (core, engine, vanilla, react, vue, svelte), each "license": "Apache-2.0" in its package.json.
    fact: "Apache-2.0, for all six packages.",
    backedBy: { label: "LICENSE", href: blob("LICENSE") },
  },
];
