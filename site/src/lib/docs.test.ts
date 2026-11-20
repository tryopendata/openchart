/** The docs model: areas, navigation, the pager, the outline and the exports. */
import { describe, expect, it } from "vitest";
import { docsAreas } from "../config";
import {
  areaOf,
  assertUniqueIds,
  DuplicatePageError,
  docsAreasNav,
  docsNav,
  llmsFull,
  llmsIndex,
  outline,
  pageLinks,
  toMarkdownExport,
  UnknownSectionError,
} from "./docs";
import type { DocPage } from "./docs-types";

function page(id: string, fields: Partial<DocPage> = {}): DocPage {
  const section = id.split("/")[0] ?? "";
  return {
    id,
    area: areaOf(section),
    section,
    title: id,
    description: `About ${id}`,
    order: 100,
    source: "site-mdx",
    ...fields,
  };
}

const pages = [
  page("tables/data-table", { title: "Data table" }),
  page("comparison/column", { title: "Column", order: 2 }),
  page("comparison/bar", { title: "Bar", order: 1, sidebarLabel: "Bars" }),
  page("get-started/getting-started", { title: "Getting started", source: "repo-md" }),
  page("comparison/lollipop", { title: "Lollipop", order: 2 }),
];
const noDemos = (id: string) => {
  throw new Error(`no demo ${id}`);
};

describe("areaOf", () => {
  it("derives a page's area from its section", () => {
    expect(areaOf("comparison")).toBe("visualizations");
    expect(areaOf("get-started")).toBe("guides");
  });

  it("rejects a section no area declares", () => {
    expect(() => areaOf("blog")).toThrow(UnknownSectionError);
  });

  it("finds every section id in exactly one area", () => {
    const ids = docsAreas.flatMap((area) => area.sections.map((section) => section.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("docsNav", () => {
  it("returns only sections with pages, in docsAreas order, pages by order then title", () => {
    expect(docsNav(pages, "visualizations")).toEqual([
      {
        id: "comparison",
        label: "Comparison",
        items: [
          { id: "comparison/bar", label: "Bars", href: "/docs/comparison/bar/" },
          { id: "comparison/column", label: "Column", href: "/docs/comparison/column/" },
          { id: "comparison/lollipop", label: "Lollipop", href: "/docs/comparison/lollipop/" },
        ],
      },
      {
        id: "tables",
        label: "Tables",
        items: [{ id: "tables/data-table", label: "Data table", href: "/docs/tables/data-table/" }],
      },
    ]);
  });

  it("lists every area with pages in the switcher, linking to its first page", () => {
    expect(docsAreasNav(pages).map(({ id, href }) => ({ id, href }))).toEqual([
      { id: "guides", href: "/docs/get-started/getting-started/" },
      { id: "visualizations", href: "/docs/comparison/bar/" },
    ]);
  });
});

describe("pageLinks", () => {
  it("gives the previous and next page within the area", () => {
    const links = pageLinks(pages, "comparison/lollipop");
    expect(links.prev?.id).toBe("comparison/column");
    expect(links.next?.id).toBe("tables/data-table");
  });

  it("is undefined at the ends of an area, never crossing into another", () => {
    expect(pageLinks(pages, "comparison/bar").prev).toBeUndefined();
    expect(pageLinks(pages, "tables/data-table").next).toBeUndefined();
    expect(pageLinks(pages, "get-started/getting-started")).toEqual({
      prev: undefined,
      next: undefined,
    });
  });
});

describe("outline", () => {
  it("returns h2 and h3 headings with their slugs, skipping h1 and deeper levels", () => {
    const headings = [
      { depth: 1, slug: "bar", text: "Bar" },
      { depth: 2, slug: "sorted", text: "Sorted" },
      { depth: 3, slug: "by-value", text: "By value" },
      { depth: 4, slug: "detail", text: "Detail" },
    ];
    expect(outline(headings)).toEqual([
      { depth: 2, slug: "sorted", text: "Sorted" },
      { depth: 3, slug: "by-value", text: "By value" },
    ]);
  });
});

describe("assertUniqueIds", () => {
  it("throws for two pages with the same id, naming both sources", () => {
    const sources = [
      { id: "comparison/bar", file: "src/content/docs/comparison/bar.mdx" },
      { id: "comparison/bar", file: "../docs/bars.md" },
    ];
    expect(() => assertUniqueIds(sources)).toThrow(DuplicatePageError);
    expect(() => assertUniqueIds(sources)).toThrow(
      /comparison\/bar.*src\/content\/docs\/comparison\/bar\.mdx.*\.\.\/docs\/bars\.md/,
    );
  });

  it("accepts distinct ids", () => {
    expect(() =>
      assertUniqueIds([
        { id: "a/b", file: "x" },
        { id: "a/c", file: "y" },
      ]),
    ).not.toThrow();
  });
});

describe("Markdown exports", () => {
  it("replaces imports and Demo tags in MDX with the demo's spec as JSON", () => {
    const body =
      'import Demo from "../Demo.astro";\n\nIntro.\n\n<Demo id="comparison/bar-basic" />\n';
    const spec = { mark: "bar", data: [{ a: 1 }] };
    const markdown = toMarkdownExport(page("comparison/bar", { title: "Bar" }), body, (id) =>
      id === "comparison/bar-basic" ? spec : noDemos(id),
    );
    expect(markdown).toBe(
      `# Bar\n\n> About comparison/bar\n\nIntro.\n\n\`\`\`json\n${JSON.stringify(spec, null, 2)}\n\`\`\`\n`,
    );
  });

  it("keeps import lines and Demo tags inside fenced code and later prose", () => {
    const fenced = [
      "```astro",
      'import Demo from "../components/demo/Demo.astro";',
      '<Demo id="x" />',
      "```",
    ].join("\n");
    const body = `import Demo from "../Demo.astro";\n\nUse it like this:\n\n${fenced}\n\nimport is a keyword.\n`;
    expect(toMarkdownExport(page("comparison/bar", { title: "Bar" }), body, noDemos)).toBe(
      `# Bar\n\n> About comparison/bar\n\nUse it like this:\n\n${fenced}\n\nimport is a keyword.\n`,
    );
  });

  it("drops a repo doc's own h1 so the title appears once", () => {
    const repoPage = pages[3] as DocPage;
    expect(toMarkdownExport(repoPage, "# Getting started\n\nFirst steps.\n", noDemos)).toBe(
      "# Getting started\n\n> About get-started/getting-started\n\nFirst steps.\n",
    );
  });

  it("lists every page in llms.txt under its area and section with an absolute URL", () => {
    const text = llmsIndex(pages);
    expect(text.startsWith("# OpenChart\n\n> ")).toBe(true);
    expect(text).toContain(
      "## Visualizations\n\n### Comparison\n\n- [Bar](https://openchart.steamfield.io/docs/comparison/bar.md): About comparison/bar",
    );
    for (const { id } of pages) expect(text).toContain(`/docs/${id}.md)`);
  });

  it("concatenates every page's export in sidebar order in llms-full.txt", () => {
    const entries = pages.map((entry) => ({ page: entry, body: `Body of ${entry.id}.` }));
    const text = llmsFull(entries, noDemos);
    const order = ["# Getting started", "# Bar", "# Column", "# Lollipop", "# Data table"];
    const positions = order.map((title) => text.indexOf(`${title}\n`));
    expect(positions.every((position) => position > 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});
