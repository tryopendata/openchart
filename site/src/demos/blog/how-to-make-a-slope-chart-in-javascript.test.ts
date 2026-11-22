// @vitest-environment node
// The slope-chart post shows its airline spec in a `json demo` fence so a reader
// can copy it. It must stay the spec the registered demo draws, over the dataset
// modules' rows unchanged, with titles read off those rows.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { airlineSafety } from "@datasets/airline-safety";
import { arcticSeaIce } from "@datasets/arctic-sea-ice";
import { describe, expect, it } from "vitest";
import { staticSvgPair } from "../../lib/demo/static-svg";
import { validateDemo } from "../../lib/demo/validate";
import {
  airlineBars,
  airlineSlope,
  MIN_EARLY_ACCIDENTS,
  nameOf,
  seaIceLine,
  seaIceSlope,
} from "./how-to-make-a-slope-chart-in-javascript";

const post = readFileSync(
  join(process.cwd(), "src/content/blog/how-to-make-a-slope-chart-in-javascript.mdx"),
  "utf8",
);
const demos = [airlineBars, airlineSlope, seaIceSlope, seaIceLine];
const specOf = (demo: (typeof demos)[number]) =>
  demo.spec as {
    data?: Record<string, unknown>[];
    chrome?: { title?: string; subtitle?: string };
  };

describe("the slope-chart post's figures", () => {
  it("writes the airline slope chart's spec in its json demo fence, citing the dataset", () => {
    const [, info = "", body = ""] = /^```json (demo[^\n]*)\n([\s\S]*?)^```$/m.exec(post) ?? [];
    expect(info).toContain(`source="${airlineSlope.source.label}"`);
    expect(info).toContain(`height=${airlineSlope.height}`);
    expect(JSON.parse(body)).toEqual(airlineSlope.spec);
  });

  it("pins the source rows: 56 airlines, 122 fatal accidents then 37", () => {
    expect(airlineSafety.data).toHaveLength(56);
    expect(airlineSafety.data.reduce((sum, row) => sum + row.fatal_accidents_85_99, 0)).toBe(122);
    expect(airlineSafety.data.reduce((sum, row) => sum + row.fatal_accidents_00_14, 0)).toBe(37);
    expect(arcticSeaIce.data).toHaveLength(47);
    const september = (year: number) =>
      arcticSeaIce.data.find((row) => row.year === year)?.september_avg_mkm2;
    expect(september(1980)).toBe(7.67);
    expect(september(2012)).toBe(3.57);
    const septembers = arcticSeaIce.data.map((row) => row.september_avg_mkm2);
    expect(Math.max(...septembers)).toBe(7.67);
    expect(Math.min(...septembers)).toBe(3.57);
    const later = arcticSeaIce.data.filter((row) => row.year > 2012);
    expect(Math.min(...later.map((row) => row.september_avg_mkm2))).toBeGreaterThan(3.57);
  });

  it("draws the airline charts from the dataset's rows, unchanged", () => {
    const shown = airlineSafety.data.filter(
      (row) => row.fatal_accidents_85_99 >= MIN_EARLY_ACCIDENTS,
    );
    expect(shown).toHaveLength(11);
    for (const demo of [airlineBars, airlineSlope]) {
      const data = specOf(demo).data ?? [];
      expect(data).toHaveLength(shown.length * 2);
      for (const row of shown) {
        const name = nameOf(row.airline);
        const pick = (period: string) =>
          data.find((entry) => entry.airline === name && entry.period === period)?.accidents;
        expect(pick("1985-99"), name).toBe(row.fatal_accidents_85_99);
        expect(pick("2000-14"), name).toBe(row.fatal_accidents_00_14);
      }
    }
  });

  it("titles each chart with a finding read off the rows", () => {
    expect(specOf(airlineSlope).chrome?.title).toBe(
      "Fatal accidents at 11 airlines fell from 74 to 17",
    );
    expect(specOf(airlineSlope).chrome?.subtitle).toContain("All 56 airlines: 122 to 37.");
    expect(specOf(seaIceSlope).chrome?.title).toBe(
      "September ice fell 53% from 1980 to 2012, and March ice changed little",
    );
    expect(specOf(seaIceLine).chrome?.title).toBe(
      "September ice reached its record low in 2012 and has stayed above it since",
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
