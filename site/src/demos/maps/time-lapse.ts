/**
 * Demos for the time-lapse map page (docs/maps/time-lapse): a choropleth and a
 * tile map of the 2020 insured unemployment rate played every other week,
 * following the Testing / Map playback stories in the Ladle gallery, and a
 * symbol map of twenty large economies played year by year.
 */
import { insuredUnemployment2020 } from "@datasets/insured-unemployment-2020";
import { worldGdpRace, worldGdpRaceSource } from "@datasets/world-gdp-race";
import { sourceOf } from "../source";
import { defineDemo } from "../types";
import { centerOf } from "./centers";
import { usStates, worldCountries, worldLand } from "./geography";
import { sourceWithGeography } from "./sources";

const RATE = {
  field: "rate",
  type: "quantitative",
  title: "Insured unemployment rate (%)",
  format: ".1f",
} as const;
const WEEK = { field: "week", type: "temporal" } as const;
const PLAYBACK = { duration: 20000, period: { format: "%b %Y" } };
const SUBTITLE =
  "Insured unemployment rate by state, 13-week average, every other week through 2020";

/**
 * Every other week of the dataset, starting with the first. Both maps share these rows; the
 * full 52 weeks put the page over its 500 KB cap.
 */
const weeksKept = new Set(
  [...new Set(insuredUnemployment2020.data.map((row) => row.week))].filter(
    (_, index) => index % 2 === 0,
  ),
);
const claimRows = insuredUnemployment2020.data.filter((row) => weeksKept.has(row.week));

export const timeLapseChoropleth = defineDemo({
  id: "maps/time-lapse-choropleth",
  title: "Insured unemployment rate by state, every other week through 2020",
  source: sourceWithGeography(insuredUnemployment2020, "us"),
  height: 500,
  spec: {
    type: "map",
    geo: { features: usStates, projection: "albersUsa", idField: "name" },
    data: claimRows,
    encoding: {
      key: { field: "state", type: "nominal" },
      color: RATE,
      time: WEEK,
    },
    playback: PLAYBACK,
    chrome: {
      title: "Insured unemployment rose tenfold by July 2020, then eased",
      subtitle: SUBTITLE,
    },
  },
  caption:
    "The average state went from 1.1% in the first week of January to 12.0% in the week ending July 4.",
});

export const timeLapseTileMap = defineDemo({
  id: "maps/time-lapse-tile",
  title: "Insured unemployment rate by state on a tile map, every other week through 2020",
  source: sourceOf(insuredUnemployment2020),
  height: 520,
  spec: {
    type: "tilemap",
    data: claimRows,
    encoding: {
      state: { field: "code", type: "nominal" },
      value: RATE,
      time: WEEK,
    },
    playback: PLAYBACK,
    chrome: {
      title: "Every state ended 2020 with a higher rate than it started with",
      subtitle: SUBTITLE,
    },
  },
  caption: "Nevada peaked highest, at 23.1% in the week ending August 1.",
});

/** Where world-atlas names a country differently from the dataset. */
const ATLAS_NAMES: Record<string, string> = { "United States": "United States of America" };

const countryCenters = new Map(
  [...new Set(worldGdpRace.map((row) => row.country))].map((country) => [
    country,
    centerOf(worldCountries, "countries", ATLAS_NAMES[country] ?? country),
  ]),
);

/**
 * Each economy's GDP every other year from 1980, placed at the center of its country. Every
 * year would add 30 KB to a page that sits near its 500 KB cap.
 */
const economyPoints = worldGdpRace
  .filter((row) => (row.year - 1980) % 2 === 0)
  .map((row) => ({ ...row, ...countryCenters.get(row.country) }));

export const timeLapsePoints = defineDemo({
  id: "maps/time-lapse-points",
  title: "GDP of twenty large economies, 1980 to 2024",
  source: sourceWithGeography({ source: worldGdpRaceSource }, "world"),
  height: 440,
  // The world's coastlines make a heavy static SVG, so it draws in the browser and the page stays under its size cap.
  static: false,
  spec: {
    type: "map",
    geo: { features: worldLand, projection: "equalEarth" },
    data: [],
    encoding: { key: { field: "id", type: "nominal" } },
    points: {
      data: economyPoints,
      longitude: { field: "lon", type: "quantitative" },
      latitude: { field: "lat", type: "quantitative" },
      size: { field: "gdp", type: "quantitative", title: "GDP ($ billions)" },
      key: { field: "country", type: "nominal" },
      time: { field: "year", type: "temporal" },
      tooltip: [
        { field: "country", type: "nominal", title: "Country" },
        { field: "gdp", type: "quantitative", title: "GDP ($ billions)", format: ",.0f" },
      ],
    },
    playback: { duration: 15000 },
    chrome: {
      title: "China's economy grew from smaller than Spain's to second largest",
      subtitle:
        "GDP of twenty large economies, current US$ billions, every other year from 1980 to 2024",
    },
  },
  caption: "Russia enters in 1988, the first year the data has a value for it.",
});
