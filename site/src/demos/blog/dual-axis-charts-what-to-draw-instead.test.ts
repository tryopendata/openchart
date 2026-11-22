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
  dualAxisTrimmed,
  dualAxisZeroBased,
  fatalitiesIndexed,
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
      const layers = (
        demo.spec as unknown as { layer: { data: { deaths: number; rate: number }[] }[] }
      ).layer;
      for (const layer of layers) {
        expect(layer.data.map((row) => [row.deaths, row.rate])).toEqual(
          nhtsaTrafficFatalities.data.map((row) => [row.total_fatalities, row.rate_per_100m_vmt]),
        );
      }
    }
  });

  it("splits the wildfire rows into one panel per measure and indexes road deaths to 1966", () => {
    const panels = (
      wildfirePanels.spec as unknown as { data: { measure: string; value: number }[] }
    ).data;
    expect(
      panels.filter((row) => row.measure === "Fires per year").map((row) => row.value),
    ).toEqual(nifcWildfires.data.map((row) => row.fires));
    expect(
      panels.filter((row) => row.measure === "Acres burned per fire").map((row) => row.value),
    ).toEqual(nifcWildfires.data.map((row) => row.acres_per_fire));
    const indexed = (
      fatalitiesIndexed.spec as unknown as { data: { series: string; index: number }[] }
    ).data;
    expect(indexed.filter((row) => row.series === "Deaths")[0]?.index).toBe(100);
    expect(indexed.filter((row) => row.series === "Deaths per 100M miles")[0]?.index).toBe(100);
  });

  it("titles each chart with a finding read off the rows", () => {
    expect(titleOf(dualAxisZeroBased)).toBe(
      "With the left axis from zero, deaths slide slowly while the rate plunges",
    );
    expect(titleOf(dualAxisTrimmed)).toBe(
      "With both axes trimmed, deaths and the rate slide down as a pair",
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
