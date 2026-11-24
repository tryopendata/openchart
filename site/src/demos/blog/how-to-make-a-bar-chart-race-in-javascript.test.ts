// @vitest-environment node
// The bar chart race post prints its top-5 race in a `json demo` fence so a
// reader can copy it. It must stay the spec the registered demo draws, over
// the World Bank rows unchanged, and the numbers the prose quotes must match them.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { worldGdpRace } from "@datasets/world-gdp-race";
import type { RaceSpec } from "@opendata-ai/openchart-core";
import { prepareRace, raceFrameAt } from "@opendata-ai/openchart-engine";
import { describe, expect, it } from "vitest";
import { staticSvgPair } from "../../lib/demo/static-svg";
import { validateDemo } from "../../lib/demo/validate";
import {
  everInTop,
  gdpRace,
  gdpRaceLine,
  gdpRaceTable,
  gdpTopFiveRace,
  topIn,
} from "./how-to-make-a-bar-chart-race-in-javascript";

const post = readFileSync(
  join(process.cwd(), "src/content/blog/how-to-make-a-bar-chart-race-in-javascript.mdx"),
  "utf8",
);
const demos = [gdpRace, gdpTopFiveRace, gdpRaceLine, gdpRaceTable];
const raceOf = (demo: (typeof demos)[number]) => demo.spec as RaceSpec;

describe("the bar chart race post's figures", () => {
  it("writes the top-5 race's spec in its json demo fence, citing the dataset", () => {
    const [, info = "", body = ""] = /^```json (demo[^\n]*)\n([\s\S]*?)^```$/m.exec(post) ?? [];
    expect(info).toContain(`source="${gdpTopFiveRace.source.label}"`);
    expect(info).toContain(`height=${gdpTopFiveRace.height}`);
    expect(info).toContain(`phone-height=${gdpTopFiveRace.phoneHeight}`);
    expect(JSON.parse(body)).toEqual(gdpTopFiveRace.spec);
  });

  it("draws the dataset's rows in dollars, one per economy and year", () => {
    expect(worldGdpRace).toHaveLength(892);
    const data = raceOf(gdpRace).data;
    expect(data).toHaveLength(worldGdpRace.length);
    for (const [index, row] of worldGdpRace.entries()) {
      expect(data[index]).toEqual({ ...row, gdp: row.gdp * 1e9 });
    }
  });

  it("keeps only the economies that reach the top five, which leaves the race unchanged", () => {
    expect([...everInTop(5)].sort()).toEqual([
      "China",
      "France",
      "Germany",
      "India",
      "Italy",
      "Japan",
      "United Kingdom",
      "United States",
    ]);
    expect(raceOf(gdpTopFiveRace).data).toHaveLength(360);
    expect(everInTop(10).size).toBe(15);
    const full = prepareRace({ ...raceOf(gdpTopFiveRace), data: raceOf(gdpRace).data }, {});
    const trimmed = prepareRace(raceOf(gdpTopFiveRace), {});
    // Every quarter period, so frames mid-swap are compared too.
    for (let t = 0; t <= 44; t += 0.25) {
      const leaders = (model: typeof full) =>
        raceFrameAt(model, t)
          .items.filter((item) => item.opacity > 0)
          .map((item) => item.key);
      expect(leaders(trimmed), `period ${t}`).toEqual(leaders(full));
    }
  });

  it("pins the facts the prose quotes", () => {
    const gdp = (country: string, year: number) =>
      worldGdpRace.find((row) => row.country === country && row.year === year)?.gdp;
    expect(topIn(1980, 10)).toEqual([
      "United States",
      "Japan",
      "Germany",
      "France",
      "United Kingdom",
      "Italy",
      "Canada",
      "Brazil",
      "Spain",
      "Mexico",
    ]);
    expect(topIn(1980, 13).slice(11)).toEqual(["China", "India"]);
    expect(topIn(2024, 5)).toEqual(["United States", "China", "Germany", "Japan", "India"]);
    const japan = worldGdpRace.filter((row) => row.country === "Japan");
    expect(Math.max(...japan.map((row) => row.gdp))).toBe(gdp("Japan", 2012));
    expect(gdp("Japan", 2012)).toBe(6272);
    expect(gdp("Japan", 2024)).toBe(4028);
    expect(gdp("China", 2024)).toBe(18744);
    expect(gdp("United States", 2024)).toBe(28751);
    expect(Math.round(((gdp("China", 2024) ?? 0) / (gdp("United States", 2024) ?? 1)) * 100)).toBe(
      65,
    );
    expect(
      Math.round(((gdp("United States", 1980) ?? 0) / (gdp("United States", 2024) ?? 1)) * 10),
    ).toBe(1);
    expect(gdp("China", 2009)).toBeLessThan(gdp("Japan", 2009) ?? 0);
    expect(gdp("China", 2010)).toBeGreaterThan(gdp("Japan", 2010) ?? 0);
    expect(gdp("Germany", 2023)).toBeGreaterThan(gdp("Japan", 2023) ?? 0);
    expect(gdp("Germany", 2022)).toBeLessThan(gdp("Japan", 2022) ?? 0);
    expect(gdp("Canada", 2012)).toBe(1828);
    expect(gdp("India", 2012)).toBe(1828);
    expect(gdp("India", 2011)).toBeGreaterThan(gdp("Canada", 2011) ?? 0);
    expect(Math.min(...worldGdpRace.filter((r) => r.country === "Russia").map((r) => r.year))).toBe(
      1988,
    );
  });

  it("breaks the 2012 tie for 10th by the previous year's order", () => {
    const model = prepareRace(raceOf(gdpRace), {});
    const tenth = raceFrameAt(model, 2012 - 1980).items.find((item) => item.rank === 9);
    expect(tenth?.key).toBe("India");
    expect(model.playback.durationMs).toBe(45 * 700);
  });

  it("titles the lead race with a finding read off the rows", () => {
    expect(raceOf(gdpRace).chrome?.title).toBe(
      "China passed Japan in 2010 to become the second-largest economy",
    );
    expect(raceOf(gdpTopFiveRace).chrome?.title).toBe(
      "Only 8 economies have been in the top five since 1980",
    );
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
