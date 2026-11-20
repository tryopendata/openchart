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
import { join, resolve } from "node:path";
import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";
import { docsAreas, site } from "../src/config";
import { LANDING_SECTION_IDS, type LandingSectionId, landingCopy } from "../src/landing/copy";
import { heroSteps } from "../src/landing/hero";
import { catalogPageIds } from "./catalog-pages";

const parser = new new Window().DOMParser();
const read = (root: string, path: string) => readFileSync(join(root, path), "utf8");
// Parsed once per file: the link check asks for the same large pages many times.
const parsed = new Map<string, Document>();
function page(root: string, path: string): Document {
  const file = join(root, path);
  let document = parsed.get(file);
  if (!document) {
    // happy-dom drops everything after a <style> inside an inline <svg>, and map
    // charts carry one. No test here reads styles, so they are removed before parsing.
    const html = read(root, path).replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, "");
    document = parser.parseFromString(html, "text/html") as unknown as Document;
    parsed.set(file, document);
  }
  return document;
}
const absolute = (path: string) => new URL(path, site.url).href;
const pagePath = (id: string) => `docs/${id}/index.html`;

const frontmatter = (source: string, key: string) =>
  new RegExp(`^${key}:\\s*["']?(.+?)["']?\\s*$`, "m").exec(source.split("\n---")[0] ?? "")?.[1];

/** Every published page: site pages under src/content/docs, and repo docs/*.md that declare a section. */
function sourceDocs(root = ".") {
  const base = join(root, "src/content/docs");
  const sitePages = readdirSync(base, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.mdx?$/.test(file))
    .map((file) => ({
      id: file.replace(/\.mdx?$/, "").replaceAll("\\", "/"),
      title: frontmatter(readFileSync(join(base, file), "utf8"), "title") ?? "",
    }));
  const repoDocs = resolve("../docs");
  const repoPages = readdirSync(repoDocs)
    .filter((file) => file.endsWith(".md"))
    .map((file) => ({ file, source: readFileSync(join(repoDocs, file), "utf8") }))
    .filter(({ source }) => source.startsWith("---\n") && frontmatter(source, "section"))
    .map(({ file, source }) => ({
      id: `${frontmatter(source, "section")}/${frontmatter(source, "slug") ?? file.replace(/\.md$/, "")}`,
      title: frontmatter(source, "title") ?? "",
    }));
  return [...sitePages, ...repoPages];
}

function htmlFiles(root: string) {
  return readdirSync(root, { recursive: true, encoding: "utf8" }).filter((file) =>
    file.endsWith(".html"),
  );
}

function islandNames(root: string, path: string) {
  return [...page(root, path).querySelectorAll("astro-island")].map(
    (island) => JSON.parse(island.getAttribute("opts") ?? "{}").name as string,
  );
}

const docs = sourceDocs();
const BAR = "comparison/bar";
const GETTING_STARTED = "get-started/getting-started";
/** A catalog page carries several demos; past this its HTML is too slow on a phone connection. */
const MAX_VISUALIZATION_PAGE_BYTES = 500_000;

describe("the page set", () => {
  it("includes the first catalog page and the first guide", () => {
    expect(docs.map(({ id }) => id)).toEqual(expect.arrayContaining([BAR, GETTING_STARTED]));
  });
});

