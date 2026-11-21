/**
 * Turns one Pagefind result into what the search dialog shows: the link to the
 * section that matched best, the page title, a safe excerpt, the group it is
 * filed under and its overall rank. Pure, so the dialog only renders what this
 * returns.
 */
import { docsAreas } from "../../config";
import { SEARCH_AREAS, type SearchArea } from "../search-index";
import type { PagefindResultData, PagefindSubResult } from "./pagefind-types";

/** One result as the dialog shows it. */
export type SearchHit = {
  /** Where the result goes: the best-matching heading's anchor when it has one. */
  href: string;
  /** The page title. */
  title: string;
  /** Excerpt HTML: the matches in `<mark>`, every other character escaped. */
  excerptHtml: string;
  /** The group it is filed under, or null when the page has no known area meta. */
  area: SearchArea | null;
  /** Where on the site it lands, for the mono line: docs section and heading, else the heading or area. */
  location: string | null;
  /** The page URL without an anchor, named when the page is not filed. */
  pageUrl: string;
  /** Its place in Pagefind's ranking of the whole query, 0 for the best match. */
  rank: number;
};

/**
 * Shapes a loaded result for display, or returns null (and warns, naming the
 * URL) when its link is not a path on this site, so the dialog can never be
 * made to follow a `javascript:` or off-site URL from the index.
 */
export function shapeResult(
  data: PagefindResultData,
  rank: number,
  warn: (message: string) => void = console.warn,
): SearchHit | null {
  const best = bestSubResult(data.sub_results);
  const href = best?.url ?? data.url;
  if (!isSitePath(href)) {
    warn(`Search dropped a result whose link "${href}" is not a path on this site.`);
    return null;
  }
  const title = data.meta.title?.trim() || best?.title || data.url;
  const heading = best?.anchor && best.title !== title ? best.title : null;
  const area = searchAreaNamed(data.meta.area);
  const section = docsSectionLabel(data.url);
  return {
    href,
    title,
    excerptHtml: safeExcerpt(best?.excerpt ?? data.excerpt),
    area,
    location: section ? joinLocation(section, heading) : (heading ?? area),
    pageUrl: data.url,
    rank,
  };
}

/** True for a same-site path: one leading slash, not a protocol-relative `//host`. */
export function isSitePath(href: string): boolean {
  return /^\/(?!\/)/.test(href);
}

/**
 * The section whose matches score highest, summing Pagefind's balanced score
 * over them (headings and rare words weigh more than repeated body text). On a
 * tie the earlier section wins, so the page itself beats a heading that scores
 * no higher. Pagefind returns sub-results in page order, not ranked.
 */
export function bestSubResult(
  subResults: readonly PagefindSubResult[],
): PagefindSubResult | undefined {
  let best: PagefindSubResult | undefined;
  for (const candidate of subResults) {
    if (!best || score(candidate) > score(best)) best = candidate;
  }
  return best;
}

const score = (subResult: PagefindSubResult) =>
  (subResult.weighted_locations ?? []).reduce((sum, match) => sum + match.balanced_score, 0);

/** The search area a meta value names, or null when it names none. */
function searchAreaNamed(value: string | undefined): SearchArea | null {
  return SEARCH_AREAS.find((area) => area === value) ?? null;
}

/** The docs section a /docs/<section>/<page>/ URL belongs to, by its label. */
function docsSectionLabel(url: string): string | null {
  const sectionId = /^\/docs\/([^/]+)\//.exec(url)?.[1];
  if (!sectionId) return null;
  for (const area of docsAreas) {
    const section = area.sections.find((candidate) => candidate.id === sectionId);
    if (section) return section.label;
  }
  return null;
}

function joinLocation(section: string, heading: string | null): string {
  return heading ? `${section} / ${heading}` : section;
}

const MARK_TAG = /<(\/?)mark>/g;

/**
 * Excerpt HTML that keeps Pagefind's `<mark>` tags and escapes everything else.
 * Pagefind encodes some characters and not others (quotes come through raw), so
 * each run of text is decoded once and then escaped in full. A stray or nested
 * mark tag is dropped and an unclosed one is closed at the end, so the result
 * never leaves an element open.
 */
export function safeExcerpt(html: string): string {
  let out = "";
  let open = false;
  let last = 0;
  for (const match of html.matchAll(MARK_TAG)) {
    out += escapeText(decodeEntities(html.slice(last, match.index)));
    const closing = match[1] === "/";
    if (closing === open) {
      out += closing ? "</mark>" : "<mark>";
      open = !closing;
    }
    last = match.index + match[0].length;
  }
  out += escapeText(decodeEntities(html.slice(last)));
  return open ? `${out}</mark>` : out;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#39": "'",
  "#x27": "'",
};

function decodeEntities(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|apos|#39|#x27);/g, (entity, name: string) => {
    return ENTITIES[name] ?? entity;
  });
}

function escapeText(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
