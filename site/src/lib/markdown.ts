/**
 * Assembles the docs Markdown pipeline for astro.config.mjs: the hast plugins and
 * Shiki transformers from prose-markdown.ts, repo-markdown.ts and demo/fence.ts,
 * in the order they must run. Holds no plugin logic, and importing it reads
 * nothing from disk: the repo page map loads on the first repo link it rewrites.
 */
import { demoFence, demoFenceMeta } from "./demo/fence";
import { callouts, codeFrames, codeTitle, headingAnchors, tableScroll } from "./prose-markdown";
import { repoPages } from "./repo-docs";
import { dropTitle, repoLinks } from "./repo-markdown";

/** Every hast plugin the docs Markdown runs through, in order. */
export const docsHastPlugins = [
  dropTitle(),
  repoLinks(repoPages),
  callouts,
  headingAnchors,
  tableScroll,
  demoFence(),
  codeFrames,
];

/** Shiki transformers that carry a fence's info string through to the hast plugins. */
export const docsShikiTransformers = [codeTitle, demoFenceMeta];
