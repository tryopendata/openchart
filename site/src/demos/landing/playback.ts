/**
 * The landing page's playback chart: the docs page's Gapminder spec with the
 * trails of China and India drawn as it plays. The motion section's island
 * imports this module when it is seen, so its rows are never in the page's HTML.
 */
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { gapminderSpec } from "../correlation/bubble-playback";
import { wealthHealthSource } from "../correlation/wealth-health-history";
import { defineDemo } from "../types";

const title = "China and India got healthier long before they got rich";

/** The chart itself, typed as a chart so the motion section needs no runtime check. */
export const landingPlaybackSpec: ChartSpec = {
  ...gapminderSpec,
  playback: {
    duration: 16000,
    labels: ["China", "India", "United States"],
    trails: ["China", "India"],
  },
  chrome: { ...gapminderSpec.chrome, title },
};

/** Wealth and health of 62 countries, played from 1960 to 2022 in sixteen seconds. */
export const landingPlayback = defineDemo({
  id: "landing/playback",
  title,
  source: wealthHealthSource,
  height: 520,
  phoneHeight: 560,
  static: false,
  spec: landingPlaybackSpec,
});
