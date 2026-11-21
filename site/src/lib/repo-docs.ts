/**
 * Finds which of the repository's docs Markdown files are published on the site:
 * the files in docs/ and one folder down (docs/reference/). A file is a page when
 * its frontmatter declares `section`; contributor docs without frontmatter stay
 * on GitHub only. Reads synchronously because
 * content.config.ts needs the answer at load time; `repoPages` reads once per
 * process so the content collections and the link rewriter share one snapshot.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, posix, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { docsAreas } from "../config";
import { DuplicatePageError } from "./docs";

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const SLUG = /^[a-z0-9-]+$/;
const SECTION_IDS: readonly string[] = docsAreas.flatMap((area) =>
  area.sections.map((section) => section.id),
);

/** Thrown when a docs Markdown file's frontmatter cannot produce a valid page id. */
export class InvalidRepoDocError extends Error {}

/** The repository root: OPENCHART_REPO_ROOT when set, otherwise the parent of the site directory. */
export function repoRoot(): string {
  return resolve(process.env.OPENCHART_REPO_ROOT ?? "..");
}

/**
 * Docs-relative path ("getting-started.md", "reference/chart-spec.md") to page id
 * ("<section>/<slug>") for each docs Markdown file, at most one folder deep,
 * whose frontmatter has `section`. The slug is the frontmatter `slug`, else the
 * file's base name.
 *
 * @throws {InvalidRepoDocError} When frontmatter is not YAML, or its section or slug is invalid.
 * @throws {DuplicatePageError} When two files resolve to the same page id.
 */
export function publishedRepoDocs(docsDir: string): ReadonlyMap<string, string> {
  const pages = new Map<string, string>();
  const fileById = new Map<string, string>();
  for (const file of docsMarkdownFiles(docsDir)) {
    const id = repoPageId(file, readFileSync(join(docsDir, file), "utf8"));
    if (!id) continue;
    const earlier = fileById.get(id);
    if (earlier) {
      throw new DuplicatePageError(
        `docs/${earlier} and docs/${file} both publish the page id "${id}". Change a section or slug.`,
      );
    }
    fileById.set(id, file);
    pages.set(file, id);
  }
  return pages;
}

let repoPagesSnapshot: ReadonlyMap<string, string> | undefined;

/**
 * The published-page map of the repository's own docs folder, read on the first
 * call and reused after it.
 *
 * @throws {InvalidRepoDocError} When a docs file's frontmatter cannot produce a page id.
 * @throws {DuplicatePageError} When two docs files resolve to the same page id.
 */
export function repoPages(): ReadonlyMap<string, string> {
  repoPagesSnapshot ??= publishedRepoDocs(repoDocsDir());
  return repoPagesSnapshot;
}

/** The repository's docs folder, where the published repo pages live. */
export function repoDocsDir(): string {
  return join(repoRoot(), "docs");
}

/** Docs-relative paths of the Markdown files in `docsDir` and its direct subfolders, sorted. */
function docsMarkdownFiles(docsDir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(docsDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".md")) files.push(entry.name);
    if (!entry.isDirectory()) continue;
    for (const nested of readdirSync(join(docsDir, entry.name), { withFileTypes: true })) {
      if (nested.isFile() && nested.name.endsWith(".md")) {
        files.push(posix.join(entry.name, nested.name));
      }
    }
  }
  return files.sort();
}

/** The page id a docs file declares, or undefined when its frontmatter has no `section`. */
function repoPageId(file: string, source: string): string | undefined {
  const block = FRONTMATTER.exec(source)?.[1];
  if (block === undefined) return undefined;
  const frontmatter = parseFrontmatter(file, block);
  if (frontmatter.section === undefined) return undefined;
  const section = String(frontmatter.section);
  const slug =
    frontmatter.slug === undefined ? posix.basename(file, ".md") : String(frontmatter.slug);
  if (!SECTION_IDS.includes(section)) {
    throw new InvalidRepoDocError(
      `docs/${file} has section "${section}". Use one of: ${SECTION_IDS.join(", ")}.`,
    );
  }
  if (!SLUG.test(slug)) {
    throw new InvalidRepoDocError(
      `docs/${file} has slug "${slug}". Use lowercase letters, digits and hyphens, or set slug.`,
    );
  }
  return `${section}/${slug}`;
}

/** The frontmatter block parsed as YAML, the same way the content collection reads it. */
function parseFrontmatter(file: string, block: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = parseYaml(block);
  } catch (error) {
    throw new InvalidRepoDocError(`docs/${file} has frontmatter that is not valid YAML.`, {
      cause: error,
    });
  }
  if (parsed === null) return {};
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new InvalidRepoDocError(`docs/${file} has frontmatter that is not a YAML mapping.`);
  }
  return parsed as Record<string, unknown>;
}
