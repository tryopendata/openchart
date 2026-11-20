/**
 * Pure docs rules over DocPage values: which area a section belongs to, the
 * sidebar and area switcher, the pager, the outline, and the Markdown and
 * llms.txt exports. Routes pass in pages from collection.ts, so none of this
 * needs the Astro runtime.
 */
import { docsAreas, site } from "../config";
import type {
  AreaId,
  DocPage,
  DocsLayoutProps,
  Heading,
  NavArea,
  NavItem,
  NavSection,
} from "./docs-types";
import { type DemoSpecLookup, mdxToMarkdown } from "./mdx-markdown";

/** Thrown when two docs files produce the same page id. */
export class DuplicatePageError extends Error {}

/** Thrown when a section id is not declared in `docsAreas`. */
export class UnknownSectionError extends Error {}

/** A page's id and the file it came from, for duplicate checks. */
export type PageSource = { id: string; file: string };

const SECTION_ORDER: readonly string[] = docsAreas.flatMap((area) =>
  area.sections.map((section) => section.id),
);

/** The site route of a docs page. */
export const docHref = (id: string) => `/docs/${id}/`;

/** The route of a docs page's Markdown export. */
export const markdownHref = (id: string) => `/docs/${id}.md`;

/**
 * The area a section belongs to.
 *
 * @throws {UnknownSectionError} When no area in `docsAreas` declares the section.
 */
export function areaOf(section: string): AreaId {
  const area = docsAreas.find((candidate) =>
    candidate.sections.some((entry) => entry.id === section),
  );
  if (!area) {
    throw new UnknownSectionError(
      `Section "${section}" is not in docsAreas. Use one of: ${SECTION_ORDER.join(", ")}.`,
    );
  }
  return area.id;
}

/** Sidebar order: section position in `docsAreas`, then `order`, then title. */
function byNavOrder(a: DocPage, b: DocPage): number {
  return (
    SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section) ||
    a.order - b.order ||
    a.title.localeCompare(b.title)
  );
}

function navItem(page: DocPage): NavItem {
  return { id: page.id, label: page.sidebarLabel ?? page.title, href: docHref(page.id) };
}

/** The sidebar of one area: its sections that have pages, in `docsAreas` order, each sorted. */
export function docsNav(pages: readonly DocPage[], area: AreaId): NavSection[] {
  const sections = docsAreas.find((candidate) => candidate.id === area)?.sections ?? [];
  const sorted = [...pages].sort(byNavOrder);
  return sections
    .map((section) => ({
      id: section.id,
      label: section.label,
      items: sorted.filter((page) => page.section === section.id).map(navItem),
    }))
    .filter((section) => section.items.length > 0);
}

/** The area switcher: every area that has pages, linking to its first page. */
export function docsAreasNav(pages: readonly DocPage[]): NavArea[] {
  return docsAreas.flatMap((area) => {
    const sections = docsNav(pages, area.id);
    const first = sections[0]?.items[0];
    return first ? [{ id: area.id, label: area.label, href: first.href, sections }] : [];
  });
}

/** The previous and next pages in sidebar order within the page's area; undefined at either end. */
export function pageLinks(
  pages: readonly DocPage[],
  id: string,
): { prev: NavItem | undefined; next: NavItem | undefined } {
  const page = pages.find((candidate) => candidate.id === id);
  if (!page) return { prev: undefined, next: undefined };
  const items = docsNav(pages, page.area).flatMap((section) => section.items);
  const index = items.findIndex((item) => item.id === id);
  return { prev: items[index - 1], next: items[index + 1] };
}

/** The "On this page" outline: h2 and h3 headings only. */
export function outline(
  headings: readonly { depth: number; slug: string; text: string }[],
): Heading[] {
  return headings.flatMap(({ depth, slug, text }) =>
    depth === 2 || depth === 3 ? [{ depth, slug, text }] : [],
  );
}

/** Everything the docs layout needs for one page, given every published page. */
export function docsLayoutProps(
  pages: readonly DocPage[],
  page: DocPage,
  headings: readonly { depth: number; slug: string; text: string }[],
): DocsLayoutProps {
  const { prev, next } = pageLinks(pages, page.id);
  return {
    page: { ...page, path: docHref(page.id), markdown: markdownHref(page.id) },
    areas: docsAreasNav(pages),
    nav: docsNav(pages, page.area),
    outline: outline(headings),
    prev,
    next,
  };
}

/**
 * Checks that no two docs files share a page id.
 *
 * @throws {DuplicatePageError} Naming the id and both files.
 */
export function assertUniqueIds(sources: readonly PageSource[]): void {
  const seen = new Map<string, string>();
  for (const { id, file } of sources) {
    const earlier = seen.get(id);
    if (earlier) {
      throw new DuplicatePageError(
        `Docs page id "${id}" comes from both ${earlier} and ${file}. Change a section or slug.`,
      );
    }
    seen.set(id, file);
  }
}

/**
 * The Markdown served at /docs/<id>.md: the title, the description as a quote,
 * then the body. Repo docs lose their own h1; MDX pages get their demo specs inline.
 *
 * @throws {DemoExportError} When an MDX page's Demo tag has no id, names a demo
 * `demoSpec` cannot find, or is not a self-closing tag. It names the page and the demo.
 */
export function toMarkdownExport(page: DocPage, body: string, demoSpec: DemoSpecLookup): string {
  const content =
    page.source === "site-mdx"
      ? mdxToMarkdown(page.id, body, demoSpec)
      : body.replace(/^\s*# .*(?:\n|$)/, "");
  return `# ${page.title}\n\n> ${page.description}\n\n${content.trim()}\n`;
}

/** llms.txt: the product summary, then every page by area and section with its Markdown URL. */
export function llmsIndex(pages: readonly DocPage[]): string {
  const sorted = [...pages].sort(byNavOrder);
  const areas = docsAreasNav(pages).map((area) => {
    const sections = area.sections.map((section) => {
      const lines = sorted
        .filter((page) => page.section === section.id)
        .map(
          (page) =>
            `- [${page.title}](${new URL(markdownHref(page.id), site.url)}): ${page.description}`,
        );
      return `### ${section.label}\n\n${lines.join("\n")}`;
    });
    return `## ${area.label}\n\n${sections.join("\n\n")}`;
  });
  return `# ${site.name}\n\n> ${site.tagline}\n\n${areas.join("\n\n")}\n`;
}

/**
 * llms-full.txt: every page's Markdown export, in sidebar order across areas.
 *
 * @throws {DemoExportError} When a page's export fails, as `toMarkdownExport` describes.
 */
export function llmsFull(
  entries: readonly { page: DocPage; body: string }[],
  demoSpec: DemoSpecLookup,
): string {
  const exports = [...entries]
    .sort((a, b) => byNavOrder(a.page, b.page))
    .map((entry) => toMarkdownExport(entry.page, entry.body, demoSpec));
  return `# ${site.name}\n\n> ${site.tagline}\n\n${exports.join("\n")}`;
}
