/**
 * Hast plugins that adapt the repository's docs/*.md for the site: the h1 goes
 * (the layout renders the title), and relative links point at the site page or
 * at the file on GitHub. Both plugins leave MDX and site Markdown untouched.
 */
import { join, posix, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { SatteriProcessorOptions } from "@astrojs/markdown-satteri";
import { site } from "../config";
import { repoRoot } from "./repo-docs";

type HastPlugin = Extract<
  NonNullable<SatteriProcessorOptions["hastPlugins"]>[number],
  { name: string }
>;
type VisitContext = { readonly fileURL: URL | undefined; readonly sourceFormat: string };

const REPO_BLOB = `${site.repo}/blob/main`;
const DOCS_FOLDER = "docs";

/**
 * True when the document is a repository docs/*.md file. A render without a
 * file URL (the Markdown unit tests) counts as one.
 */
function isRepoMarkdown(ctx: VisitContext): boolean {
  if (ctx.sourceFormat !== "markdown") return false;
  if (!ctx.fileURL) return true;
  return fileURLToPath(ctx.fileURL).startsWith(join(repoRoot(), DOCS_FOLDER) + sep);
}

/** True for a link written relative to the current file, such as `tables.md#sort`. */
function isRelativeLink(href: string): boolean {
  return href !== "" && !/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(href);
}

/**
 * Where a relative link in docs/*.md should point on the site: the page URL
 * when the target is a published page, otherwise the file on GitHub. Links that
 * climb above the repository root are returned unchanged.
 */
export function rewriteRepoLink(href: string, pages: ReadonlyMap<string, string>): string {
  const hashAt = href.indexOf("#");
  const path = hashAt === -1 ? href : href.slice(0, hashAt);
  const hash = hashAt === -1 ? "" : href.slice(hashAt);
  const repoPath = posix.normalize(posix.join(DOCS_FOLDER, path));
  if (repoPath.startsWith("..")) return href;
  const pageId = pages.get(posix.relative(DOCS_FOLDER, repoPath));
  if (pageId) return `/docs/${pageId}/${hash}`;
  return `${REPO_BLOB}/${repoPath}${hash}`;
}

/** Drops a repo doc's h1, which the docs layout renders from the title. */
export function dropTitle(): HastPlugin {
  return {
    name: "drop-title",
    element: {
      filter: ["h1"],
      visit(node, ctx) {
        if (isRepoMarkdown(ctx)) ctx.removeNode(node);
      },
    },
  };
}

/**
 * Rewrites relative links between repo docs: to site URLs for published pages
 * (file name to page id in `pages`), and to GitHub for every other repo file.
 */
export function repoLinks(pages: ReadonlyMap<string, string>): HastPlugin {
  return {
    name: "repo-links",
    element: {
      filter: ["a"],
      visit(node, ctx) {
        const href = node.properties.href;
        if (typeof href !== "string" || !isRelativeLink(href) || !isRepoMarkdown(ctx)) return;
        ctx.setProperty(node, "href", rewriteRepoLink(href, pages));
      },
    },
  };
}
