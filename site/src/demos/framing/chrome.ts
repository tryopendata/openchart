/**
 * Demos for the title, subtitle and source page (docs/framing/chrome): one
 * temperature chart under a topic headline, a finding headline, and with a
 * byline and footer added.
 */
import { temperatureAnomaly } from "@datasets/temperature-anomaly";
import type { ChartSpec } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import { ANOMALY_SUBTITLE, COOL, WARM } from "../the-spec/shared";
import { defineDemo } from "../types";

const source = sourceOf(temperatureAnomaly);

/** Anomaly columns colored by the dataset's own warmer/cooler field. */
const anomalyColumns: ChartSpec = {
  mark: "bar",
  data: temperatureAnomaly.data.map((row) => ({ ...row })),
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
  title: "Every reading since 1960 has been warmer than the 20th-century average",
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
        "Note: The baseline is the 20th-century average, not GISTEMP's usual 1951–1980 average, so mid-century values differ slightly from NASA's published series.",
    },
  },
});
