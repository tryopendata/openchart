/**
 * Atmospheric CO2 at Mauna Loa, monthly mean in parts per million (ppm), for five
 * selected years: 1960, 1980, 2000, 2020 and 2025 (60 rows).
 *
 * Rows are the OpenData dataset `noaa/co2-mauna-loa` (view `default`), queried on
 * 2026-11-22 with:
 * SELECT EXTRACT(YEAR FROM date)::INT AS year, EXTRACT(MONTH FROM date)::INT AS month,
 * co2_ppm FROM data WHERE EXTRACT(YEAR FROM date) IN (1960,1980,2000,2020,2025) ORDER BY 1,2
 *
 * Verified against the rows: the lowest month of 2025 (September, 424.37 ppm) is 104 ppm
 * above the highest month of 1960 (May, 320.03 ppm). The metadata lists the license as
 * unknown; the landing page below is NOAA's data page for the record.
 */
export const co2MaunaLoa = {
  source: 'Source: NOAA Global Monitoring Laboratory, Mauna Loa CO2 monthly mean',
  url: 'https://gml.noaa.gov/ccgg/trends/data.html',
  data: [
    { year: 1960, month: 1, co2_ppm: 316.43 },
    { year: 1960, month: 2, co2_ppm: 316.98 },
    { year: 1960, month: 3, co2_ppm: 317.58 },
    { year: 1960, month: 4, co2_ppm: 319.03 },
    { year: 1960, month: 5, co2_ppm: 320.03 },
    { year: 1960, month: 6, co2_ppm: 319.58 },
    { year: 1960, month: 7, co2_ppm: 318.18 },
    { year: 1960, month: 8, co2_ppm: 315.9 },
    { year: 1960, month: 9, co2_ppm: 314.17 },
    { year: 1960, month: 10, co2_ppm: 313.83 },
    { year: 1960, month: 11, co2_ppm: 315.0 },
    { year: 1960, month: 12, co2_ppm: 316.19 },
    { year: 1980, month: 1, co2_ppm: 337.9 },
    { year: 1980, month: 2, co2_ppm: 338.34 },
    { year: 1980, month: 3, co2_ppm: 340.07 },
    { year: 1980, month: 4, co2_ppm: 340.93 },
    { year: 1980, month: 5, co2_ppm: 341.45 },
    { year: 1980, month: 6, co2_ppm: 341.36 },
    { year: 1980, month: 7, co2_ppm: 339.45 },
    { year: 1980, month: 8, co2_ppm: 337.67 },
    { year: 1980, month: 9, co2_ppm: 336.25 },
    { year: 1980, month: 10, co2_ppm: 336.14 },
    { year: 1980, month: 11, co2_ppm: 337.3 },
    { year: 1980, month: 12, co2_ppm: 338.29 },
    { year: 2000, month: 1, co2_ppm: 369.45 },
    { year: 2000, month: 2, co2_ppm: 369.71 },
    { year: 2000, month: 3, co2_ppm: 370.75 },
    { year: 2000, month: 4, co2_ppm: 371.98 },
    { year: 2000, month: 5, co2_ppm: 371.75 },
    { year: 2000, month: 6, co2_ppm: 371.87 },
    { year: 2000, month: 7, co2_ppm: 370.02 },
    { year: 2000, month: 8, co2_ppm: 368.27 },
    { year: 2000, month: 9, co2_ppm: 367.15 },
    { year: 2000, month: 10, co2_ppm: 367.18 },
    { year: 2000, month: 11, co2_ppm: 368.53 },
    { year: 2000, month: 12, co2_ppm: 369.83 },
    { year: 2020, month: 1, co2_ppm: 413.59 },
    { year: 2020, month: 2, co2_ppm: 414.32 },
    { year: 2020, month: 3, co2_ppm: 414.72 },
    { year: 2020, month: 4, co2_ppm: 416.42 },
    { year: 2020, month: 5, co2_ppm: 417.28 },
    { year: 2020, month: 6, co2_ppm: 416.58 },
    { year: 2020, month: 7, co2_ppm: 414.58 },
    { year: 2020, month: 8, co2_ppm: 412.75 },
    { year: 2020, month: 9, co2_ppm: 411.5 },
    { year: 2020, month: 10, co2_ppm: 411.49 },
    { year: 2020, month: 11, co2_ppm: 413.1 },
    { year: 2020, month: 12, co2_ppm: 414.23 },
    { year: 2025, month: 1, co2_ppm: 426.65 },
    { year: 2025, month: 2, co2_ppm: 427.09 },
    { year: 2025, month: 3, co2_ppm: 428.15 },
    { year: 2025, month: 4, co2_ppm: 429.64 },
    { year: 2025, month: 5, co2_ppm: 430.51 },
    { year: 2025, month: 6, co2_ppm: 429.61 },
    { year: 2025, month: 7, co2_ppm: 427.87 },
    { year: 2025, month: 8, co2_ppm: 425.48 },
    { year: 2025, month: 9, co2_ppm: 424.37 },
    { year: 2025, month: 10, co2_ppm: 424.87 },
    { year: 2025, month: 11, co2_ppm: 426.46 },
    { year: 2025, month: 12, co2_ppm: 427.49 },
  ],
};
