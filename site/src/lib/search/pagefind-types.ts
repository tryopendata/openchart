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

/** The module `/pagefind/pagefind.js` exports. */
export type PagefindApi = {
  init: () => Promise<void>;
  /** Resolves to null when a newer call replaced this one before it ran. */
  debouncedSearch: (
    term: string,
    options?: Record<string, unknown>,
    debounceMs?: number,
  ) => Promise<{ results: readonly PagefindResult[] } | null>;
};
