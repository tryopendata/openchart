/**
 * The global temperature rows every temperature demo plots (NASA GISTEMP v4,
 * annual means against the 1951–1980 average), the shared wording for them,
 * and the figures their titles state, computed from the rows so a title can't
 * drift from the data under it.
 */
import { gistempGlobalAnnual } from "@datasets/gistemp-global-annual";

/** The period GISTEMP measures every anomaly against. */
export const TEMPERATURE_BASELINE = "1951–1980 average";

/** The subtitle for a chart of the global temperature anomaly rows. */
export const TEMPERATURE_ANOMALY_SUBTITLE = `Global surface temperature, difference from the ${TEMPERATURE_BASELINE} (°C), by decade from 1900, plus 2025`;

/** The y-axis title for the anomaly: what the number is a difference from, and its unit. */
export const TEMPERATURE_AXIS_TITLE = `Difference from the ${TEMPERATURE_BASELINE} (°C)`;

const rows = gistempGlobalAnnual.data;

/**
 * The anomaly for one year of the rows, in °C.
 *
 * @throws {Error} When the rows have no reading for the year.
 */
export function anomalyIn(year: string): number {
  const row = rows.find((r) => r.year === year);
  if (!row) {
    const years = rows.map((r) => r.year).join(", ");
    throw new Error(`gistemp-global-annual has no reading for ${year}; it has ${years}.`);
  }
  return row.anomaly;
}

/** A difference of two readings, rounded to the rows' two decimals. */
export const degreesBetween = (from: string, to: string) =>
  Math.round((anomalyIn(to) - anomalyIn(from)) * 100) / 100;

/** A reading as chart text with its sign and unit: `+1.19°C`. */
export const signedDegrees = (value: number) => `${value >= 0 ? "+" : "−"}${Math.abs(value)}°C`;

/** How many readings the rows hold. */
export const readingCount = rows.length;
/** How many readings sit above the baseline. */
export const readingsAboveBaseline = rows.filter((row) => row.anomaly > 0).length;

/**
 * The first year from which every reading is above the baseline.
 *
 * @throws {Error} When the latest reading is not above it.
 */
function firstYearOfWarmRun(): string {
  let start: string | undefined;
  for (const row of rows) {
    if (row.anomaly <= 0) start = undefined;
    else start ??= row.year;
  }
  if (!start) throw new Error("The latest gistemp-global-annual reading is not above zero.");
  return start;
}

/** Every reading from this year on is above the baseline. */
export const warmSince = firstYearOfWarmRun();

/** How many readings fall before `year` and how many of those are below the baseline; likewise from `year` on, above it. */
export function readingsAroundYear(year: string) {
  const before = rows.filter((row) => row.year < year);
  const after = rows.filter((row) => row.year >= year);
  return {
    before: before.length,
    belowBefore: before.filter((row) => row.anomaly < 0).length,
    from: after.length,
    aboveFrom: after.filter((row) => row.anomaly > 0).length,
  };
}

/** The largest distance of any reading from the baseline over a span of years, in °C. */
export function largestGap(from: string, to: string): number {
  const span = rows.filter((row) => row.year >= from && row.year <= to);
  return Math.max(...span.map((row) => Math.abs(row.anomaly)));
}
