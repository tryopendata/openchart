import { countOf, filterAnnouncement, KINDS, kindLabel, relatedHeading } from "./kind-words";

describe("the gallery's kind wording", () => {
  it.each([
    ["maps", 4, "Showing 4 maps."],
    ["tables", 1, "Showing 1 table."],
    ["change-over-time", 5, "Showing 5 charts of change over time."],
    ["flow", 1, "Showing 1 flow diagram."],
    ["all", 25, "Showing all 25 graphics."],
  ] as const)("announces %s with %i tiles as %s", (filter, count, sentence) => {
    expect(filterAnnouncement(filter, count)).toBe(sentence);
  });

  it("has a noun for every Visualizations section, in the docs' order", () => {
    expect(KINDS).toEqual([
      "comparison",
      "change-over-time",
      "part-to-whole",
      "distribution",
      "correlation",
      "flow",
      "maps",
      "tables",
      "composition",
    ]);
    for (const kind of KINDS) expect(countOf(kind, 2)).toMatch(/^2 \w/);
  });

  it("labels a kind as the docs do", () => {
    expect(kindLabel("flow")).toBe("Flow and networks");
  });

  it("heads related tiles by their kind only when they share it", () => {
    expect(relatedHeading("maps", true)).toBe("More maps");
    expect(relatedHeading("flow", false)).toBe("More examples");
  });
});
