// Acceptance tests over the real build in dist/. `make build` runs them after
// `astro build`. The page list comes from src/content/docs, not from the build.
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { Window } from "happy-dom";
import { afterEach, describe, expect, it } from "vitest";
import { docsAreas, site } from "../src/config";
import { LANDING_SECTION_IDS, type LandingSectionId, landingCopy } from "../src/landing/copy";
import { heroSteps } from "../src/landing/hero";
import { catalogPageIds } from "./catalog-pages";
import { type DocsPage, docsPageList } from "./docs-pages";

const read = (root: string, path: string) => readFileSync(join(root, path), "utf8");
/**
 * The most recently parsed pages, each in its own happy-dom window. A parsed
 * page with inline chart SVGs takes tens of megabytes, and a window keeps every
 * document parsed in it, so one shared window passed Node's 4 GB heap. Only the
 * last few pages stay, and a dropped page's window is closed to free it; the
 * link check keeps the ids it reads in `idsCache` instead.
 */
const MAX_PARSED_PAGES = 8;
const parsed = new Map<string, { window: Window; document: Document }>();
function page(root: string, path: string): Document {
  const file = join(root, path);
  let entry = parsed.get(file);
  if (entry) {
    // Move it to the end, so the least recently used page is the one dropped.
    parsed.delete(file);
  } else {
    // happy-dom drops everything after a <style> inside an inline <svg>, and map
    // charts carry one. No test here reads styles, so they are removed before parsing.
    const html = read(root, path).replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, "");
    const window = new Window();
    const document = new window.DOMParser().parseFromString(html, "text/html");
    entry = { window, document: document as unknown as Document };
  }
  parsed.set(file, entry);
  const [oldest] = parsed;
  if (parsed.size > MAX_PARSED_PAGES && oldest) {
    parsed.delete(oldest[0]);
    void oldest[1].window.happyDOM.close();
  }
  return entry.document;
}

/** Every element id on a page, kept once read: the link check asks for the same pages many times. */
const idsCache = new Map<string, Set<string>>();
function idsOn(root: string, path: string): Set<string> {
  const file = join(root, path);
  let ids = idsCache.get(file);
  if (!ids) {
    ids = new Set([...page(root, path).querySelectorAll("[id]")].map((node) => node.id));
    idsCache.set(file, ids);
  }
  return ids;
}
const absolute = (path: string) => new URL(path, site.url).href;
const pagePath = (id: string) => `docs/${id}/index.html`;

const frontmatter = (source: string, key: string) =>
  new RegExp(`^${key}:\\s*["']?(.+?)["']?\\s*$`, "m").exec(source.split("\n---")[0] ?? "")?.[1];

/** A published page as its source file declares it, with the file's text for source checks. */
type SourceDoc = { id: string; title: string; file: string; source: string };

/**
 * Every published page: site pages under src/content/docs, and the repository's
 * docs Markdown, in docs/ and one folder down, that declares a section.
 */
function sourceDocs(root = "."): SourceDoc[] {
  const base = join(root, "src/content/docs");
  const sitePages = readdirSync(base, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.mdx?$/.test(file))
    .map((file) => {
      const source = readFileSync(join(base, file), "utf8");
      return {
        id: file.replace(/\.mdx?$/, "").replaceAll("\\", "/"),
        title: frontmatter(source, "title") ?? "",
        file: `src/content/docs/${file}`,
        source,
      };
    });
  const repoDocs = resolve("../docs");
  const repoPages = repoDocFiles(repoDocs)
    .map((file) => ({ file, source: readFileSync(join(repoDocs, file), "utf8") }))
    .filter(({ source }) => source.startsWith("---\n") && frontmatter(source, "section"))
    .map(({ file, source }) => ({
      id: `${frontmatter(source, "section")}/${frontmatter(source, "slug") ?? basename(file, ".md")}`,
      title: frontmatter(source, "title") ?? "",
      file: `../docs/${file}`,
      source,
    }));
  return [...sitePages, ...repoPages];
}

/** Markdown files in the repository's docs folder and its direct subfolders, relative to it. */
function repoDocFiles(docsDir: string): string[] {
  return readdirSync(docsDir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isFile()) return entry.name.endsWith(".md") ? [entry.name] : [];
    if (!entry.isDirectory()) return [];
    return readdirSync(join(docsDir, entry.name))
      .filter((name) => name.endsWith(".md"))
      .map((name) => `${entry.name}/${name}`);
  });
}

function htmlFiles(root: string) {
  return readdirSync(root, { recursive: true, encoding: "utf8" }).filter((file) =>
    file.endsWith(".html"),
  );
}

/** Waits one turn of the event loop, which is when happy-dom finishes closing the windows `page` dropped. */
const freeClosedPages = () => new Promise((resolve) => setTimeout(resolve, 0));

// A test that reads a page or two runs synchronously, so the closes it queued finish here.
afterEach(freeClosedPages);

/**
 * Every built HTML page under root that `include` accepts, parsed one at a
 * time, waiting a turn after each so the memory of dropped pages is freed.
 */
