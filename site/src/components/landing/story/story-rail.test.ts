import { describe, expect, it } from "vitest";
import { railProgress } from "./story-rail";

describe("railProgress", () => {
  const steps = { top: 1000, height: 2000 };

  it("is 0 while the trigger line is at or above the steps' top", () => {
    expect(railProgress(steps, 400)).toBe(0);
    expect(railProgress(steps, 1000)).toBe(0);
  });

  it("is linear between the top and the bottom", () => {
    expect(railProgress(steps, 1500)).toBeCloseTo(0.25);
    expect(railProgress(steps, 2000)).toBeCloseTo(0.5);
  });

  it("is 1 at and past the bottom", () => {
    expect(railProgress(steps, 3000)).toBe(1);
    expect(railProgress(steps, 9000)).toBe(1);
  });

  it("is 0 for steps with no height", () => {
    expect(railProgress({ top: 1000, height: 0 }, 1500)).toBe(0);
  });
});
