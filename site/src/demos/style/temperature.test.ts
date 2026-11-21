// @vitest-environment node
/** The figures the temperature demos print in their titles, checked against NASA's published rows. */
import { describe, expect, it } from "vitest";
import {
  anomalyIn,
  degreesBetween,
  largestGap,
  readingCount,
  readingsAboveBaseline,
  readingsAroundYear,
  signedDegrees,
  warmSince,
} from "./temperature";

describe("temperature facts", () => {
  it("reads the 2025 reading and the rises the titles state", () => {
    expect(anomalyIn("2025")).toBe(1.19);
    expect(degreesBetween("1980", "2025")).toBe(0.93);
    expect(degreesBetween("1970", "2025")).toBe(1.16);
  });

  it("counts the readings above the baseline and finds where the unbroken run starts", () => {
    expect([readingsAboveBaseline, readingCount]).toEqual([8, 14]);
    expect(warmSince).toBe("1970");
    expect(readingsAroundYear("1970")).toEqual({
      before: 7,
      belowBefore: 6,
      from: 7,
      aboveFrom: 7,
    });
  });

  it("finds the largest distance from the baseline over a span", () => {
    expect(largestGap("1900", "1970")).toBe(0.43);
  });

  it("signs a reading on either side of zero", () => {
    expect([signedDegrees(1.19), signedDegrees(-0.43)]).toEqual(["+1.19°C", "−0.43°C"]);
  });

  it("names the years it has when asked for one it lacks", () => {
    expect(() => anomalyIn("2023")).toThrow(/no reading for 2023; it has 1900, .*, 2025\./);
  });
});
