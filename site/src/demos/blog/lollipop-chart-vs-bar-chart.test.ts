// @vitest-environment node
// The lollipop post shows a lollipop spec, a trimmed-axis lollipop spec and a
// stemless dot plot in `json demo` fences so a reader can copy them. Each fence
// must stay the spec its registered demo draws, over the dataset modules' rows,
// and every title must be read off those rows.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { blsEducationPays } from "@datasets/bls-education-pays";
import { tidyTuesdayFoodCo2ByCountry } from "@datasets/tidytuesday-food-co2";
import { compileChart } from "@opendata-ai/openchart-engine";
import { describe, expect, it } from "vitest";
import { staticSvgPair } from "../../lib/demo/static-svg";
import { validateDemo } from "../../lib/demo/validate";
import {
  co2Bars,
  co2Lollipop,
  educationBars,
  educationDotPlot,
  educationLollipopTrimmed,
  foodRange,
  topBeefPct,
} from "./lollipop-chart-vs-bar-chart";

const post = readFileSync(
  join(process.cwd(), "src/content/blog/lollipop-chart-vs-bar-chart.mdx"),
  "utf8",
);

const fences = [...post.matchAll(/^```json (demo[^\n]*)\n([\s\S]*?)^```$/gm)].map((match) => ({
  info: match[1] ?? "",
  spec: JSON.parse(match[2] ?? "null"),
}));

const titleOf = (demo: { spec: unknown }) =>
  (demo.spec as { chrome?: { title?: string } }).chrome?.title;
const dataOf = (demo: { spec: unknown }) => (demo.spec as { data: Record<string, unknown>[] }).data;
const compiled = (demo: { spec: unknown }) =>
  compileChart(demo.spec as Parameters<typeof compileChart>[0], { width: 720, height: 420 });

describe("the lollipop post's figures", () => {
  it("writes the lollipop and dot plot specs in its json demo fences, citing their datasets", () => {
    expect(fences).toHaveLength(3);
    for (const [fence, demo] of [
      [fences[0], co2Lollipop],
      [fences[1], educationLollipopTrimmed],
      [fences[2], educationDotPlot],
    ] as const) {
      expect(fence?.info).toContain(`source="${demo.source.label}"`);
      expect(fence?.info).toContain(`height=${demo.height}`);
      expect(fence?.spec).toEqual(demo.spec);
    }
  });

  it("draws the food bars and lollipops from the same 20 country rows", () => {
    expect(dataOf(co2Bars)).toEqual(dataOf(co2Lollipop));
    expect(dataOf(co2Lollipop)).toHaveLength(20);
    expect(dataOf(co2Lollipop).map((row) => row.kgCo2)).toEqual(
      tidyTuesdayFoodCo2ByCountry.data.map((row) => row.kg_co2_per_person),
    );
    expect(foodRange).toEqual({ low: "1,420", high: "2,172" });
    expect(topBeefPct).toBe(79);
  });

  it("draws all three education charts from the BLS rows unchanged", () => {
    expect(dataOf(educationBars)).toEqual(dataOf(educationLollipopTrimmed));
    expect(dataOf(educationDotPlot)).toEqual(dataOf(educationLollipopTrimmed));
    expect(dataOf(educationBars).map((row) => row.weeklyEarnings)).toEqual(
      blsEducationPays.data.map((row) => row.median_weekly_earnings),
    );
  });

  it("prints $600 at the start of the trimmed axis", () => {
    for (const demo of [educationLollipopTrimmed, educationDotPlot]) {
      const labels = compiled(demo).axes.x?.ticks.map((tick) => tick.label);
      expect(labels?.[0], demo.id).toBe("$600");
    }
  });

  it("draws the dot plot as eight dots, with no stems and no trend line", () => {
    const marks = compiled(educationDotPlot).marks;
    expect(marks.filter((mark) => mark.type === "point")).toHaveLength(8);
    expect(marks.filter((mark) => mark.type !== "point")).toEqual([]);
  });

  it("titles each chart with a finding read off the rows", () => {
    expect(titleOf(co2Bars)).toBe(
      "Argentina's diet comes to 2,172 kg of CO2 per person a year, the most of 130 countries",
    );
    expect(titleOf(co2Lollipop)).toBe(titleOf(co2Bars));
    expect(titleOf(educationBars)).toBe(
      "Median weekly earnings run from $738 to $2,363 across eight education levels",
    );
    expect(titleOf(educationLollipopTrimmed)).toBe(
      "Starting the axis at $600 stretches a 3.2-times gap into 12.8 times",
    );
    expect(titleOf(educationDotPlot)).toBe(
      "Without stems, an axis from $600 shows where each level sits, from $738 to $2,363",
    );
  });

  it("validates every demo and renders light and dark static SVGs", () => {
    for (const demo of [
      co2Bars,
      co2Lollipop,
      educationBars,
      educationLollipopTrimmed,
      educationDotPlot,
    ]) {
      expect(() => validateDemo(demo.id, demo.spec), demo.id).not.toThrow();
      const svgs = staticSvgPair(demo.spec, {
        idPrefix: demo.id.replaceAll("/", "-"),
        width: 720,
        height: demo.height ?? 440,
      });
      expect(svgs, demo.id).not.toBeNull();
      expect(svgs, demo.id).toContain('data-theme="light"');
      expect(svgs, demo.id).toContain('data-theme="dark"');
    }
  });
});
