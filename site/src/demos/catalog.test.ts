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

  const withStates = demos.filter((demo) => demo.controls?.states);
  const withControls = demos.filter((demo) => demo.controls);

  it("has demos with states and with controls to check", () => {
    expect(withStates.length).toBeGreaterThan(0);
    expect(withControls.length).toBeGreaterThan(withStates.length);
  });

  it.each(withStates.map((demo) => [demo.id, demo] as const))(
    "%s has a valid spec for every state",
    (id, demo) => {
      for (const state of demo.controls?.states?.others ?? []) {
        expect(() => validateDemo(`${id} (${state.label})`, state.spec)).not.toThrow();
      }
    },
  );

  it.each(withControls.map((demo) => [demo.id, demo] as const))(
    "%s puts controls on a chart or layer spec only",
    (_id, demo) => {
      expect("mark" in demo.spec || "layer" in demo.spec).toBe(true);
    },
  );
});
