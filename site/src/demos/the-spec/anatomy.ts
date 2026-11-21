/**
 * Demos for the anatomy page (docs/the-spec/anatomy): one US inflation chart
 * built up in four steps, each adding one block of the spec to the one before.
 */
import { usInflation } from "@datasets/us-inflation";
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import { defineDemo } from "../types";
import { ACCENT, INFLATION_SUBTITLE } from "./shared";

const source = sourceOf(usInflation);

/** Step 1: data, mark and encoding, the smallest spec that draws. */
const bareSpec: ChartSpec = {
  mark: "line",
  data: usInflation.data.map((row) => ({ ...row })),
  encoding: {
    x: { field: "date", type: "temporal" },
    y: { field: "rate", type: "quantitative" },
  },
};

/** Step 2: axis titles and tick formats on the two channels. */
const axisSpec: ChartSpec = {
  ...bareSpec,
  mark: { type: "line", stroke: ACCENT, strokeWidth: 2 },
  encoding: {
    x: { field: "date", type: "temporal", axis: { format: "%Y", tickCount: 6 } },
    y: {
      field: "rate",
      type: "quantitative",
      axis: { title: "Change from a year earlier", format: ".0f", labelSuffix: "%" },
    },
  },
};

/** Step 3: a title that states the finding and a subtitle that names the measure. */
const chromeSpec: ChartSpec = {
  ...axisSpec,
  chrome: {
    title: "US inflation peaked at 8.5% in 2022 and was down to 2.6% by late 2024",
    subtitle: INFLATION_SUBTITLE,
  },
};

/** Step 4: one annotation on the peak the title names. */
const annotatedSpec: ChartSpec = {
  ...chromeSpec,
  annotations: [
    {
      type: "text",
      x: "2022-07-01",
      y: 8.5,
      text: "**8.5%** in the third quarter of 2022",
      anchor: "right",
      offset: { dx: 16, dy: 0 },
      connector: true,
    },
  ],
};

export const anatomyBare = defineDemo({
  id: "the-spec/anatomy-bare",
  title: "US inflation, data and encoding only",
  source,
  height: 320,
  spec: bareSpec,
});

export const anatomyAxes = defineDemo({
  id: "the-spec/anatomy-axes",
  title: "US inflation with formatted axes",
  source,
  height: 340,
  spec: axisSpec,
});

export const anatomyChrome = defineDemo({
  id: "the-spec/anatomy-chrome",
  title: "US inflation with a title and subtitle",
  source,
  height: 420,
  spec: chromeSpec,
});

export const anatomyAnnotated = defineDemo({
  id: "the-spec/anatomy-annotated",
  title: "US inflation with the peak annotated",
  source,
  height: 420,
  spec: annotatedSpec,
});
