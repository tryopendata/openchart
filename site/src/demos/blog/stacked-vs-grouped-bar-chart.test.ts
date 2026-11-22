// @vitest-environment node
// The stacked-vs-grouped post shows a grouped capacity chart and a stacked
// homelessness chart in `json demo` fences so a reader can copy them. Each
// fence must stay the spec its registered demo draws, over the dataset modules'
// rows, and every title must be read off those rows.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eiaCapacityOnlineByYear } from "@datasets/eia-capacity-online-by-year";
import { hudPitHomelessnessNational } from "@datasets/hud-pit-homelessness-national";
import { describe, expect, it } from "vitest";
import { staticSvgPair } from "../../lib/demo/static-svg";
import { validateDemo } from "../../lib/demo/validate";
import { capacityGrouped, capacityStacked, homelessStacked } from "./stacked-vs-grouped-bar-chart";

const post = readFileSync(
  join(process.cwd(), "src/content/blog/stacked-vs-grouped-bar-chart.mdx"),
  "utf8",
);

const fences = [...post.matchAll(/^```json (demo[^\n]*)\n([\s\S]*?)^```$/gm)].map((match) => ({
  info: match[1] ?? "",
  spec: JSON.parse(match[2] ?? "null"),
}));

const titleOf = (demo: { spec: unknown }) =>
  (demo.spec as { chrome?: { title?: string } }).chrome?.title;
const dataOf = (demo: { spec: unknown }) => (demo.spec as { data: Record<string, unknown>[] }).data;

describe("the stacked-vs-grouped post's figures", () => {
  it("writes the grouped and homelessness specs in its json demo fences, citing their datasets", () => {
    expect(fences).toHaveLength(2);
    for (const [fence, demo] of [
      [fences[0], capacityGrouped],
      [fences[1], homelessStacked],
    ] as const) {
      expect(fence?.info).toContain(`source="${demo.source.label}"`);
      expect(fence?.info).toContain(`height=${demo.height}`);
      expect(fence?.spec).toEqual(demo.spec);
    }
  });

  it("draws the stacked and grouped capacity charts from the same EIA rows", () => {
    expect(dataOf(capacityStacked)).toEqual(dataOf(capacityGrouped));
    const byFuel = (fuel: string) =>
      dataOf(capacityGrouped)
        .filter((row) => row.fuel === fuel)
        .map((row) => row.gigawatts);
    const years = eiaCapacityOnlineByYear.data.filter(
      (row) => row.year >= 2018 && row.year <= 2024,
    );
    expect(byFuel("Solar")).toEqual(
      years.map((row) => Number(((row.solar_mw ?? 0) / 1000).toFixed(1))),
    );
    expect(byFuel("Natural gas")).toEqual(
      years.map((row) => Number((row.natural_gas_mw / 1000).toFixed(1))),
    );
  });

  it("lists solar first in every year, since segments stack in row order", () => {
    const rows = dataOf(capacityStacked) as { year: string; fuel: string }[];
    const firstFuelByYear = new Map<string, string>();
    for (const row of rows)
      if (!firstFuelByYear.has(row.year)) firstFuelByYear.set(row.year, row.fuel);
    expect(new Set(firstFuelByYear.values())).toEqual(new Set(["Solar"]));
  });

  it("splits every homelessness row into its sheltered and unsheltered counts", () => {
    const rows = dataOf(homelessStacked);
    expect(rows.filter((row) => row.status === "Sheltered").map((row) => row.people)).toEqual(
      hudPitHomelessnessNational.data.map((row) => row.sheltered),
    );
    expect(rows.filter((row) => row.status === "Unsheltered").map((row) => row.people)).toEqual(
      hudPitHomelessnessNational.data.map((row) => row.unsheltered),
    );
  });

  it("titles each chart with a finding read off the rows", () => {
    expect(titleOf(capacityStacked)).toBe(
      "The four fuels added 49.8 GW in 2024, the most of any year shown",
    );
    expect(titleOf(capacityGrouped)).toBe(
      "Solar added 31.2 GW in 2024, 13 times as much as natural gas",
    );
    expect(titleOf(homelessStacked)).toBe(
      "The homeless count fell to 544,084 in 2016 and rose to 767,856 in 2024",
    );
  });

  it("validates every demo and renders light and dark static SVGs", () => {
    for (const demo of [capacityStacked, capacityGrouped, homelessStacked]) {
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
