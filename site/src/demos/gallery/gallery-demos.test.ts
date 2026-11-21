import { electricityMixMatrix } from "@datasets/electricity-mix-matrix";
import { usInflation } from "@datasets/us-inflation";
import { usStateUnemployment } from "@datasets/us-state-unemployment";
import { validateDemo } from "../../lib/demo/validate";
import { allDemos, getDemo } from "../registry";
import { sourceOf } from "../source";
import { combinedShare, SOURCES, shareOf } from "./shared";

const titleOf = (id: string) =>
  (getDemo(id).spec as { chrome?: { title?: string } }).chrome?.title ?? "";
const galleryDemos = allDemos().filter((demo) => demo.id.startsWith("gallery/"));

describe("the gallery's own demos", () => {
  it.each(galleryDemos.map((demo) => [demo.id, demo]))("%s has a valid spec", (id, demo) => {
    expect(() => validateDemo(id, demo.spec)).not.toThrow();
  });

  it("each cite the tier-1 dataset they draw", () => {
    const tier1 = [electricityMixMatrix, usInflation, usStateUnemployment].map(
      (dataset) => sourceOf(dataset).label,
    );
    const cited = galleryDemos
      .map((demo) => demo.source.label)
      .filter((label) => !tier1.includes(label));
    // The table is the one demo on another dataset; it is tier 1 too.
    expect(cited).toEqual(["World Bank WDI, OWID (PPP GDP), WHO Global Health Observatory"]);
  });
});

describe("the gallery's titles state what the rows show", () => {
  it("gas made more than coal and nuclear together in 2023", () => {
    expect(titleOf("gallery/electricity-donut")).toBe(
      "Gas generated more than coal and nuclear combined in 2023",
    );
    expect(shareOf("Gas", "2023")).toBeGreaterThan(combinedShare(["Coal", "Nuclear"], "2023"));
  });

  it("nuclear made more than wind and solar together in 2023", () => {
    expect(titleOf("gallery/electricity-waffle")).toMatch(/^Nuclear generated more than wind/);
    expect(shareOf("Nuclear", "2023")).toBeGreaterThan(combinedShare(["Wind", "Solar"], "2023"));
  });

  it("wind and solar's combined share more than doubled", () => {
    expect(titleOf("gallery/electricity-share-columns")).toBe(
      "Wind and solar's combined share more than doubled from 2016 to 2023, to 15.9%",
    );
    expect(combinedShare(["Wind", "Solar"], "2023")).toBeGreaterThan(
      2 * combinedShare(["Wind", "Solar"], "2016"),
    );
  });

  it("only gas, wind and solar gained share", () => {
    expect(titleOf("gallery/electricity-facets")).toContain("only gas, wind and solar gained");
    const gained = SOURCES.filter((source) => shareOf(source, "2023") > shareOf(source, "2016"));
    expect(gained).toEqual(["Gas", "Wind", "Solar"]);
  });

  it("inflation was above 2% in every quarter from mid-2021, and not just before", () => {
    expect(titleOf("gallery/inflation-reference")).toBe(
      "US inflation was above 2% in every quarter from mid-2021 through 2024",
    );
    const fromMid2021 = usInflation.data.filter((row) => row.date >= "2021-04-01");
    expect(fromMid2021.at(-1)?.date).toBe("2024-10-01");
    expect(fromMid2021.every((row) => row.rate > 2)).toBe(true);
    expect(usInflation.data.find((row) => row.date === "2021-01-01")?.rate).toBeLessThanOrEqual(2);
  });

  it("counts the states by the thresholds their titles name", () => {
    expect(titleOf("gallery/unemployment-histogram")).toBe(
      "Unemployment was under 4% in 22 of the 50 states",
    );
    expect(titleOf("gallery/unemployment-beeswarm")).toBe(
      "Unemployment was 5% or more in seven states and DC",
    );
    // The beeswarm's title adds DC to the count, so DC must clear the line too.
    expect(usStateUnemployment.data.DC).toBeGreaterThanOrEqual(5);
  });

  it("names the source whose share grew most", () => {
    expect(titleOf("gallery/electricity-change-table")).toBe(
      "Gas gained 8.7 points of share from 2016 to 2023, more than any other source",
    );
    const gains = SOURCES.map((source) => shareOf(source, "2023") - shareOf(source, "2016"));
    expect(Math.max(...gains)).toBeCloseTo(shareOf("Gas", "2023") - shareOf("Gas", "2016"));
  });

  it("names the country with the longest life expectancy", () => {
    expect(titleOf("gallery/country-table")).toBe(
      "Japan has the longest life expectancy of these 12 countries, at 83.6 years",
    );
  });
});
