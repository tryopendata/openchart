// @vitest-environment node
// The lollipop post shows a lollipop spec and a trimmed-axis lollipop spec in
// `json demo` fences so a reader can copy them. Each fence must stay the spec
// its registered demo draws, over the dataset modules' rows, and every title
// must be read off those rows.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { blsEducationPays } from "@datasets/bls-education-pays";
import { tidyTuesdayFoodCo2 } from "@datasets/tidytuesday-food-co2";
import { describe, expect, it } from "vitest";
import { staticSvgPair } from "../../lib/demo/static-svg";
import { validateDemo } from "../../lib/demo/validate";
import {
  co2Bars,
  co2Lollipop,
  educationBars,
  educationLollipopTrimmed,
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

describe("the lollipop post's figures", () => {
  it("writes the lollipop specs in its json demo fences, citing their datasets", () => {
    expect(fences).toHaveLength(2);
    for (const [fence, demo] of [
      [fences[0], co2Lollipop],
      [fences[1], educationLollipopTrimmed],
    ] as const) {
      expect(fence?.info).toContain(`source="${demo.source.label}"`);
      expect(fence?.info).toContain(`height=${demo.height}`);
      expect(fence?.spec).toEqual(demo.spec);
    }
  });

  it("draws the food bars and lollipops from the same rows, sorted by emissions", () => {
    expect(dataOf(co2Bars)).toEqual(dataOf(co2Lollipop));
    const values = dataOf(co2Lollipop).map((row) => row.kgCo2PerKg);
    expect([...values].sort((a, b) => Number(b) - Number(a))).toEqual(values);
    expect([...values].sort()).toEqual(
      tidyTuesdayFoodCo2.data.map((row) => row.kg_co2_per_kg_food).sort(),
    );
  });

  it("draws both education charts from the BLS rows unchanged", () => {
    expect(dataOf(educationBars)).toEqual(dataOf(educationLollipopTrimmed));
    expect(dataOf(educationBars).map((row) => row.weeklyEarnings)).toEqual(
      blsEducationPays.data.map((row) => row.median_weekly_earnings),
    );
  });

  it("titles each chart with a finding read off the rows", () => {
    expect(titleOf(co2Bars)).toBe(
      "Lamb, goat and beef emit 31 to 35 kg of CO2 per kg of food, and no other food tops 3.5",
    );
    expect(titleOf(co2Lollipop)).toBe(titleOf(co2Bars));
    expect(titleOf(educationBars)).toBe(
      "Median weekly earnings run from $738 to $2,363 across eight education levels",
    );
    expect(titleOf(educationLollipopTrimmed)).toBe(
      "Starting the axis at $600 stretches a 3.2-times gap into 12.8 times",
    );
  });

  it("validates every demo and renders light and dark static SVGs", () => {
    for (const demo of [co2Bars, co2Lollipop, educationBars, educationLollipopTrimmed]) {
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