async function* builtPages(root: string, include: (file: string) => boolean = () => true) {
  for (const file of htmlFiles(root).filter(include)) {
    yield { file, doc: page(root, file) };
    await freeClosedPages();
  }
}

function islandNames(root: string, path: string) {
  return [...page(root, path).querySelectorAll("astro-island")].map(
    (island) => JSON.parse(island.getAttribute("opts") ?? "{}").name as string,
  );
}

const docs = sourceDocs();
const sourceById = new Map(docs.map((doc) => [doc.id, doc]));
const BAR = "comparison/bar";
const GETTING_STARTED = "get-started/getting-started";
/** A catalog page carries several demos; past this its HTML is too slow on a phone connection. */
const MAX_VISUALIZATION_PAGE_BYTES = 500_000;
/** A page whose source holds this is unfinished, so its content rules don't apply yet. */
const STUB_MARKER = "phase-4-stub";
const PARAGRAPH_WORD_LIMIT = 90;
const sectionsOf = (areaId: string): readonly string[] =>
  docsAreas.find((area) => area.id === areaId)?.sections.map(({ id }) => id) ?? [];
const BUILDING_BLOCK_SECTIONS = sectionsOf("building-blocks");
const GUIDE_SECTIONS = sectionsOf("guides");

/** The docs prose of a page: the article body the content rules read. */
const proseOf = (doc: Document) => doc.querySelector("article .docs-prose");

/** Paragraphs and h2s among the prose's top-level elements before the first demo. */
function leadBeforeFirstDemo(doc: Document): { paragraphs: number; headings: number } {
  const prose = proseOf(doc);
  const firstDemo = prose?.querySelector(".demo[data-demo]");
  const lead = { paragraphs: 0, headings: 0 };
  if (!prose || !firstDemo) return { paragraphs: Number.POSITIVE_INFINITY, headings: 0 };
  for (const child of prose.children) {
    if (child === firstDemo || child.contains(firstDemo)) break;
    if (child.tagName === "P") lead.paragraphs += 1;
    if (child.tagName === "H2") lead.headings += 1;
  }
  return lead;
}

/** Figures whose caption lacks a source, or cites illustrative data when that is not allowed. */
function unsourcedFigures(
  figures: Element[],
  { allowIllustrative }: { allowIllustrative: boolean },
) {
  return figures
    .map((figure) => ({
      id: figure.getAttribute("data-demo") ?? "",
      caption: figure.querySelector("figcaption")?.textContent ?? "",
    }))
    .filter(
      ({ caption }) =>
        !/Source: \S/.test(caption) ||
        (!allowIllustrative && caption.includes("Illustrative data")),
    )
    .map(({ id, caption }) => `${id}: "${caption}"`);
}

/** Prose paragraphs over the word limit. */
function longParagraphs(doc: Document): string[] {
  return [...doc.querySelectorAll("article .docs-prose > p")]
    .map((paragraph) => (paragraph.textContent ?? "").trim())
    .filter((text) => text.split(/\s+/).length > PARAGRAPH_WORD_LIMIT);
}

/** h2 and h3 texts that appear more than once in the article. */
function repeatedHeadings(doc: Document): string[] {
  const headings = [...(doc.querySelector("article")?.querySelectorAll("h2, h3") ?? [])].map(
    (heading) => (heading.textContent ?? "").trim(),
  );
  return headings.filter((text, index) => headings.indexOf(text) !== index);
}

/** The docs areas the page's prose links into, one entry per link. */
function linkedAreas(doc: Document): string[] {
  return [...(proseOf(doc)?.querySelectorAll('a[href^="/docs/"]') ?? [])].map((link) => {
    const section = (link.getAttribute("href") ?? "").split("/")[2] ?? "";
    return docsAreas.find((area) => sectionsOf(area.id).includes(section))?.id ?? "";
  });
}

/** Every distinct font-family a static SVG names on its text. */
function fontFamilies(svg: Element): string[] {
  const families = [...svg.querySelectorAll("[font-family]")].map(
    (node) => node.getAttribute("font-family") ?? "",
  );
  return [...new Set(families)];
}

describe("the page set", () => {
  it("includes the first catalog page and the first guide", () => {
    expect(docs.map(({ id }) => id)).toEqual(expect.arrayContaining([BAR, GETTING_STARTED]));
  });
});

