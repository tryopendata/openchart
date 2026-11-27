import { describe, expect, it } from "vitest";
import { widthAtProgress } from "./frame-scroll";

describe("widthAtProgress", () => {
  const range = { min: 320, max: 1376 };

  it("holds the full width while the section enters", () => {
    expect(widthAtProgress(0, range)).toBe(1376);
    expect(widthAtProgress(0.15, range)).toBe(1376);
  });

  it("holds the narrowest width as the section leaves", () => {
    expect(widthAtProgress(0.85, range)).toBe(320);
    expect(widthAtProgress(1, range)).toBe(320);
  });

  it("is linear between, in 8px steps", () => {
    expect(widthAtProgress(0.5, range)).toBe(848);
    const quarter = widthAtProgress(0.325, range);
    expect(quarter % 8).toBe(0);
    expect(Math.abs(quarter - 1112)).toBeLessThanOrEqual(4);
  });

  it("never grows as the progress grows", () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let step = 0; step <= 100; step++) {
      const width = widthAtProgress(step / 100, range);
      expect(width).toBeLessThanOrEqual(previous);
      previous = width;
    }
  });

  it("clamps progress outside 0 to 1 and stays inside an odd range", () => {
    expect(widthAtProgress(-1, range)).toBe(1376);
    expect(widthAtProgress(2, range)).toBe(320);
    const odd = { min: 323, max: 1001 };
    for (let step = 0; step <= 20; step++) {
      const width = widthAtProgress(step / 20, odd);
      expect(width).toBeGreaterThanOrEqual(323);
      expect(width).toBeLessThanOrEqual(1001);
    }
  });
});
