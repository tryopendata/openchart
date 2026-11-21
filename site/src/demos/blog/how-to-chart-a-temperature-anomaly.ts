/**
 * The figures in the blog post "How to chart a temperature anomaly": NASA's
 * global temperature anomaly as columns on a time scale, then the same chart
 * with its zero line named and the coolest year shown called out. Titles state
 * findings computed from the rows, so a title can't drift from its data. The
 * post's `json demo` fence repeats `gistempColumns.spec` verbatim, and a test
 * holds the two together.
 */
import { gistempGlobalAnnual } from "@datasets/gistemp-global-annual";
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import { signedDegrees, TEMPERATURE_BASELINE } from "../style/temperature";
import { COOL, WARM } from "../the-spec/shared";
import { defineDemo } from "../types";

const rows = gistempGlobalAnnual.data;
const source = sourceOf(gistempGlobalAnnual);
const span = `selected years ${rows[0]?.year}–${rows.at(-1)?.year}`;
/** Both figures name the reference period in the subtitle. */
const subtitle = `Global land and ocean temperature, difference from the ${TEMPERATURE_BASELINE} (°C), ${span}`;

/** The latest reading, which the first title states. */
const latest = rows.reduce((last, row) => (row.year > last.year ? row : last));
/** The coolest of the years plotted (not of NASA's whole record), which the second chart calls out. */
const coolest = rows.reduce((low, row) => (row.anomaly < low.anomaly ? row : low));

/** Columns on a time scale (so 2025 sits half a step past 2020), colored by the rows' own Cooler/Warmer field. */
const anomalyColumns: ChartSpec = {
  mark: "bar",
  data: rows.map((row) => ({ ...row })),
  encoding: {
    x: { field: "year", type: "temporal", axis: { format: "%Y" } },
    y: {
      field: "anomaly",
      type: "quantitative",
      // Five ticks in both figures, so they read on the same scale marks.
      axis: { format: ".1f", labelSuffix: "°C", tickCount: 5 },
    },
    color: {
      field: "trend",
      type: "nominal",
      scale: { domain: ["Cooler", "Warmer"], range: [COOL, WARM] },
    },
  },
  legend: { show: false },
  labels: false,
};

export const gistempColumns = defineDemo({
  id: "blog/gistemp-columns",
  title: "Global temperature anomaly, selected years 1900 to 2025",
  source,
  height: 400,
  spec: {
    ...anomalyColumns,
    chrome: {
      title: `${latest.year} was ${latest.anomaly}°C warmer than NASA's ${TEMPERATURE_BASELINE}`,
      subtitle,
    },
  },
});

export const gistempBaseline = defineDemo({
  id: "blog/gistemp-baseline",
  title: "Global temperature anomaly with its zero line named and 1910 called out",
  source,
  height: 420,
  spec: {
    ...anomalyColumns,
    encoding: {
      ...anomalyColumns.encoding,
      // Room under the coolest column for its note, clear of the axis labels.
      y: { ...anomalyColumns.encoding.y, scale: { domain: [-0.8, 1.2] } },
    },
    annotations: [
      // Over the zero line at the left, where the early columns all hang below it.
      {
        type: "refline",
        y: 0,
        label: TEMPERATURE_BASELINE,
        strokeWidth: 1.5,
        labelPlacement: "start",
        labelAnchor: "top",
      },
      {
        type: "text",
        x: coolest.year,
        y: coolest.anomaly,
        text: `**${coolest.year}**\n${signedDegrees(coolest.anomaly)}, coolest year shown`,
        anchor: "right",
        offset: { dx: 28, dy: 8 },
        connector: "curve",
      },
    ],
    chrome: {
      title: `${coolest.year} was the coolest year shown, ${Math.abs(coolest.anomaly)}°C below average`,
      subtitle,
    },
  },
});
