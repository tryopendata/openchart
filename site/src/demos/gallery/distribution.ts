/**
 * The gallery's distribution graphics, on the state unemployment rates
 * (`us-state-unemployment`): a histogram in half-point bins and a beeswarm with
 * one dot per state. Ported from the Ladle scatter and distribution gallery,
 * rebuilt on this tier-1 dataset.
 */
import { usStateUnemployment } from "@datasets/us-state-unemployment";
import { sourceOf } from "../source";
import { ACCENT, GREY, WARM } from "../the-spec/shared";
import { defineDemo } from "../types";
import { countWord, stateRates, statesWhere, UNEMPLOYMENT_MEASURE } from "./shared";

const UNDER = 4;
const HIGH = 5;
const rateAxis = { title: "Unemployment rate", format: ".1f", labelSuffix: "%" };

export const unemploymentHistogram = defineDemo({
  id: "gallery/unemployment-histogram",
  title: "State unemployment rates in half-point bins",
  source: sourceOf(usStateUnemployment),
  height: 400,
  spec: {
    mark: { type: "histogram", fill: ACCENT },
    data: stateRates,
    encoding: {
      x: {
        field: "rate",
        type: "quantitative",
        // Half a point of room either side of the data, so the first tick clears the y-axis.
        bin: { step: 0.5, extent: [1.5, 6.5] },
        axis: rateAxis,
      },
    },
    annotations: [{ type: "refline", x: UNDER, label: `${UNDER}%`, style: "dashed", stroke: GREY }],
    chrome: {
      title: `Unemployment was under ${UNDER}% in ${countWord(statesWhere((rate) => rate < UNDER))} of the 50 states`,
      subtitle: `Number of states and DC in each half-point band. ${UNEMPLOYMENT_MEASURE}`,
    },
  },
});

/** The band each rate falls in, for the beeswarm's two colors. Derived from the rate, not a new field. */
const bandOf = (rate: number) => (rate >= HIGH ? `${HIGH}% or more` : `Under ${HIGH}%`);

export const unemploymentBeeswarm = defineDemo({
  id: "gallery/unemployment-beeswarm",
  title: "State unemployment rates, one dot per state",
  source: sourceOf(usStateUnemployment),
  height: 340,
  spec: {
    mark: "beeswarm",
    data: stateRates.map((row) => ({ ...row, band: bandOf(row.rate) })),
    encoding: {
      x: { field: "rate", type: "quantitative", axis: rateAxis },
      color: {
        field: "band",
        type: "nominal",
        scale: { domain: [`${HIGH}% or more`, `Under ${HIGH}%`], range: [WARM, GREY] },
      },
      tooltip: [
        { field: "state", type: "nominal", title: "State" },
        { field: "rate", type: "quantitative", title: "Rate (%)", format: ".1f" },
      ],
    },
    chrome: {
      title: `Unemployment was ${HIGH}% or more in ${countWord(statesWhere((rate) => rate >= HIGH))} states and DC`,
      subtitle: `Each dot is one state or DC. ${UNEMPLOYMENT_MEASURE}`,
    },
  },
});
