// @vitest-environment node
// The animated-or-small-multiples post draws the World Bank rows three ways. Each view
// must compile, the small multiples must keep one color and size scale across panels,
// the printed connected scatter must stay the spec its demo draws, and the numbers the
// prose and titles quote must match the rows.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { compileChart, compileChartPlayback } from "@opendata-ai/openchart-engine";
import { describe, expect, it } from "vitest";
import { staticSvgPair } from "../../lib/demo/static-svg";
import { validateDemo } from "../../lib/demo/validate";
import { wealthHealthRows } from "./how-to-make-an-animated-bubble-chart-in-javascript";
import {
  PANEL_YEARS,
  PATH_COUNTRIES,
  wealthHealthPanels,
  wealthHealthPaths,
} from "./when-to-use-an-animated-chart-instead-of-small-multiples";

const post = readFileSync(
  join(
    process.cwd(),
    "src/content/blog/when-to-use-an-animated-chart-instead-of-small-multiples.mdx",
  ),
  "utf8",
);
const demos = [wealthHealthPaths, wealthHealthPanels];
const row = (country: string, year: number) => {
  const found = wealthHealthRows.find((entry) => entry.country === country && entry.year === year);
  if (!found) throw new Error(`no row for ${country} in ${year}`);
  return found;
};

type PointMark = { type: "point"; fill: string; r: number; data: Record<string, unknown> };

describe("the animated-or-small-multiples post's figures", () => {
  it("writes the connected scatter's spec in its json demo fence, citing the dataset", () => {
    const [, info = "", body = ""] = /^```json (demo[^\n]*)\n([\s\S]*?)^```$/m.exec(post) ?? [];
    expect(info).toContain(`source="${wealthHealthPaths.source.label}"`);
    expect(info).toContain(`height=${wealthHealthPaths.height}`);
    expect(info).toContain(`phone-height=${wealthHealthPaths.phoneHeight}`);
    expect(JSON.parse(body)).toEqual(wealthHealthPaths.spec);
  });

  it("draws every year of five countries as trails, opened on the last year", () => {
    const spec = wealthHealthPaths.spec as ChartSpec;
    expect(new Set(spec.data.map((entry) => entry.country))).toEqual(new Set(PATH_COUNTRIES));
    expect(spec.data).toHaveLength(PATH_COUNTRIES.length * 64);
    const playback = compileChartPlayback(spec, { width: 720, height: 520 });
    const trails = playback.trailsAt(playback.periods.length - 1);
    expect(trails.map((trail) => trail.key).sort()).toEqual([...PATH_COUNTRIES].sort());
    // A dot for every year: each of the five has both values in all 64.
    for (const trail of trails) expect(trail.points, trail.key).toHaveLength(64);
    expect(spec.animation).toBe(false);
  });

  it("colors and sizes a country alike in every panel", () => {
    const layout = compileChart(wealthHealthPanels.spec as ChartSpec, { width: 720, height: 880 });
    const panels = layout.facet?.panels ?? [];
    expect(panels.map((panel) => panel.header.text)).toEqual(PANEL_YEARS.map(String));
    const points = panels.flatMap((panel) =>
      panel.marks.filter((mark): mark is PointMark & typeof mark => mark.type === "point"),
    );
    const fillsByRegion = new Map<unknown, Set<string>>();
    for (const point of points) {
      const fills = fillsByRegion.get(point.data.region) ?? new Set();
      fills.add(point.fill);
      fillsByRegion.set(point.data.region, fills);
    }
    for (const [region, fills] of fillsByRegion) expect(fills.size, String(region)).toBe(1);
    const radius = (country: string, year: number) =>
      points.find((point) => point.data.country === country && point.data.year === year)?.r ?? 0;
    expect(radius("China", 2023)).toBeGreaterThan(radius("China", 1960));
    expect(radius("India", 2023)).toBeGreaterThan(radius("China", 2023));
  });

  it("pins the facts the prose and titles quote", () => {
    expect(row("China", 2023).life).toBeCloseTo(78.0, 1);
    expect(row("United States", 2023).life).toBeCloseTo(78.4, 1);
    const incomeShare = (row("China", 2023).gdp ?? 0) / (row("United States", 2023).gdp ?? 1);
    expect(Math.round(1 / incomeShare)).toBe(6);
    const both = [...new Set(wealthHealthRows.map((entry) => entry.country))].filter(
      (country) => row(country, 1960).gdp !== null && row(country, 2023).gdp !== null,
    );
    expect(both).toHaveLength(51);
    const rose = both.filter(
      (country) =>
        (row(country, 2023).gdp ?? 0) > (row(country, 1960).gdp ?? 0) &&
        (row(country, 2023).life ?? 0) > (row(country, 1960).life ?? 0),
    );
    expect(rose).toHaveLength(51);
    expect(row("Cambodia", 1977).life).toBeCloseTo(11.3, 1);
    expect(row("Cambodia", 1980).life).toBeCloseTo(47.5, 1);
    expect(row("Cambodia", 1974).life).toBeCloseTo(39.3, 1);
    expect(Math.round(row("Cambodia", 1975).life ?? 0)).toBe(13);
    expect(row("Nigeria", 2023).life).toBeCloseTo(54.5, 1);
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
