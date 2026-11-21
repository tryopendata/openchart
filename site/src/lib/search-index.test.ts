/** The search contract: which group each part of the site files its results under. */
import { describe, expect, it } from "vitest";
import { docsAreas } from "../config";
import { SEARCH_AREAS, searchBodyAttrs } from "./search-index";

describe("searchBodyAttrs", () => {
  it.each(docsAreas.map((area) => [area.id, area.label] as const))(
    "files the %s docs area under %s",
    (id, label) => {
      expect(searchBodyAttrs(id)).toEqual({
        "data-pagefind-body": "",
        "data-pagefind-meta": `area:${label}`,
      });
    },
  );

  it.each([
    ["examples", "Examples"],
    ["blog", "Blog"],
  ] as const)("files %s under %s", (source, area) => {
    expect(searchBodyAttrs(source)["data-pagefind-meta"]).toBe(`area:${area}`);
  });

  it("lists the docs areas in sidebar order, then Examples and Blog", () => {
    expect(SEARCH_AREAS).toEqual([...docsAreas.map((area) => area.label), "Examples", "Blog"]);
  });
});
