// @vitest-environment node
/** Repo Markdown rendered through the real processor with the repo plugins. */
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createSatteriMarkdownProcessor, satteriHeadingIdsPlugin } from "@astrojs/markdown-satteri";
import { describe, expect, it } from "vitest";
import { dropTitle, repoLinks } from "./repo-markdown";

const pages = new Map([["tables.md", "tables/data-table"]]);
const repoDoc = pathToFileURL(resolve("../docs/getting-started.md"));
const siteDoc = pathToFileURL(join(process.cwd(), "src/content/docs/comparison/notes.md"));

async function render(markdown: string, fileURL: URL | undefined) {
  const processor = await createSatteriMarkdownProcessor({
    hastPlugins: [satteriHeadingIdsPlugin(), dropTitle(), repoLinks(pages)],
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
      "[Graphs](graphs.md) and [Rules](../CONVENTIONS.md#errors)\n",
      repoDoc,
    );
    expect(html).toContain(
      'href="https://github.com/tryopendata/openchart/blob/main/docs/graphs.md"',
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
});
