import type { WallEntry } from "./tile-size";
import { arrangeWall, WallLayoutError } from "./wall-layout";

const tile = (slug: string, shape?: WallEntry["shape"]): WallEntry => ({
  slug,
  shape,
  demo: `demo/${slug}`,
  kind: "comparison",
  title: slug,
  description: slug,
  docs: "/docs/comparison/bar/",
});

const placed = (entries: WallEntry[]) =>
  [...arrangeWall(entries)].map(
    ([slug, p]) => `${slug} ${p.column}/${p.span} r${p.row}/${p.rowSpan}`,
  );

describe("the wall's arrangement", () => {
  it("puts the lead across the top, then fills rows in order", () => {
    expect(
      placed([tile("lead", "lead"), tile("a"), tile("b"), tile("c"), tile("w", "wide"), tile("d")]),
    ).toEqual([
      "lead 1/6 r1/1",
      "a 1/2 r2/1",
      "b 3/2 r2/1",
      "c 5/2 r2/1",
      "w 1/4 r3/1",
      "d 5/2 r3/1",
    ]);
  });

  it("sets two standard tiles beside each feature, alternating its side", () => {
    expect(
      placed([
        tile("f1", "feature"),
        tile("a"),
        tile("b"),
        tile("f2", "feature"),
        tile("c"),
        tile("d"),
      ]),
    ).toEqual([
      "f1 1/4 r1/2",
      "a 5/2 r1/1",
      "b 5/2 r2/1",
      "f2 3/4 r3/2",
      "c 1/2 r3/1",
      "d 1/2 r4/1",
    ]);
  });

  it.each([
    [
      "a lead after the first tile",
      [tile("a"), tile("l", "lead")],
      '"l" is a lead but not the first',
    ],
    [
      "a wide tile that overruns its row",
      [tile("a"), tile("b"), tile("w", "wide")],
      '"w" is wide and runs past',
    ],
    ["a square beside a flat tile", [tile("a"), tile("s", "square")], '"s" mixes square and flat'],
    [
      "a wide tile beside a feature",
      [tile("f", "feature"), tile("w", "wide")],
      '"w" is wide but must be standard',
    ],
    [
      "a feature mid-row",
      [tile("a"), tile("f", "feature")],
      '"f" is a feature but does not start a row',
    ],
    ["a short last row", [tile("a"), tile("b")], '"b" is the last entry but leaves its row'],
    ["a feature without its two tiles", [tile("f", "feature"), tile("a")], '"a" is the last entry'],
  ])("rejects %s, naming the entry", (_case, entries, message) => {
    expect(() => arrangeWall(entries)).toThrow(WallLayoutError);
    expect(() => arrangeWall(entries)).toThrow(message);
  });
});
