import { describe, expect, it } from "vitest";
import { sourceOf } from "./source";

describe("sourceOf", () => {
  it.each([
    {
      name: "drops the Source: prefix and keeps the link",
      dataset: { source: "Source: World Bank", url: "https://data.worldbank.org" },
      expected: { label: "World Bank", url: "https://data.worldbank.org" },
    },
    {
      name: "keeps a citation that has no prefix",
      dataset: { source: "US Census Bureau", url: "https://census.gov" },
      expected: { label: "US Census Bureau", url: "https://census.gov" },
    },
    {
      name: "gives a label only when the dataset has no URL",
      dataset: { source: "Source: Illustrative data" },
      expected: { label: "Illustrative data" },
    },
    {
      name: "removes the prefix only at the start",
      dataset: { source: "Agency report. Source: survey" },
      expected: { label: "Agency report. Source: survey" },
    },
  ])("$name", ({ dataset, expected }) => {
    expect(sourceOf(dataset)).toEqual(expected);
  });
});
