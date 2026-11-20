/** The house-style stops, the theme lines each changes, and how scroll progress maps to a stop. */
import { validateSpec } from "@opendata-ai/openchart-engine";
import { describe, expect, it } from "vitest";
import { houseStyle } from "../../../demos/landing/house-style";
import { HOUSE_STYLE_STOPS, houseStyleDiffs, PRESET_NAMES, themeDiff } from "./house-styles";
import { progressOf, stopAt } from "./scrub-progress";

describe("the house-style stops", () => {
  it("run through the four presets in order, then dark mode", () => {
    expect(HOUSE_STYLE_STOPS.map((stop) => stop.id)).toEqual([...PRESET_NAMES, "dark"]);
    expect(HOUSE_STYLE_STOPS.at(-1)?.dark).toBe(true);
    expect(HOUSE_STYLE_STOPS.slice(0, -1).every((stop) => !stop.dark)).toBe(true);
  });

  it("each give the chart a spec the validator accepts", () => {
    for (const stop of HOUSE_STYLE_STOPS) {
      expect(validateSpec({ ...houseStyle.spec, theme: stop.theme }).errors, stop.id).toEqual([]);
    }
  });
});

describe("the theme lines a stop changes", () => {
  const diffs = houseStyleDiffs();

  it("start from the site default: essay adds its serif, sizes and paper", () => {
    const [essay] = diffs;
    expect(essay).toContainEqual({ path: "fonts.family", after: '"Source Serif 4"' });
    expect(essay).toContainEqual({ path: "colors.background", after: '"#faf8f5"' });
    expect(essay?.every((line) => line.before === undefined)).toBe(true);
  });

  it("show only what differs from the stop before", () => {
    const wire = diffs[1] ?? [];
    expect(wire).toContainEqual({
      path: "fonts.family",
      before: '"Source Serif 4"',
      after: '"JetBrains Mono"',
    });
    expect(wire.map((line) => line.path)).not.toContain("darkMode");
    for (const line of diffs.flat()) expect(line.before).not.toBe(line.after);
  });

  it("mark broadsheet's rule and terminal's series strategy", () => {
    expect(diffs[2]?.map((line) => line.path)).toContain("rule");
    expect(diffs[3]).toContainEqual(
      expect.objectContaining({ path: "seriesStrategy", after: '"accent-neutral"' }),
    );
  });

  it("for dark mode, flip darkMode and the colors it derives, and nothing typographic", () => {
    const dark = diffs[4] ?? [];
    expect(dark).toContainEqual({ path: "darkMode", before: '"off"', after: '"force"' });
    expect(dark.map((line) => line.path)).not.toContain("fonts.family");
  });

  it("are empty between a stop and itself", () => {
    const stop = HOUSE_STYLE_STOPS[2];
    if (!stop) throw new Error("expected a broadsheet stop");
    expect(themeDiff(stop, stop)).toEqual([]);
  });
});

describe("scroll progress and stops", () => {
  it.each([
    [0, 0],
    [0.19, 0],
    [0.2, 1],
    [0.59, 2],
    [0.99, 4],
    [1, 4],
    [-0.5, 0],
    [1.5, 4],
  ])("progress %d shows stop %d of five", (progress, stop) => {
    expect(stopAt(progress, 5)).toBe(stop);
  });

  it("sends each stop's button to the middle of that stop", () => {
    for (let index = 0; index < 5; index += 1) {
      expect(stopAt(progressOf(index, 5), 5)).toBe(index);
    }
    expect(progressOf(0, 5)).toBeCloseTo(0.1);
  });
});
