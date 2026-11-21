/**
 * The motion section's chart states: every month count and animation choice
 * gives a valid spec, "Next month" walks to December and back, months are
 * written out in full, and the excerpt is read off the spec with the changed
 * field marked.
 */
import { validateSpec } from "@opendata-ai/openchart-engine";
import { describe, expect, it } from "vitest";
import {
  ALL_MONTHS,
  FIRST_MONTHS,
  MOTION_CHOICES,
  monthName,
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
  });

  it("writes month names in full", () => {
    expect(payrollSpec(6, "fluid").chrome?.subtitle).toMatch(/January to June$/);
    expect([monthName(1), monthName(9), monthName(12)]).toEqual([
      "January",
      "September",
      "December",
    ]);
    expect(() => monthName(13)).toThrow(/No month 13 in the payrolls data \(it has 12\)/);
  });
});

describe("the spec excerpt", () => {
  it("shows every top-level field of the real spec, folded", () => {
    const lines = motionExcerpt(payrollSpec(7, "off"), null).map((line) => line.text);
    expect(lines).toEqual([
      "{",
      '  "mark": "bar",',
      '  "data": [ … 7 rows ],',
      '  "encoding": { … },',
      '  "chrome": { … },',
      '  "animation": false',
      "}",
    ]);
  });

  it("marks only the field the last control changed", () => {
    const marked = (change: "data" | "animation" | null) =>
      motionExcerpt(payrollSpec(7, "subtle"), change)
        .filter((line) => line.changed)
        .map((line) => line.text.trim());
    expect(marked("data")).toEqual(['"data": [ … 7 rows ],']);
    expect(marked("animation")).toEqual(['"animation": "subtle"']);
    expect(marked(null)).toEqual([]);
  });
});
