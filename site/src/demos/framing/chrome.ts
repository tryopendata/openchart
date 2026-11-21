/**
 * Demos for the title, subtitle and source page (docs/framing/chrome): one
 * temperature chart under a topic headline, a finding headline, and with a
 * byline and footer added.
 */
import { gistempGlobalAnnual } from "@datasets/gistemp-global-annual";
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import { TEMPERATURE_BASELINE, warmSince } from "../style/temperature";
import { ANOMALY_SUBTITLE, COOL, WARM } from "../the-spec/shared";
import { defineDemo } from "../types";

const source = sourceOf(gistempGlobalAnnual);

/** Anomaly columns colored by the dataset's own warmer/cooler field. */
const anomalyColumns: ChartSpec = {
  mark: "bar",
  data: gistempGlobalAnnual.data.map((row) => ({ ...row })),
  encoding: {
    x: { field: "year", type: "ordinal" },
    y: {
      field: "anomaly",
      type: "quantitative",
      axis: { title: "Difference from average", format: "+.1f", labelSuffix: "°C" },
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

export const chromeTopic = defineDemo({
  id: "framing/chrome-topic",
  title: "Temperature anomaly under a topic headline",
  source,
  height: 420,
  spec: {
    ...anomalyColumns,
    chrome: { title: "Global temperature anomaly, 1900–2025", subtitle: ANOMALY_SUBTITLE },
  },
});

const findingChrome = {
  title: `Every reading since ${warmSince} has been warmer than the ${TEMPERATURE_BASELINE}`,
  subtitle: ANOMALY_SUBTITLE,
};

export const chromeFinding = defineDemo({
  id: "framing/chrome-finding",
  title: "Temperature anomaly under a finding headline",
  source,
  height: 420,
  spec: { ...anomalyColumns, chrome: findingChrome },
});

export const chromeByline = defineDemo({
  id: "framing/chrome-byline",
  title: "Temperature anomaly with a byline and footer",
  source,
  height: 460,
  spec: {
    ...anomalyColumns,
    chrome: {
      ...findingChrome,
      byline: "Chart: OpenChart",
      footer:
        "Note: Each column is the January–December mean for that year, not an average over the decade.",
    },
  },
});
