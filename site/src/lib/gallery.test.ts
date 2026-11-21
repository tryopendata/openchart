import type { VizSpec } from "@opendata-ai/openchart-core";
import { GalleryEntryError } from "../components/gallery/entry-rules";
import { KINDS } from "../components/gallery/kind-words";
import {
  galleryTileRequests,
  relatedTileOptions,
  wallTileOptions,
} from "../components/gallery/tile-options";
import { NARROW_SIZE, SHAPE_SIZES, shapeOf, type WallEntry } from "../components/gallery/tile-size";
import { checkGalleryEntries, wallPlacements } from "../components/gallery/wall";
import { tileFileUrl } from "../components/shared/tiles/tile-files";
import { parseFilterHash } from "../components/shared/tiles/tile-filter";
import { tileChartHtml } from "../components/shared/tiles/tile-markup";
import { getDemo } from "../demos/registry";
import { galleryEntries } from "./gallery";
import { GALLERY_HASH_KEY, type GalleryEntry } from "./gallery-types";

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

const entry = (slug: string) =>
  galleryEntries.find((candidate) => candidate.slug === slug) as WallEntry;

describe("a gallery tile's chart", () => {
  it("keeps the demo's data without its chrome, and its legend where the entry keeps the key", () => {
    const waffle = entry("electricity-mix-waffle");
    const html = tileChartHtml(waffle.demo, new Set(), wallTileOptions(waffle));
    const spec = embeddedSpec(html);
    expect(spec.data).toEqual((getDemo(waffle.demo).spec as VizSpec & { data: unknown }).data);
    expect(spec).not.toHaveProperty("chrome");
    expect(spec).not.toHaveProperty("legend");
  });

  it("draws a shaped entry in its shape and in the standard shape it narrows to", () => {
    const feature = entry("unemployment-above-5-percent");
    const html = tileChartHtml(feature.demo, new Set(), wallTileOptions(feature));
    expect(html).toContain(
      `-${SHAPE_SIZES.feature.width}x${SHAPE_SIZES.feature.height}-key-light.svg`,
    );
    expect(html).toContain(`-${NARROW_SIZE.width}x${NARROW_SIZE.height}-key-light.svg`);
  });

  it("asks for a file for every image a tile on the wall or under an entry page shows", () => {
    const requested = new Set(
      galleryTileRequests(galleryEntries).map((request) => tileFileUrl(request, "light")),
    );
    for (const candidate of galleryEntries) {
      for (const options of [wallTileOptions(candidate), relatedTileOptions(candidate)]) {
        const html = tileChartHtml(candidate.demo, new Set(), options);
        for (const [, src] of html.matchAll(/src="([^"]+-light\.svg)"/g)) {
          expect(requested, `${candidate.slug}: ${src}`).toContain(src);
        }
      }
    }
  });
});

describe("the arranged wall", () => {
  it("leads with one graphic and places every entry, in order, with no row left short", () => {
    expect(shapeOf(galleryEntries[0] as WallEntry)).toBe("lead");
    expect([...wallPlacements.keys()]).toEqual(galleryEntries.map((candidate) => candidate.slug));
    // Six columns a row: count every cell each tile covers.
    const cells = new Map<number, number>();
    for (const { span, row, rowSpan } of wallPlacements.values()) {
      for (let r = row; r < row + rowSpan; r += 1) cells.set(r, (cells.get(r) ?? 0) + span);
    }
    expect([...cells.values()].every((count) => count === 6)).toBe(true);
  });

  it("draws no more than five entries from one dataset, and no two from one demo", () => {
    const byDataset = new Map<string, number>();
    for (const candidate of galleryEntries) {
      const label = getDemo(candidate.demo).source.label.split(";")[0] ?? "";
      byDataset.set(label, (byDataset.get(label) ?? 0) + 1);
    }
    expect(Math.max(...byDataset.values())).toBeLessThanOrEqual(5);
    expect(byDataset.size).toBeGreaterThanOrEqual(8);
  });
});
