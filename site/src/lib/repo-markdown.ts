/**
 * Hast plugins that adapt the repository's published docs Markdown for the
 * site: the h1 goes (the layout renders the title), relative links point at the
 * site page, an alias page or the file on GitHub, and Ladle gallery links point
 * at the catalog page that shows the same chart. Every plugin leaves MDX and
 * site Markdown untouched.
 */
import { join, posix, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { SatteriProcessorOptions } from "@astrojs/markdown-satteri";
import { site } from "../config";
import { repoRoot } from "./repo-docs";
import { repoDocAliases } from "./repo-link-targets";

type HastPlugin = Extract<
  NonNullable<SatteriProcessorOptions["hastPlugins"]>[number],
  { name: string }
>;
type VisitContext = { readonly fileURL: URL | undefined; readonly sourceFormat: string };

const REPO_BLOB = `${site.repo}/blob/main`;
const DOCS_FOLDER = "docs";
/** The Ladle gallery the repository's docs link to for live examples. */
const LADLE_ORIGIN = "https://tryopendata.github.io/openchart/";

/** Thrown when a repo doc links to a Ladle story that the story map does not send to a site page. */
export class UnmappedLadleLinkError extends Error {}

/**
 * The document's path relative to the repository's docs folder
 * ("reference/chart-spec.md"), or undefined when it is not repo Markdown. A
 * render without a file URL can't be placed, so it is left alone.
 */
function repoDocPath(ctx: VisitContext): string | undefined {
  if (ctx.sourceFormat !== "markdown" || !ctx.fileURL) return undefined;
  const docsDir = join(repoRoot(), DOCS_FOLDER);
  const file = fileURLToPath(ctx.fileURL);
  if (!file.startsWith(docsDir + sep)) return undefined;
  return relative(docsDir, file).split(sep).join(posix.sep);
}

/** True for a link written relative to the current file, such as `tables.md#sort`. */
function isRelativeLink(href: string): boolean {
  return href !== "" && !/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(href);
}

/**
 * Where a relative link in a published repo doc should point on the site. The
 * link resolves against the folder of `fromFile`, the linking file's path
 * relative to docs/. The target is the page URL when it is a published page,
 * else the alias URL (without the anchor) when the site replaces that file,
 * else the file on GitHub. Links that climb above the repository root are
 * returned unchanged.
 */
export function rewriteRepoLink(
  href: string,
  pages: ReadonlyMap<string, string>,
  fromFile: string,
): string {
  const hashAt = href.indexOf("#");
  const path = hashAt === -1 ? href : href.slice(0, hashAt);
  const hash = hashAt === -1 ? "" : href.slice(hashAt);
  const repoPath = posix.normalize(posix.join(DOCS_FOLDER, posix.dirname(fromFile), path));
  if (repoPath.startsWith("..")) return href;
  const docsPath = posix.relative(DOCS_FOLDER, repoPath);
  const pageId = pages.get(docsPath);
  if (pageId) return `/docs/${pageId}/${hash}`;
  const alias = repoDocAliases[docsPath];
  if (alias) return alias;
  return `${REPO_BLOB}/${repoPath}${hash}`;
}

/**
 * The site page for a Ladle gallery URL, or undefined when `href` is not one.
 * The story map is tried with `<story>#<anchor>` first, then `<story>`.
 *
 * @throws {UnmappedLadleLinkError} When the URL names no story, or a story `stories` does not map.
 */
export function rewriteLadleLink(
  href: string,
  stories: Readonly<Record<string, string>>,
  fromFile: string,
): string | undefined {
  if (!href.startsWith(LADLE_ORIGIN)) return undefined;
  const url = new URL(href);
  const story = url.searchParams.get("story");
  const anchor = url.hash.slice(1);
  const page = story ? (stories[`${story}#${anchor}`] ?? stories[story]) : undefined;
  if (!page) {
    throw new UnmappedLadleLinkError(
      `docs/${fromFile} links to the Ladle story ${href}, which has no site page. Add the story to ladleStoryPages in src/lib/repo-link-targets.ts.`,
    );
  }
  return `/docs/${page}/`;
}

/** Drops a repo doc's h1, which the docs layout renders from the title. */
export function dropTitle(): HastPlugin {
  return {
    name: "drop-title",
    element: {
      filter: ["h1"],
      visit(node, ctx) {
        if (repoDocPath(ctx) !== undefined) ctx.removeNode(node);
      },
    },
  };
}

/**
 * Rewrites relative links between repo docs: to site URLs for published pages
 * (docs-relative path to page id in the map `pages` returns), to the alias page
 * for files the site replaces, and to GitHub for every other repo file. A link
 * to this site's own absolute URL (how a repo doc reaches a page with no repo
 * file, so the link also works on GitHub) loses its origin. `pages` is called
 * on the first relative link to rewrite, so building the plugin reads nothing.
 *
 * @throws Whatever `pages` throws, from the first repo link the plugin visits.
 */
export function repoLinks(pages: () => ReadonlyMap<string, string>): HastPlugin {
  return {
    name: "repo-links",
    element: {
      filter: ["a"],
      visit(node, ctx) {
        const href = node.properties.href;
        if (typeof href !== "string") return;
        const ownSite = href.startsWith(`${site.url}/`);
        if (!ownSite && !isRelativeLink(href)) return;
        const fromFile = repoDocPath(ctx);
        if (fromFile === undefined) return;
        if (ownSite) {
          ctx.setProperty(node, "href", href.slice(site.url.length));
          return;
        }
        ctx.setProperty(node, "href", rewriteRepoLink(href, pages(), fromFile));
      },
    },
  };
}

/**
 * Rewrites links to the Ladle gallery in repo docs
 * (`https://tryopendata.github.io/openchart/?story=<id>#<anchor>`) to the site
 * page `stories` maps the story to.
 *
 * @throws {UnmappedLadleLinkError} From the first gallery link whose story has no page.
 */
export function ladleLinks(stories: Readonly<Record<string, string>>): HastPlugin {
  return {
    name: "ladle-links",
    element: {
      filter: ["a"],
      visit(node, ctx) {
        const href = node.properties.href;
        if (typeof href !== "string" || !href.startsWith(LADLE_ORIGIN)) return;
        const fromFile = repoDocPath(ctx);
        if (fromFile === undefined) return;
        const page = rewriteLadleLink(href, stories, fromFile);
        if (page) ctx.setProperty(node, "href", page);
      },
    },
  };
}
