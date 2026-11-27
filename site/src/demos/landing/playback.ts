/**
 * The landing page's playback chart: the docs page's Gapminder spec with the
 * trails of China and India drawn as it plays. The motion section's island
 * imports this module when it is seen, so its rows are never in the page's HTML.
 */
import { gapminderSpec } from "../correlation/bubble-playback";
import { wealthHealthSource } from "../correlation/wealth-health-history";
import { defineDemo } from "../types";

const title = "China and India got healthier long before they got rich";
const { x, y, size } = gapminderSpec.encoding;
if (!x || !y || !size || !("field" in size)) {
  throw new Error("The landing playback demo needs x, y and size fields.");
}

/** Wealth and health of 62 countries, played from 1960 to 2022 in sixteen seconds. */
export const landingPlayback = defineDemo({
  id: "landing/playback",
  title,
  source: wealthHealthSource,
  height: 520,
  phoneHeight: 560,
  static: false,
  spec: {
    ...gapminderSpec,
    mark: { type: "point", trendline: false },
    // Use the full history's scales even in the last-period poster.
    encoding: {
      ...gapminderSpec.encoding,
      x: { ...x, scale: { ...x.scale, domain: [10, 100_000] } },
      y: { ...y, scale: { ...y.scale, domain: [10, 85] } },
      size: { ...size, scale: { ...size.scale, domain: [2.4, 1425.4] } },
    },
    playback: {
      duration: 16000,
      labels: ["China", "India", "United States"],
      trails: ["China", "India"],
    },
    chrome: { ...gapminderSpec.chrome, title },
  },
});
