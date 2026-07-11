/**
 * US electricity generation mix as a source x year matrix (share of total, %).
 *
 * Verified against the OpenData MCP dataset `owid/electricity-mix` (country =
 * 'United States', 2016-2023). Each row is one (source, year) cell; `share` is
 * that source's percent of the six-source total for the year (coal + gas +
 * nuclear + hydro + wind + solar), rounded to one decimal. Long-form on purpose:
 * a `rect` heatmap encodes source on y, year on x, and share as sequential color.
 *
 * The story the matrix tells: coal's share roughly halves (31% -> 16%) as gas
 * and renewables climb — the classic diagonal a heatmap reveals at a glance.
 */
const SOURCES = ['Coal', 'Gas', 'Nuclear', 'Hydro', 'Wind', 'Solar'] as const;

// Per-year shares, columns aligned to SOURCES above.
const ROWS: [number, number, number, number, number, number, number][] = [
  [2016, 31.2, 34.8, 20.3, 6.6, 5.7, 1.4],
  [2017, 30.7, 33.0, 20.5, 7.5, 6.5, 2.0],
  [2018, 28.2, 36.0, 19.8, 7.0, 6.7, 2.3],
  [2019, 23.9, 39.2, 20.0, 7.0, 7.3, 2.6],
  [2020, 19.6, 41.3, 20.1, 7.1, 8.6, 3.3],
  [2021, 22.2, 39.0, 19.3, 6.1, 9.3, 4.1],
  [2022, 19.9, 40.4, 18.5, 6.0, 10.4, 4.9],
  [2023, 16.2, 43.5, 18.6, 5.8, 10.1, 5.8],
];

export const electricityMixMatrix = {
  source: 'Source: Our World in Data (owid/electricity-mix)',
  url: 'https://ourworldindata.org/electricity-mix',
  data: ROWS.flatMap(([year, ...shares]) =>
    SOURCES.map((sourceName, i) => ({
      year: String(year),
      source: sourceName,
      share: shares[i],
    })),
  ),
} as const;
