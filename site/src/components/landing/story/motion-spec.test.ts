/**
 * The motion section's chart states: every month count and animation choice
 * gives a valid spec, "Next month" walks to December and back, and the excerpt
 * marks the line the last control changed.
 */
import { validateSpec } from "@opendata-ai/openchart-engine";
import { describe, expect, it } from "vitest";
import {
  ALL_MONTHS,
  FIRST_MONTHS,
  MOTION_CHOICES,
  motionExcerpt,
  nextMonthCount,
  payrollSpec,
} from "./motion-spec";

describe("the motion chart", () => {
  it.each(MOTION_CHOICES)("is valid at every month count with animation %s", (choice) => {
    for (let months = FIRST_MONTHS; months <= ALL_MONTHS; months += 1) {
      expect(validateSpec(payrollSpec(months, choice)).errors).toEqual([]);
    }
  });

  it("maps off to animation: false and the presets to their names", () => {
    expect(MOTION_CHOICES.map((choice) => payrollSpec(6, choice).animation)).toEqual([
      "fluid",
      "subtle",
      false,
    ]);
  });

  it("adds one month at a time through December, then goes back to June", () => {
    const counts = [FIRST_MONTHS];
    for (let press = 0; press < 7; press += 1) counts.push(nextMonthCount(counts.at(-1) ?? 0));
    expect(counts).toEqual([6, 7, 8, 9, 10, 11, 12, 6]);
    expect(payrollSpec(8, "fluid").data).toHaveLength(8);
    expect(payrollSpec(8, "fluid").chrome?.subtitle).toMatch(/January to Aug$/);
  });

  it("marks only the line the last control changed", () => {
    const marked = (change: "data" | "animation" | null) =>
      motionExcerpt(7, "off", change)
        .filter((line) => line.changed)
        .map((line) => line.text.trim());
    expect(marked("data")).toEqual(['"data": [ … 7 rows ],']);
    expect(marked("animation")).toEqual(['"animation": false,']);
    expect(marked(null)).toEqual([]);
  });
});
