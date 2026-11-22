/**
 * The figures in the blog post "Choropleth vs tile map for US state data":
 * a geographic US choropleth over the BLS state unemployment snapshot, followed
 * by an equal-area tile grid map of the same figures. Titles state findings
 * computed from the dataset so they cannot drift from the data. The post's
 * `json demo` fence repeats `unemploymentTilemap.spec` verbatim, and a test
 * holds the two together.
 */
import { usStateUnemployment } from "@datasets/us-state-unemployment";
import { usStates } from "../maps/geography";
import { sourceWithGeography } from "../maps/sources";
import { rowsByFips } from "../maps/state-fips";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

/** Display names for each two-letter postal code in the US state dataset. */
const STATE_NAMES: Readonly<Record<string, string>> = {
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

const stateName = (code: string): string => STATE_NAMES[code] ?? code;

const entries = Object.entries(usStateUnemployment.data).sort(
  (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
);
const highest = entries[0] as [string, number];
const secondHighest = entries[1] as [string, number];
const lowest = entries.at(-1) as [string, number];

const subtitle = "State unemployment rate, seasonally adjusted (%)";

/** Geographic US choropleth using the albersUsa projection and FIPS-keyed rows. */
export const unemploymentChoropleth = defineDemo({
  id: "blog/unemployment-choropleth",
  title: "US state unemployment rate on a geographic choropleth",
  source: sourceWithGeography(usStateUnemployment, "us"),
  height: 460,
  spec: {
    type: "map",
    geo: { features: usStates, projection: "albersUsa" },
    data: rowsByFips(usStateUnemployment.data, "rate"),
    encoding: {
      key: { field: "id", type: "nominal" },
      color: {
        field: "rate",
        type: "quantitative",
        format: ".1f",
        title: "Unemployment rate (%)",
      },
    },
    chrome: {
      title: `Unemployment ranges from ${lowest[1].toFixed(1)}% in ${stateName(lowest[0])} to ${highest[1].toFixed(1)}% in ${stateName(highest[0])}`,
      subtitle,
    },
  },
});

/** Equal-area US tile grid map over the same state unemployment figures. */
export const unemploymentTilemap = defineDemo({
  id: "blog/unemployment-tilemap",
  title: "US state unemployment rate on a tile grid map",
  source: sourceOf(usStateUnemployment),
  height: 520,
  spec: {
    type: "tilemap",
    data: { ...usStateUnemployment.data },
    palette: "blue",
    valueFormat: ".1f",
    chrome: {
      title: `${stateName(highest[0])} (${highest[1].toFixed(1)}%) and ${stateName(secondHighest[0])} (${secondHighest[1].toFixed(1)}%) have the highest unemployment rates`,
      subtitle,
    },
  },
});
