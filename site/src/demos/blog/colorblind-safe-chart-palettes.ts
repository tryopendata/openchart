/**
 * Figures for the blog post "Colorblind-safe chart palettes for light and dark
 * mode": a multi-line US electricity mix chart highlighting gas and coal in an
 * Okabe-Ito blue and vermilion pair while muting the other four sources to
 * gray, followed by a single-hue sequential US unemployment tile map. Titles
 * state findings computed from the imported dataset rows so they cannot drift.
 */
import { electricityMixMatrix } from "@datasets/electricity-mix-matrix";
import { usStateUnemployment } from "@datasets/us-state-unemployment";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

const mixRows = electricityMixMatrix.data;
const firstYear = mixRows[0]?.year ?? "2016";
const lastYear = mixRows.at(-1)?.year ?? "2023";

/**
 * Returns one source's percentage share for a given year in the electricity mix.
 *
 * @throws {Error} When the dataset lacks a row for that source and year.
 */
function shareOf(sourceName: string, year: string): number {
  const row = mixRows.find((entry) => entry.source === sourceName && entry.year === year);
  if (row?.share === undefined) {
    throw new Error(`electricity-mix-matrix has no ${sourceName} share for ${year}.`);
  }
  return row.share;
}

const gasLast = shareOf("Gas", lastYear);
const coalLast = shareOf("Coal", lastYear);

const mixYears = [...new Set(mixRows.map((row) => row.year))].sort();
/**
 * Phone-width x axis: the first, middle and last years. Beside the endpoint
 * label column the narrow axis otherwise thins to a single 2020 tick, or to
 * 2016 to 2022 by twos on a wider phone, skipping the final year.
 */
const phoneYearAxis = {
  encoding: {
    x: { axis: { values: [firstYear, mixYears[Math.floor(mixYears.length / 2)] ?? "", lastYear] } },
  },
};

export const accessiblePaletteLines = defineDemo({
  id: "blog/accessible-palette-lines",
  title: "US electricity mix with gas and coal highlighted in Okabe-Ito colors",
  source: sourceOf(electricityMixMatrix),
  height: 440,
  spec: {
    mark: { type: "line", strokeWidth: 2 },
    data: mixRows.map((row) => ({ ...row })),
    encoding: {
      x: { field: "year", type: "temporal", axis: { format: "%Y", tickCount: 8 } },
      y: {
        field: "share",
        type: "quantitative",
        axis: { title: "Share of generation (%)", format: ".0f", grid: true },
      },
      color: {
        field: "source",
        type: "nominal",
        scale: {
          domain: ["Gas", "Coal", "Nuclear", "Wind", "Hydro", "Solar"],
          range: ["#0072b2", "#d55e00", "#7a858f", "#7a858f", "#7a858f", "#7a858f"],
        },
      },
    },
    legend: { show: false },
    endpointLabels: { content: "label" },
    seriesStyles: { Gas: { strokeWidth: 3 }, Coal: { strokeWidth: 3 } },
    chrome: {
      title: `Gas rose to ${gasLast}% in ${lastYear} and coal fell to ${coalLast}%`,
      subtitle: `Share of US electricity from the six main sources (%), ${firstYear}-${lastYear}`,
    },
    // Phones span compact (under 400px) and medium (400 to 700px, where 412
    // and 430px phones land); desktop figures render at full.
    overrides: { compact: phoneYearAxis, medium: phoneYearAxis },
  },
});

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "DC",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};

const stateEntries = Object.entries(usStateUnemployment.data);
const lowestState = stateEntries.reduce((low, entry) => (entry[1] < low[1] ? entry : low));
const highestState = stateEntries.reduce((high, entry) => (entry[1] > high[1] ? entry : high));
const stateName = (code: string) => STATE_NAMES[code] ?? code;

export const accessibleSequentialMap = defineDemo({
  id: "blog/accessible-sequential-map",
  title: "US state unemployment rate on a single-hue blue scale",
  source: sourceOf(usStateUnemployment),
  height: 520,
  spec: {
    type: "tilemap",
    data: { ...usStateUnemployment.data },
    palette: "blue",
    valueFormat: ".1f",
    chrome: {
      title: `State unemployment runs from ${lowestState[1]}% in ${stateName(lowestState[0])} to ${highestState[1]}% in ${stateName(highestState[0])}`,
      subtitle: "US state unemployment rate, seasonally adjusted (%)",
    },
  },
});
