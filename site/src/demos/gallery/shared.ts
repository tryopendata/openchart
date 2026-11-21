/**
 * Rows and wording the gallery's own demos share. They chart the tier-1
 * datasets as published: `electricity-mix-matrix` for the US generation mix and
 * `us-state-unemployment` for the state rates. Nothing here changes a value;
 * the helpers only reshape rows and look values up for titles.
 */
import { electricityMixMatrix } from "@datasets/electricity-mix-matrix";
import { usStateUnemployment } from "@datasets/us-state-unemployment";

/** The six sources in the dataset's own order, which fixes their colors on every chart. */
export const SOURCES = ["Coal", "Gas", "Nuclear", "Hydro", "Wind", "Solar"] as const;

/** One source's share of the six-source total in one year, in percent. */
export type MixRow = { year: string; source: string; share: number };

/** Every row of the matrix as a mutable copy, 2016 to 2023. */
export const mixRows: MixRow[] = electricityMixMatrix.data.map(({ year, source, share }) => {
  // The module builds rows by index, so the type allows a gap the data does not have.
  if (share === undefined) {
    throw new Error(`electricity-mix-matrix has no ${source} share for ${year}.`);
  }
  return { year, source, share };
});

/** The rows for one year. */
export function mixIn(year: string): MixRow[] {
  return mixRows.filter((row) => row.year === year);
}

/**
 * A source's share in a year, in percent.
 *
 * @throws {Error} When the matrix has no row for that source and year.
 */
export function shareOf(source: string, year: string): number {
  const row = mixRows.find((candidate) => candidate.source === source && candidate.year === year);
  if (!row) throw new Error(`electricity-mix-matrix has no ${source} row for ${year}.`);
  return row.share;
}

/** The sum of several sources' shares in a year, to one decimal, as the dataset rounds. */
export function combinedShare(sources: readonly string[], year: string): number {
  return Math.round(sources.reduce((sum, source) => sum + shareOf(source, year), 0) * 10) / 10;
}

/** The measure behind every electricity chart: a share of six sources, not of all US generation. */
export const MIX_MEASURE = "Share of US generation from coal, gas, nuclear, hydro, wind and solar";

/** One state's (or DC's) unemployment rate, in percent. */
export type StateRate = { state: string; rate: number };

/** The latest seasonally adjusted rate for the 50 states and DC. */
export const stateRates: StateRate[] = Object.entries(usStateUnemployment.data).map(
  ([state, rate]) => ({ state, rate }),
);

/** The unit line every unemployment chart carries. */
export const UNEMPLOYMENT_MEASURE = "Unemployment rate, seasonally adjusted, latest month (%)";

/** How many states (DC not counted) have a rate that passes `test`. */
export function statesWhere(test: (rate: number) => boolean): number {
  return stateRates.filter(({ state, rate }) => state !== "DC" && test(rate)).length;
}

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

/** A count as a title prints it: words for zero to nine, numerals from 10 (AP style). */
export function countWord(count: number): string {
  return WORDS[count] ?? String(count);
}
