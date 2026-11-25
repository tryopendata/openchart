/**
 * Demos for the playback page (docs/change-over-time/playback): the Gapminder
 * chart from the bubble playback page with its timing and controls changed,
 * a bar chart played by year, and a race timed by the same playback block.
 */
import { worldGdpRaceSource } from "@datasets/world-gdp-race";
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { gapminderSpec } from "../correlation/bubble-playback";
import { wealthHealthRows, wealthHealthSource } from "../correlation/wealth-health-history";
import { sourceOf } from "../source";
import { defineDemo } from "../types";
import { bar as gdpRaceBar } from "./race";

const title = "All 62 countries live longer than they did in 1960";

export const playbackOnDemand = defineDemo({
  id: "change-over-time/playback-on-demand",
  title: "Wealth and health, played on demand",
  source: wealthHealthSource,
  height: 560,
  phoneHeight: 600,
  spec: {
    ...gapminderSpec,
    playback: {
      step: 250,
      holdEnd: 3000,
      loop: true,
      autoplay: false,
      period: { position: "top-right" },
    },
    chrome: {
      title,
      subtitle:
        "GDP per capita and life expectancy, every other year from 1960 to 2022. Circle size = population.",
    },
  },
  caption:
    "The chart opens on 2022 and waits for Play. Each period then takes 250 milliseconds, and the run repeats after a 3-second hold.",
});

/** Shortest-lived on top, which leaves the upper right corner clear for the period label. */
const barCountries = ["Japan", "South Korea", "United States", "China", "Brazil", "India", "Nigeria"];
const barTitle = "South Korea passed the United States in 2004";

const lifeExpectancyBars: ChartSpec = {
  mark: "bar",
  data: wealthHealthRows
    .filter(({ country }) => barCountries.includes(country))
    .map(({ country, year, life }) => ({ country, year, life })),
  encoding: {
    y: { field: "country", type: "nominal", sort: barCountries },
    x: { field: "life", type: "quantitative", axis: { title: "Life expectancy (years)" } },
    time: { field: "year", type: "temporal" },
  },
  labels: { format: ".1f" },
  playback: { duration: 16000 },
  chrome: {
    title: barTitle,
    subtitle: "Life expectancy at birth, every other year from 1960 to 2022",
  },
};

export const playbackBars = defineDemo({
  id: "change-over-time/playback-bars",
  title: barTitle,
  source: wealthHealthSource,
  height: 420,
  phoneHeight: 460,
  spec: lifeExpectancyBars,
  caption:
    "Each bar keeps its row for the whole run, and the value axis covers every year, so bar length compares across years.",
});

const raceTitle = "China passed Japan in 2010";

export const playbackRace = defineDemo({
  id: "change-over-time/playback-race",
  title: raceTitle,
  source: sourceOf({ source: worldGdpRaceSource }),
  height: 490,
  phoneHeight: 530,
  entrance: false,
  static: false,
  spec: {
    ...gdpRaceBar,
    race: { top: 8 },
    playback: { step: 400, holdEnd: 3000, loop: true },
    chrome: { title: raceTitle, subtitle: "Annual GDP in current US dollars" },
  },
  caption:
    "The race takes its timing from a playback block: 400 milliseconds per year, a 3-second hold, then the run repeats.",
});
