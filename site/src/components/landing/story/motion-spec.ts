/**
 * The motion section's chart and the state its controls move: how many months
 * of 2024 payrolls are shown and which animation setting the spec carries. Pure,
 * so the island and its tests share one definition of each step, and the spec
 * excerpt beside the chart is read off the real spec rather than written twice.
 */
import { usPayrolls } from "@datasets/us-payrolls";
import type { AnimationSpec, ChartSpec } from "@opendata-ai/openchart-core";
import { sourceOf } from "../../../demos/source";

/** The animation choices the section offers, as the reader sees them. */
export const MOTION_CHOICES = ["fluid", "subtle", "off"] as const;
export type MotionChoice = (typeof MOTION_CHOICES)[number];

/** The chart opens on January to June, so "Next month" has six months to add. */
export const FIRST_MONTHS = 6;
export const ALL_MONTHS = usPayrolls.data.length;

export const motionSource = sourceOf(usPayrolls);

/** Full month names for the dataset's abbreviations, for every place a month is written out. */
const MONTH_NAMES: Record<string, string> = {
  Jan: "January",
  Feb: "February",
  Mar: "March",
  Apr: "April",
  May: "May",
  Jun: "June",
  Jul: "July",
  Aug: "August",
  Sep: "September",
  Oct: "October",
  Nov: "November",
  Dec: "December",
};

/**
 * The full name of the `count`th month of the data (1 is January).
 *
 * @throws {RangeError} When the data has no such month or its label is not a known abbreviation.
 */
export function monthName(count: number): string {
  const label = usPayrolls.data[count - 1]?.month;
  const name = label === undefined ? undefined : MONTH_NAMES[label];
  if (name === undefined) {
    throw new RangeError(
      `No month ${count} in the payrolls data (it has ${ALL_MONTHS}), or its label "${label}" is not a month abbreviation.`,
    );
  }
  return name;
}

/** The spec's `animation` value for a choice: "off" is `false`. */
export function animationValue(choice: MotionChoice): AnimationSpec {
  return choice === "off" ? false : choice;
}

/** The month count after "Next month": one more, or back to the opening six after December. */
export function nextMonthCount(months: number): number {
  return months >= ALL_MONTHS ? FIRST_MONTHS : months + 1;
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
      subtitle: `Change in nonfarm payrolls, thousands, January to ${monthName(months)}`,
    },
    animation: animationValue(choice),
  };
}

/** The spec field the last control changed. */
export type ChangedField = "data" | "animation";

/** One line of the spec excerpt beside the chart; `changed` marks the field the last control changed. */
export type ExcerptLine = { key: string; text: string; changed: boolean };

/** A field's value as the excerpt shows it: data rows folded to a count, other objects folded whole. */
function foldedValue(key: string, value: unknown): string {
  if (key === "data" && Array.isArray(value)) return `[ … ${value.length} rows ]`;
  if (value !== null && typeof value === "object") return "{ … }";
  return JSON.stringify(value);
}

/** The spec's top-level fields, one line each, with the field the last control changed marked. */
export function motionExcerpt(spec: ChartSpec, lastChange: ChangedField | null): ExcerptLine[] {
  const entries = Object.entries(spec);
  const fields = entries.map(([key, value], index) => ({
    key,
    text: `  "${key}": ${foldedValue(key, value)}${index < entries.length - 1 ? "," : ""}`,
    changed: key === lastChange,
  }));
  return [
    { key: "{", text: "{", changed: false },
    ...fields,
    { key: "}", text: "}", changed: false },
  ];
}
