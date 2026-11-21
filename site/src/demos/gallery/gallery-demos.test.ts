/**
 * The gallery's own demos: each validates and cites the tier-1 dataset it
 * draws, and each title says what that dataset's rows say. The facts are
 * recomputed here from the raw rows, not through the helpers the demos use, so
 * a helper's mistake cannot pass its own check.
 */
import { countryIndicators } from "@datasets/country-indicators";
import { electricityMixMatrix } from "@datasets/electricity-mix-matrix";
import { usEnergyFlow2024 } from "@datasets/us-energy-flow-2024";
import { usInflation } from "@datasets/us-inflation";
import { usStateUnemployment } from "@datasets/us-state-unemployment";
import { validateDemo } from "../../lib/demo/validate";
import { allDemos, getDemo } from "../registry";
import { sourceOf } from "../source";

const titleOf = (id: string) =>
  (getDemo(id).spec as { chrome?: { title?: string } }).chrome?.title ?? "";
const galleryDemos = allDemos().filter((demo) => demo.id.startsWith("gallery/"));

/** A source's share in a year, straight from the matrix's rows. */
const share = (source: string, year: string) =>
  electricityMixMatrix.data.find((row) => row.source === source && row.year === year)?.share ?? NaN;
/** The 50 states' rates, DC left out. */
const states = Object.entries(usStateUnemployment.data).filter(([state]) => state !== "DC");
/** The Census Bureau's West region. */
const WEST = ["AK", "AZ", "CA", "CO", "HI", "ID", "MT", "NV", "NM", "OR", "UT", "WA", "WY"];

describe("the gallery's own demos", () => {
  it.each(galleryDemos.map((demo) => [demo.id, demo]))("%s has a valid spec", (id, demo) => {
    expect(() => validateDemo(id, demo.spec)).not.toThrow();
  });

  it("each cite a tier-1 dataset, maps with their atlas", () => {
    const tier1 = [
      countryIndicators,
      electricityMixMatrix,
      usEnergyFlow2024,
      usInflation,
      usStateUnemployment,
    ].map((dataset) => sourceOf(dataset).label);
    const uncited = galleryDemos.filter(
      (demo) => !tier1.some((label) => demo.source.label.startsWith(label)),
    );
    expect(uncited.map((demo) => demo.id)).toEqual([]);
  });
});

