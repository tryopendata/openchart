// @vitest-environment node
// The dual-axis post shows two fixes in `json demo` fences so a reader can copy
// them. Each fence must stay the spec its registered demo draws, over the
// dataset modules' rows, and every title must be read off those rows.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { nhtsaTrafficFatalities } from "@datasets/nhtsa-traffic-fatalities";
import { nifcWildfires } from "@datasets/nifc-wildfires";
import { describe, expect, it } from "vitest";
import { staticSvgPair } from "../../lib/demo/static-svg";
import { validateDemo } from "../../lib/demo/validate";
import {
  deathsToLowPct,
  dualAxisTrimmed,
  dualAxisZeroBased,
  fatalitiesIndexed,
  lowYear,
  rateToLowPct,
  wildfirePanels,
} from "./dual-axis-charts-what-to-draw-instead";

const post = readFileSync(
  join(process.cwd(), "src/content/blog/dual-axis-charts-what-to-draw-instead.mdx"),
  "utf8",
);

const fences = [...post.matchAll(/^```json (demo[^\n]*)\n([\s\S]*?)^```$/gm)].map((match) => ({
  info: match[1] ?? "",
  spec: JSON.parse(match[2] ?? "null"),
}));

const titleOf = (demo: { spec: unknown }) =>
  (demo.spec as { chrome?: { title?: string } }).chrome?.title;

describe("the dual-axis post's figures", () => {
  it("writes the panels and indexed specs in its json demo fences, citing their datasets", () => {
    expect(fences).toHaveLength(2);
    for (const [fence, demo] of [
      [fences[0], wildfirePanels],
      [fences[1], fatalitiesIndexed],
    ] as const) {
      expect(fence?.info).toContain(`source="${demo.source.label}"`);
      expect(fence?.info).toContain(`height=${demo.height}`);
      expect(fence?.spec).toEqual(demo.spec);
    }
  });

  it("draws both dual-axis charts from the road-death rows unchanged", () => {
    for (const demo of [dualAxisZeroBased, dualAxisTrimmed]) {
      const [deaths, rate] = (
        demo.spec as unknown as { layer: { data: { deaths?: number; rate?: number }[] }[] }
      ).layer;
      expect(deaths?.data.map((row) => row.deaths)).toEqual(
        nhtsaTrafficFatalities.data.map((row) => row.total_fatalities),
      );
      expect(rate?.data.map((row) => row.rate)).toEqual(
        nhtsaTrafficFatalities.data.map((row) => row.rate_per_100m_vmt),
      );
    }
  });

  it("starts the wildfire panels in 1985 and marks each decade's average acres per fire", () => {
    const panels = (
      wildfirePanels.spec as unknown as {
        data: { date: string; measure: string; series: string; value: number }[];
      }
    ).data;
    const from1985 = nifcWildfires.data.filter((row) => row.year >= 1985);
    const yearly = panels.filter((row) => row.series === "Yearly");
    expect(
      yearly.filter((row) => row.measure === "Fires per year").map((row) => row.value),
    ).toEqual(from1985.map((row) => row.fires));
    expect(
      yearly.filter((row) => row.measure === "Acres burned per fire").map((row) => row.value),
    ).toEqual(from1985.map((row) => row.acres_per_fire));
    const averages = panels.filter((row) => row.series !== "Yearly");
    expect(averages.map((row) => [row.series, row.date, row.value])).toEqual([
      ["1985-94 average: 42", "1985-01-01", 42],
      ["1985-94 average: 42", "1994-01-01", 42],
      ["2015-24 average: 121", "2015-01-01", 121],
      ["2015-24 average: 121", "2024-01-01", 121],
    ]);
    expect(new Set(averages.map((row) => row.measure))).toEqual(new Set(["Acres burned per fire"]));
  });

  it("indexes road deaths and the rate to 1966", () => {
    const indexed = (
      fatalitiesIndexed.spec as unknown as { data: { series: string; index: number }[] }
    ).data;
    expect(indexed.filter((row) => row.series === "Deaths")[0]?.index).toBe(100);
    expect(indexed.filter((row) => row.series === "Deaths per 100M miles")[0]?.index).toBe(100);
  });

  it("finds the year deaths bottom out and each series' fall to it", () => {
    expect([lowYear, deathsToLowPct, rateToLowPct]).toEqual([2011, 36, 80]);
  });

  it("titles each chart with a finding read off the rows", () => {
    expect(titleOf(dualAxisZeroBased)).toBe(
      "With both axes from zero, deaths fall 23% and the rate falls 78%, in proportion",
    );
    expect(titleOf(dualAxisTrimmed)).toBe(
      "With both axes trimmed, deaths seem to fall as far as the rate until 2011",
    );
    expect(titleOf(wildfirePanels)).toBe(
      "Fires per year did not climb, but the average fire grew from 42 to 121 acres",
    );
    expect(titleOf(fatalitiesIndexed)).toBe(
      "Since 1966, deaths fell 23% and the death rate fell 78%",
    );
  });

  it("validates every demo and renders light and dark static SVGs", () => {
    for (const demo of [dualAxisZeroBased, dualAxisTrimmed, wildfirePanels, fatalitiesIndexed]) {
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
