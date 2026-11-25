// @vitest-environment node
// The animated bubble chart post builds one playback spec over the World Bank rows and
// quotes numbers from them. The figures must compile as playbacks, the printed spec must
// stay the one the demo draws, and every number the prose and titles quote must match the rows.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { compileChart, compileChartPlayback, isTrailMark } from "@opendata-ai/openchart-engine";
import { describe, expect, it } from "vitest";
import { staticSvgPair } from "../../lib/demo/static-svg";
import { validateDemo } from "../../lib/demo/validate";
import {
  LABELLED,
  POPULOUS,
  populousPlayback,
  TRAILED,
  wealthHealthPlayback,
  wealthHealthRows,
  wealthHealthSpec,
  wealthHealthTrails,
} from "./how-to-make-an-animated-bubble-chart-in-javascript";

const post = readFileSync(
  join(process.cwd(), "src/content/blog/how-to-make-an-animated-bubble-chart-in-javascript.mdx"),
  "utf8",
);
const demos = [wealthHealthPlayback, populousPlayback, wealthHealthTrails];
const row = (country: string, year: number) => {
  const found = wealthHealthRows.find((entry) => entry.country === country && entry.year === year);
  if (!found) throw new Error(`no row for ${country} in ${year}`);
  return found;
};
const series = (country: string) => wealthHealthRows.filter((entry) => entry.country === country);
const complete = (entry: (typeof wealthHealthRows)[number]) =>
  entry.gdp !== null && entry.life !== null && entry.pop !== null;

