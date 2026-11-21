import type { GalleryEntry } from "../../lib/gallery-types";
import { pagerFor, relatedTo } from "./neighbours";

const entry = (slug: string, kind: GalleryEntry["kind"]): GalleryEntry => ({
  slug,
  kind,
  demo: `demo/${slug}`,
  title: slug,
  description: slug,
  docs: "/docs/maps/choropleth/",
});

const wall = [
  entry("map-a", "maps"),
  entry("bar-a", "comparison"),
  entry("map-b", "maps"),
  entry("table-a", "tables"),
  entry("map-c", "maps"),
  entry("bar-b", "comparison"),
  entry("map-d", "maps"),
];
const slugs = (entries: GalleryEntry[]) => entries.map((e) => e.slug);

describe("an entry's place in the gallery", () => {
  it("links the entries either side, and nothing past either end", () => {
    const [firstEntry, secondEntry, thirdEntry] = wall as [
      GalleryEntry,
      GalleryEntry,
      GalleryEntry,
    ];
    expect(pagerFor(wall, secondEntry)).toEqual({ previous: firstEntry, next: thirdEntry });
    expect(pagerFor(wall, firstEntry).previous).toBeUndefined();
    expect(pagerFor(wall, wall.at(-1) as GalleryEntry).next).toBeUndefined();
  });

  it("suggests its own kind first, in wall order, never itself", () => {
    expect(slugs(relatedTo(wall, wall[2] as GalleryEntry, 3))).toEqual(["map-a", "map-c", "map-d"]);
  });

  it("fills from the entries after it, wrapping round, when its kind has too few", () => {
    expect(slugs(relatedTo(wall, wall[3] as GalleryEntry, 3))).toEqual(["map-c", "bar-b", "map-d"]);
    expect(slugs(relatedTo(wall, wall[5] as GalleryEntry, 3))).toEqual(["bar-a", "map-d", "map-a"]);
  });
});
