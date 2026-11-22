/**
 * The figures in the blog post "Stacked vs grouped bar chart": new US
 * generating capacity by fuel as stacked and then grouped columns, and the
 * national homeless count split into sheltered and unsheltered. Titles state
 * findings computed from the dataset rows so they cannot drift from the data.
 * The post's `json demo` fences repeat `capacityGrouped.spec` and
 * `homelessStacked.spec` verbatim, and a test holds them together.
 */
import { eiaCapacityOnlineByYear } from "@datasets/eia-capacity-online-by-year";
import { hudPitHomelessnessNational } from "@datasets/hud-pit-homelessness-national";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

/** The row at the given index of a dataset the demo cannot be built without. */
function must<T>(row: T | undefined, what: string): T {
  if (row === undefined) throw new Error(`The ${what} dataset has no such row.`);
  return row;
}

const FUELS = [
  { key: "solar_mw", label: "Solar", color: "#e07b39" },
  { key: "battery_mw", label: "Batteries", color: "#7c3aed" },
  { key: "wind_mw", label: "Wind", color: "#0e7490" },
  { key: "natural_gas_mw", label: "Natural gas", color: "#6b7280" },
] as const;

const FIRST_YEAR = 2018;
const LAST_YEAR = 2024;

const capacityYears = eiaCapacityOnlineByYear.data.filter(
  (row) => row.year >= FIRST_YEAR && row.year <= LAST_YEAR,
);

const gigawatts = (megawatts: number) => Number((megawatts / 1000).toFixed(1));

/** One row per year and fuel, in gigawatts. A fuel with no units that year is zero. */
const capacityRows = capacityYears.flatMap((row) =>
  FUELS.map((fuel) => ({
    year: String(row.year),
    fuel: fuel.label,
    gigawatts: gigawatts(row[fuel.key] ?? 0),
  })),
);

const totalMw = (row: (typeof capacityYears)[number]) =>
  FUELS.reduce((sum, fuel) => sum + (row[fuel.key] ?? 0), 0);
const biggestYear = capacityYears.reduce((max, row) => (totalMw(row) > totalMw(max) ? row : max));
const lastYear = must(capacityYears[capacityYears.length - 1], "generator capacity");

/** Every `step`th year label from `from` to `to`, as the ordinal axis's category strings. */
const everyNthYear = (from: number, to: number, step: number) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => String(from + i * step));

// Seven year labels fit flat on a desktop; on a phone every other year keeps them horizontal.
const capacityX = {
  field: "year",
  type: "ordinal",
  axis: { labelAngle: 0 },
} as const;
const capacityCompact = {
  encoding: { x: { axis: { labelAngle: 0, values: everyNthYear(FIRST_YEAR, LAST_YEAR, 2) } } },
};

const fuelScale = {
  domain: FUELS.map((fuel) => fuel.label),
  range: FUELS.map((fuel) => fuel.color),
};
const capacitySubtitle = `US generators still operating, by the year they came online and by fuel, ${FIRST_YEAR}-${LAST_YEAR} (gigawatts)`;

export const capacityStacked = defineDemo({
  id: "blog/capacity-stacked",
  title: "New US generating capacity by fuel, stacked",
  source: sourceOf(eiaCapacityOnlineByYear),
  height: 440,
  spec: {
    mark: "bar",
    data: capacityRows,
    encoding: {
      x: capacityX,
      y: {
        field: "gigawatts",
        type: "quantitative",
        stack: "zero",
        axis: { title: "Gigawatts", format: ".0f" },
      },
      color: { field: "fuel", type: "nominal", scale: fuelScale },
    },
    labels: { density: "none" },
    legend: { position: "top" },
    chrome: {
      title: `The four fuels added ${gigawatts(totalMw(biggestYear))} GW in ${biggestYear.year}, the most of any year shown`,
      subtitle: capacitySubtitle,
    },
    overrides: { compact: capacityCompact },
  },
});

const solarOf = (row: (typeof capacityYears)[number]) => row.solar_mw ?? 0;
export const solarToGasRatio = Math.round(solarOf(lastYear) / (lastYear.natural_gas_mw ?? 1));

export const capacityGrouped = defineDemo({
  id: "blog/capacity-grouped",
  title: "New US generating capacity by fuel, grouped",
  source: sourceOf(eiaCapacityOnlineByYear),
  height: 440,
  spec: {
    mark: "bar",
    data: capacityRows,
    encoding: {
      x: capacityX,
      y: {
        field: "gigawatts",
        type: "quantitative",
        stack: null,
        axis: { title: "Gigawatts", format: ".0f" },
      },
      color: { field: "fuel", type: "nominal", scale: fuelScale },
    },
    labels: { density: "none" },
    legend: { position: "top" },
    chrome: {
      title: `Solar added ${gigawatts(solarOf(lastYear))} GW in ${lastYear.year}, ${solarToGasRatio} times natural gas`,
      subtitle: capacitySubtitle,
    },
    overrides: { compact: capacityCompact },
  },
});

const homeless = hudPitHomelessnessNational.data;
const latest = must(homeless[homeless.length - 1], "homelessness");

const homelessRows = homeless.flatMap((row) => [
  { year: String(row.year), status: "Sheltered", people: row.sheltered },
  { year: String(row.year), status: "Unsheltered", people: row.unsheltered },
]);

// 2021 is the lowest total, but only because the unsheltered count was skipped, so the low
// worth reporting is the lowest of the other years.
const lowestExcludingOddYear = homeless
  .filter((row) => row.year !== 2021)
  .reduce((min, row) => (row.total_homeless < min.total_homeless ? row : min));

export const homelessStacked = defineDemo({
  id: "blog/homeless-stacked",
  title: "People counted as homeless, sheltered and unsheltered",
  source: sourceOf(hudPitHomelessnessNational),
  height: 460,
  spec: {
    mark: "bar",
    data: homelessRows,
    encoding: {
      // Eighteen years: label every other one so the labels stay flat, every fourth on a phone.
      x: {
        field: "year",
        type: "ordinal",
        axis: { labelAngle: 0, values: everyNthYear(2008, latest.year, 2) },
      },
      y: {
        field: "people",
        type: "quantitative",
        stack: "zero",
        axis: { title: "People counted", format: "~s" },
      },
      color: {
        field: "status",
        type: "nominal",
        scale: { domain: ["Sheltered", "Unsheltered"], range: ["#0e7490", "#e07b39"] },
      },
    },
    labels: { density: "none" },
    legend: { position: "top" },
    annotations: [
      {
        type: "text",
        x: "2021",
        y: 400000,
        text: "2021: unsheltered\ncount skipped",
        anchor: "top",
        offset: { dx: -50, dy: -62 },
        connector: true,
      },
    ],
    chrome: {
      title: `Counted homelessness fell to ${lowestExcludingOddYear.total_homeless.toLocaleString("en-US")} in ${lowestExcludingOddYear.year}, then reached ${latest.total_homeless.toLocaleString("en-US")} in ${latest.year}`,
      subtitle: "People counted as homeless on one night in January, 50 states and DC, 2007-2024",
    },
    overrides: {
      compact: {
        encoding: { x: { axis: { labelAngle: 0, values: everyNthYear(2008, latest.year, 4) } } },
      },
    },
  },
});