describe("demos", () => {
  it("the bar page shows at least three demos, each with both static SVGs and five code tabs behind Show code", () => {
    const doc = page("dist", pagePath(BAR));
    const figures = [...doc.querySelectorAll(".demo[data-demo]")];
    expect(figures.length).toBeGreaterThanOrEqual(3);
    for (const figure of figures) {
      const id = figure.getAttribute("data-demo") ?? "";
      const stage = figure.querySelector("[data-demo-stage]");
      expect(stage?.querySelector('svg.demo-static[data-theme="light"]'), id).not.toBeNull();
      expect(stage?.querySelector('svg.demo-static[data-theme="dark"]'), id).not.toBeNull();
      expect(
        JSON.parse(figure.querySelector("[data-demo-spec]")?.textContent ?? "null"),
        id,
      ).toBeTypeOf("object");
      const tabs = [...figure.querySelectorAll("[data-demo-tab]")].map((tab) =>
        tab.getAttribute("data-demo-tab"),
      );
      expect(tabs, id).toEqual(["spec", "react", "vue", "svelte", "vanilla"]);
      for (const tab of tabs) {
        expect(figure.querySelector(`[data-demo-panel="${tab}"]`), `${id} ${tab}`).not.toBeNull();
      }
      const code = figure.querySelector("[data-demo-code]");
      const toggle = figure.querySelector("button[data-demo-toggle]");
      expect(toggle?.textContent, id).toBe("Code");
      expect(toggle?.getAttribute("aria-controls"), id).toBe(code?.id);
      expect(toggle?.getAttribute("aria-expanded"), `${id} code starts closed`).toBe("false");
      expect(figure.querySelectorAll("button[data-demo-copy][hidden]"), id).toHaveLength(1);
      expect(figure.hasAttribute("data-demo-entrance"), `${id} plays its entrance`).toBe(true);
      expect(figure.querySelector("figcaption")?.textContent, id).toMatch(/Source: \S/);
    }
    // The gate runs in the head, before anything paints, so a restored open block never moves the page.
    const gate = [...doc.querySelectorAll("head script:not([src])")].find((script) =>
      script.textContent?.includes("data-demo-gate"),
    );
    expect(gate, "the demo gate script in the head").toBeDefined();
  });

  it("a json demo fence in repo Markdown becomes a demo figure", () => {
    const figures = page("dist", pagePath(GETTING_STARTED)).querySelectorAll(
      '.demo[data-demo^="fence-"]',
    );
    expect(figures.length).toBeGreaterThanOrEqual(1);
    expect(figures[0]?.querySelector("svg.demo-static")).not.toBeNull();
  });

  it("every stage without a static SVG shows the demo's title and a drawn-in-the-browser line", async () => {
    const missing: string[] = [];
    let stages = 0;
    // The broken-demo fixture writes its figure by hand to test the failure state.
    for await (const { file, doc } of builtPages("dist", (file) => !file.includes("broken-demo"))) {
      for (const stage of doc.querySelectorAll("[data-demo-stage]")) {
        if (stage.querySelector("svg.demo-static")) continue;
        stages += 1;
        const text = stage.querySelector("p[data-demo-placeholder]")?.textContent ?? "";
        if (!/^\S.*\. This chart is drawn in the browser\.$/.test(text)) {
          missing.push(`${file}: ${stage.closest("[data-demo]")?.getAttribute("data-demo")}`);
        }
      }
    }
    expect(stages).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });

  it("writes each shared value once per page, and every figure's references resolve on its page", async () => {
    const problems: string[] = [];
    let references = 0;
    for await (const { file, doc } of builtPages("dist")) {
      const blocks = [...doc.querySelectorAll("script[data-demo-shared]")].map(
        (block) => block.getAttribute("data-demo-shared") ?? "",
      );
      const repeated = blocks.filter((hash, index) => blocks.indexOf(hash) !== index);
      if (repeated.length) problems.push(`${file}: blocks written twice: ${repeated.join(", ")}`);
      for (const script of doc.querySelectorAll("script[data-demo-spec][data-demo-shared-refs]")) {
        const refs = JSON.parse(script.getAttribute("data-demo-shared-refs") ?? "[]");
        for (const { hash } of refs as { hash: string }[]) {
          references += 1;
          if (!blocks.includes(hash)) problems.push(`${file}: no block ${hash}`);
        }
      }
    }
    expect(references).toBeGreaterThan(0);
    expect(problems).toEqual([]);
  });

  it("every Visualizations page is at most 500 KB of HTML", () => {
    const sections: readonly string[] =
      docsAreas.find((area) => area.id === "visualizations")?.sections.map(({ id }) => id) ?? [];
    const pages = docs.filter(({ id }) => sections.includes(id.split("/")[0] ?? ""));
    expect(pages.map(({ id }) => id)).toContain(BAR);
    const oversized = pages
      .map(({ id }) => ({ id, bytes: statSync(join("dist", pagePath(id))).size }))
      .filter(({ bytes }) => bytes > MAX_VISUALIZATION_PAGE_BYTES);
    expect(oversized).toEqual([]);
  });

  it("a dense demo's Spec panel shows its first rows and counts the rest, writing the rows out once", () => {
    const doc = page("dist", pagePath("output/canvas"));
    const figure = doc.querySelector('.demo[data-demo="output/canvas-all-counties"]');
    // The rows live in the page's shared-value block, which the figure's spec references.
    const refs = JSON.parse(
      figure?.querySelector("[data-demo-spec]")?.getAttribute("data-demo-shared-refs") ?? "[]",
    ) as { path: string[]; hash: string }[];
    const dataRef = refs.find(({ path }) => path.join("/") === "data");
    const rows = doc.querySelector(`script[data-demo-shared="${dataRef?.hash}"]`)?.textContent;
    expect(JSON.parse(rows ?? "null")).toHaveLength(3108);
    const panel = figure?.querySelector('[data-demo-panel="spec"]');
    const shown = panel?.querySelector("pre")?.textContent ?? "";
    expect(shown).toContain("// … 3,102 more rows; Copy includes them");
    expect(shown.match(/"lon":/g)).toHaveLength(6);
    const template = panel?.querySelector("template[data-demo-copy-source]");
    expect(template?.getAttribute("data-demo-copy-fills")).toBe('[["data"]]');
    expect(template?.innerHTML ?? "").not.toContain('"lon":');
  });

  it.each([BAR, GETTING_STARTED])("%s repeats no element id", (id) => {
    const ids = [...page("dist", pagePath(id)).querySelectorAll("[id]")].map((node) => node.id);
    const repeated = ids.filter((value, index) => ids.indexOf(value) !== index);
    expect([...new Set(repeated)]).toEqual([]);
  });
});

