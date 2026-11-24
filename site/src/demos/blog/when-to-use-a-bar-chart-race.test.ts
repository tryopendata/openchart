// @vitest-environment node
// The race-or-not post prints its line chart in a `json demo` fence. It must
// stay the spec the registered demo draws, and the census rows and the
// numbers the prose quotes must stay what the Census Bureau published.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { RaceSpec } from "@opendata-ai/openchart-core";
import { prepareRace } from "@opendata-ai/openchart-engine";
import { describe, expect, it } from "vitest";
import { staticSvgPair } from "../../lib/demo/static-svg";
import { validateDemo } from "../../lib/demo/validate";
import {
  stateBump,
  stateLines,
  statePopulation,
  stateRace,
  TOP_FIVE_STATES,
} from "./when-to-use-a-bar-chart-race";

const post = readFileSync(
  join(process.cwd(), "src/content/blog/when-to-use-a-bar-chart-race.mdx"),
  "utf8",
);
const demos = [stateRace, stateBump, stateLines];
const rows = statePopulation.data;
const row = (state: string, year: number) =>
  rows.find((entry) => entry.state === state && entry.year === year);

describe("the race-or-not post's figures", () => {
  it("writes the line chart's spec in its json demo fence, citing the dataset", () => {
    const [, info = "", body = ""] = /^```json (demo[^\n]*)\n([\s\S]*?)^```$/m.exec(post) ?? [];
    expect(info).toContain(`source="${stateLines.source.label}"`);
    expect(info).toContain(`height=${stateLines.height}`);
    expect(JSON.parse(body)).toEqual(stateLines.spec);
  });

  it("pins census counts the Census Bureau published", () => {
    expect(rows).toHaveLength(14 * 12);
    expect(row("New York", 1910)?.population).toBe(9113614);
    expect(row("California", 1970)?.population).toBe(19953134);
    expect(row("New York", 1970)?.population).toBe(18236967);
    expect(row("California", 2020)?.population).toBe(39538223);
    expect(row("Texas", 2020)?.population).toBe(29145505);
    expect(row("Florida", 2020)?.population).toBe(21538187);
    expect(row("New York", 2020)?.population).toBe(20201249);
  });

  it("ranks agree with the populations wherever two listed states meet", () => {
    for (const year of new Set(rows.map((entry) => entry.year))) {
      const sorted = rows
        .filter((entry) => entry.year === year)
        .sort((a, b) => b.population - a.population);
      sorted.forEach((entry, index) => {
        const next = sorted[index + 1];
        if (next) expect(entry.rank, `${entry.state} ${year}`).toBeLessThan(next.rank);
      });
      expect(sorted[0]?.rank).toBe(1);
    }
  });

  it("keeps every state that reaches the top ten, and the seven that reach the top five", () => {
    for (const year of new Set(rows.map((entry) => entry.year))) {
      const ranks = rows.filter((entry) => entry.year === year && entry.rank <= 10);
      expect(ranks, String(year)).toHaveLength(10);
    }
    expect(TOP_FIVE_STATES).toEqual([
      "California",
      "Florida",
      "Illinois",
      "New York",
      "Ohio",
      "Pennsylvania",
      "Texas",
    ]);
  });

  it("pins the numbers the prose quotes", () => {
    const pop = (state: string, year: number) => row(state, year)?.population ?? Number.NaN;
    const rank = (state: string, year: number) => row(state, year)?.rank;
    const millions = (n: number) => Math.round(n / 1e5) / 10;
    const topTen = (year: number) =>
      rows
        .filter((entry) => entry.year === year && entry.rank <= 10)
        .sort((a, b) => a.rank - b.rank)
        .map((entry) => entry.state);
    const years = [...new Set(rows.map((entry) => entry.year))];
    for (let i = 1; i < years.length; i++) {
      expect(topTen(years[i] as number), String(years[i])).not.toEqual(
        topTen(years[i - 1] as number),
      );
    }
    expect([rank("Pennsylvania", 1910), rank("Pennsylvania", 2000)]).toEqual([2, 6]);
    expect([rank("Florida", 1950), rank("Florida", 1960)]).toEqual([20, 10]);
    expect([rank("Georgia", 1910), rank("Georgia", 1920), rank("Georgia", 2000)]).toEqual([
      10, 12, 10,
    ]);
    expect(years.filter((year) => (rank("Georgia", year) ?? 99) <= 10)).toEqual([
      1910, 2000, 2010, 2020,
    ]);
    expect(Math.floor(pop("California", 2020) / pop("California", 1910))).toBe(16);
    expect([millions(pop("California", 1910)), millions(pop("California", 2020))]).toEqual([
      2.4, 39.5,
    ]);
    expect([millions(pop("New York", 1910)), millions(pop("New York", 2020))]).toEqual([9.1, 20.2]);
    expect(pop("New York", 1910) / pop("California", 2020)).toBeLessThan(0.25);
    expect(Math.round((pop("Florida", 1950) / pop("Florida", 1910)) * 10) / 10).toBe(3.7);
    expect(millions(pop("New York", 1910) - pop("Pennsylvania", 1910))).toBe(1.4);
    expect(millions(pop("California", 2020) - pop("Texas", 2020))).toBe(10.4);
    expect(millions(pop("New York", 2020) - pop("New York", 1970))).toBe(2);
    expect(Math.round((pop("Texas", 2020) - pop("Texas", 1970)) / 1e6)).toBe(18);
    expect(millions(pop("Florida", 2020) - pop("Florida", 1970))).toBe(14.7);
  });

  it("titles each chart with a finding read off the rows", () => {
    const title = (demo: (typeof demos)[number]) =>
      (demo.spec as { chrome?: { title?: string } }).chrome?.title;
    expect(title(stateRace)).toBe("California became the most populous state in 1970");
    expect(title(stateBump)).toBe("Florida climbed from 33rd to 3rd and New York fell to 4th");
    expect(title(stateLines)).toBe("Texas passed New York in 2000 and Florida passed it in 2020");
  });

  it("plays the race in 8.4 seconds, 700 ms per census", () => {
    expect(prepareRace(stateRace.spec as RaceSpec, {}).playback.durationMs).toBe(8400);
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
