/**
 * Where the edit chart's static drawings start their plot: the offset the spec
 * column beside the chart uses until the live chart is in.
 */
import { describe, expect, it } from "vitest";
import { editSpec } from "./edit-spec";
import { STATIC_LAYOUTS, staticPlotTop } from "./static-layout";

describe("staticPlotTop", () => {
  it.each(Object.entries(STATIC_LAYOUTS))(
    "puts the plot under the headline and in the top half of the %s stage",
    (_size, layout) => {
      const top = staticPlotTop(editSpec, layout);
      expect(top).toBeGreaterThan(60);
      expect(top).toBeLessThan(layout.height / 2);
    },
  );

  it("follows the width: a phone's narrower headline wraps further and starts the plot lower", () => {
    expect(staticPlotTop(editSpec, STATIC_LAYOUTS.phone)).toBeGreaterThan(
      staticPlotTop(editSpec, STATIC_LAYOUTS.xl),
    );
  });

  it("leaves the spec it is given unchanged", () => {
    const before = JSON.stringify(editSpec);
    staticPlotTop(editSpec, STATIC_LAYOUTS.lg);
    expect(JSON.stringify(editSpec)).toBe(before);
  });
});