describe("docs navigation", () => {
  it("the sidebar lists the current area only", () => {
    const sidebar = page("dist", pagePath(BAR)).querySelector('nav[aria-label="Docs"]');
    expect(sidebar?.querySelector(`a[href="/docs/${BAR}/"]`)).not.toBeNull();
    expect(sidebar?.querySelector(`a[href="/docs/${GETTING_STARTED}/"]`)).toBeNull();
  });

  it.each([
    [BAR, "Visualizations"],
    ["get-started/introduction", "Guides"],
    ["the-spec/anatomy", "Building blocks"],
    ["spec/overview", "Reference"],
  ])("the area switcher on %s lists the four areas in order and marks %s", (id, current) => {
    const areas = [
      ...page("dist", pagePath(id)).querySelectorAll('nav[aria-label="Docs areas"] a'),
    ];
    expect(areas.map((area) => area.textContent?.trim())).toEqual([
      "Guides",
      "Visualizations",
      "Building blocks",
      "Reference",
    ]);
    expect(
      areas.find((area) => area.getAttribute("aria-current") === "page")?.textContent?.trim(),
    ).toBe(current);
  });

  it("repo Markdown renders one h1, its title, and highlighted code", () => {
    const guide = page("dist", pagePath(GETTING_STARTED));
    expect(guide.querySelectorAll("h1").length).toBe(1);
    expect(read("dist", pagePath(GETTING_STARTED))).toMatch(/--shiki-dark:/);
  });
});

describe("docs pages", () => {
  it.each(docs)("$id renders its metadata, sidebar entry and exports", ({ id, title }) => {
    const doc = page("dist", pagePath(id));
    const href = `/docs/${id}/`;
    expect(doc.querySelector("h1")?.textContent).toBe(title);
    expect(doc.querySelector('meta[name="description"]')?.getAttribute("content")).toBeTruthy();
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(absolute(href));
    expect(doc.querySelector('meta[property="og:image"]')?.getAttribute("content")).toBe(
      absolute(`/og/docs/${id}.png`),
    );
    expect(
      doc.querySelector('link[rel="alternate"][type="text/markdown"]')?.getAttribute("href"),
    ).toBe(`/docs/${id}.md`);
    expect(
      doc.querySelector('nav[aria-label="Docs"] a[aria-current="page"]')?.getAttribute("href"),
    ).toBe(href);
    expect(read("dist", `docs/${id}.md`).startsWith(`# ${title}\n`)).toBe(true);
    expect(read("dist", "llms.txt")).toContain(absolute(`/docs/${id}.md`));
    expect(read("dist", "llms-full.txt")).toContain(`# ${title}\n`);
    expect(read("dist", "sitemap-0.xml")).toContain(`<loc>${absolute(href)}</loc>`);
    const png = readFileSync(`dist/og/docs/${id}.png`);
    expect(png.subarray(1, 4).toString()).toBe("PNG");
  });

  it("lists every page on the docs home", () => {
    const home = page("dist", "docs/index.html");
    for (const { id } of docs) {
      expect(home.querySelector(`main a[href="/docs/${id}/"]`), id).not.toBeNull();
    }
  });
});

