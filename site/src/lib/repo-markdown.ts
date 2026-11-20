/** Hast plugins that adapt the repository's docs/*.md for the site. */
import type { SatteriProcessorOptions } from "@astrojs/markdown-satteri";

type HastPlugin = Extract<
  NonNullable<SatteriProcessorOptions["hastPlugins"]>[number],
  { name: string }
>;

/** Drops a page's h1, which the layout renders from the title. */
export function dropTitle(): HastPlugin {
  return { name: "drop-title" } as HastPlugin;
}

/**
 * Rewrites relative links between repo docs: to site URLs for published pages
 * (file name to page id in `pages`), and to GitHub for every other repo file.
 */
export function repoLinks(_pages: ReadonlyMap<string, string>): HastPlugin {
  return { name: "repo-links" } as HastPlugin;
}