describe("the gallery's titles state what the rows show", () => {
  it("nuclear made more than wind and solar together in 2023", () => {
    expect(titleOf("gallery/electricity-waffle")).toBe(
      "Nuclear generated more than wind and solar together in 2023",
    );
    expect(share("Nuclear", "2023")).toBeGreaterThan(
      share("Wind", "2023") + share("Solar", "2023"),
    );
  });

  it("wind and solar's combined share more than doubled", () => {
    expect(titleOf("gallery/electricity-share-columns")).toBe(
      "Wind and solar's share of generation from six sources more than doubled, 2016 to 2023",
    );
    expect(share("Wind", "2023") + share("Solar", "2023")).toBeGreaterThan(
      2 * (share("Wind", "2016") + share("Solar", "2016")),
    );
  });

  it("only gas, wind and solar gained share", () => {
    expect(titleOf("gallery/electricity-facets")).toBe(
      "Of six sources, only gas, wind and solar gained share from 2016 to 2023",
    );
    const sources = [...new Set(electricityMixMatrix.data.map((row) => row.source))];
    expect(sources.filter((source) => share(source, "2023") > share(source, "2016"))).toEqual([
      "Gas",
      "Wind",
      "Solar",
    ]);
  });

  it("gas gained the most share, 8.7 points", () => {
    expect(titleOf("gallery/electricity-change-table")).toBe(
      "Gas gained the most share of generation from six sources, 8.7 points from 2016 to 2023",
    );
    const sources = [...new Set(electricityMixMatrix.data.map((row) => row.source))];
    const gains = sources.map((source) => share(source, "2023") - share(source, "2016"));
    expect(Math.max(...gains)).toBeCloseTo(8.7);
    expect(share("Gas", "2023") - share("Gas", "2016")).toBeCloseTo(8.7);
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

  it("inflation fell in seven of the nine quarters after its 2022 peak", () => {
    expect(titleOf("gallery/inflation-columns")).toBe(
      "US inflation fell in seven of the nine quarters after its 2022 peak",
    );
    const rates: number[] = usInflation.data.map((row) => row.rate);
    const peak = rates.indexOf(Math.max(...rates));
    expect(usInflation.data[peak]?.date.startsWith("2022")).toBe(true);
    const after = rates.slice(peak + 1);
    expect(after).toHaveLength(9);
    expect(after.filter((rate, index) => rate < (rates[peak + index] ?? 0))).toHaveLength(7);
  });

  it("counts the states, DC left out, by the thresholds the titles name", () => {
    expect(titleOf("gallery/unemployment-histogram")).toBe(
      "Unemployment was under 4% in 22 of the 50 states",
    );
    expect(states).toHaveLength(50);
    expect(states.filter(([, rate]) => rate < 4)).toHaveLength(22);

    expect(titleOf("gallery/unemployment-beeswarm")).toBe(
      "Unemployment was 5% or more in seven states and DC",
    );
    expect(states.filter(([, rate]) => rate >= 5)).toHaveLength(7);
    expect(usStateUnemployment.data.DC).toBeGreaterThanOrEqual(5);

    expect(titleOf("gallery/unemployment-tiles")).toBe("Unemployment was below 3% in five states");
    expect(states.filter(([, rate]) => rate < 3)).toHaveLength(5);
  });

  it("four of the seven states above 5% are in the West", () => {
    expect(titleOf("gallery/unemployment-choropleth")).toBe(
      "Four of the seven states with unemployment above 5% are in the West",
    );
    const above = states.filter(([, rate]) => rate > 5).map(([state]) => state);
    expect(above).toHaveLength(7);
    expect(above.filter((state) => WEST.includes(state))).toHaveLength(4);
  });

  it("names Japan, the longest-lived of the 12", () => {
    expect(titleOf("gallery/country-table")).toBe(
      "Japan has the longest life expectancy of these 12 countries, at 83.6 years",
    );
    const longest = countryIndicators.data.reduce((a, b) =>
      b.lifeExpectancy > a.lifeExpectancy ? b : a,
    );
    expect([longest.country, longest.lifeExpectancy, countryIndicators.data.length]).toEqual([
      "Japan",
      83.6,
      12,
    ]);
  });

  it("petroleum and natural gas supplied 74% of the energy", () => {
    expect(titleOf("gallery/energy-sources-donut")).toBe(
      "Petroleum and natural gas supplied 74% of the energy the US used in 2024",
    );
    const targets = new Set<string>(usEnergyFlow2024.data.map((link) => link.target));
    const fuelLinks = usEnergyFlow2024.data.filter((link) => !targets.has(link.source));
    const total = fuelLinks.reduce((sum, link) => sum + link.value, 0);
    const oilAndGas = fuelLinks
      .filter((link) => link.source === "Petroleum" || link.source === "Natural gas")
      .reduce((sum, link) => sum + link.value, 0);
    expect(Math.round((oilAndGas / total) * 100)).toBe(74);
  });

  it("transportation turned the least of its energy into energy services, 21%", () => {
    expect(titleOf("gallery/energy-services-by-sector")).toBe(
      "Transportation turned 21% of its energy into energy services, the least of four sectors",
    );
    const sectors = ["Residential", "Commercial", "Industrial", "Transportation"];
    const out = (sector: string, target: string) =>
      usEnergyFlow2024.data.find((link) => link.source === sector && link.target === target)
        ?.value ?? NaN;
    const useful = sectors.map(
      (sector) =>
        out(sector, "Energy services") /
        (out(sector, "Energy services") + out(sector, "Rejected energy")),
    );
    expect(Math.min(...useful)).toBe(useful[3]);
    expect(Math.round((useful[3] ?? 0) * 100)).toBe(21);
  });
});
