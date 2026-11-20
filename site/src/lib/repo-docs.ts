/**
 * Finds which of the repository's docs/*.md files are published on the site.
 * A file is a page when its frontmatter declares `section`; contributor docs
 * without frontmatter stay on GitHub only. Reads synchronously because
 * astro.config.mjs and content.config.ts both need the answer at load time.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/** The repository root: OPENCHART_REPO_ROOT when set, otherwise the parent of the site directory. */
export function repoRoot(): string {
  return resolve(process.env.OPENCHART_REPO_ROOT ?? "..");
}

/**
 * File name to page id ("<section>/<slug>") for each docs/*.md file whose
 * frontmatter has `section`. The slug is the frontmatter `slug`, else the file name.
 */
export function publishedRepoDocs(docsDir: string): ReadonlyMap<string, string> {
  const pages = new Map<string, string>();
  for (const file of readdirSync(docsDir)
    .filter((name) => name.endsWith(".md"))
    .sort()) {
    const id = repoPageId(file, readFileSync(join(docsDir, file), "utf8"));
    if (id) pages.set(file, id);
  }
  return pages;
}

/** The page id a docs file declares, or undefined when its frontmatter has no `section`. */
function repoPageId(file: string, source: string): string | undefined {
  const block = FRONTMATTER.exec(source)?.[1];
  if (block === undefined) return undefined;
  const section = frontmatterValue(block, "section");
  if (!section) return undefined;
  return `${section}/${frontmatterValue(block, "slug") ?? file.replace(/\.md$/, "")}`;
}

/** A top-level scalar from a YAML frontmatter block, without surrounding quotes. */
function frontmatterValue(block: string, key: string): string | undefined {
  const match = new RegExp(`^${key}:[ \\t]*(.*?)[ \\t]*$`, "m").exec(block)?.[1];
  const value = match?.replace(/^(["'])(.*)\1$/, "$2");
  return value ? value : undefined;
}
