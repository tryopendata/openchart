import type { VizSpec } from "@opendata-ai/openchart-core";
import { GalleryEntryError } from "../components/gallery/entry-rules";
import { KINDS } from "../components/gallery/kind-words";
import { GALLERY_FEATURE_TILE_SIZE } from "../components/gallery/tile-size";
import { parseFilterHash } from "../components/shared/tiles/tile-filter";
import { tileChartHtml } from "../components/shared/tiles/tile-markup";
import { getDemo } from "../demos/registry";
import { checkGalleryEntries, galleryEntries } from "./gallery";
import { GALLERY_HASH_KEY, GALLERY_TILE_SIZE, type GalleryEntry } from "./gallery-types";

const [first, second] = galleryEntries as [GalleryEntry, GalleryEntry];

describe("the gallery's entries", () => {
  it("pass every rule against the real demos and docs pages", () => {
    expect(() => checkGalleryEntries(galleryEntries)).not.toThrow();
  });

  it.each([
    [
      "an unknown demo",
      { demo: "gallery/no-such-demo" },
      'no demo has the id "gallery/no-such-demo"',
    ],
    ["an unknown docs page", { docs: "/docs/maps/no-such-page/" }, "is not a docs page"],
    ["a description over 160 characters", { description: "x".repeat(161) }, "161 characters"],
    ["a kind outside the Visualizations sections", { kind: "style" }, 'kind "style" is not one of'],
    ["a malformed slug", { slug: "Has Spaces" }, "lowercase letters and digits"],
  ])("reject %s, naming the entry", (_case, change, reason) => {
    const broken = { ...second, ...change } as GalleryEntry;
    const check = () => checkGalleryEntries([first, broken]);
    expect(check).toThrow(GalleryEntryError);
    expect(check).toThrow(`gallery entry "${broken.slug}"`);
    expect(check).toThrow(reason);
  });

  it("reject a slug two entries share, naming the second", () => {
    const check = () => checkGalleryEntries([first, { ...second, slug: first.slug }]);
    expect(check).toThrow(`gallery entry "${first.slug}": another entry already uses this slug`);
  });

  it("reject a demo two entries share", () => {
    const check = () => checkGalleryEntries([first, { ...second, demo: first.demo }]);
    expect(check).toThrow(`another entry already shows "${first.demo}"`);
  });

  it("report every rule one entry breaks in one message", () => {
    const broken = { ...second, demo: "gallery/no-such-demo", description: "x".repeat(200) };
    expect(() => checkGalleryEntries([broken])).toThrow(/no-such-demo.*200 characters/);
  });
});

describe("the gallery's filter hash", () => {
  it.each([
    ["#kind=maps", "maps"],
    ["#kind", "all"],
    ["#kind=", "all"],
    ["#kind=change-over-time", "change-over-time"],
    ["#kind=charts", null],
    ["#kind=%E0%A4", null],
    ["#vocabulary=maps", null],
  ])("reads %s as %s", (hash, expected) => {
    expect(parseFilterHash(hash, GALLERY_HASH_KEY, KINDS)).toBe(expected);
  });
});

/** The embedded spec a tile's live mount reads. */
function embeddedSpec(html: string): Record<string, unknown> {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return JSON.parse(doc.querySelector("script[data-demo-spec]")?.textContent ?? "{}");
}

describe("a gallery tile's chart", () => {
  it("lays out at the tile size and keeps the demo's data without its chrome", () => {
    const demo = getDemo("gallery/electricity-donut");
    const html = tileChartHtml(demo.id, new Set(), { size: GALLERY_TILE_SIZE, domPrefix: "t" });
    expect(html).toContain('viewBox="0 0 360 240"');
    const spec = embeddedSpec(html);
    expect(spec.data).toEqual((demo.spec as VizSpec & { data: unknown }).data);
    expect(spec).not.toHaveProperty("chrome");
  });

  it("lays a feature out at the feature size", () => {
    const html = tileChartHtml("maps/choropleth-basic", new Set(), {
      size: GALLERY_FEATURE_TILE_SIZE,
      domPrefix: "t",
    });
    expect(html).toContain('viewBox="0 0 720 576"');
  });
});
