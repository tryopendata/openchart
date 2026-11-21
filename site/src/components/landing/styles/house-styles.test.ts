/** The house-style stops, the theme lines each changes, and how scroll progress maps to a stop. */
import { validateSpec } from "@opendata-ai/openchart-engine";
import { describe, expect, it } from "vitest";
import { houseStyle } from "../../../demos/landing/house-style";
import {
  HOUSE_STYLE_STOPS,
  houseStyleDiffs,
  MAX_DIFF_LINES,
  PRESET_NAMES,
  themeDiff,
} from "./house-styles";
import { progressOf, stopAt } from "./scrub-progress";

describe("the house-style stops", () => {
  it("run through the four presets in order, then broadsheet in dark mode", () => {
    expect(HOUSE_STYLE_STOPS.map((stop) => stop.id)).toEqual([...PRESET_NAMES, "dark"]);
    const dark = HOUSE_STYLE_STOPS.at(-1);
    expect(dark).toMatchObject({
      preset: "broadsheet",
      dark: true,
      variant: "Broadsheet, in dark mode",
    });
    expect(HOUSE_STYLE_STOPS.slice(0, -1).every((stop) => !stop.dark)).toBe(true);
  });

  it("name no preset in the dark stop's label, which the page shows as the current preset", () => {
    const label = HOUSE_STYLE_STOPS.at(-1)?.label.toLowerCase() ?? "";
    expect(PRESET_NAMES.filter((name) => label.includes(name))).toEqual([]);
  });

  it("each describe the look in one sentence and give the chart a valid spec", () => {
    for (const stop of HOUSE_STYLE_STOPS) {
      // A sentence: a capital, one or two clauses, a full stop at the end.
      expect(stop.description, stop.id).toMatch(/^[A-Z][\s\S]*\.$/);
      expect(validateSpec({ ...houseStyle.spec, theme: stop.theme }).errors, stop.id).toEqual([]);
    }
  });
});

describe("the theme lines a stop changes", () => {
  const diffs = houseStyleDiffs();
  const paths = (index: number) => (diffs[index] ?? []).map((line) => line.path);

  it("start from the library defaults: essay swaps the sans for its serif and adds paper", () => {
    expect(diffs[0]).toContainEqual({
      path: "fonts.family",
      before: '"Inter Variable"',
      after: '"Source Serif 4"',
    });
    expect(diffs[0]).toContainEqual({
      path: "colors.background",
      before: '"transparent"',
      after: '"#faf8f5"',
    });
  });

  it("compare each stop with the one shown before it, never more than five lines", () => {
    expect(diffs[1]).toContainEqual({
      path: "fonts.family",
      before: '"Source Serif 4"',
      after: '"JetBrains Mono"',
    });
    // Broadsheet sets no family, so the chart goes back to the library's sans.
    expect(diffs[2]).toContainEqual({
      path: "fonts.family",
      before: '"JetBrains Mono"',
      after: '"Inter Variable"',
    });
    for (const diff of diffs) {
      expect(diff.length).toBeGreaterThan(0);
      expect(diff.length).toBeLessThanOrEqual(MAX_DIFF_LINES);
      for (const line of diff) expect(line.before).not.toBe(line.after);
    }
  });

  it("show the values a reader sees change: the kicker's color and the masthead rule", () => {
    expect(paths(2)).toEqual(expect.arrayContaining(["chrome.eyebrow.color", "rule"]));
    expect(diffs[2]).toContainEqual(
      expect.objectContaining({ path: "chrome.eyebrow.color", after: '"#e3120b"' }),
    );
  });

  it("for dark mode, compare with terminal, the stop shown before it", () => {
    const dark = diffs[4] ?? [];
    expect(dark).toContainEqual({ path: "darkMode", before: '"off"', after: '"force"' });
    expect(dark).toContainEqual({
      path: "colors.background",
      before: '"#0b0f14"',
      after: '"#12181f"',
    });
    // The palette lines read the values the chart is drawn with, the dark half of each pair.
    expect(dark).toContainEqual(
      expect.objectContaining({ path: "colors.categorical", after: '["#5e9fd6", "#f4655a", …]' }),
    );
    const [terminalStop, darkStop] = HOUSE_STYLE_STOPS.slice(3);
    if (!terminalStop || !darkStop) throw new Error("expected terminal and dark stops");
    expect(themeDiff(terminalStop, darkStop)).toEqual(dark);
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
