/** A tile wall's filter rules: hash parsing and writing under a page's key, the reducer, and which tiles show. */
import { describe, expect, it } from "vitest";
import {
  filterHash,
  isTileShown,
  kindCounts,
  parseFilterHash,
  tileFilterReducer,
} from "./tile-filter";

const KINDS = ["comparison", "change-over-time", "distribution", "flow", "maps", "tables"];

describe("a wall's URL hash", () => {
  it.each([
    ["#vocabulary=distribution", "distribution"],
    ["vocabulary=flow", "flow"],
    ["#vocabulary=change-over-time", "change-over-time"],
    ["#vocabulary", "all"],
    ["#vocabulary=", "all"],
    ["#vocabulary=all", "all"],
    ["#vocabulary=%6Daps", "maps"],
  ])("reads %s as %s", (hash, filter) => {
    expect(parseFilterHash(hash, "vocabulary", KINDS)).toBe(filter);
  });

  it.each([
    ["", "an empty hash"],
    ["#desk", "another section's anchor"],
    ["#vocabulary=guides", "an id the page does not offer"],
    ["#vocabulary=distribution=extra", "a second ="],
    ["#vocabularies=maps", "a key that only starts the same"],
    ["#vocabulary=Distribution", "a label instead of an id"],
    ["#vocabulary=%E0%A4", "a malformed escape"],
  ])("ignores %j (%s)", (hash) => {
    expect(parseFilterHash(hash, "vocabulary", KINDS)).toBeNull();
  });

  it("reads only its own key, so two walls never read each other's hash", () => {
    expect(parseFilterHash("#kind=maps", "kind", KINDS)).toBe("maps");
    expect(parseFilterHash("#kind=maps", "vocabulary", KINDS)).toBeNull();
    expect(parseFilterHash("#vocabulary=maps", "kind", KINDS)).toBeNull();
  });

  it("writes a hash that reads back as the same filter, for All and every id", () => {
    for (const filter of ["all", ...KINDS]) {
      expect(parseFilterHash(filterHash(filter, "kind"), "kind", KINDS)).toBe(filter);
    }
    expect(filterHash("all", "vocabulary")).toBe("#vocabulary");
    expect(filterHash("maps", "kind")).toBe("#kind=maps");
  });
});

describe("a wall's filter reducer", () => {
  const reduce = tileFilterReducer("vocabulary", KINDS);

  it("takes the chosen filter, and follows a hash that names one", () => {
    expect(reduce("all", { type: "choose", filter: "tables" })).toBe("tables");
    expect(reduce("tables", { type: "choose", filter: "all" })).toBe("all");
    expect(reduce("tables", { type: "hash", hash: "#vocabulary=maps" })).toBe("maps");
  });

  it("keeps its filter when the hash moves to another section", () => {
    expect(reduce("tables", { type: "hash", hash: "#frameworks" })).toBe("tables");
  });
});

describe("which tiles show", () => {
  it("shows every tile for All and only matching tiles for a kind", () => {
    expect(isTileShown("maps", "all")).toBe(true);
    expect(isTileShown("maps", "maps")).toBe(true);
    expect(isTileShown("maps", "tables")).toBe(false);
  });

  it("counts tiles per kind", () => {
    expect([...kindCounts(["maps", "tables", "maps"])]).toEqual([
      ["maps", 2],
      ["tables", 1],
    ]);
  });
});
