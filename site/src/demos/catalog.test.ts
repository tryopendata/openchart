// Every demo on the site, checked in one place: a spec that fails validation
// would otherwise only surface as a failed page build.
import { describe, expect, it } from "vitest";
import { validateDemo } from "../lib/demo/validate";
import { allDemos } from "./registry";

describe("registered demos", () => {
  const demos = allDemos();

  it("has demos", () => {
    expect(demos.length).toBeGreaterThan(0);
  });

  it.each(demos.map((demo) => [demo.id, demo] as const))("%s has a valid spec", (id, demo) => {
    expect(() => validateDemo(id, demo.spec)).not.toThrow();
  });

  it.each(demos.map((demo) => [demo.id, demo] as const))("%s names its source", (_id, demo) => {
    expect(demo.source.label.trim()).not.toBe("");
  });
});
