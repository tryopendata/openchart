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
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { countryIndicators } from "@datasets/country-indicators";
import { electricityMixMatrix } from "@datasets/electricity-mix-matrix";
import { gistempGlobalAnnual } from "@datasets/gistemp-global-annual";
import { nycTemperatureRange } from "@datasets/nyc-temperature-range";
import { populationByCountry } from "@datasets/population";
import { usEnergyFlow2024 } from "@datasets/us-energy-flow-2024";
import { usInflation } from "@datasets/us-inflation";
import { usStateUnemployment } from "@datasets/us-state-unemployment";
import { build as esbuild } from "esbuild";
import { Window } from "happy-dom";
import { afterEach, describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { docsAreas, site } from "../src/config";
import { sourceOf } from "../src/demos/source";
import { LANDING_SECTION_IDS, type LandingSectionId, landingCopy } from "../src/landing/copy";
import {
  buildHeroSpec,
  DEFAULT_HERO_FORM,
  DEFAULT_HERO_SPOTLIGHT,
  heroSpecDiff,
} from "../src/landing/hero";
import { GALLERY_GAPS, galleryEntries } from "../src/lib/gallery";
import { catalogPageIds } from "./catalog-pages";
import { catalogReference, docsPageList } from "./docs-pages";

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
/** The marker phase 4 left in a page's source until the page was written; none may remain. */
const STUB_MARKER = "phase-4-stub";
const PARAGRAPH_WORD_LIMIT = 90;
const sectionsOf = (areaId: string): readonly string[] =>
  docsAreas.find((area) => area.id === areaId)?.sections.map(({ id }) => id) ?? [];
const BUILDING_BLOCK_SECTIONS = sectionsOf("building-blocks");
const GUIDE_SECTIONS = sectionsOf("guides");

/** The h1 lines of a Markdown text, skipping fenced code, where `# ` starts a shell comment. */
function markdownH1s(markdown: string): string[] {
  let fenced = false;
  return markdown.split("\n").filter((line) => {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    return !fenced && line.startsWith("# ");
  });
}

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

/**
 * Every distinct font-family a static SVG's text draws with. The build lifts a
 * family every node shares onto the root, so the root's own value counts when
 * the text inherits it.
 */
function fontFamilies(svg: Element): string[] {
  const declared = [...svg.querySelectorAll("[font-family]"), svg]
    .map((node) => node.getAttribute("font-family") ?? "")
    .filter((family) => family !== "");
  return [...new Set(declared)];
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
        // A static chart is an inline SVG, a tile image, or a tile's fallback table.
        if (stage.querySelector(".demo-static, .tile-table")) continue;
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
    const markdown = read("dist", `docs/${id}.md`);
    expect(markdown.startsWith(`# ${title}\n`)).toBe(true);
    expect(markdownH1s(markdown), "h1s in the Markdown export").toEqual([`# ${title}`]);
    expect(markdown).not.toContain(STUB_MARKER);
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

  it("hydrates only the islands site.islands lists, and no island on any page but the landing page", () => {
    expect([...new Set(islandNames("dist", "index.html"))].sort()).toEqual(
      [...site.islands].sort(),
    );
    const withIslands = htmlFiles("dist").filter(
      (file) => file !== "index.html" && read("dist", file).includes("<astro-island"),
    );
    expect(withIslands).toEqual([]);
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

  it.each(docsPageList.filter(({ section }) => BUILDING_BLOCK_SECTIONS.includes(section)))(
    "$id meets the building-block rules",
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

  it.each(
    docsPageList.filter(
      ({ section, minDemos }) => GUIDE_SECTIONS.includes(section) && minDemos > 0,
    ),
  )("$id shows its minimum of sourced demos", ({ id, minDemos }) => {
    const figures = [...page("dist", pagePath(id)).querySelectorAll(".demo[data-demo]")];
    expect(figures.length, "demo figures").toBeGreaterThanOrEqual(minDemos);
    // The tutorial's toy data must match the four framework examples beside it.
    const allowIllustrative = id === GETTING_STARTED;
    expect(unsourcedFigures(figures, { allowIllustrative })).toEqual([]);
  });

  it("get-started/introduction reads tightly", () => {
    const doc = page("dist", pagePath("get-started/introduction"));
    expect(longParagraphs(doc)).toEqual([]);
    expect(
      unsourcedFigures([...doc.querySelectorAll(".demo[data-demo]")], {
        allowIllustrative: false,
      }),
    ).toEqual([]);
  });

  it.each(docsPageList.filter(({ section }) => section === "spec"))(
    "$id links to a Building-blocks or Visualizations page",
    ({ id }) => {
      const areas = linkedAreas(page("dist", pagePath(id)));
      expect(areas.some((area) => area === "building-blocks" || area === "visualizations")).toBe(
        true,
      );
    },
  );

  it.each(Object.entries(catalogReference))("%s links to its reference page, %s", (id, ref) => {
    const prose = page("dist", pagePath(id)).querySelectorAll('.docs-prose a[href^="/docs/"]');
    const hrefs = [...prose].map((link) => link.getAttribute("href") ?? "");
    expect(hrefs.filter((href) => href.startsWith(`/docs/${ref}/`))).not.toEqual([]);
  });

  it("no source file under docs/ or src/content still carries the stub marker", () => {
    const sources = [resolve("../docs"), resolve("src/content")].flatMap((dir) =>
      readdirSync(dir, { recursive: true, encoding: "utf8" })
        .map((file) => join(dir, file))
        .filter((file) => statSync(file).isFile()),
    );
    expect(sources.length).toBeGreaterThan(50);
    expect(sources.filter((file) => readFileSync(file, "utf8").includes(STUB_MARKER))).toEqual([]);
  });
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
    const defaultSpec = buildHeroSpec(DEFAULT_HERO_FORM, DEFAULT_HERO_SPOTLIGHT);
    const defaultDiff = heroSpecDiff(DEFAULT_HERO_FORM, DEFAULT_HERO_SPOTLIGHT);
    const pane = textOf(hero?.querySelector("[data-hero-spec]"));
    const missing = [
      ...specTokens(defaultSpec),
      ...defaultDiff.lines.filter((line) => line.added).map((line) => line.text.trim()),
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
    const { total, report } = upFrontWeight(HOME);
    expect(total, report).toBeLessThan(MAX_OWN_ASSET_GZIP_BYTES);
  });

  it("is at most 620 KB of HTML", () => {
    expect(statSync(join("dist", HOME)).size).toBeLessThanOrEqual(MAX_LANDING_PAGE_BYTES);
  });
});

/**
 * The landing page's HTML cap. It was 587 KB once the hero's spec lines were
 * formatted in the island and every static SVG lost the attributes only a live
 * chart reads, down from 806 KB. The cap leaves about one more inline light and
 * dark static pair (30 KB), so a new section that inlines more has to cut elsewhere.
 */
const MAX_LANDING_PAGE_BYTES = 620_000;

/**
 * A page's own JavaScript and CSS before lazily imported chunks, each file
 * gzipped: what a reader downloads before the page works. React's client is
 * about 66 KB of the landing page's, so the cap leaves room for the islands and
 * catches a chart or GSAP chunk imported statically by mistake (115 KB when it happened).
 */
const MAX_OWN_ASSET_GZIP_BYTES = 160_000;

/** The gzipped size of a page's up-front assets plus its inline code, with a per-file report. */
function upFrontWeight(file: string): { total: number; report: string } {
  const assets = [...ownAssets(file)];
  const sizes = assets.map((path) => gzipSync(readFileSync(join("dist", path))).byteLength);
  const inline = gzipSync(inlineCode(read("dist", file))).byteLength;
  const total = sizes.reduce((sum, size) => sum + size, inline);
  const report = assets.map((path, index) => `${sizes[index]} ${path}`).join("\n");
  return { total, report: `${file}: ${total} bytes\n${report}\n${inline} inline` };
}

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

// ---------------------------------------------------------------------------
// Phase 5: the header and footer, the examples gallery, search and the blog.

/** The marker phase 5 left in a lane's stub until its work was done; none may remain. */
const PHASE_5_STUB = "phase-5-stub";

/** The sample post lane d writes. */
const SAMPLE_POST = "how-to-chart-a-temperature-anomaly";
const EM_DASH = "—";

/** A blog post as its source file declares it. */
type SourcePost = {
  slug: string;
  title: string;
  published: Date;
  updated?: Date;
  author: string;
  tags: string[];
  related: string[];
  draft: boolean;
};

/** Every post in src/content/blog, read from its frontmatter. */
function sourcePosts(): SourcePost[] {
  const dir = "src/content/blog";
  return readdirSync(dir)
    .filter((file) => /\.mdx?$/.test(file))
    .map((file) => {
      const [, yaml = ""] = /^---\n([\s\S]*?)\n---/.exec(read(dir, file)) ?? [];
      const data = (parseYaml(yaml) ?? {}) as Record<string, unknown>;
      return {
        slug: file.replace(/\.mdx?$/, ""),
        title: String(data.title ?? ""),
        published: new Date(String(data.published)),
        ...(data.updated ? { updated: new Date(String(data.updated)) } : {}),
        author: String(data.author ?? ""),
        tags: (data.tags ?? []) as string[],
        related: (data.related ?? []) as string[],
        draft: data.draft === true,
      };
    });
}

const posts = sourcePosts().filter((post) => !post.draft);
const postTags = [...new Set(posts.flatMap((post) => post.tags))];
const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const entryPath = (slug: string) => `examples/${slug}/index.html`;
const postPath = (slug: string) => `blog/${slug}/index.html`;
const tagPath = (tag: string) => `blog/tags/${tag}/index.html`;

/** The source label of each tier-1 dataset: the only data the gallery and the blog may draw. */
const TIER_1_LABELS = [
  countryIndicators,
  electricityMixMatrix,
  nycTemperatureRange,
  populationByCountry,
  usInflation,
  usStateUnemployment,
  gistempGlobalAnnual,
  usEnergyFlow2024,
].map((dataset) => sourceOf(dataset).label);

/** Whether a figure's caption cites a tier-1 dataset. */
function citesTier1(figure: Element): boolean {
  const caption = figure.querySelector("figcaption")?.textContent ?? "";
  return TIER_1_LABELS.some((label) => caption.includes(`Source: ${label}`));
}

/** The search area a docs page is filed under: its area's label. */
const docsAreaLabel = (id: string) =>
  docsAreas.find((area) => sectionsOf(area.id).includes(id.split("/")[0] ?? ""))?.label ?? "";

/** Every page search should index, by built file, with the area its meta must name. */
const indexedPages = new Map<string, string>([
  ...docs.map((doc): [string, string] => [pagePath(doc.id), docsAreaLabel(doc.id)]),
  ...galleryEntries.map((entry): [string, string] => [entryPath(entry.slug), "Examples"]),
  ...posts.map((post): [string, string] => [postPath(post.slug), "Blog"]),
]);

/** The opening tags in raw HTML that carry `data-pagefind-body`; escaped code never matches. */
const searchBodies = (html: string) =>
  html.match(/<[a-z]+\s[^>]*\bdata-pagefind-body\b[^>]*>/g) ?? [];

/** An element's text outside demo figures and code blocks: the prose a reader reads. */
function proseText(element: Element | null | undefined): string {
  if (!element) return "";
  const copy = element.cloneNode(true) as Element;
  for (const node of copy.querySelectorAll(".demo, pre")) node.remove();
  return copy.textContent ?? "";
}

/** Parses only a page's header, so a pass over every page never holds a parsed chart. */
function headerOf(window: Window, file: string): Document {
  const header = /<header\b[\s\S]*?<\/header>/.exec(read("dist", file))?.[0] ?? "";
  const parser = new window.DOMParser();
  return parser.parseFromString(`<body>${header}</body>`, "text/html") as unknown as Document;
}

/** Parses the RSS feed as XML. */
function rssFeed(window: Window): Document {
  const parser = new window.DOMParser();
  return parser.parseFromString(
    read("dist", "blog/rss.xml"),
    "application/xml",
  ) as unknown as Document;
}

describe("the header and footer", () => {
  it("every page's main nav lists Docs, Examples, Blog and GitHub, marks the current one, and the header has one search trigger", async () => {
    const window = new Window();
    const problems: string[] = [];
    try {
      for (const file of htmlFiles("dist")) {
        const header = headerOf(window, file);
        const links = [...header.querySelectorAll('nav[aria-label="Main"] a')];
        const labels = links.map((link) => link.textContent?.trim()).join(", ");
        if (labels !== "Docs, Examples, Blog, GitHub") problems.push(`${file}: ${labels}`);
        const path = `/${file.replace(/index\.html$/, "")}`;
        const expected = ["/docs/", "/examples/", "/blog/"].find((href) => path.startsWith(href));
        const current = links
          .filter((link) => link.getAttribute("aria-current") === "page")
          .map((link) => link.getAttribute("href"))
          .join();
        if (current !== (expected ?? "")) problems.push(`${file}: current is "${current}"`);
        const triggers = header.querySelectorAll('[data-search-trigger][aria-haspopup="dialog"]');
        if (triggers.length !== 1) problems.push(`${file}: ${triggers.length} search triggers`);
      }
    } finally {
      await window.happyDOM.close();
    }
    expect(problems).toEqual([]);
  });

  it("the footer links the examples, the blog and the RSS feed", () => {
    const footer = page("dist", "index.html").querySelector("footer");
    for (const href of ["/examples/", "/blog/", "/blog/rss.xml"]) {
      expect(footer?.querySelector(`a[href="${href}"]`), href).not.toBeNull();
    }
  });

  it("every page links the blog's RSS feed as an alternate", () => {
    const feedLink =
      '<link rel="alternate" type="application/rss+xml" title="OpenChart blog" href="/blog/rss.xml">';
    expect(htmlFiles("dist").filter((file) => !read("dist", file).includes(feedLink))).toEqual([]);
  });
});

describe("the gallery and blog pages", () => {
  const files = [
    "examples/index.html",
    ...galleryEntries.map((entry) => entryPath(entry.slug)),
    "blog/index.html",
    ...posts.map((post) => postPath(post.slug)),
    ...postTags.map(tagPath),
  ];

  it("include at least one entry, one post and one tag page", () => {
    expect(galleryEntries.length).toBeGreaterThan(0);
    expect(posts.length).toBeGreaterThan(0);
    expect(postTags.length).toBeGreaterThan(0);
  });

  it.each(files)("%s has one h1, its canonical and a description", (file) => {
    const doc = page("dist", file);
    expect(doc.querySelectorAll("h1")).toHaveLength(1);
    const path = `/${file.replace(/index\.html$/, "")}`;
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(absolute(path));
    expect(doc.querySelector('meta[name="description"]')?.getAttribute("content")).toBeTruthy();
  });

  it.each([
    ...galleryEntries.map((entry) => [entryPath(entry.slug), `og/examples/${entry.slug}.png`]),
    ...posts.map((post) => [postPath(post.slug), `og/blog/${post.slug}.png`]),
  ])("%s has its own social card, %s", (file, card) => {
    const image = page("dist", file).querySelector('meta[property="og:image"]');
    expect(image?.getAttribute("content")).toBe(absolute(`/${card}`));
    expect(readFileSync(join("dist", card)).subarray(1, 4).toString()).toBe("PNG");
  });

  it("the sitemap lists the gallery, every entry, the blog and every post, and no tag page", () => {
    const sitemap = read("dist", "sitemap-0.xml");
    const paths = [
      "/examples/",
      ...galleryEntries.map((entry) => `/examples/${entry.slug}/`),
      "/blog/",
      ...posts.map((post) => `/blog/${post.slug}/`),
    ];
    for (const path of paths) expect(sitemap, path).toContain(`<loc>${absolute(path)}</loc>`);
    expect(sitemap).not.toContain("/blog/tags/");
  });

  it.each(postTags)("the %s tag page is noindex, follow", (tag) => {
    const robots = page("dist", tagPath(tag)).querySelector('meta[name="robots"]');
    expect(robots?.getAttribute("content")).toBe("noindex, follow");
  });

  it("every docs page, the gallery and each entry page is at most 500 KB of HTML", () => {
    // Over the cap before phase 5: 30 highlighted code blocks, about 350 KB of the page.
    const knownOversized = ["agents/agent-patterns"];
    const checked = [
      ...docs.filter(({ id }) => !knownOversized.includes(id)).map(({ id }) => pagePath(id)),
      "examples/index.html",
      ...galleryEntries.map((entry) => entryPath(entry.slug)),
    ];
    const oversized = checked
      .map((file) => ({ file, bytes: statSync(join("dist", file)).size }))
      .filter(({ bytes }) => bytes > MAX_VISUALIZATION_PAGE_BYTES);
    expect(oversized).toEqual([]);
  });

  it("a json demo fence in an MDX post becomes a demo figure with both static SVGs", () => {
    const figure = page("dist", postPath(SAMPLE_POST)).querySelector('.demo[data-demo^="fence-"]');
    expect(figure?.querySelectorAll("svg.demo-static")).toHaveLength(2);
    expect(figure?.querySelector("figcaption")?.textContent).toMatch(/Source: \S/);
  });

  it("the RSS feed parses as XML and has one item per published post", async () => {
    const window = new Window();
    try {
      const feed = rssFeed(window);
      expect(feed.querySelector("parsererror")).toBeNull();
      expect(feed.querySelector("rss > channel > title")?.textContent).toBeTruthy();
      const links = [...feed.querySelectorAll("channel > item > link")].map(
        (link) => link.textContent,
      );
      expect(links.sort()).toEqual(posts.map((post) => absolute(`/blog/${post.slug}/`)).sort());
    } finally {
      await window.happyDOM.close();
    }
  });
});

describe("the search index", () => {
  it("is written to dist/pagefind and counts every docs page, gallery entry and published post", () => {
    expect(existsSync("dist/pagefind/pagefind.js")).toBe(true);
    const entry = JSON.parse(read("dist", "pagefind/pagefind-entry.json")) as {
      languages: Record<string, { page_count: number }>;
    };
    const pageCount = Object.values(entry.languages).reduce(
      (sum, language) => sum + language.page_count,
      0,
    );
    expect(pageCount).toBe(docs.length + galleryEntries.length + posts.length);
  });

  it("each indexed page has one search body naming its area, and no other page has one", () => {
    const problems: string[] = [];
    for (const file of htmlFiles("dist")) {
      const bodies = searchBodies(read("dist", file));
      const area = indexedPages.get(file);
      if (area === undefined) {
        if (bodies.length > 0) problems.push(`${file}: has a search body but is not indexed`);
      } else if (bodies.length !== 1) {
        problems.push(`${file}: ${bodies.length} search bodies`);
      } else if (!bodies[0]?.includes(`data-pagefind-meta="area:${area}"`)) {
        problems.push(`${file}: ${bodies[0]} does not name area ${area}`);
      }
    }
    expect(indexedPages.size).toBe(docs.length + galleryEntries.length + posts.length);
    expect(problems).toEqual([]);
    for (const file of ["index.html", "examples/index.html", "blog/index.html"]) {
      expect(searchBodies(read("dist", file)), file).toEqual([]);
    }
  });

  it("loads no search code up front, and the gallery and a post stay under the landing page's budget", () => {
    const samplePages = [
      "index.html",
      pagePath(BAR),
      "examples/index.html",
      postPath(posts[0]?.slug ?? SAMPLE_POST),
    ];
    for (const file of samplePages) {
      const searchAssets = [...ownAssets(file)].filter((path) =>
        /pagefind|search-dialog/.test(path),
      );
      expect(searchAssets, file).toEqual([]);
    }
    for (const file of ["examples/index.html", postPath(posts[0]?.slug ?? SAMPLE_POST)]) {
      const { total, report } = upFrontWeight(file);
      expect(total, report).toBeLessThan(MAX_OWN_ASSET_GZIP_BYTES);
    }
  });

  it("keeps search's eager script, with what it imports statically, to 2 KB gzipped", async () => {
    const { metafile, outputFiles } = await esbuild({
      entryPoints: ["src/scripts/search.ts"],
      bundle: true,
      format: "esm",
      splitting: true,
      minify: true,
      metafile: true,
      write: false,
      outdir: "search-size",
      logLevel: "silent",
    });
    const { outputs } = metafile;
    const entry = Object.keys(outputs).find((path) => outputs[path]?.entryPoint);
    const eager = new Set<string>();
    const queue = entry ? [entry] : [];
    while (queue.length > 0) {
      const path = queue.pop() ?? "";
      if (eager.has(path)) continue;
      eager.add(path);
      for (const imported of outputs[path]?.imports ?? []) {
        if (imported.kind === "import-statement") queue.push(imported.path);
      }
    }
    const bytes = outputFiles
      .filter((file) => [...eager].some((path) => file.path.endsWith(path)))
      .reduce((sum, file) => sum + gzipSync(file.contents).byteLength, 0);
    expect(eager.size).toBeGreaterThan(0);
    expect(bytes).toBeLessThanOrEqual(2048);
  });
});

describe("the gallery's content (lane a)", () => {
  const sections: readonly { id: string; label: string }[] = docsAreas.flatMap(
    (area): readonly { id: string; label: string }[] => area.sections,
  );
  const kindLabel = (kind: string) => sections.find((section) => section.id === kind)?.label;

  it("has at least 24 entries, with unique slugs and demos", () => {
    expect(galleryEntries.length).toBeGreaterThanOrEqual(24);
    for (const key of ["slug", "demo"] as const) {
      const values = galleryEntries.map((entry) => entry[key]);
      expect(
        values.filter((value, index) => values.indexOf(value) !== index),
        key,
      ).toEqual([]);
    }
  });

  it("titles each entry's chart with a finding, and draws it from tier-1 data", async () => {
    const { getDemo } = await import("../src/demos/registry");
    const problems = galleryEntries.flatMap((entry) => {
      const demo = getDemo(entry.demo);
      const chrome = (demo.spec as { chrome?: { title?: string | { text: string } } }).chrome;
      const title = typeof chrome?.title === "string" ? chrome.title : (chrome?.title?.text ?? "");
      const found: string[] = [];
      if (title === "" || title.length > 90) found.push(`title "${title}" is empty or over 90`);
      if (title.includes("!")) found.push(`title "${title}" has "!"`);
      if (title === kindLabel(entry.kind)) found.push(`title "${title}" is the kind's label`);
      // Map demos add their geography after the dataset's label.
      if (!TIER_1_LABELS.some((label) => demo.source.label.startsWith(label))) {
        found.push(`source "${demo.source.label}"`);
      }
      return found.map((problem) => `${entry.slug}: ${problem}`);
    });
    expect(problems).toEqual([]);
  });

  it("covers every Visualizations section except those GALLERY_GAPS lists", () => {
    const covered = new Set<string>([
      ...galleryEntries.map((entry) => entry.kind),
      ...GALLERY_GAPS.map((gap) => gap.kind),
    ]);
    expect(sectionsOf("visualizations").filter((id) => !covered.has(id))).toEqual([]);
  });

  it("links each tile to its entry page", () => {
    const wall = page("dist", "examples/index.html");
    const missing = galleryEntries.filter(
      (entry) => !wall.querySelector(`main a[href="/examples/${entry.slug}/"]`),
    );
    expect(missing.map((entry) => entry.slug)).toEqual([]);
  });

  it.each(galleryEntries)(
    "$slug shows its demo with Code and Copy, a tier-1 source and its docs link",
    (entry) => {
      const doc = page("dist", entryPath(entry.slug));
      const figures = [...doc.querySelectorAll(`.demo[data-demo="${entry.demo}"]`)];
      expect(figures).toHaveLength(1);
      const [figure] = figures as [Element];
      expect(figure.querySelector("button[data-demo-toggle]")?.textContent).toBe("Code");
      expect(figure.querySelectorAll("button[data-demo-copy]")).toHaveLength(1);
      expect(citesTier1(figure), "the figure cites tier-1 data").toBe(true);
      expect(doc.querySelector(`main a[href="${entry.docs}"]`)).not.toBeNull();
      expect(proseText(doc.querySelector("main"))).not.toContain(EM_DASH);
    },
  );
});

describe("the blog's content (lane d)", () => {
  it.each(posts)("$slug has at least two tier-1 figures, one of them from a json demo fence", (post) => {
    const prose = page("dist", postPath(post.slug)).querySelector("article .docs-prose");
    const figures = [...(prose?.querySelectorAll(".demo[data-demo]") ?? [])];
    expect(figures.length).toBeGreaterThanOrEqual(2);
    const untraced = figures.filter((figure) => !citesTier1(figure));
    expect(untraced.map((figure) => figure.getAttribute("data-demo"))).toEqual([]);
    const fenced = figures.filter((figure) =>
      figure.getAttribute("data-demo")?.startsWith("fence-"),
    );
    expect(fenced.length).toBeGreaterThanOrEqual(1);
  });

  it.each(posts)("$slug has a byline: the author, the date, then the reading time", (post) => {
    const byline = page("dist", postPath(post.slug)).querySelector("[data-byline]");
    const [author, time, reading] = [...(byline?.children ?? [])];
    expect(author?.textContent?.trim()).toBe(post.author);
    expect(time?.tagName).toBe("TIME");
    expect(time?.getAttribute("datetime")).toBe(isoDay(post.published));
    expect(reading?.textContent?.trim()).toMatch(/^\d+ min read$/);
  });

  it.each(posts)("$slug is an article whose BlogPosting JSON-LD matches it", (post) => {
    const doc = page("dist", postPath(post.slug));
    expect(doc.querySelector('meta[property="og:type"]')?.getAttribute("content")).toBe("article");
    const json = doc.querySelector('script[type="application/ld+json"]')?.textContent ?? "{}";
    const ld = JSON.parse(json);
    const canonical = absolute(`/blog/${post.slug}/`);
    const mainEntity =
      typeof ld.mainEntityOfPage === "string" ? ld.mainEntityOfPage : ld.mainEntityOfPage?.["@id"];
    expect(ld["@type"]).toBe("BlogPosting");
    expect(ld.headline).toBe(post.title);
    expect(isoDay(new Date(ld.datePublished))).toBe(isoDay(post.published));
    expect(isoDay(new Date(ld.dateModified))).toBe(isoDay(post.updated ?? post.published));
    expect(ld.author?.name).toBe(post.author);
    expect(ld.image).toBe(absolute(`/og/blog/${post.slug}.png`));
    expect(mainEntity).toBe(canonical);
  });

  it.each(posts)("$slug ends on one paragraph of at most 30 words with one link", (post) => {
    const prose = page("dist", postPath(post.slug)).querySelector("article .docs-prose");
    const last = prose?.lastElementChild;
    expect(last?.tagName).toBe("P");
    expect((last?.textContent ?? "").trim().split(/\s+/).length).toBeLessThanOrEqual(30);
    expect(last?.querySelectorAll("a")).toHaveLength(1);
  });

  it.each(posts)("$slug links each related docs page", (post) => {
    const doc = page("dist", postPath(post.slug));
    expect(post.related.length).toBeGreaterThan(0);
    const missing = post.related.filter(
      (id) => !doc.querySelector(`article a[href="/docs/${id}/"]`),
    );
    expect(missing).toEqual([]);
  });

  it.each(posts)("$slug reads tightly: short paragraphs, no em dash, no repeated heading", (post) => {
    const doc = page("dist", postPath(post.slug));
    expect(longParagraphs(doc)).toEqual([]);
    expect(proseText(doc.querySelector("article"))).not.toContain(EM_DASH);
    expect(repeatedHeadings(doc)).toEqual([]);
  });

  it.each(posts)(
    "$slug has an RSS item with its canonical, its date and one category per tag",
    async (post) => {
      const window = new Window();
      try {
        const canonical = absolute(`/blog/${post.slug}/`);
        const item = [...rssFeed(window).querySelectorAll("item")].find(
          (candidate) => candidate.querySelector("link")?.textContent === canonical,
        );
        expect(item?.querySelector("guid")?.textContent).toBe(canonical);
        const published = new Date(item?.querySelector("pubDate")?.textContent ?? "");
        expect(isoDay(published)).toBe(isoDay(post.published));
        expect(item?.querySelectorAll("category")).toHaveLength(post.tags.length);
      } finally {
        await window.happyDOM.close();
      }
    },
  );

  it.each(postTags)("the %s tag page lists exactly the posts with that tag", (tag) => {
    const listed = [...page("dist", tagPath(tag)).querySelectorAll("main a[href]")]
      .map((link) => link.getAttribute("href") ?? "")
      .filter((href) => /^\/blog\/(?!tags\/)[a-z0-9-]+\/$/.test(href));
    const tagged = posts.filter((post) => post.tags.includes(tag));
    expect([...new Set(listed)].sort()).toEqual(tagged.map((post) => `/blog/${post.slug}/`).sort());
  });
});

describe("phase 5 close", () => {
  it("no source file still carries the phase 5 stub marker", () => {
    const sources = readdirSync("src", { recursive: true, encoding: "utf8" })
      .map((file) => join("src", file))
      .filter((file) => statSync(file).isFile());
    expect(sources.filter((file) => read(".", file).includes(PHASE_5_STUB))).toEqual([]);
  });
});

// The layout only calls initAnalytics, and only creates the consent store and
// banner, when the build has a key, so a keyless build (dev, CI, previews) bundles
// none of it. The banner's stylesheet ships either way, with the other library CSS.
describe("analytics in the build", () => {
  // Every JavaScript file a page loads or may load: its inline scripts, script tags
  // and island components, renderers and before-hydration scripts, then the imports
  // (static, and dynamic with any quote style) of each file they reach.
  function scriptsReachedFrom(root: string, file: string): Map<string, string> {
    const html = read(root, file);
    const reached = new Map<string, string>();
    const pending: string[] = [];
    const follow = (source: string, folder: string) => {
      // Match static imports, re-exports and dynamic import()s, never JSON strings like
      // `{ import: "./dist/index.js" }` from an inlined package.json.
      const imports =
        /(?:\bfrom|\bimport(?!\s*:))\s*(?:\(\s*)?["'`](\.{1,2}\/|\/(?!\/))([^"'`]+\.js)["'`]/g;
      for (const m of source.matchAll(imports)) {
        const prefix = m[1] ?? "";
        const target = m[2] ?? "";
        // A template such as posthog-js's `/static/${version}/${name}.js` is a URL
        // built at run time for its CDN scripts, not a file in the build.
        if (target.includes("${")) continue;
        const resolved = new URL(`${prefix}${target}`, `https://dist.invalid/${folder}`).pathname;
        pending.push(resolved.slice(1));
      }
    };
    const pageFolder = file.slice(0, file.lastIndexOf("/") + 1);
    const inline = html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g);
    for (const [index, m] of Array.from(inline).entries()) {
      const source = m[1] ?? "";
      reached.set(`${file}#inline-${index}`, source);
      follow(source, pageFolder);
    }
    const entries =
      /(?:<script[^>]*\ssrc|\scomponent-url|\srenderer-url|\sbefore-hydration-url)="\/(?!\/)([^"]+\.js)"/g;
    pending.push(...Array.from(html.matchAll(entries), (m) => m[1] ?? ""));
    for (let path = pending.pop(); path !== undefined; path = pending.pop()) {
      if (reached.has(path)) continue;
      const source = read(root, path);
      reached.set(path, source);
      follow(source, path.slice(0, path.lastIndexOf("/") + 1));
    }
    return reached;
  }

  function stylesheetsOf(root: string, file: string): Map<string, string> {
    const html = read(root, file);
    const links = html.matchAll(/<link[^>]*\srel="stylesheet"[^>]*\shref="\/([^"]+)"/g);
    return new Map(Array.from(links, (m) => m[1] ?? "").map((path) => [path, read(root, path)]));
  }

  const filesContaining = (reached: Map<string, string>, text: string) =>
    [...reached].filter(([, source]) => source.includes(text)).map(([path]) => path);

  const analyticsMarker = "us.i.posthog.com";
  const sdkMarker = "__ph_opt_in_out_";
  const consentMarker = "sf-consent";
  const bannerStyleMarker = "--sf-consent-background";
  const isConsentStyle = (source: string) => /\[data-part=["']?consent["']?\]/.test(source);
  const siteValue = /site:\s*["'`]openchart["'`]/;

  function buildWithKey(key: string) {
    const out = mkdtempSync(join(tmpdir(), "openchart-analytics-"));
    const built = spawnSync("bunx", ["--no-install", "astro", "build", "--outDir", out], {
      encoding: "utf8",
      timeout: 150_000,
      env: { ...process.env, PUBLIC_POSTHOG_KEY: key },
    });
    expect(built.status, `${built.stdout}\n${built.stderr}`).toBe(0);
    return out;
  }

  it("loads no analytics or consent code without a PostHog key", () => {
    const out = buildWithKey("");
    try {
      const reached = scriptsReachedFrom(out, "index.html");
      expect(reached.size).toBeGreaterThan(0);
      expect(filesContaining(reached, analyticsMarker)).toEqual([]);
      expect(filesContaining(reached, consentMarker)).toEqual([]);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 180_000);

  it("loads the key once, posthog-js, the banner and its styles when the build has a key", () => {
    const key = "openchart-build-test-key";
    const out = buildWithKey(key);
    try {
      const reached = scriptsReachedFrom(out, "index.html");
      expect(filesContaining(reached, key)).toHaveLength(1);
      expect(filesContaining(reached, sdkMarker)).toHaveLength(1);
      expect(filesContaining(reached, consentMarker)).not.toEqual([]);
      const sources = [...reached.values()];
      expect(sources.some((source) => siteValue.test(source))).toBe(true);
      expect(sources.some((source) => /domain:\s*["'`]steamfield\.io["'`]/.test(source))).toBe(
        true,
      );
      const styles = [...stylesheetsOf(out, "index.html").values()];
      expect(styles.some((source) => source.includes(bannerStyleMarker))).toBe(true);
      expect(styles.some(isConsentStyle)).toBe(true);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 180_000);

  it("links the shared privacy page from the footer and masks search fields for recordings", () => {
    const home = page("dist", "index.html");
    expect(home.querySelector('footer a[href="https://steamfield.io/privacy"]')).not.toBeNull();
    expect(home.querySelector("[data-search-input]")?.hasAttribute("data-ph-mask")).toBe(true);
    expect(home.querySelector("[data-search-results]")?.hasAttribute("data-ph-mask")).toBe(true);
    expect(home.querySelector("[data-search-status]")?.hasAttribute("data-ph-mask")).toBe(true);
  });
});
