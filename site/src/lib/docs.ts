// Pure docs rules: ordering, URLs, the pager and the agent-readable exports.
// Pages pass in the collection from collection.ts, so tests need no Astro runtime.
import type { DocData } from "../content/schema";

export type DocEntry = { id: string; data: DocData; body: string };
export type Group = { readonly id: string; readonly label: string };
export type NavItem = { id: string; label: string; title: string; description: string };
export type NavGroup = { id: string; label: string; items: NavItem[] };
export type SiteInfo = { name: string; tagline: string; url: string };

export const docHref = (id: string) => `/docs/${id}/`;
export const markdownHref = (id: string) => `/docs/${id}.md`;
export const ogImageHref = (id: string) => `/og/docs/${id}.png`;

const byOrder = (a: DocEntry, b: DocEntry) =>
  a.data.order - b.data.order || a.data.title.localeCompare(b.data.title);

/** Sidebar groups in config order, each page sorted by `order` then title. Empty groups drop out. */
export function docsNav(entries: readonly DocEntry[], groups: readonly Group[]): NavGroup[] {
  return groups
    .map((group) => ({
      id: group.id,
      label: group.label,
      items: entries
        .filter((entry) => entry.data.group === group.id)
        .sort(byOrder)
        .map((entry) => ({
          id: entry.id,
          label: entry.data.sidebarLabel ?? entry.data.title,
          title: entry.data.title,
          description: entry.data.description,
        })),
    }))
    .filter((group) => group.items.length > 0);
}

/** Previous and next pages in sidebar order, across group boundaries. */
export function pageLinks(nav: readonly NavGroup[], id: string) {
  const flat = nav.flatMap((group) => group.items);
  const index = flat.findIndex((item) => item.id === id);
  if (index === -1) return { prev: undefined, next: undefined };
  return { prev: flat[index - 1], next: flat[index + 1] };
}

/** The Markdown served beside each page at /docs/<id>.md. */
export function toMarkdownExport(entry: DocEntry): string {
  return `# ${entry.data.title}\n\n> ${entry.data.description}\n\n${entry.body.trim()}\n`;
}

/** llms.txt: the product summary, then every page by group with its description. */
export function llmsIndex(site: SiteInfo, nav: readonly NavGroup[]): string {
  const sections = nav.map((group) => {
    const lines = group.items.map(
      (item) =>
        `- [${item.title}](${new URL(markdownHref(item.id), site.url)}): ${item.description}`,
    );
    return `## ${group.label}\n\n${lines.join("\n")}`;
  });
  return `# ${site.name}\n\n> ${site.tagline}\n\n${sections.join("\n\n")}\n`;
}

/** llms-full.txt: every page's Markdown export in sidebar order. */
export function llmsFull(
  site: SiteInfo,
  nav: readonly NavGroup[],
  entries: readonly DocEntry[],
): string {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const pages = nav
    .flatMap((group) => group.items)
    .map((item) => byId.get(item.id))
    .filter((entry) => entry !== undefined)
    .map(toMarkdownExport);
  return `# ${site.name}\n\n> ${site.tagline}\n\n${pages.join("\n")}`;
}
