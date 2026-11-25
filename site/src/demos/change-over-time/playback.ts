/**
 * Demos for the playback page (docs/change-over-time/playback): the Gapminder
 * chart from the bubble playback page with its timing and controls changed.
 */
import { gapminderSpec } from "../correlation/bubble-playback";
import { wealthHealthSource } from "../correlation/wealth-health-history";
import { defineDemo } from "../types";

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
