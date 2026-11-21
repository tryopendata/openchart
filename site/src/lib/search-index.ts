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
  return {
    "data-pagefind-body": "",
    "data-pagefind-meta": `area:${searchAreaOf(source)}`,
  };
}

/** Shown in the dialog when /pagefind/pagefind.js cannot load (dev server). From the Spec's error model. */
export const SEARCH_UNAVAILABLE =
  "Search runs on the built site. Run make build, then make preview.";
