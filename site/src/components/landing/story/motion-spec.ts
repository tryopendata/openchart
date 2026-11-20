/**
 * The motion section's chart and the state its controls move: how many months
 * of 2024 payrolls are shown and which animation setting the spec carries. Pure,
 * so the island and its tests share one definition of each step.
 */
import { usPayrolls } from "@datasets/us-payrolls";
import type { AnimationSpec, ChartSpec } from "@opendata-ai/openchart-core";

/** The animation choices the section offers, as the reader sees them. */
export const MOTION_CHOICES = ["fluid", "subtle", "off"] as const;
export type MotionChoice = (typeof MOTION_CHOICES)[number];

/** The chart opens on January to June, so "Next month" has six months to add. */
export const FIRST_MONTHS = 6;
export const ALL_MONTHS = usPayrolls.data.length;

export const motionSource = {
  label: usPayrolls.source.replace(/^Source:\s*/, ""),
  url: usPayrolls.url,
};

/** The spec's `animation` value for a choice: "off" is `false`. */
export function animationValue(choice: MotionChoice): AnimationSpec {
  return choice === "off" ? false : choice;
}

/** The month count after "Next month": one more, or back to the opening six after December. */
export function nextMonthCount(months: number): number {
  return months >= ALL_MONTHS ? FIRST_MONTHS : months + 1;
}

/** The name of the last month shown, for the deck and the button's label. */
export function lastMonthName(months: number): string {
  return usPayrolls.data[months - 1]?.month ?? "";
}

/** The payrolls column chart through `months` months, with the chosen animation. */
export function payrollSpec(months: number, choice: MotionChoice): ChartSpec {
  return {
    mark: "bar",
    data: usPayrolls.data.slice(0, months).map((row) => ({ ...row })),
    encoding: {
      x: { field: "month", type: "ordinal" },
      y: {
        field: "jobs",
        type: "quantitative",
        scale: { domain: [0, 400] },
        axis: { title: "Jobs added (thousands)", grid: true },
      },
    },
    chrome: {
      title: "US employers added jobs in every month of 2024",
      subtitle: `Change in nonfarm payrolls, thousands, January to ${lastMonthName(months)}`,
    },
    animation: animationValue(choice),
  };
}

/** One line of the spec excerpt beside the chart; `changed` marks the line the last control changed. */
export type ExcerptLine = { text: string; changed: boolean };

/** The few spec lines the controls touch, with the one that just changed marked. */
export function motionExcerpt(
  months: number,
  choice: MotionChoice,
  lastChange: "data" | "animation" | null,
): ExcerptLine[] {
  return [
    { text: "{", changed: false },
    { text: '  "mark": "bar",', changed: false },
    { text: `  "data": [ … ${months} rows ],`, changed: lastChange === "data" },
    {
      text: `  "animation": ${JSON.stringify(animationValue(choice))},`,
      changed: lastChange === "animation",
    },
    { text: '  "encoding": { … },', changed: false },
    { text: '  "chrome": { … }', changed: false },
    { text: "}", changed: false },
  ];
}
