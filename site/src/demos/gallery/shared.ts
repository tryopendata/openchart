/**
 * Rows and wording the gallery's own demos share. They chart the tier-1
 * datasets as published: `electricity-mix-matrix` for the US generation mix,
 * `us-state-unemployment` for the state rates and `us-energy-flow-2024` for
 * US energy from source to end use. Nothing here changes a value; the helpers
 * reshape rows, sum flows and look values up for titles.
 */
import { electricityMixMatrix } from "@datasets/electricity-mix-matrix";
import { usEnergyFlow2024 } from "@datasets/us-energy-flow-2024";
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

/** What every electricity chart measures: a share of six sources, not of all US generation. */
export const MIX_MEASURE =
  "Share of US generation from six sources: coal, gas, nuclear, hydro, wind and solar";

/** One state's (or DC's) unemployment rate, in percent. */
export type StateRate = { state: string; rate: number };

/** The rate for the 50 states and DC. */
export const stateRates: StateRate[] = Object.entries(usStateUnemployment.data).map(
  ([state, rate]) => ({ state, rate }),
);

/**
 * The unit line every unemployment chart carries. The dataset's header names
 * no month, only the latest observation per state, so the line says that.
 */
export const UNEMPLOYMENT_MEASURE =
  "Unemployment rate, seasonally adjusted, most recent month in the BLS release (%)";

/** How many states (DC not counted) have a rate that passes `test`. */
export function statesWhere(test: (rate: number) => boolean): number {
  return stateRates.filter(({ state, rate }) => state !== "DC" && test(rate)).length;
}

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

/** A count as a title prints it: words for zero to nine, numerals from 10 (AP style). */
export function countWord(count: number): string {
  return WORDS[count] ?? String(count);
}

/** The quadrillion BTU (quads) flowing out of a node of the US energy flow, or into it with `into`. */
export function energyThrough(node: string, { into = false } = {}): number {
  return usEnergyFlow2024.data
    .filter((link) => (into ? link.target : link.source) === node)
    .reduce((sum, link) => sum + link.value, 0);
}

/** The four end-use sectors, each splitting its energy into services and rejected energy. */
export const SECTORS = ["Residential", "Commercial", "Industrial", "Transportation"] as const;

/** The fuels at the start of the energy flow: every node that is only ever a source. */
export const FUELS: readonly string[] = [
  ...new Set(usEnergyFlow2024.data.map((link) => link.source)),
].filter((node) => !usEnergyFlow2024.data.some((link) => link.target === node));
