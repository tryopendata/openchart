// @vitest-environment node
// The heatmap post shows its seasonal CO2 spec in a `json demo` fence so a
// reader can copy it. It must stay the spec the registered demo draws, over the
// dataset modules' rows, and every figure the prose quotes is recomputed here
// from those rows.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { co2MaunaLoa } from "@datasets/co2-mauna-loa";
import { greenCardsByCountry } from "@datasets/green-cards-by-country";
import { describe, expect, it } from "vitest";
import { staticSvgPair } from "../../lib/demo/static-svg";
import { validateDemo } from "../../lib/demo/validate";
import {
  co2Cells,
  co2Departures,
  co2Seasonal,
  co2Trend,
  gapPpm,
  greenCardCells,
  greenCardHeatmap,
} from "./how-to-make-a-heatmap-in-javascript";

const post = readFileSync(
  join(process.cwd(), "src/content/blog/how-to-make-a-heatmap-in-javascript.mdx"),
  "utf8",
);
const demos = [greenCardHeatmap, co2Trend, co2Seasonal];
const specOf = (demo: (typeof demos)[number]) =>
  demo.spec as {
    data?: Record<string, unknown>[];
    chrome?: { title?: string; subtitle?: string };
  };

describe("the heatmap post's figures", () => {
  it("writes the seasonal CO2 heatmap's spec in its json demo fence, citing the dataset", () => {
    const [, info = "", body = ""] = /^```json (demo[^\n]*)\n([\s\S]*?)^```$/m.exec(post) ?? [];
    expect(info).toContain(`source="${co2Seasonal.source.label}"`);
    expect(info).toContain(`height=${co2Seasonal.height}`);
    expect(JSON.parse(body)).toEqual(co2Seasonal.spec);
  });

  it("draws the green card grid from the dataset's rows in thousands", () => {
    expect(greenCardsByCountry.data).toHaveLength(10);
    expect(greenCardCells).toHaveLength(60);
    const layers = (greenCardHeatmap.spec as { layer: { data?: unknown }[] }).layer;
    for (const layer of layers) expect(layer.data).toEqual(greenCardCells);
    const mexico2023 = greenCardCells.find(
      (cell) => cell.country === "Mexico" && cell.year === "2023",
    );
    expect(mexico2023?.cards).toBe(181);
  });

  it("pins the green card claims in the prose", () => {
    const byYear = (year: number) => greenCardsByCountry.data.find((row) => row.year === year);
    for (const field of [
      "mexico",
      "india",
      "china",
      "cuba",
      "dominican_republic",
      "philippines",
    ] as const) {
      expect(byYear(2020)?.[field], field).toBeLessThan(byYear(2019)?.[field] ?? 0);
    }
    const total = (year: number) => byYear(year)?.all_countries ?? 0;
    expect(total(2019)).toBe(1_031_770);
    expect(total(2020)).toBe(707_360);
    expect(Math.round((1 - total(2020) / total(2019)) * 100)).toBe(31);
    // Fiscal 2021 stays below 2019 for every country but India.
    const below2019 = (
      ["mexico", "india", "china", "cuba", "dominican_republic", "philippines"] as const
    ).filter((field) => (byYear(2021)?.[field] ?? 0) < (byYear(2019)?.[field] ?? 0));
    expect(below2019).toEqual(["mexico", "china", "cuba", "dominican_republic", "philippines"]);
    for (const row of greenCardsByCountry.data) {
      expect(row.mexico, String(row.year)).toBeGreaterThan(
        Math.max(row.india, row.china, row.cuba, row.dominican_republic, row.philippines),
      );
    }
  });

  it("draws the CO2 grids from the dataset's rows and pins the claims in the prose", () => {
    expect(co2MaunaLoa.data).toHaveLength(168);
    expect([...new Set(co2MaunaLoa.data.map((row) => row.year))]).toEqual([
      1960, 1965, 1970, 1975, 1980, 1985, 1990, 1995, 2000, 2005, 2010, 2015, 2020, 2025,
    ]);
    expect(co2Cells.map((cell) => cell.ppm)).toEqual(co2MaunaLoa.data.map((row) => row.co2_ppm));
    expect(specOf(co2Trend).data).toEqual(co2Cells);
    expect(specOf(co2Seasonal).data).toEqual(co2Departures);
    const pick = (year: number, month: number) =>
      co2MaunaLoa.data.find((row) => row.year === year && row.month === month)?.co2_ppm;
    expect(pick(1960, 5)).toBe(320.03);
    expect(pick(2025, 9)).toBe(424.37);
    expect(gapPpm).toBe(104);
  });

  it("peaks every year in April or May and bottoms out in September or October", () => {
    const swings: number[] = [];
    for (const year of new Set(co2MaunaLoa.data.map((row) => row.year))) {
      const rows = co2MaunaLoa.data.filter((row) => row.year === year);
      expect(rows, String(year)).toHaveLength(12);
      const high = rows.reduce((a, b) => (b.co2_ppm > a.co2_ppm ? b : a));
      const low = rows.reduce((a, b) => (b.co2_ppm < a.co2_ppm ? b : a));
      expect([4, 5], `${year} peak`).toContain(high.month);
      expect([9, 10], `${year} trough`).toContain(low.month);
      const sum = co2Departures
        .filter((cell) => cell.year === String(year))
        .reduce((total, cell) => total + cell.departure, 0);
      expect(Math.abs(sum), `${year} departures net out`).toBeLessThan(0.5);
      swings.push(high.co2_ppm - low.co2_ppm);
    }
    // "About 5 to 6 ppm": every year's swing runs 4.8 to 6.3.
    expect(Math.min(...swings)).toBeGreaterThan(4.8);
    expect(Math.max(...swings)).toBeLessThan(6.4);
    // The diverging legend's midpoint is zero: the departures run symmetric about it.
    const departures = co2Departures.map((cell) => cell.departure);
    expect(Math.min(...departures) + Math.max(...departures)).toBeCloseTo(0, 5);
  });

  it("titles each chart with a finding read off the rows", () => {
    expect(specOf(greenCardHeatmap).chrome?.title).toBe(
      "Green cards fell 31% in fiscal 2020, with drops for all six countries",
    );
    expect(specOf(co2Trend).chrome?.title).toBe(
      "The lowest month of 2025 was 104 ppm above the highest month of 1960",
    );
  });

  it("validates every demo and renders light and dark static SVGs", () => {
    for (const demo of demos) {
      expect(() => validateDemo(demo.id, demo.spec), demo.id).not.toThrow();
      expect(demo.height, demo.id).toBeTypeOf("number");
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
