// @vitest-environment node
// The animated choropleth post prints its tile map in a `json demo` fence so a
// reader can copy it. It must stay the spec the registered demo draws, over the
// Department of Labor rows unchanged, and the numbers the prose quotes must match them.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { insuredUnemployment2020 } from "@datasets/insured-unemployment-2020";
import type { GeoMapSpec, TileMapSpec } from "@opendata-ai/openchart-core";
import { compileGeoMap, compileTileMap } from "@opendata-ai/openchart-engine";
import { describe, expect, it } from "vitest";
import { staticSvgPair } from "../../lib/demo/static-svg";
import { validateDemo } from "../../lib/demo/validate";
import {
  CHOROPLETH_WEEKS,
  insuredChoropleth,
  insuredTileMap,
  medianRate,
  statesHigherAtYearEnd,
  TILE_WEEKS,
  WEEKS,
} from "./how-to-make-an-animated-choropleth-map";

const post = readFileSync(
  join(process.cwd(), "src/content/blog/how-to-make-an-animated-choropleth-map.mdx"),
  "utf8",
);
const rows = insuredUnemployment2020.data;
const choropleth = insuredChoropleth.spec as GeoMapSpec;
const tileMap = insuredTileMap.spec as TileMapSpec;
const rate = (code: string, week: string) =>
  rows.find((row) => row.code === code && row.week === week)?.rate;

describe("the animated choropleth post's figures", () => {
  it("writes the tile map's spec in its json demo fence, citing the dataset", () => {
    const [, info = "", body = ""] = /^```json (demo[^\n]*)\n([\s\S]*?)^```$/m.exec(post) ?? [];
    expect(info).toContain(`source="${insuredTileMap.source.label}"`);
    expect(info).toContain(`height=${insuredTileMap.height}`);
    expect(JSON.parse(body)).toEqual(tileMap);
  });

  it("draws every other week on the choropleth and every fourth on the tile map, values unchanged", () => {
    expect(rows).toHaveLength(51 * 52);
    expect(CHOROPLETH_WEEKS).toHaveLength(26);
    expect(CHOROPLETH_WEEKS[0]).toBe("2020-01-11");
    expect(CHOROPLETH_WEEKS).toEqual(
      expect.arrayContaining(["2020-03-21", "2020-06-27", "2020-12-26"]),
    );
    expect(TILE_WEEKS.every((week) => CHOROPLETH_WEEKS.includes(week))).toBe(true);
    expect(choropleth.data).toEqual(
      rows
        .filter((row) => CHOROPLETH_WEEKS.includes(row.week))
        .map(({ state, week, rate }) => ({ state, week, rate })),
    );
    expect(TILE_WEEKS).toHaveLength(13);
    expect(TILE_WEEKS[0]).toBe("2020-01-25");
    expect(TILE_WEEKS.at(-1)).toBe("2020-12-26");
    expect(TILE_WEEKS).toContain("2020-03-21");
    expect(tileMap.data).toHaveLength(51 * 13);
    for (const row of tileMap.data as { code: string; week: string; rate: number }[]) {
      expect(rate(row.code, row.week)).toBe(row.rate);
    }
  });

  it("pins the facts the prose quotes", () => {
    expect(WEEKS).toHaveLength(52);
    expect(rows.every((row) => row.rate !== null)).toBe(true);
    expect(medianRate("2020-01-04")).toBe(0.97);
    expect(medianRate("2020-03-21")).toBe(1.34);
    expect(medianRate("2020-06-27")).toBe(11.2);
    const all = rows.map((row) => row.rate as number);
    expect(Math.min(...all)).toBe(0.34);
    expect(Math.max(...all)).toBe(23.13);
    expect(rate("NV", "2020-08-01")).toBe(23.13);
    expect(
      Math.max(...rows.filter((r) => r.week === "2020-01-04").map((r) => r.rate as number)),
    ).toBe(2.64);
    expect(rate("AK", "2020-01-04")).toBe(2.64);
    expect(rate("NV", "2020-12-26")).toBe(7.34);
    expect(statesHigherAtYearEnd).toHaveLength(51);
    expect([rate("MI", "2020-03-21"), rate("MI", "2020-03-28")]).toEqual([1.88, 2.4]);
    expect([rate("NV", "2020-03-21"), rate("NV", "2020-03-28")]).toEqual([1.65, 2.26]);
    expect(WEEKS.indexOf("2020-06-27")).toBe(25);
    const tileRates = (tileMap.data as { rate: number }[]).map((row) => row.rate);
    expect([Math.min(...tileRates), Math.max(...tileRates)]).toEqual([0.39, 22.54]);
  });

  it("titles each map with a finding read off the rows", () => {
    expect(choropleth.chrome?.title).toBe(
      "In the median state, insured unemployment rose from 1.0% to 11.2% by June 27",
    );
    expect(tileMap.chrome?.title).toBe(
      "Every state ended 2020 with a higher rate than it started with",
    );
  });

  it("freezes one color scale across the year, so January and July share a legend", () => {
    const at = (t: number) => compileGeoMap(choropleth, { width: 720, height: 476, playbackT: t });
    const january = at(0);
    const july = at(CHOROPLETH_WEEKS.indexOf("2020-07-11"));
    expect(january.continuousLegend).toEqual(july.continuousLegend);
    expect(january.continuousLegend?.ticks.map((tick) => tick.value)).toEqual([5, 10, 15, 20]);
    // Every state sits in the lightest of the five classes in January; July uses all five.
    expect(new Set(january.features.map((feature) => feature.fill)).size).toBe(1);
    expect(new Set(july.features.map((feature) => feature.fill)).size).toBe(5);
    const tiles = (t: number) => compileTileMap(tileMap, { width: 720, height: 516, playbackT: t });
    expect(tiles(0).gradientLegend).toEqual(tiles(TILE_WEEKS.length - 1).gradientLegend);
  });

  it("validates every demo and renders light and dark static SVGs", () => {
    for (const demo of [insuredChoropleth, insuredTileMap]) {
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