describe("demos", () => {
  it("the bar page shows at least three demos, each with both static SVGs and five code tabs", () => {
    const figures = [...page("dist", pagePath(BAR)).querySelectorAll("figure[data-demo]")];
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
      expect(figure.querySelector("figcaption")?.textContent, id).toMatch(/Source: \S/);
    }
  });

  it("a json demo fence in repo Markdown becomes a demo figure", () => {
    const figures = page("dist", pagePath(GETTING_STARTED)).querySelectorAll(
      'figure[data-demo^="fence-"]',
    );
    expect(figures.length).toBeGreaterThanOrEqual(1);
    expect(figures[0]?.querySelector("svg.demo-static")).not.toBeNull();
  });

  it("every stage without a static SVG shows the demo's title and a drawn-in-the-browser line", () => {
    const missing: string[] = [];
    let stages = 0;
    // The broken-demo fixture writes its figure by hand to test the failure state.
    for (const file of htmlFiles("dist").filter((file) => !file.includes("broken-demo"))) {
      for (const stage of page("dist", file).querySelectorAll("[data-demo-stage]")) {
        if (stage.querySelector("svg.demo-static")) continue;
        stages += 1;
        const text = stage.querySelector("p[data-demo-placeholder]")?.textContent ?? "";
        if (!/^\S.*\. This chart is drawn in the browser\.$/.test(text)) {
          missing.push(`${file}: ${stage.closest("figure")?.getAttribute("data-demo")}`);
        }
      }
    }
    expect(stages).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });

  it("writes each shared value once per page, and every figure's references resolve on its page", () => {
    const problems: string[] = [];
    let references = 0;
    for (const file of htmlFiles("dist")) {
      const doc = page("dist", file);
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

  it.each([BAR, GETTING_STARTED])("%s repeats no element id", (id) => {
    const ids = [...page("dist", pagePath(id)).querySelectorAll("[id]")].map((node) => node.id);
    const repeated = ids.filter((value, index) => ids.indexOf(value) !== index);
    expect([...new Set(repeated)]).toEqual([]);
  });
});

describe("docs navigation", () => {
  it("the sidebar lists the current area only, and the area switcher lists every area with pages", () => {
    const bar = page("dist", pagePath(BAR));
    const sidebar = bar.querySelector('nav[aria-label="Docs"]');
    expect(sidebar?.querySelector(`a[href="/docs/${BAR}/"]`)).not.toBeNull();
    expect(sidebar?.querySelector(`a[href="/docs/${GETTING_STARTED}/"]`)).toBeNull();
    const areas = [...bar.querySelectorAll('nav[aria-label="Docs areas"] a')];
    expect(areas.map((area) => area.textContent?.trim())).toEqual(["Guides", "Visualizations"]);
    expect(
      areas.find((area) => area.getAttribute("aria-current") === "page")?.textContent?.trim(),
    ).toBe("Visualizations");
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
  it("has no broken internal links or anchors", () => {
    const broken: string[] = [];
    for (const file of htmlFiles("dist")) {
      const self = `/${file.replace(/index\.html$/, "")}`;
      for (const link of page("dist", file).querySelectorAll("a[href]")) {
        const href = link.getAttribute("href") ?? "";
        if (!href.startsWith("/") && !href.startsWith("#")) continue;
        if (href.startsWith("//")) continue;
        const [path = "", hash] = (href.startsWith("#") ? `${self}${href}` : href).split("#");
        const target = path.endsWith("/") ? `${path}index.html` : path;
        if (!existsSync(join("dist", target))) {
          broken.push(`${file}: ${href}`);
        } else if (hash && target.endsWith(".html")) {
          if (!page("dist", target).getElementById(decodeURIComponent(hash))) {
            broken.push(`${file}: ${href} (no #${hash})`);
          }
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it("hydrates only the islands site.islands lists, and none on docs pages", () => {
    expect([...new Set(islandNames("dist", "index.html"))].sort()).toEqual(
      [...site.islands].sort(),
    );
    for (const file of htmlFiles("dist").filter((file) => file.startsWith("docs"))) {
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
    const figures = [...page("dist", pagePath(id)).querySelectorAll("figure[data-demo]")];
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

describe("the landing page", () => {
  const HOME = "index.html";
  /** The page's own JavaScript and CSS, uncompressed, before lazily imported chunks. */
  const MAX_OWN_ASSET_BYTES = 350_000;
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

  it("keeps the page's own JavaScript and CSS under 350 KB before lazy chunks", () => {
    const assets = [...ownAssets(HOME)];
    const files = assets.reduce((sum, path) => sum + statSync(join("dist", path)).size, 0);
    const inline = inlineCodeBytes(read("dist", HOME));
    expect(files + inline, assets.join("\n")).toBeLessThan(MAX_OWN_ASSET_BYTES);
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

/** Bytes of inline scripts (not JSON data) anywhere and of styles in the head: code the HTML carries. */
function inlineCodeBytes(html: string): number {
  const head = html.slice(0, html.indexOf("</head>"));
  const scripts = html.matchAll(
    /<script\b(?![^>]*\bsrc=)(?![^>]*application\/json)[^>]*>([\s\S]*?)<\/script>/g,
  );
  const styles = head.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g);
  return [...scripts, ...styles].reduce(
    (sum, [, body]) => sum + Buffer.byteLength(body ?? "", "utf8"),
    0,
  );
}
