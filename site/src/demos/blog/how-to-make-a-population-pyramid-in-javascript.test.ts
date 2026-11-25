// @vitest-environment node
// The population pyramid post prints its static 2020 pyramid in a `json demo`
// fence so a reader can copy it. It must stay the spec the registered demo
// draws, over the UN rows unchanged, and the numbers the prose quotes must match them.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JAPAN_AGE_GROUPS, japanPopulation } from "@datasets/japan-population";
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { describe, expect, it } from "vitest";
import { staticSvgPair } from "../../lib/demo/static-svg";
import { validateDemo } from "../../lib/demo/validate";
import {
  japanPyramid2020,
  japanPyramidPlayback,
  largestGroup,
  peopleIn,
} from "./how-to-make-a-population-pyramid-in-javascript";

const post = readFileSync(
  join(process.cwd(), "src/content/blog/how-to-make-a-population-pyramid-in-javascript.mdx"),
  "utf8",
);
const rows = japanPopulation.data;
const chart = (demo: typeof japanPyramid2020) => demo.spec as ChartSpec;
const total = (year: number) =>
  rows.filter((row) => row.year === year).reduce((sum, row) => sum + row.pop, 0);
const shareFrom = (year: number, firstGroup: number, lastGroup = JAPAN_AGE_GROUPS.length) =>
  JAPAN_AGE_GROUPS.slice(firstGroup, lastGroup).reduce((sum, age) => sum + peopleIn(year, age), 0) /
  total(year);

describe("the population pyramid post's figures", () => {
  it("writes the static pyramid's spec in its json demo fence, citing the dataset", () => {
    const [, info = "", body = ""] = /^```json (demo[^\n]*)\n([\s\S]*?)^```$/m.exec(post) ?? [];
    expect(info).toContain(`source="${japanPyramid2020.source.label}"`);
    expect(info).toContain(`height=${japanPyramid2020.height}`);
    expect(JSON.parse(body)).toEqual(chart(japanPyramid2020));
  });

  it("draws the UN rows unchanged: 2020 for the static pyramid, every year for the playing one", () => {
    expect(chart(japanPyramid2020).data).toEqual(rows.filter((row) => row.year === 2020));
    expect(chart(japanPyramid2020).data).toHaveLength(42);
    expect(chart(japanPyramidPlayback).data).toEqual(rows);
    expect(rows).toHaveLength(31 * 21 * 2);
  });

  it("pins the facts the prose quotes", () => {
    expect(largestGroup(1950)).toBe("0-4");
    expect(largestGroup(2020)).toBe("45-49");
    expect(largestGroup(2100)).toBe("85-89");
    expect(Math.round(total(1950) / 1e6)).toBe(86);
    expect(Math.round(total(2020) / 1e6)).toBe(126);
    expect(Math.round(total(2100) / 1e6)).toBe(77);
    expect(Math.round(shareFrom(1950, 13) * 100)).toBe(5);
    expect(Math.round(shareFrom(2020, 13) * 100)).toBe(29);
    expect(Math.round(shareFrom(1950, 0, 3) * 100)).toBe(35);
    expect(Math.round(shareFrom(2020, 0, 3) * 100)).toBe(12);
    const years = [...new Set(rows.map((row) => row.year))].sort((a, b) => a - b);
    expect(years.indexOf(2020)).toBe(14);
    expect(years).toHaveLength(31);
    expect(peopleIn(2020, "70-74")).toBeGreaterThan(peopleIn(2020, "65-69"));
    expect(peopleIn(2020, "70-74")).toBeGreaterThan(peopleIn(2020, "75-79"));
    const centenarians = rows.filter((row) => row.year === 2020 && row.age === "100+");
    expect(centenarians.map((row) => [row.sex, row.pop])).toEqual([
      ["Male", 15000],
      ["Female", 97000],
    ]);
  });

  it("titles each pyramid with a finding read off the rows", () => {
    expect(chart(japanPyramid2020).chrome?.title).toBe(
      "Japan's largest age group in 2020 was 45-49",
    );
    expect(chart(japanPyramidPlayback).chrome?.title).toBe(
      "Japan's largest age group moves from 0-4 in 1950 to 85-89 in 2100",
    );
  });

  it("validates every demo and renders light and dark static SVGs", () => {
    for (const demo of [japanPyramid2020, japanPyramidPlayback]) {
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
