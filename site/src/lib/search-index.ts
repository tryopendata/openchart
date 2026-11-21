/**
 * The search contract shared by the pages Pagefind indexes and the search
 * dialog that reads the index. A page is indexed only when one element carries
 * `searchBodyAttrs(...)`; its `area` meta files each result under one of
 * SEARCH_AREAS. Docs articles, gallery entry pages and blog posts carry it;
 * index pages, tag pages, the 404 page and fixtures do not.
 */
import { docsAreas } from "../config";
import type { AreaId } from "./docs-types";

/** The groups search results are filed under, in display order. */
export type SearchArea =
  | "Guides"
  | "Visualizations"
  | "Building blocks"
  | "Reference"
  | "Examples"
  | "Blog";

/** Every search area, in the order the dialog shows its groups. */
export const SEARCH_AREAS: readonly SearchArea[] = [
  "Guides",
  "Visualizations",
  "Building blocks",
  "Reference",
  "Examples",
  "Blog",
];

/** The part of the site a page belongs to: a docs area, the gallery or the blog. */
export type SearchSource = AreaId | "examples" | "blog";

/** The attributes `searchBodyAttrs` returns, spread onto the indexed element. */
export type SearchBodyAttrs = {
  "data-pagefind-body": "";
  "data-pagefind-meta": `area:${SearchArea}`;
  /** The same area as a Pagefind filter, so the dialog can count and search one area at a time. */
  "data-pagefind-filter": `area:${SearchArea}`;
};

const OTHER_AREAS: Record<"examples" | "blog", SearchArea> = {
  examples: "Examples",
  blog: "Blog",
};

/**
 * The search area a page is filed under. A docs area's label comes from
 * `docsAreas`, so renaming an area renames its group.
 *
 * @throws {Error} When `docsAreas` has no label for the area, or the label is not a SearchArea.
 */
export function searchAreaOf(source: SearchSource): SearchArea {
  if (source === "examples" || source === "blog") return OTHER_AREAS[source];
  const label = docsAreas.find((area) => area.id === source)?.label;
  const area = SEARCH_AREAS.find((candidate) => candidate === label);
  if (!area) {
    throw new Error(
      `Docs area "${source}" has the label "${label}", which is not a search area. Add it to SEARCH_AREAS in src/lib/search-index.ts.`,
    );
  }
  return area;
}

/** Attributes for the element whose text Pagefind indexes. Only pages with these are indexed. */
export function searchBodyAttrs(source: SearchSource): SearchBodyAttrs {
  const area = searchAreaOf(source);
  return {
    "data-pagefind-body": "",
    "data-pagefind-meta": `area:${area}`,
    "data-pagefind-filter": `area:${area}`,
  };
}

/**
 * Shown in the dialog when /pagefind/pagefind.js cannot load. Readers of the live
 * site see it after a network failure, so it says nothing about build commands;
 * SEARCH_UNAVAILABLE_HINT goes to the console for someone on the dev server.
 */
export const SEARCH_UNAVAILABLE = "Search could not load. Try again in a moment.";

/** Logged with the load failure: the dev server has no index. */
export const SEARCH_UNAVAILABLE_HINT =
  "The search index exists only on the built site: run make build, then make preview.";
