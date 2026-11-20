// @vitest-environment node
/** Every distribution page demo has a spec the engine accepts, a named source and a small payload. */
import { validateSpec } from "@opendata-ai/openchart-engine";
import { describe, expect, it } from "vitest";
import * as beeswarm from "./beeswarm";
import * as density from "./density";
import * as errorBars from "./error-bars";
import * as histogram from "./histogram";
import * as tickStrip from "./tick-strip";

const pages = { beeswarm, density, "error-bars": errorBars, histogram, "tick-strip": tickStrip };

/** The most rows one demo may inline, to keep each built page small. */
const MAX_ROWS = 150;

describe.each(Object.entries(pages))("%s page demos", (_page, module) => {
  const demos = Object.values(module);

  it("defines at least three demos with distinct ids", () => {
    expect(demos.length).toBeGreaterThanOrEqual(3);
    expect(new Set(demos.map((demo) => demo.id)).size).toBe(demos.length);
  });

  it.each(demos.map((demo) => [demo.id, demo] as const))("%s passes validateSpec", (_id, demo) => {
    const result = validateSpec(demo.spec);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it.each(demos.map((demo) => [demo.id, demo] as const))("%s names its source", (_id, demo) => {
    expect(demo.source.label).not.toMatch(/^Source:/);
    if (demo.source.label !== "Illustrative data") {
      expect(demo.source.url).toMatch(/^https:\/\//);
    }
  });

  it.each(demos.map((demo) => [demo.id, demo] as const))("%s inlines few rows", (_id, demo) => {
    const rows = "data" in demo.spec && Array.isArray(demo.spec.data) ? demo.spec.data.length : 0;
    expect(rows).toBeLessThanOrEqual(MAX_ROWS);
  });
});
