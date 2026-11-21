/**
 * The gallery's change-over-time graphic of its own: quarterly US inflation as
 * columns (`us-inflation`), the falls after the 2022 peak in the accent.
 */
import { usInflation } from "@datasets/us-inflation";
import { sourceOf } from "../source";
import { ACCENT, GREY, INFLATION_SUBTITLE } from "../the-spec/shared";
import { defineDemo } from "../types";
import { countWord } from "./shared";

const rows = usInflation.data.map((row) => ({ ...row }));
const peakIndex = rows.reduce(
  (best, row, index) => (row.rate > (rows[best]?.rate ?? 0) ? index : best),
  0,
);
const peakYear = rows[peakIndex]?.date.slice(0, 4);
const afterPeak = rows.slice(peakIndex + 1);
/** The quarters after the peak whose rate was below the quarter before. */
const falls = afterPeak.filter((row, index) => row.rate < (rows[peakIndex + index]?.rate ?? 0));

/** "Fell" for a quarter after the peak that came in lower, else "Other quarters". */
const PHASE = { fell: "Fell from the quarter before", other: "Other quarters" } as const;
const fellDates = new Set(falls.map((row) => row.date));

export const inflationColumns = defineDemo({
  id: "gallery/inflation-columns",
  title: "US inflation by quarter, 2019 to 2024",
  source: sourceOf(usInflation),
  height: 400,
  spec: {
    mark: "bar",
    data: rows.map((row) => ({
      ...row,
      phase: fellDates.has(row.date) ? PHASE.fell : PHASE.other,
    })),
    encoding: {
      x: { field: "date", type: "temporal", axis: { tickCount: 6 } },
      y: {
        field: "rate",
        type: "quantitative",
        axis: { title: "CPI (year-over-year %)", format: ".0f", grid: true },
      },
      color: {
        field: "phase",
        type: "nominal",
        scale: { domain: [PHASE.fell, PHASE.other], range: [ACCENT, GREY] },
      },
    },
    labels: false,
    chrome: {
      title: `US inflation fell in ${countWord(falls.length)} of the ${countWord(afterPeak.length)} quarters after its ${peakYear} peak`,
      subtitle: INFLATION_SUBTITLE,
    },
  },
});
