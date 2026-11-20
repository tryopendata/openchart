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

const parser = new new Window().DOMParser();
const read = (root: string, path: string) => readFileSync(join(root, path), "utf8");
// Parsed once per file: the link check asks for the same large pages many times.
const parsed = new Map<string, Document>();
function page(root: string, path: string): Document {
  const file = join(root, path);
  let document = parsed.get(file);
  if (!document) {
    document = parser.parseFromString(read(root, path), "text/html") as unknown as Document;
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

  it("renders the landing page from config, hiding empty sections", () => {
    const home = page("dist", "index.html");
    expect(home.querySelector("h1")?.textContent).toBe(site.tagline);
    expect(home.querySelector('meta[property="og:image"]')?.getAttribute("content")).toBe(
      absolute("/og/index.png"),
    );
    const text = home.body.textContent ?? "";
    expect(text).toContain(site.install[0]?.command ?? "");
    for (const line of site.demo.lines) expect(text).toContain(line.text);
    if (site.announcement) expect(text).toContain(site.announcement.label);
    if (site.version) expect(text).toContain(`v${site.version}`);
    expect(text).toContain(`${site.license} license`);
    const headings = [...home.querySelectorAll("h2")].map((heading) => heading.textContent);
    expect(headings.includes("Used by")).toBe(site.usedBy.length > 0);
    expect(headings.includes("Sponsors")).toBe(site.sponsors.logos.length > 0);
    expect(readFileSync("dist/og/index.png").subarray(1, 4).toString()).toBe("PNG");
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
