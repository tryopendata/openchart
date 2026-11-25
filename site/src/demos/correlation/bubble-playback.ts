/**
 * Demos for the bubble playback page (docs/correlation/bubble-playback): the
 * Gapminder chart of wealth and health, played from 1960 to 2022. The spec
 * follows the Testing / Playback story in the Ladle gallery.
 */
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { defineDemo } from "../types";
import { wealthHealthRows, wealthHealthSource } from "./wealth-health-history";

const subtitle =
  "GDP per capita and life expectancy, every other year from 1960 to 2022. Circle size = population.";

/** The Gapminder spec: log x, region color, one bubble per country, played by year. */
export const gapminderSpec: ChartSpec = {
  mark: "point",
  data: wealthHealthRows,
  encoding: {
    x: {
      field: "gdp",
      type: "quantitative",
      scale: { type: "log" },
      axis: { title: "GDP per capita (current US$)", format: "$,.0f" },
    },
    y: { field: "life", type: "quantitative", axis: { title: "Life expectancy (years)" } },
    size: { field: "pop", type: "quantitative", title: "Population (millions)" },
    color: { field: "region", type: "nominal" },
    key: { field: "country", type: "nominal" },
    time: { field: "year", type: "temporal" },
  },
  playback: { duration: 20000, labels: ["China", "India", "United States"] },
  chrome: {
    title: "China and India got healthier long before they got rich",
    subtitle,
  },
};

const figure = { source: wealthHealthSource, height: 560, phoneHeight: 600 };

export const bubblePlayback = defineDemo({
  ...figure,
  id: "correlation/bubble-playback",
  title: "Wealth and health of 62 countries, 1960 to 2022",
  spec: gapminderSpec,
  caption:
    "China's life expectancy rose from 33 to 64 years by 1980, while its GDP per capita was still under $200.",
});

const trailsTitle = "China's path ran up first, then right";

export const bubblePlaybackTrails = defineDemo({
  ...figure,
  id: "correlation/bubble-playback-trails",
  title: trailsTitle,
  static: false,
  spec: {
    ...gapminderSpec,
    playback: { duration: 20000, labels: ["China", "India"], trails: ["China", "India"] },
    chrome: { title: trailsTitle, subtitle },
  },
  caption: "Each trail has a dot for every period the country has reached so far.",
});

const africaTitle = "South Africa lost nine years of life expectancy from 1990 to 2004";

export const bubblePlaybackAfrica = defineDemo({
  ...figure,
  id: "correlation/bubble-playback-africa",
  title: africaTitle,
  static: false,
  spec: {
    ...gapminderSpec,
    transform: [{ filter: { field: "region", equal: "Africa" } }],
    playback: {
      duration: 20000,
      labels: ["South Africa", "Kenya"],
      trails: ["South Africa", "Kenya"],
    },
    chrome: {
      title: africaTitle,
      subtitle:
        "The 17 African countries in the data, every other year from 1960 to 2022. Circle size = population.",
    },
  },
  caption:
    "South Africa's life expectancy fell from 62.9 years in 1990 to 54.0 in 2004, and its trail turns back down the chart before it climbs again.",
});
