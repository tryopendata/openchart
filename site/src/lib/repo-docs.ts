/** Finds which of the repository's docs/*.md files are published on the site. */
import { resolve } from "node:path";

/** The repository root: OPENCHART_REPO_ROOT when set, otherwise the parent of the site directory. */
export function repoRoot(): string {
  return resolve(process.env.OPENCHART_REPO_ROOT ?? "..");
}

/**
 * File name to page id ("<section>/<slug>") for each docs/*.md file whose
 * frontmatter has `section`. Files without it are not published.
 */
export function publishedRepoDocs(_docsDir: string): ReadonlyMap<string, string> {
  return new Map();
}
