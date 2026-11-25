/**
 * Demos for the population pyramid page (docs/comparison/pyramid): Japan's
 * population by age and sex as mirrored bars, static for 2025 and 1950, then
 * played every fifth year from 1950 to 2100. The specs follow the Testing /
 * Pyramid and Testing / Pyramid playback stories in the Ladle gallery.
 */
import { JAPAN_AGE_GROUPS, japanPopulation } from "@datasets/japan-population";
import type { BarEncoding, ChartSpec } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import { defineDemo } from "../types";

const source = sourceOf(japanPopulation);

/** The pyramid's channels: ages up the side with 100+ on top, men on the left. */
const encoding: BarEncoding = {
  y: { field: "age", type: "ordinal", sort: JAPAN_AGE_GROUPS },
  x: { field: "pop", type: "quantitative", format: ".2~s" },
  color: { field: "sex", type: "nominal", sort: ["Male", "Female"] },
};

/** A static pyramid of one year's rows. */
function pyramidFor(year: number, title: string): ChartSpec {
  return {
    mark: { type: "bar", mirror: true },
    data: japanPopulation.data.filter((row) => row.year === year),
    encoding,
    chrome: { title, subtitle: `Population of Japan by age and sex, ${year}` },
  };
}

export const pyramid2025 = defineDemo({
  id: "comparison/pyramid-2025",
  title: "Population of Japan by age and sex, 2025",
  source,
  height: 600,
  spec: pyramidFor(2025, "Japan's largest age group is 50 to 54"),
  caption: "Three in ten people in Japan are 65 or older.",
});

export const pyramid1950 = defineDemo({
  id: "comparison/pyramid-1950",
  title: "Population of Japan by age and sex, 1950",
  source,
  height: 600,
  spec: pyramidFor(1950, "In 1950 every age group was smaller than the one below it"),
  caption: "One person in twenty was 65 or older.",
});

export const pyramidPlayback = defineDemo({
  id: "comparison/pyramid-playback",
  title: "Population of Japan by age and sex, 1950 to 2100",
  source,
  height: 600,
  spec: {
    mark: { type: "bar", mirror: true },
    data: japanPopulation.data,
    encoding: { ...encoding, time: { field: "year", type: "temporal" } },
    playback: { duration: 15000 },
    chrome: {
      title: "Japan's population ages as the base narrows and the bulge moves up",
      subtitle:
        "Population of Japan by age and sex, every fifth year from 1950 to 2100; 2025 onward projected",
    },
  },
  caption:
    "The children of the late-1940s baby boom, the widest bar in 1950, are the bulge at 75 to 79 in 2025.",
});