describe("the whole site", () => {
  it("has no broken internal links or anchors", async () => {
    const broken: string[] = [];
    for await (const { file, doc } of builtPages("dist")) {
      const self = `/${file.replace(/index\.html$/, "")}`;
      // Read the hrefs first: looking up a target's ids may drop this page from the cache.
      const hrefs = [...doc.querySelectorAll("a[href]")].map((link) => link.getAttribute("href"));
      for (const href of hrefs.map((value) => value ?? "")) {
        if (!href.startsWith("/") && !href.startsWith("#")) continue;
        if (href.startsWith("//")) continue;
        const [path = "", hash] = (href.startsWith("#") ? `${self}${href}` : href).split("#");
        const target = path.endsWith("/") ? `${path}index.html` : path;
        if (!existsSync(join("dist", target))) {
          broken.push(`${file}: ${href}`);
        } else if (hash && target.endsWith(".html")) {
          if (!idsOn("dist", target).has(decodeURIComponent(hash))) {
            broken.push(`${file}: ${href} (no #${hash})`);
          }
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it("hydrates only the islands site.islands lists, and none on docs pages", async () => {
    expect([...new Set(islandNames("dist", "index.html"))].sort()).toEqual(
      [...site.islands].sort(),
    );
    for await (const { file } of builtPages("dist", (file) => file.startsWith("docs"))) {
      expect(islandNames("dist", file), file).toEqual([]);
    }
  });

  it("renders the landing page's headline, version, license and social card", () => {
    const home = page("dist", "index.html");
    expect(home.querySelector("h1")?.textContent?.trim()).toBe(landingCopy.headline);
    expect(home.querySelector('meta[property="og:image"]')?.getAttribute("content")).toBe(
      absolute("/og-image.png"),
    );
    const text = home.body.textContent ?? "";
    const release = JSON.parse(read("..", "packages/core/package.json")).version as string;
    expect(text).toContain(`v${release}`);
    expect(text).toContain(`${site.license} license`);
    expect(readFileSync("dist/og-image.png").subarray(1, 4).toString()).toBe("PNG");
    const icons: [string, string][] = [
      ['link[rel="icon"][sizes]', "favicon.ico"],
      ['link[rel="icon"][type="image/svg+xml"]', "favicon.svg"],
      ['link[rel="apple-touch-icon"]', "apple-touch-icon.png"],
      ['link[rel="manifest"]', "site.webmanifest"],
    ];
    for (const [selector, file] of icons) {
      expect(home.querySelector(selector)?.getAttribute("href"), selector).toBe(`/${file}`);
      expect(existsSync(`dist/${file}`), file).toBe(true);
    }
    const manifest = JSON.parse(read("dist", "site.webmanifest"));
    for (const icon of manifest.icons) expect(existsSync(`dist${icon.src}`), icon.src).toBe(true);
  });

  it("serves robots.txt, the sitemap index and an unindexed 404 page", () => {
    expect(read("dist", "robots.txt")).toContain(`Sitemap: ${absolute("/sitemap-index.xml")}`);
    expect(existsSync("dist/sitemap-index.xml")).toBe(true);
    expect(read("dist", "sitemap-0.xml")).not.toMatch(/404|fixtures|\.md<|\.png<|\.txt</);
    const notFound = page("dist", "404.html");
    expect(notFound.querySelector("h1")?.textContent).toBe("Page not found");
    expect(notFound.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe(
      "noindex, nofollow",
    );
  });
});

describe("adding a docs page", () => {
  it("is one file: navigation, pager, exports and sitemap pick it up", () => {
    // A sibling of site/, not the OS temp dir: this workspace hoists most
    // dependencies to the repository root, which Node finds by walking up.
    const root = mkdtempSync(join(resolve(".."), ".site-probe-"));
    try {
      for (const entry of ["src", "public", "astro.config.mjs", "tsconfig.json", "package.json"]) {
        cpSync(entry, join(root, entry), { recursive: true });
      }
      symlinkSync(resolve("node_modules"), join(root, "node_modules"), "dir");
      writeFileSync(
        join(root, "src/content/docs/comparison/probe-page.mdx"),
        "---\ntitle: Probe page\ndescription: Checks that a new page is wired in.\nsection: comparison\norder: -1000\n---\n\n## Probe heading\n\nProbe body.\n",
      );
      const built = spawnSync("bunx", ["--no-install", "astro", "build"], {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, OPENCHART_REPO_ROOT: resolve("..") },
        timeout: 150_000,
      });
      expect(built.status, `${built.stdout}\n${built.stderr}`).toBe(0);
      const dist = join(root, "dist");
      const href = "/docs/comparison/probe-page/";
      const other = page(dist, pagePath(BAR));
      expect(other.querySelector(`nav[aria-label="Docs"] a[href="${href}"]`)).not.toBeNull();
      // order -1000 makes the probe its section's first page, so the bar page links back to it.
      expect(other.querySelector(`a[rel="prev"][href="${href}"]`)).not.toBeNull();
      expect(
        page(dist, pagePath("comparison/probe-page")).querySelector("#probe-heading"),
      ).not.toBeNull();
      expect(read(dist, "docs/comparison/probe-page.md")).toContain("Probe body.");
      expect(read(dist, "llms.txt")).toContain(absolute("/docs/comparison/probe-page.md"));
      expect(read(dist, "sitemap-0.xml")).toContain(absolute(href));
      expect(existsSync(join(dist, "og/docs/comparison/probe-page.png"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("the visualization catalog", () => {
  const WORD_LIMIT = 90;
  const built = (id: string) => existsSync(join("dist", pagePath(id)));

  it("builds every page in the catalog list", () => {
    expect(catalogPageIds.filter((id) => !built(id))).toEqual([]);
  });

  it.each(catalogPageIds.filter(built))("%s shows at least three sourced demos", (id) => {
    const figures = [...page("dist", pagePath(id)).querySelectorAll(".demo[data-demo]")];
    expect(figures.length).toBeGreaterThanOrEqual(3);
    for (const figure of figures) {
      const demo = figure.getAttribute("data-demo") ?? "";
      expect(figure.querySelector("figcaption")?.textContent ?? "", demo).toMatch(/Source: \S/);
    }
  });

  it.each(catalogPageIds.filter(built))("%s reads tightly and links onward", (id) => {
    const article = page("dist", pagePath(id)).querySelector("article");
    const section = id.split("/")[0];
    const long = [...(article?.querySelectorAll(".docs-prose > p") ?? [])]
      .map((paragraph) => (paragraph.textContent ?? "").trim())
      .filter((text) => text.split(/\s+/).length > WORD_LIMIT);
    expect(long).toEqual([]);
    const headings = [...(article?.querySelectorAll("h2, h3") ?? [])].map((heading) =>
      (heading.textContent ?? "").trim(),
    );
    expect(headings.filter((text, index) => headings.indexOf(text) !== index)).toEqual([]);
    const elsewhere = [...(article?.querySelectorAll('.docs-prose a[href^="/docs/"]') ?? [])]
      .map((link) => link.getAttribute("href") ?? "")
      .filter((href) => !href.startsWith(`/docs/${section}/`));
    expect(elsewhere.length, "links to a page in another section").toBeGreaterThanOrEqual(1);
  });
});

describe("the phase 4 pages", () => {
  it.each(docsPageList)("$id is built with its manifest title as the h1", ({ id, title }) => {
    expect(existsSync(join("dist", pagePath(id))), id).toBe(true);
    expect(page("dist", pagePath(id)).querySelector("h1")?.textContent).toBe(title);
  });

  it("finds a source file for every manifest page", () => {
    expect(docsPageList.filter(({ id }) => !sourceById.has(id)).map(({ id }) => id)).toEqual([]);
  });

  // Each kind's content rules apply once a page's source drops the stub marker.
  const finished = (pages: readonly DocsPage[]) =>
    pages.filter(({ id }) => !sourceById.get(id)?.source.includes(STUB_MARKER));
  const eachFinished = (name: string, pages: readonly DocsPage[], check: (p: DocsPage) => void) => {
    const ready = finished(pages);
    if (ready.length === 0) it.skip(`${name}: no finished page yet`, () => {});
    else it.each(ready)(`$id ${name}`, check);
  };

  eachFinished(
    "meets the building-block rules",
    docsPageList.filter(({ section }) => BUILDING_BLOCK_SECTIONS.includes(section)),
    ({ id, minDemos }) => {
      const doc = page("dist", pagePath(id));
      const figures = [...doc.querySelectorAll(".demo[data-demo]")];
      expect(figures.length, "demo figures").toBeGreaterThanOrEqual(minDemos);
      const lead = leadBeforeFirstDemo(doc);
      expect(lead.headings, "h2s before the first demo").toBe(0);
      expect(lead.paragraphs, "paragraphs before the first demo").toBeLessThanOrEqual(1);
      expect(unsourcedFigures(figures, { allowIllustrative: false })).toEqual([]);
      expect(longParagraphs(doc)).toEqual([]);
      expect(repeatedHeadings(doc)).toEqual([]);
      const areas = linkedAreas(doc);
      expect(areas, "links to a Visualizations page").toContain("visualizations");
      expect(areas, "links to a Reference page").toContain("reference");
      expect(statSync(join("dist", pagePath(id))).size).toBeLessThanOrEqual(
        MAX_VISUALIZATION_PAGE_BYTES,
      );
    },
  );

  eachFinished(
    "shows its minimum of sourced demos",
    docsPageList.filter(
      ({ section, minDemos }) => GUIDE_SECTIONS.includes(section) && minDemos > 0,
    ),
    ({ id, minDemos }) => {
      const figures = [...page("dist", pagePath(id)).querySelectorAll(".demo[data-demo]")];
      expect(figures.length, "demo figures").toBeGreaterThanOrEqual(minDemos);
      // The tutorial's toy data must match the four framework examples beside it.
      const allowIllustrative = id === GETTING_STARTED;
      expect(unsourcedFigures(figures, { allowIllustrative })).toEqual([]);
    },
  );

  eachFinished(
    "reads tightly",
    docsPageList.filter(({ id }) => id === "get-started/introduction"),
    ({ id }) => {
      const doc = page("dist", pagePath(id));
      expect(longParagraphs(doc)).toEqual([]);
      expect(
        unsourcedFigures([...doc.querySelectorAll(".demo[data-demo]")], {
          allowIllustrative: false,
        }),
      ).toEqual([]);
    },
  );

  eachFinished(
    "links to a Building-blocks or Visualizations page",
    docsPageList.filter(({ section }) => section === "spec"),
    ({ id }) => {
      const areas = linkedAreas(page("dist", pagePath(id)));
      expect(areas.some((area) => area === "building-blocks" || area === "visualizations")).toBe(
        true,
      );
    },
  );
});

describe("links out of the docs", () => {
  it("no docs page links to the Ladle gallery", async () => {
    const ladle: string[] = [];
    for await (const { file, doc } of builtPages("dist", (file) => file.startsWith("docs"))) {
      for (const link of doc.querySelectorAll('a[href*="tryopendata.github.io/openchart"]')) {
        ladle.push(`${file}: ${link.getAttribute("href")}`);
      }
    }
    expect(ladle).toEqual([]);
  });

  it("no page links to a published docs file on GitHub instead of its page", async () => {
    const published = new Set(
      docs
        .filter(({ file }) => file.startsWith("../docs/"))
        .map(({ file }) => file.slice("../docs/".length)),
    );
    expect(published.size).toBeGreaterThan(20);
    const blob = `${site.repo}/blob/main/docs/`;
    const onGitHub: string[] = [];
    for await (const { file, doc } of builtPages("dist")) {
      const hrefs = [...doc.querySelectorAll(`a[href^="${blob}"]`)]
        .map((link) => link.getAttribute("href") ?? "")
        .filter((href) => published.has(href.slice(blob.length).split("#")[0] ?? ""));
      onGitHub.push(...hrefs.map((href) => `${file}: ${href}`));
    }
    expect(onGitHub).toEqual([]);
  });
});

describe("the controls fixture page", () => {
  const FIXTURE = "fixtures/controls/index.html";
  const demo = (id: string) => page("dist", FIXTURE).querySelector(`.demo[data-demo="${id}"]`);
  const staticSvgs = (id: string) => [...(demo(id)?.querySelectorAll("svg.demo-static") ?? [])];

  it("renders the own-theme demo's static SVGs in the broadsheet preset's family, not the site sans", () => {
    const svgs = staticSvgs("fixtures/own-theme");
    expect(svgs).toHaveLength(2);
    expect(demo("fixtures/own-theme")?.hasAttribute("data-demo-own-theme")).toBe(true);
    for (const svg of svgs) {
      const families = fontFamilies(svg);
      expect(families.length, svg.getAttribute("data-theme") ?? "").toBeGreaterThan(0);
      expect(families.every((family) => family.startsWith('"Inter Variable"'))).toBe(true);
    }
  });

  it("lays the compact demo out 360 wide and caps its stage there", () => {
    const svgs = staticSvgs("fixtures/compact");
    expect(svgs.map((svg) => svg.getAttribute("viewBox")?.split(" ")[2])).toEqual(["360", "360"]);
    expect(
      demo("fixtures/compact")?.querySelector("[data-demo-stage]")?.getAttribute("style"),
    ).toContain("--demo-width: 360px");
  });

  it("writes the host options on the spec script of a demo that sets a renderer", () => {
    const script = demo("fixtures/compact")?.querySelector("script[data-demo-spec]");
    expect(JSON.parse(script?.getAttribute("data-demo-mount") ?? "null")).toEqual({
      renderer: "svg",
    });
  });
});

describe("the landing page", () => {
  const HOME = "index.html";
  /**
   * The page's own JavaScript and CSS before lazily imported chunks, each file
   * gzipped: what a reader downloads before the page works. React's client is
   * about 66 KB of it, so the cap leaves room for the islands and catches a
   * chart or GSAP chunk imported statically by mistake (115 KB when it happened).
   */
  const MAX_OWN_ASSET_GZIP_BYTES = 160_000;
  const home = () => page("dist", HOME);
  const sections = () => [...home().querySelectorAll("main > section[data-landing-section]")];
  const textOf = (node: Element | null | undefined) => (node?.textContent ?? "").trim();

  it("has one h1 and the ten sections in order, each labelled by its one h2 from copy.ts", () => {
    expect(home().querySelectorAll("h1").length).toBe(1);
    expect(textOf(home().querySelector("h1"))).toBe(landingCopy.headline);
    expect(sections().map((section) => section.id)).toEqual([...LANDING_SECTION_IDS]);
    for (const section of sections()) {
      const headings = section.querySelectorAll("h2");
      expect(headings.length, section.id).toBe(1);
      expect(headings[0]?.id, section.id).toBe(`${section.id}-title`);
      expect(section.getAttribute("aria-labelledby"), section.id).toBe(`${section.id}-title`);
      expect(textOf(headings[0]), section.id).toBe(
        landingCopy.headings[section.id as LandingSectionId],
      );
    }
    const headings = [...home().querySelectorAll("main :is(h1, h2, h3, h4, h5, h6)")].map(textOf);
    expect(headings.filter((text, index) => headings.indexOf(text) !== index)).toEqual([]);
  });

  it("declares the cascade layer order before its first stylesheet", () => {
    const html = read("dist", HOME);
    const order = html.indexOf("@layer theme, base, sf, components, utilities;");
    expect(order).toBeGreaterThan(-1);
    expect(order).toBeLessThan(html.indexOf('rel="stylesheet"'));
  });

  it("gives every figure a caption with a Source: line", () => {
    const figures = [...home().querySelectorAll("main figure")];
    expect(figures.length).toBeGreaterThan(0);
    const unsourced = figures
      .map((figure, index) => ({ index, caption: textOf(figure.querySelector("figcaption")) }))
      .filter(({ caption }) => !/Source: \S/.test(caption))
      .map(({ index, caption }) => `figure ${index}: "${caption}"`);
    expect(unsourced).toEqual([]);
  });

  it("without JavaScript already shows the hero chart, the finished spec and every install command", () => {
    const hero = home().querySelector("#desk");
    expect(hero?.querySelector("[data-hero-chart] svg"), "a chart SVG in the hero").not.toBeNull();
    const last = heroSteps.at(-1);
    expect(last, "src/landing/hero.ts exports the hero steps").toBeDefined();
    const pane = textOf(hero?.querySelector("[data-hero-spec]"));
    const missing = [
      ...specTokens(last?.spec),
      ...heroSteps.flatMap((step) => step.changed.map((line) => line.trim())),
    ].filter((token) => !pane.includes(token));
    expect(missing).toEqual([]);
    const text = home().body.textContent ?? "";
    for (const { command } of site.install) expect(text).toContain(command);
    for (const framework of ["react", "vue", "svelte", "vanilla"]) {
      expect(text).toContain(`npm install @opendata-ai/openchart-${framework}`);
    }
  });

  it("never hides content behind a reveal script with an inline opacity: 0 or visibility: hidden", () => {
    const hidden = [...home().querySelectorAll("[style]")]
      .map((element) => element.getAttribute("style") ?? "")
      .filter((style) => INLINE_OPACITY_ZERO.test(style) || INLINE_VISIBILITY_HIDDEN.test(style));
    expect(hidden).toEqual([]);
  });

  it("keeps the page's own JavaScript and CSS under 160 KB gzipped before lazy chunks", () => {
    const assets = [...ownAssets(HOME)];
    const sizes = assets.map((path) => gzipSync(readFileSync(join("dist", path))).byteLength);
    const files = sizes.reduce((sum, size) => sum + size, 0);
    const inline = gzipSync(inlineCode(read("dist", HOME))).byteLength;
    const report = assets.map((path, index) => `${sizes[index]} ${path}`).join("\n");
    expect(files + inline, report).toBeLessThan(MAX_OWN_ASSET_GZIP_BYTES);
  });
});

const INLINE_OPACITY_ZERO =
  /(?:^|;)\s*opacity\s*:\s*(?:0+(?:\.0*)?|\.0+)%?\s*(?:!important\s*)?(?:;|$)/i;
const INLINE_VISIBILITY_HIDDEN = /(?:^|;)\s*visibility\s*:\s*hidden/i;

/**
 * The text a spec pane must show for a spec, however it is formatted: every key
 * as a JSON string and every scalar value outside `data`, which the pane folds.
 */
function specTokens(spec: unknown): string[] {
  if (Array.isArray(spec)) return spec.flatMap(specTokens);
  if (spec === undefined) return [];
  if (spec === null || typeof spec !== "object") return [JSON.stringify(spec)];
  return Object.entries(spec).flatMap(([key, value]) =>
    key === "data" ? [JSON.stringify(key)] : [JSON.stringify(key), ...specTokens(value)],
  );
}

/**
 * The scripts and stylesheets a page loads up front, as paths under dist/: its
 * script, stylesheet and modulepreload links, each island's component and
 * renderer, and everything those import statically. A dynamic `import()` is a
 * lazy chunk and is not followed.
 */
function ownAssets(file: string): Set<string> {
  const doc = page("dist", file);
  const entries = [
    ...[...doc.querySelectorAll("script[src]")].map((node) => node.getAttribute("src")),
    ...[...doc.querySelectorAll('link[rel="stylesheet"], link[rel="modulepreload"]')].map((node) =>
      node.getAttribute("href"),
    ),
    ...[...doc.querySelectorAll("astro-island")].flatMap((island) => [
      island.getAttribute("component-url"),
      island.getAttribute("renderer-url"),
      island.getAttribute("before-hydration-url"),
    ]),
  ].filter((path): path is string => Boolean(path?.startsWith("/")));
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length > 0) {
    const path = queue.pop() ?? "";
    if (seen.has(path)) continue;
    seen.add(path);
    if (!path.endsWith(".js")) continue;
    for (const [, specifier] of read("dist", path).matchAll(STATIC_RELATIVE_IMPORT)) {
      queue.push(new URL(specifier ?? "", `https://dist.invalid${path}`).pathname);
    }
  }
  return seen;
}

/** A minified static import of a sibling chunk; `import(` (a lazy chunk) never matches. */
const STATIC_RELATIVE_IMPORT = /\b(?:from|import)\s*"(\.{1,2}\/[^"]+\.js)"/g;

/** Inline scripts (not JSON data) anywhere and styles in the head, joined: the code the HTML carries. */
function inlineCode(html: string): string {
  const head = html.slice(0, html.indexOf("</head>"));
  const scripts = html.matchAll(
    /<script\b(?![^>]*\bsrc=)(?![^>]*application\/json)[^>]*>([\s\S]*?)<\/script>/g,
  );
  const styles = head.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g);
  return [...scripts, ...styles].map(([, body]) => body ?? "").join("\n");
}
