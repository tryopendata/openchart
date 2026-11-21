/**
 * The parts of Pagefind's browser API (`/pagefind/pagefind.js`, written by the
 * build into dist/) that site search uses. Pagefind ships no types for the
 * browser bundle, so these follow its documented shapes and what version 1.6
 * returns; fields search does not read are left out.
 */

/** One section of a page that matched: the page itself, or a heading with an id. */
export type PagefindSubResult = {
  /** The heading's text, or the page title for the page-level entry. */
  title: string;
  /** The page URL, with `#id` for a heading. */
  url: string;
  /** HTML with matches wrapped in `<mark>`. */
  excerpt: string;
  /** Word positions of the matches in this section. */
  locations?: readonly number[];
  /** Each match with its score; `balanced_score` weighs headings and rare words above body text. */
  weighted_locations?: readonly { weight: number; balanced_score: number; location: number }[];
  /** Present on heading entries only. */
  anchor?: { id: string; text: string; element: string };
};

/** A result's loaded data, from `result.data()`. */
export type PagefindResultData = {
  url: string;
  /** HTML with matches wrapped in `<mark>`. */
  excerpt: string;
  /** Raw, unescaped metadata: `title` from the page, `area` from `searchBodyAttrs`. */
  meta: Record<string, string | undefined>;
  sub_results: readonly PagefindSubResult[];
};

/** One ranked match before its data loads. */
export type PagefindResult = { id: string; data: () => Promise<PagefindResultData> };

/** Match counts per filter value, as `{ area: { Guides: 5, ... } }`. */
export type PagefindFilterCounts = Record<string, Record<string, number>>;

/** What a search resolves to: results in rank order, and match counts per filter value. */
export type PagefindSearch = {
  results: readonly PagefindResult[];
  /** Counts with each filter value applied on top of this search's filters. */
  filters?: PagefindFilterCounts;
};

/** Search options: filter names to the value or values a result must carry. */
export type PagefindSearchOptions = { filters?: Record<string, string | readonly string[]> };

/** The module `/pagefind/pagefind.js` exports. */
export type PagefindApi = {
  init: () => Promise<void>;
  /** Loads the filter index; search responses carry filter counts only after it. */
  filters: () => Promise<PagefindFilterCounts>;
  search: (term: string, options?: PagefindSearchOptions) => Promise<PagefindSearch>;
  /** Resolves to null when a newer call replaced this one before it ran. */
  debouncedSearch: (
    term: string,
    options?: PagefindSearchOptions,
    debounceMs?: number,
  ) => Promise<PagefindSearch | null>;
};
