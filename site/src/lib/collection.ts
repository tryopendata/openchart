/**
 * The only module that imports astro:content. Turns the repoDocs and siteDocs
 * collections into one list of DocPage entries and enforces the rules that
 * need the file path: a site page's folder is its section, and no two files
 * share a page id. Turns the blog collection into BlogPost entries and checks
 * each post's related pages against the docs.
 */
import { type CollectionEntry, getCollection, render } from "astro:content";
import type { BlogPost } from "./blog-types";
import { areaOf, assertUniqueIds } from "./docs";
import type { DocPage } from "./docs-types";

/** One published page: its metadata, its source text and a way to render it. */
export type PageEntry = {
  page: DocPage;
  body: string;
  render(): ReturnType<typeof render>;
};

/** Thrown when a site page's folder does not match its `section` frontmatter. */
export class PageLocationError extends Error {}

type DocsEntry = CollectionEntry<"repoDocs"> | CollectionEntry<"siteDocs">;

/**
 * Every published docs page, from both collections.
 *
 * @throws {PageLocationError} When a site page sits outside its section's folder.
 * @throws {DuplicatePageError} When two files produce the same page id.
 */
export async function allPages(): Promise<PageEntry[]> {
  const [repoDocs, siteDocs] = await Promise.all([
    getCollection("repoDocs"),
    getCollection("siteDocs"),
  ]);
  siteDocs.forEach(assertInSectionFolder);
  const entries: DocsEntry[] = [...repoDocs, ...siteDocs];
  assertUniqueIds(entries.map((entry) => ({ id: entry.id, file: sourceFile(entry) })));
  return entries.map(toPageEntry);
}

function assertInSectionFolder(entry: CollectionEntry<"siteDocs">): void {
  const [folder, ...rest] = entry.id.split("/");
  if (folder === entry.data.section && rest.length === 1) return;
  throw new PageLocationError(
    `${sourceFile(entry)} declares section "${entry.data.section}", so it must be at src/content/docs/${entry.data.section}/<slug>.mdx.`,
  );
}

function sourceFile(entry: DocsEntry): string {
  return entry.filePath ?? `${entry.collection}:${entry.id}`;
}

function toPageEntry(entry: DocsEntry): PageEntry {
  if (entry.body === undefined) {
    throw new Error(`${sourceFile(entry)} has no body; the glob loader should always set one.`);
  }
  const { title, description, section, order, sidebarLabel } = entry.data;
  const page: DocPage = {
    id: entry.id,
    area: areaOf(section),
    section,
    title,
    description,
    order,
    ...(sidebarLabel ? { sidebarLabel } : {}),
    source: entry.collection === "repoDocs" ? "repo-md" : "site-mdx",
  };
  return { page, body: entry.body, render: () => render(entry) };
}

/** One blog post: its metadata, its source text and a way to render it. */
export type PostEntry = {
  post: BlogPost;
  body: string;
  render(): ReturnType<typeof render>;
};

/** Thrown when a post's `related` frontmatter names a docs page that does not exist. */
export class UnknownRelatedPageError extends Error {}

/**
 * Every blog post, newest first. Drafts are left out of production builds and
 * shown in dev.
 *
 * @throws {UnknownRelatedPageError} When a post lists a related page id no docs page has.
 */
export async function allPosts(): Promise<PostEntry[]> {
  const [entries, pages] = await Promise.all([getCollection("blog"), allPages()]);
  const pageIds = new Set(pages.map(({ page }) => page.id));
  return entries
    .filter((entry) => !(import.meta.env.PROD && entry.data.draft))
    .map((entry) => toPostEntry(entry, pageIds))
    .sort((a, b) => b.post.published.getTime() - a.post.published.getTime());
}

function toPostEntry(entry: CollectionEntry<"blog">, pageIds: ReadonlySet<string>): PostEntry {
  const file = entry.filePath ?? `blog:${entry.id}`;
  const unknown = entry.data.related.find((id) => !pageIds.has(id));
  if (unknown) {
    throw new UnknownRelatedPageError(
      `${file} lists related page "${unknown}", which is not a docs page. Use an id from /docs/, such as "comparison/column".`,
    );
  }
  if (entry.body === undefined) {
    throw new Error(`${file} has no body; the glob loader should always set one.`);
  }
  const { title, description, published, updated, author, tags, related, lead } = entry.data;
  const post: BlogPost = {
    slug: entry.id,
    title,
    description,
    published,
    ...(updated ? { updated } : {}),
    author,
    tags,
    related,
    ...(lead ? { lead } : {}),
  };
  return { post, body: entry.body, render: () => render(entry) };
}
