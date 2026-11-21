// @vitest-environment node
/** Repo Markdown rendered through the real processor with the repo plugins. */
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createSatteriMarkdownProcessor, satteriHeadingIdsPlugin } from "@astrojs/markdown-satteri";
import { describe, expect, it } from "vitest";
import { dropTitle, ladleLinks, repoLinks, UnmappedLadleLinkError } from "./repo-markdown";

const pages = new Map([["tables.md", "tables/data-table"]]);
const repoDoc = pathToFileURL(resolve("../docs/getting-started.md"));
const referenceDoc = pathToFileURL(resolve("../docs/reference/chart-spec.md"));
const siteDoc = pathToFileURL(join(process.cwd(), "src/content/docs/comparison/notes.md"));
const siteMdx = pathToFileURL(join(process.cwd(), "src/content/docs/the-spec/anatomy.mdx"));

/** The published pages after the reference split, without tables.md, which the site aliases. */
const splitPages = new Map([
  ["getting-started.md", "get-started/getting-started"],
  ["spec-reference.md", "spec/overview"],
  ["reference/chart-spec.md", "spec/chart-spec"],
  ["reference/encoding.md", "spec/encoding"],
]);

const stories = {
  "charts--bar-and-column#columns": "comparison/column",
  "graphs--graphs": "flow/graph",
};
const LADLE = "https://tryopendata.github.io/openchart/";

async function render(
  markdown: string,
  fileURL: URL | undefined,
  pageMap: () => ReadonlyMap<string, string> = () => pages,
) {
  const processor = await createSatteriMarkdownProcessor({
    hastPlugins: [satteriHeadingIdsPlugin(), dropTitle(), repoLinks(pageMap), ladleLinks(stories)],
  });
  return (await processor.render(markdown, fileURL ? { fileURL } : {})).code;
}

describe("repo Markdown", () => {
  it("drops the h1 and keeps the other headings", async () => {
    const html = await render("# Getting started\n\n## First chart\n", repoDoc);
    expect(html).not.toContain("<h1");
    expect(html).toContain('<h2 id="first-chart">First chart</h2>');
  });

  it("rewrites a relative link to a published page to its site URL, keeping the anchor", async () => {
    const html = await render("[Sorting](./tables.md#anchor)\n", repoDoc);
    expect(html).toContain('href="/docs/tables/data-table/#anchor"');
  });

  it("points a link to a file that is not a page at GitHub", async () => {
    const html = await render(
      "[Internals](architecture.md) and [Rules](../CONVENTIONS.md#errors)\n",
      repoDoc,
    );
    expect(html).toContain(
      'href="https://github.com/tryopendata/openchart/blob/main/docs/architecture.md"',
    );
    expect(html).toContain(
      'href="https://github.com/tryopendata/openchart/blob/main/CONVENTIONS.md#errors"',
    );
  });

  it("leaves absolute, external and same-page links alone", async () => {
    const html = await render("[a](/docs/x/) [b](https://example.com/y.md) [c](#top)\n", repoDoc);
    expect(html).toContain('href="/docs/x/"');
    expect(html).toContain('href="https://example.com/y.md"');
    expect(html).toContain('href="#top"');
  });

  it("leaves Markdown outside the repository's docs folder untouched", async () => {
    const html = await render("# Notes\n\n[Tables](./tables.md)\n", siteDoc);
    expect(html).toContain("<h1");
    expect(html).toContain('href="./tables.md"');
  });

  it("leaves Markdown rendered without a file URL untouched", async () => {
    const html = await render("# Notes\n\n[Tables](./tables.md)\n", undefined);
    expect(html).toContain("<h1");
    expect(html).toContain('href="./tables.md"');
  });

  it("asks for the page map only when a repo doc has a relative link to rewrite", async () => {
    let reads = 0;
    const counted = () => {
      reads += 1;
      return pages;
    };
    await render("# Notes\n\n[Tables](./tables.md)\n", siteDoc, counted);
    await render("# Notes\n\n[Top](#top) [Out](https://example.com)\n", repoDoc, counted);
    expect(reads).toBe(0);
    const html = await render("[Sorting](./tables.md)\n", repoDoc, counted);
    expect(html).toContain('href="/docs/tables/data-table/"');
    expect(reads).toBe(1);
  });
});

describe("links from a file one folder down", () => {
  const fromReference = (markdown: string) => render(markdown, referenceDoc, () => splitPages);

  it("resolves a sibling link against the file's own folder", async () => {
    const html = await fromReference("[Faceting](./encoding.md#faceting)\n");
    expect(html).toContain('href="/docs/spec/encoding/#faceting"');
  });

  it("resolves a link that climbs to docs/ to the page there, keeping the anchor", async () => {
    const html = await fromReference("[Dark mode](../getting-started.md#dark-mode)\n");
    expect(html).toContain('href="/docs/get-started/getting-started/#dark-mode"');
  });

  it("points a link to an unpublished docs file at GitHub", async () => {
    const html = await fromReference("[Architecture](../architecture.md)\n");
    expect(html).toContain(
      'href="https://github.com/tryopendata/openchart/blob/main/docs/architecture.md"',
    );
  });
});

describe("links to a docs file the site replaces", () => {
  it("go to the alias page without the anchor", async () => {
    const html = await render("[Sorting](tables.md#sort)\n", repoDoc, () => splitPages);
    expect(html).toContain('href="/docs/tables/data-table/"');
  });

  it("resolve from a file one folder down too", async () => {
    const html = await render("[Graphs](../graphs.md#layout)\n", referenceDoc, () => splitPages);
    expect(html).toContain('href="/docs/flow/graph/"');
  });
});

describe("Ladle gallery links", () => {
  it("go to the page mapped for the story and its anchor", async () => {
    const html = await render(
      `[Live example](${LADLE}?story=charts--bar-and-column#columns)\n`,
      repoDoc,
    );
    expect(html).toContain('href="/docs/comparison/column/"');
  });

  it("fall back to the page mapped for the bare story", async () => {
    const html = await render(
      `[Live example](${LADLE}?story=graphs--graphs#search)\n`,
      referenceDoc,
    );
    expect(html).toContain('href="/docs/flow/graph/"');
  });

  it("fail the render naming the file and the URL when the story has no page", async () => {
    const url = `${LADLE}?story=charts--bar-and-column#stacked-bars`;
    const failure = render(`[Live example](${url})\n`, referenceDoc);
    await expect(failure).rejects.toThrow(UnmappedLadleLinkError);
    await expect(render(`[Live example](${url})\n`, referenceDoc)).rejects.toThrow(
      `docs/reference/chart-spec.md links to the Ladle story ${url}`,
    );
  });

  it("are left alone in site pages", async () => {
    const url = `${LADLE}?story=unmapped--story`;
    for (const page of [siteMdx, siteDoc]) {
      expect(await render(`[Gallery](${url})\n`, page)).toContain(`href="${url}"`);
    }
  });
});
