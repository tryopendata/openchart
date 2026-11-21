/**
 * Demos for the presets page (docs/style/presets): one US inflation chart in
 * each of the four named presets. Every demo sets `pageTheme: false`, so the
 * preset's fonts, colors and spacing show instead of the site's chart theme.
 */
import { usInflation } from "@datasets/us-inflation";
import type { ChartSpec, ThemeConfig } from "@opendata-ai/openchart-core";
import { broadsheet, essay, terminal, wire } from "@opendata-ai/openchart-core";
import { sourceOf } from "../source";
import type { DemoDef } from "../types";
import { defineDemo } from "../types";

// From 2021 only: each preset demo writes its rows out in the Spec code tab, and
// four demos of 24 rows take the page past its size budget.
const rowsFrom2021 = usInflation.data.filter((row) => row.date >= "2021-01-01");

const inflationSpec: ChartSpec = {
  mark: { type: "line", strokeWidth: 2.5 },
  data: rowsFrom2021,
  encoding: {
    x: { field: "date", type: "temporal" },
    y: { field: "rate", type: "quantitative", axis: { title: "Change (%)", grid: true } },
  },
  annotations: [
    { type: "text", x: "2022-07-01", y: 8.5, text: "8.5% in Q3 2022", anchor: "right" },
    { type: "refline", y: 2, label: "Fed target, 2%", style: "dashed" },
  ],
  chrome: {
    title: "US inflation peaked at 8.5% in 2022 and eased to 2.6% by the end of 2024",
    subtitle: "Consumer price index, year-over-year change, %, quarterly 2021–2024",
  },
};

/** The same chart in one preset. */
function presetDemo(name: string, theme: ThemeConfig): DemoDef {
  return defineDemo({
    id: `style/presets-${name}`,
    title: `US inflation in the ${name} preset`,
    source: sourceOf(usInflation),
    height: 420,
    pageTheme: false,
    spec: { ...inflationSpec, theme },
  });
}

export const essayPreset = presetDemo("essay", essay);
export const wirePreset = presetDemo("wire", wire);
export const broadsheetPreset = presetDemo("broadsheet", broadsheet);
export const terminalPreset = presetDemo("terminal", terminal);
