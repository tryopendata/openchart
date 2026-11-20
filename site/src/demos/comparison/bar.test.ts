// @vitest-environment node
/** Every bar page demo carries a spec the engine accepts and a cited source. */
import { validateSpec } from "@opendata-ai/openchart-engine";
import { describe, expect, it } from "vitest";
import * as barDemos from "./bar";

const demos = Object.values(barDemos);

describe("bar page demos", () => {
  it("defines the six demos the page shows", () => {
    expect(demos.map((demo) => demo.id).sort()).toEqual([
      "comparison/bar-basic",
      "comparison/bar-grouped",
      "comparison/bar-highlight",
      "comparison/bar-labels",
      "comparison/bar-sorted",
      "comparison/bar-stacked",
    ]);
  });

  it.each(demos.map((demo) => [demo.id, demo] as const))("%s passes validateSpec", (_id, demo) => {
    const result = validateSpec(demo.spec);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it.each(demos.map((demo) => [demo.id, demo] as const))("%s cites a real source", (_id, demo) => {
    expect(demo.source.label).not.toMatch(/^Source:|Illustrative/);
    expect(demo.source.url).toMatch(/^https:\/\//);
  });
});
