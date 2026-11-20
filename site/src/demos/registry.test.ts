/** The demo registry: lookup over the real demo modules, and indexing rules. */
import { describe, expect, it } from "vitest";
import { fixtureBar } from "./fixtures/bar";
import {
  allDemos,
  DuplicateDemoError,
  demoSpec,
  getDemo,
  indexDemos,
  UnknownDemoError,
} from "./registry";

describe("the demo registry", () => {
  it("returns a demo a module under src/demos defines", () => {
    expect(getDemo("fixtures/bar")).toBe(fixtureBar);
    expect(demoSpec("fixtures/bar")).toBe(fixtureBar.spec);
    expect(allDemos().map(({ id }) => id)).toEqual(
      expect.arrayContaining(["fixtures/bar", "fixtures/table"]),
    );
  });

  it("throws UnknownDemoError naming an id nothing defines", () => {
    expect(() => getDemo("fixtures/nope")).toThrow(UnknownDemoError);
    expect(() => getDemo("fixtures/nope")).toThrow('"fixtures/nope"');
    expect(() => demoSpec("fixtures/nope")).toThrow(UnknownDemoError);
  });

  it("throws DuplicateDemoError naming both modules when two define the same id", () => {
    const modules = {
      "./a/one.ts": { first: fixtureBar },
      "./b/two.ts": { second: { ...fixtureBar } },
    };
    expect(() => indexDemos(modules)).toThrow(DuplicateDemoError);
    expect(() => indexDemos(modules)).toThrow(/"fixtures\/bar".*\.\/a\/one\.ts.*\.\/b\/two\.ts/);
  });

  it("accepts one demo object exported under two names", () => {
    const demos = indexDemos({ "./a/one.ts": { fixtureBar, default: fixtureBar } });
    expect([...demos.values()]).toEqual([fixtureBar]);
  });

  it("ignores exports that are not demos", () => {
    const demos = indexDemos({ "./c.ts": { fixtureBar, helper: () => 1, label: "bar" } });
    expect([...demos.keys()]).toEqual(["fixtures/bar"]);
  });
});
