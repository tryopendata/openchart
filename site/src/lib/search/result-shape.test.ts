import { describe, expect, it } from "vitest";
import type { PagefindResultData, PagefindSubResult } from "./pagefind-types";
import { safeExcerpt, shapeResult } from "./result-shape";

const sub = (url: string, title: string, hits: number, anchored = true): PagefindSubResult => ({
  url,
  title,
  excerpt: `${title} <mark>sankey</mark> text`,
  locations: Array.from({ length: hits }, (_, index) => index),
  ...(anchored ? { anchor: { id: url.split("#")[1] ?? "", text: title, element: "h2" } } : {}),
});

const result = (overrides: Partial<PagefindResultData> = {}): PagefindResultData => ({
  url: "/docs/flow/sankey/",
  excerpt: "page <mark>sankey</mark> excerpt",
  meta: { title: "Sankey", area: "Visualizations" },
  sub_results: [sub("/docs/flow/sankey/", "Sankey", 2, false)],
  ...overrides,
});

describe("shapeResult", () => {
  it("links the heading with the most matches and names it with the docs section", () => {
    const hit = shapeResult(
      result({
        sub_results: [
          sub("/docs/flow/sankey/", "Sankey", 1, false),
          sub("/docs/flow/sankey/#a-funnel", "A funnel", 4),
          sub("/docs/flow/sankey/#related", "Related", 2),
        ],
      }),
    );
    expect(hit).toEqual({
      href: "/docs/flow/sankey/#a-funnel",
      title: "Sankey",
      excerptHtml: "A funnel <mark>sankey</mark> text",
      area: "Visualizations",
      location: "Flow and networks / A funnel",
      pageUrl: "/docs/flow/sankey/",
    });
  });

  it("keeps the page link when a heading matches no more often than the page", () => {
    const hit = shapeResult(
      result({
        sub_results: [
          sub("/docs/flow/sankey/", "Sankey", 2, false),
          sub("/docs/flow/sankey/#a-basic-sankey", "A basic sankey", 2),
        ],
      }),
    );
    expect(hit.href).toBe("/docs/flow/sankey/");
    expect(hit.location).toBe("Flow and networks");
  });

  it("leaves the heading out of the location when it repeats the page title", () => {
    const hit = shapeResult(
      result({
        url: "/docs/spec/sankey-spec/",
        meta: { title: "SankeySpec", area: "Reference" },
        sub_results: [sub("/docs/spec/sankey-spec/#sankeyspec-1", "SankeySpec", 3)],
      }),
    );
    expect(hit.href).toBe("/docs/spec/sankey-spec/#sankeyspec-1");
    expect(hit.location).toBe("Spec");
  });

  it("gives an example or post no section, only the heading it lands on", () => {
    const example = shapeResult(
      result({
        url: "/examples/energy-flow/",
        meta: { title: "Energy flow", area: "Examples" },
        sub_results: [sub("/examples/energy-flow/", "Energy flow", 1, false)],
      }),
    );
    expect(example).toMatchObject({ area: "Examples", location: null });
    const post = shapeResult(
      result({
        url: "/blog/anomaly/",
        meta: { title: "Anomaly", area: "Blog" },
        sub_results: [sub("/blog/anomaly/#the-zero-line", "The zero line", 2)],
      }),
    );
    expect(post).toMatchObject({ href: "/blog/anomaly/#the-zero-line", location: "The zero line" });
  });

  it("files a page with missing or unknown area meta under no area", () => {
    expect(shapeResult(result({ meta: { title: "Sankey" } })).area).toBeNull();
    expect(shapeResult(result({ meta: { title: "Sankey", area: "Docs" } })).area).toBeNull();
  });

  it("falls back to the page excerpt and URL when there are no sub-results or title", () => {
    const hit = shapeResult(result({ meta: { area: "Guides" }, sub_results: [] }));
    expect(hit).toMatchObject({
      href: "/docs/flow/sankey/",
      title: "/docs/flow/sankey/",
      excerptHtml: "page <mark>sankey</mark> excerpt",
    });
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
