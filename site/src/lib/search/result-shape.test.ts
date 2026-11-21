import { describe, expect, it, vi } from "vitest";
import type { PagefindResultData, PagefindSubResult } from "./pagefind-types";
import { type SearchHit, safeExcerpt, shapeResult } from "./result-shape";

/** A section of a page whose matches sum to `score` (Pagefind's balanced score). */
const sub = (url: string, title: string, score: number, anchored = true): PagefindSubResult => ({
  url,
  title,
  excerpt: `${title} <mark>sankey</mark> text`,
  locations: [0, 1, 2],
  weighted_locations: [
    { weight: 1, balanced_score: score / 2, location: 0 },
    { weight: 1, balanced_score: score / 2, location: 1 },
  ],
  ...(anchored ? { anchor: { id: url.split("#")[1] ?? "", text: title, element: "h2" } } : {}),
});

const result = (overrides: Partial<PagefindResultData> = {}): PagefindResultData => ({
  url: "/docs/flow/sankey/",
  excerpt: "page <mark>sankey</mark> excerpt",
  meta: { title: "Sankey", area: "Visualizations" },
  sub_results: [sub("/docs/flow/sankey/", "Sankey", 200, false)],
  ...overrides,
});

/** Shapes a result that must come out; a dropped one fails the test here. */
const shaped = (data: PagefindResultData, rank = 0): SearchHit => {
  const hit = shapeResult(data, rank, vi.fn());
  if (!hit) throw new Error(`shapeResult dropped ${data.url}`);
  return hit;
};

describe("shapeResult", () => {
  it("links the section with the highest balanced score, not the most matches, and keeps the rank", () => {
    const hit = shaped(
      result({
        sub_results: [
          sub("/docs/flow/sankey/", "Sankey", 100, false),
          // More matches, but body text: a lower score.
          { ...sub("/docs/flow/sankey/#related", "Related", 300), locations: [0, 1, 2, 3, 4, 5] },
          sub("/docs/flow/sankey/#a-funnel", "A funnel", 900),
        ],
      }),
      3,
    );
    expect(hit).toEqual({
      href: "/docs/flow/sankey/#a-funnel",
      title: "Sankey",
      excerptHtml: "A funnel <mark>sankey</mark> text",
      area: "Visualizations",
      location: "Flow and networks / A funnel",
      pageUrl: "/docs/flow/sankey/",
      rank: 3,
    });
  });

  it("keeps the page link when a heading scores no higher than the page", () => {
    const hit = shaped(
      result({
        sub_results: [
          sub("/docs/flow/sankey/", "Sankey", 500, false),
          sub("/docs/flow/sankey/#a-basic-sankey", "A basic sankey", 500),
        ],
      }),
    );
    expect(hit.href).toBe("/docs/flow/sankey/");
    expect(hit.location).toBe("Flow and networks");
  });

  it("leaves the heading out of the location when it repeats the page title", () => {
    const hit = shaped(
      result({
        url: "/docs/spec/sankey-spec/",
        meta: { title: "SankeySpec", area: "Reference" },
        sub_results: [sub("/docs/spec/sankey-spec/#sankeyspec-1", "SankeySpec", 300)],
      }),
    );
    expect(hit.href).toBe("/docs/spec/sankey-spec/#sankeyspec-1");
    expect(hit.location).toBe("Spec");
  });

  it("gives an example or post the heading it lands on, else its area", () => {
    const example = shaped(
      result({
        url: "/examples/energy-flow/",
        meta: { title: "Energy flow", area: "Examples" },
        sub_results: [sub("/examples/energy-flow/", "Energy flow", 100, false)],
      }),
    );
    expect(example).toMatchObject({ area: "Examples", location: "Examples" });
    const post = shaped(
      result({
        url: "/blog/anomaly/",
        meta: { title: "Anomaly", area: "Blog" },
        sub_results: [sub("/blog/anomaly/#the-zero-line", "The zero line", 200)],
      }),
    );
    expect(post).toMatchObject({ href: "/blog/anomaly/#the-zero-line", location: "The zero line" });
  });

  it("files a page with missing or unknown area meta under no area", () => {
    expect(shaped(result({ meta: { title: "Sankey" } })).area).toBeNull();
    expect(shaped(result({ meta: { title: "Sankey", area: "Docs" } })).area).toBeNull();
  });

  it("falls back to the page excerpt and URL when there are no sub-results or title", () => {
    const hit = shaped(result({ meta: { area: "Guides" }, sub_results: [] }));
    expect(hit).toMatchObject({
      href: "/docs/flow/sankey/",
      title: "/docs/flow/sankey/",
      excerptHtml: "page <mark>sankey</mark> excerpt",
    });
  });

  it.each([
    ["a javascript: URL", "javascript:alert(1)"],
    ["a protocol-relative URL", "//x.test/"],
    ["an absolute URL", "https://x.test/"],
    ["a relative path", "docs/flow/"],
  ])("drops a result whose link is %s, warning with the link", (_, url) => {
    const warn = vi.fn();
    const data = result({ url, sub_results: [sub(url, "Sankey", 100, false)] });
    expect(shapeResult(data, 0, warn)).toBeNull();
    expect(warn.mock.calls).toEqual([
      [`Search dropped a result whose link "${url}" is not a path on this site.`],
    ]);
  });
});

describe("safeExcerpt", () => {
  it.each([
    ["keeps marks", "a <mark>b</mark> c", "a <mark>b</mark> c"],
    [
      "escapes tags and attributes that are not marks",
      '<img src=x onerror="alert(1)"><mark class="x">b</mark>',
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&lt;mark class=&quot;x&quot;&gt;b",
    ],
    [
      "decodes Pagefind's entities once instead of escaping them twice",
      "&lt;Sankey&gt; &amp; &quot;flow&quot;",
      "&lt;Sankey&gt; &amp; &quot;flow&quot;",
    ],
    ["escapes raw quotes and ampersands", `say "a" & 'b'`, "say &quot;a&quot; &amp; &#39;b&#39;"],
    [
      "keeps an encoded mark tag as text",
      "&lt;mark&gt;not a highlight&lt;/mark&gt;",
      "&lt;mark&gt;not a highlight&lt;/mark&gt;",
    ],
    ["drops a stray closing mark", "a</mark> b", "a b"],
    ["drops a nested opening mark", "<mark>a<mark>b</mark>", "<mark>ab</mark>"],
    ["closes a mark left open", "<mark>a b", "<mark>a b</mark>"],
    ["shows entities it does not decode as text", "&nbsp;&copy;", "&amp;nbsp;&amp;copy;"],
  ])("%s", (_, input, expected) => {
    expect(safeExcerpt(input)).toBe(expected);
  });
});
