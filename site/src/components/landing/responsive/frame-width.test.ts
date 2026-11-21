/**
 * The resize frame's rules: how keys move the width inside its range, and that
 * the frame's chart is a valid spec. Breakpoint names come from the library's
 * own `getBreakpoint`, so they are not re-tested here.
 */
import { validateSpec } from "@opendata-ai/openchart-engine";
import { describe, expect, it } from "vitest";
import { clampWidth, widthAfterKey } from "./frame-width";
import { responsiveSpec } from "./responsive-spec";

const range = { min: 280, max: 900 };

describe("widthAfterKey", () => {
  it.each([
    ["ArrowLeft", 500, 480],
    ["ArrowDown", 500, 480],
    ["ArrowRight", 500, 520],
    ["ArrowUp", 500, 520],
    ["PageDown", 500, 400],
    ["PageUp", 500, 600],
    ["Home", 500, 280],
    ["End", 500, 900],
  ] as const)("%s from %ipx gives %ipx", (key, width, next) => {
    expect(widthAfterKey(key, width, range)).toBe(next);
  });

  it("stops at the ends of the range", () => {
    expect(widthAfterKey("ArrowLeft", 290, range)).toBe(280);
    expect(widthAfterKey("ArrowRight", 890, range)).toBe(900);
  });

  it("leaves other keys to the browser", () => {
    expect(widthAfterKey("Tab", 500, range)).toBeNull();
    expect(widthAfterKey("a", 500, range)).toBeNull();
  });
});

describe("clampWidth", () => {
  it("rounds to whole pixels inside the range", () => {
    expect([clampWidth(100, range), clampWidth(512.6, range), clampWidth(2000, range)]).toEqual([
      280, 513, 900,
    ]);
  });
});

describe("the frame's chart", () => {
  it("is a valid spec", () => {
    expect(validateSpec(responsiveSpec).errors).toEqual([]);
  });
});