describe("the animated bubble chart post's figures", () => {
  it("writes the 10-country playback's spec in its json demo fence, citing the dataset", () => {
    const [, info = "", body = ""] = /^```json (demo[^\n]*)\n([\s\S]*?)^```$/m.exec(post) ?? [];
    expect(info).toContain(`source="${populousPlayback.source.label}"`);
    expect(info).toContain(`height=${populousPlayback.height}`);
    expect(info).toContain(`phone-height=${populousPlayback.phoneHeight}`);
    expect(JSON.parse(body)).toEqual(populousPlayback.spec);
  });

  it("keeps the 10 most populous countries every fifth year, ending on the last", () => {
    expect(POPULOUS).toEqual([
      "India",
      "China",
      "United States",
      "Indonesia",
      "Pakistan",
      "Nigeria",
      "Brazil",
      "Bangladesh",
      "Russia",
      "Mexico",
    ]);
    const data = (populousPlayback.spec as ChartSpec).data;
    expect(data).toHaveLength(130);
    expect(new Set(data.map((entry) => entry.year))).toEqual(
      new Set([1963, 1968, 1973, 1978, 1983, 1988, 1993, 1998, 2003, 2008, 2013, 2018, 2023]),
    );
    const under60 = POPULOUS.filter((country) => (row(country, 2023).life ?? 0) < 60);
    expect(under60).toEqual(["Nigeria"]);
  });

  it("draws one row per country per year, 62 countries over 64 years", () => {
    expect(new Set(wealthHealthRows.map((entry) => entry.country)).size).toBe(62);
    expect(new Set(wealthHealthRows.map((entry) => entry.year)).size).toBe(64);
    expect(wealthHealthRows).toHaveLength(3968);
    const playback = compileChartPlayback(wealthHealthSpec as ChartSpec, {
      width: 720,
      height: 560,
    });
    expect(playback.periods).toHaveLength(64);
    expect(playback.timing.durationMs).toBe(25000);
  });

  it("pins the facts the prose and titles quote", () => {
    // Nearly doubled while income stayed under $200: 1960 through 1981.
    const underTwoHundred = series("China").filter((entry) => entry.year <= 1981);
    expect(underTwoHundred.every((entry) => (entry.gdp ?? Infinity) < 200)).toBe(true);
    expect(row("China", 1982).gdp).toBeGreaterThanOrEqual(200);
    expect(row("China", 1960).life).toBeCloseTo(33.4, 1);
    expect(row("China", 1981).life).toBeCloseTo(64.8, 1);
    expect(row("China", 1962).life).toBeCloseTo(51.0, 1);
    // Life expectancy 60 on under $400.
    const firstAtSixty = (country: string) =>
      series(country).find((entry) => (entry.life ?? 0) >= 60);
    expect(firstAtSixty("China")).toMatchObject({ year: 1974 });
    expect(Math.round(firstAtSixty("China")?.gdp ?? 0)).toBe(160);
    expect(firstAtSixty("South Korea")).toMatchObject({ year: 1967 });
    expect(Math.round(firstAtSixty("South Korea")?.gdp ?? 0)).toBe(162);
    expect(firstAtSixty("India")).toMatchObject({ year: 1994 });
    expect(Math.round(firstAtSixty("India")?.gdp ?? 0)).toBe(348);
    // Countries that enter late, and Cuba's missing GDP after 2020.
    expect(wealthHealthRows.filter((entry) => entry.year === 1960 && complete(entry))).toHaveLength(
      51,
    );
    expect(series("Russia").find(complete)?.year).toBe(1988);
    expect(series("Cuba").filter((entry) => entry.year > 2020 && entry.gdp === null)).toHaveLength(
      3,
    );
    // Cambodia's collapse, and Iraq's exchange-rate drop.
    expect(row("Cambodia", 1977).life).toBeCloseTo(11.3, 1);
    expect(Math.round(row("Iraq", 1990).gdp ?? 0)).toBe(10261);
    expect(Math.round(row("Iraq", 1991).gdp ?? 0)).toBe(23);
    // The ends of the log axis, and the lowest life expectancy in 2023.
    const incomes = wealthHealthRows.flatMap((entry) => (entry.gdp === null ? [] : [entry]));
    const poorest = incomes.reduce((low, entry) =>
      (entry.gdp ?? 0) < (low.gdp ?? 0) ? entry : low,
    );
    const richest = incomes.reduce((high, entry) =>
      (entry.gdp ?? 0) > (high.gdp ?? 0) ? entry : high,
    );
    expect([poorest.country, poorest.year, Math.round(poorest.gdp ?? 0)]).toEqual([
      "Myanmar",
      1966,
      12,
    ]);
    expect([richest.country, richest.year, Math.round(richest.gdp ?? 0)]).toEqual([
      "United States",
      2023,
      81032,
    ]);
    const in2023 = wealthHealthRows.filter((entry) => entry.year === 2023 && entry.life !== null);
    expect(Math.min(...in2023.map((entry) => entry.life ?? Infinity))).toBe(
      row("Nigeria", 2023).life,
    );
    expect(row("Nigeria", 2023).life).toBeCloseTo(54.5, 1);
    expect(Math.round(row("South Korea", 2023).gdp ?? 0)).toBe(35674);
    expect(row("India", 2023).gdp).toBeLessThan(3000);
  });

  it("labels and trails only countries in the data", () => {
    const countries = new Set(wealthHealthRows.map((entry) => entry.country));
    for (const name of [...LABELLED, ...TRAILED]) expect(countries.has(name), name).toBe(true);
  });

  it("compiles the static frame at the last year without warnings, one point per country with values", () => {
    for (const demo of demos) {
      const warnings: string[] = [];
      const layout = compileChart(demo.spec as ChartSpec, {
        width: 720,
        height: demo.height ?? 560,
        onWarn: (warning) => warnings.push(warning),
      });
      expect(warnings, demo.id).toEqual([]);
      expect(
        layout.marks.filter((mark) => mark.type === "point" && !isTrailMark(mark)),
        demo.id,
      ).toHaveLength(
        (demo.spec as ChartSpec).data.filter(
          (entry) => entry.year === 2023 && complete(entry as never),
        ).length,
      );
    }
  });

  it("validates every demo and renders light and dark static SVGs", () => {
    for (const demo of demos) {
      expect(() => validateDemo(demo.id, demo.spec), demo.id).not.toThrow();
      const svgs = staticSvgPair(demo.spec, {
        idPrefix: demo.id.replaceAll("/", "-"),
        width: 720,
        height: demo.height ?? 440,
      });
      expect(svgs, demo.id).toContain('data-theme="light"');
      expect(svgs, demo.id).toContain('data-theme="dark"');
    }
  });
});
