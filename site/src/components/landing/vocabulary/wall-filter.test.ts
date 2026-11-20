/** The wall's filter rules: hash parsing and writing, the reducer, and which tiles show. */
import { describe, expect, it } from "vitest";
import {
  intentCounts,
  isTileShown,
  parseWallHash,
  WALL_INTENTS,
  wallFilterReducer,
  wallHash,
} from "./wall-filter";

describe("the wall's URL hash", () => {
  it.each([
    ["#vocabulary=distribution", "distribution"],
    ["vocabulary=flow", "flow"],
    ["#vocabulary=change-over-time", "change-over-time"],
    ["#vocabulary", "all"],
    ["#vocabulary=", "all"],
    ["#vocabulary=all", "all"],
  ])("reads %s as %s", (hash, filter) => {
    expect(parseWallHash(hash)).toBe(filter);
  });

  it.each([
    ["", "an empty hash"],
    ["#desk", "another section's anchor"],
    ["#vocabulary=guides", "a section outside Visualizations"],
    ["#vocabulary=distribution=extra", "a second ="],
    ["#vocabularies=maps", "a key that only starts the same"],
    ["#vocabulary=Distribution", "a label instead of an id"],
  ])("ignores %j (%s)", (hash) => {
    expect(parseWallHash(hash)).toBeNull();
  });

  it("writes a hash that reads back as the same filter, for All and every intent", () => {
    for (const filter of ["all", ...WALL_INTENTS.map((intent) => intent.id)] as const) {
      expect(parseWallHash(wallHash(filter))).toBe(filter);
    }
    expect(wallHash("all")).toBe("#vocabulary");
    expect(wallHash("maps")).toBe("#vocabulary=maps");
  });
});

describe("the wall's filter reducer", () => {
  it("takes the chosen filter, and follows a hash that names one", () => {
    expect(wallFilterReducer("all", { type: "choose", filter: "tables" })).toBe("tables");
    expect(wallFilterReducer("tables", { type: "choose", filter: "all" })).toBe("all");
    expect(wallFilterReducer("tables", { type: "hash", hash: "#vocabulary=maps" })).toBe("maps");
  });

  it("keeps its filter when the hash moves to another section", () => {
    expect(wallFilterReducer("tables", { type: "hash", hash: "#frameworks" })).toBe("tables");
  });
});

describe("which tiles show", () => {
  it("shows every tile for All and only matching tiles for an intent", () => {
    expect(isTileShown("maps", "all")).toBe(true);
    expect(isTileShown("maps", "maps")).toBe(true);
    expect(isTileShown("maps", "tables")).toBe(false);
  });

  it("offers the nine Visualizations sections in sidebar order", () => {
    expect(WALL_INTENTS.map((intent) => intent.label)).toEqual([
      "Comparison",
      "Change over time",
      "Part to whole",
      "Distribution",
      "Correlation",
      "Flow and networks",
      "Maps",
      "Tables",
      "Composition",
    ]);
  });

  it("counts tiles per intent", () => {
    expect([...intentCounts(["maps", "tables", "maps"])]).toEqual([
      ["maps", 2],
      ["tables", 1],
    ]);
  });
});
