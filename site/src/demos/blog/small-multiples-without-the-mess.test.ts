// @vitest-environment node
// The small-multiples post shows two panel specs in `json demo` fences so a
// reader can copy them. Each fence must stay the spec its registered demo draws,
// over the dataset modules' rows, and every title must be read off those rows.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fbiViolentCrimeRates } from "@datasets/fbi-violent-crime-rates";
import { spaceLaunchesByCountry } from "@datasets/space-launches-by-country";
import { describe, expect, it } from "vitest";
import { staticSvgPair } from "../../lib/demo/static-svg";
import { validateDemo } from "../../lib/demo/validate";
import {
  crimeIndependent,
  crimeShared,
  launchesOneChart,
  launchPanels,
} from "./small-multiples-without-the-mess";

const post = readFileSync(
  join(process.cwd(), "src/content/blog/small-multiples-without-the-mess.mdx"),
  "utf8",
);

const fences = [...post.matchAll(/^```json (demo[^\n]*)\n([\s\S]*?)^```$/gm)].map((match) => ({
  info: match[1] ?? "",
  spec: JSON.parse(match[2] ?? "null"),
}));

const titleOf = (demo: { spec: unknown }) =>
  (demo.spec as { chrome?: { title?: string } }).chrome?.title;
const dataOf = (demo: { spec: unknown }) => (demo.spec as { data: Record<string, unknown>[] }).data;

describe("the small-multiples post's figures", () => {
  it("writes the panel specs in its json demo fences, citing their datasets", () => {
    expect(fences).toHaveLength(2);
    for (const [fence, demo] of [
      [fences[0], launchPanels],
      [fences[1], crimeIndependent],
    ] as const) {
      expect(fence?.info).toContain(`source="${demo.source.label}"`);
      expect(fence?.info).toContain(`height=${demo.height}`);
      expect(fence?.spec).toEqual(demo.spec);
    }
  });

  it("draws every launch chart from the launch rows unchanged", () => {
    for (const demo of [launchesOneChart, launchPanels]) {
      const byCountry = (name: string) =>
        dataOf(demo)
          .filter((row) => row.country === name)
          .map((row) => row.launches);
      expect(byCountry("USSR/Russia")).toEqual(
        spaceLaunchesByCountry.data.map((r) => r.ussr_russia),
      );
      expect(byCountry("United States")).toEqual(spaceLaunchesByCountry.data.map((r) => r.usa));
      expect(byCountry("China")).toEqual(spaceLaunchesByCountry.data.map((r) => r.china));
      expect(byCountry("Other countries")).toEqual(spaceLaunchesByCountry.data.map((r) => r.other));
    }
  });

  it("draws both crime panel charts from the same rows, differing only in the y scale", () => {
    expect(dataOf(crimeShared)).toEqual(dataOf(crimeIndependent));
    const homicide = dataOf(crimeShared)
      .filter((row) => row.crime === "Homicide")
      .map((row) => row.rate);
    expect(homicide).toEqual(fbiViolentCrimeRates.data.map((r) => r.homicide_rate_per_100k));
    expect((crimeShared.spec as { resolve?: unknown }).resolve).toBeUndefined();
    expect((crimeIndependent.spec as { resolve?: unknown }).resolve).toEqual({
      scale: { y: "independent" },
    });
  });

  it("titles each chart with a finding read off the rows", () => {
    expect(titleOf(launchesOneChart)).toBe(
      "USSR and Russian launches peaked at 108 in 1982, US launches at 77 in 1966",
    );
    expect(titleOf(launchPanels)).toBe("China launched 28 times in 2018, one more than the US");
    expect(titleOf(crimeShared)).toBe(
      "On a shared scale, homicide's fall from 9.8 to 4.1 is a flat line",
    );
    expect(titleOf(crimeIndependent)).toBe(
      "On free scales, the 2021 homicide rise to 6.8 is visible",
    );
  });

  it("validates every demo and renders light and dark static SVGs", () => {
    for (const demo of [launchesOneChart, launchPanels, crimeShared, crimeIndependent]) {
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
