/**
 * Arctic sea ice extent: September average, March average and annual minimum, in
 * millions of square kilometers, 1979-2025.
 *
 * Rows are the OpenData dataset `nsidc/arctic-sea-ice` (view `default`), queried on
 * 2026-11-22 with:
 * SELECT year, ROUND(AVG(extent) FILTER (WHERE month=9),2) AS september_avg_mkm2,
 * ROUND(AVG(extent) FILTER (WHERE month=3),2) AS march_avg_mkm2,
 * ROUND(MIN(extent),2) AS annual_min_mkm2 FROM data WHERE year BETWEEN 1979 AND 2025
 * GROUP BY 1 ORDER BY 1
 *
 * Aggregated from the daily NSIDC Sea Ice Index v4.0 extent file; 1987-88 observations are
 * every other day in the satellite record. Metadata lists the data as public domain.
 */
export const arcticSeaIce = {
  source: 'Source: NSIDC Sea Ice Index v4.0 (NOAA at NSIDC)',
  url: 'https://nsidc.org/data/seaice_index',
  data: [
    { year: 1979, september_avg_mkm2: 7.05, march_avg_mkm2: 16.34, annual_min_mkm2: 6.9 },
    { year: 1980, september_avg_mkm2: 7.67, march_avg_mkm2: 16.04, annual_min_mkm2: 7.53 },
    { year: 1981, september_avg_mkm2: 7.14, march_avg_mkm2: 15.63, annual_min_mkm2: 6.9 },
    { year: 1982, september_avg_mkm2: 7.3, march_avg_mkm2: 16.04, annual_min_mkm2: 7.16 },
    { year: 1983, september_avg_mkm2: 7.39, march_avg_mkm2: 16.09, annual_min_mkm2: 7.2 },
    { year: 1984, september_avg_mkm2: 6.81, march_avg_mkm2: 15.58, annual_min_mkm2: 6.4 },
    { year: 1985, september_avg_mkm2: 6.7, march_avg_mkm2: 15.89, annual_min_mkm2: 6.49 },
    { year: 1986, september_avg_mkm2: 7.41, march_avg_mkm2: 15.91, annual_min_mkm2: 7.12 },
    { year: 1987, september_avg_mkm2: 7.28, march_avg_mkm2: 15.82, annual_min_mkm2: 6.89 },
    { year: 1988, september_avg_mkm2: 7.37, march_avg_mkm2: 15.96, annual_min_mkm2: 7.05 },
    { year: 1989, september_avg_mkm2: 7.01, march_avg_mkm2: 15.42, annual_min_mkm2: 6.89 },
    { year: 1990, september_avg_mkm2: 6.14, march_avg_mkm2: 15.87, annual_min_mkm2: 6.01 },
    { year: 1991, september_avg_mkm2: 6.47, march_avg_mkm2: 15.42, annual_min_mkm2: 6.26 },
    { year: 1992, september_avg_mkm2: 7.47, march_avg_mkm2: 15.48, annual_min_mkm2: 7.16 },
    { year: 1993, september_avg_mkm2: 6.4, march_avg_mkm2: 15.81, annual_min_mkm2: 6.16 },
    { year: 1994, september_avg_mkm2: 7.14, march_avg_mkm2: 15.55, annual_min_mkm2: 6.93 },
    { year: 1995, september_avg_mkm2: 6.08, march_avg_mkm2: 15.26, annual_min_mkm2: 6.01 },
    { year: 1996, september_avg_mkm2: 7.58, march_avg_mkm2: 15.12, annual_min_mkm2: 7.15 },
    { year: 1997, september_avg_mkm2: 6.69, march_avg_mkm2: 15.47, annual_min_mkm2: 6.6 },
    { year: 1998, september_avg_mkm2: 6.54, march_avg_mkm2: 15.6, annual_min_mkm2: 6.29 },
    { year: 1999, september_avg_mkm2: 6.12, march_avg_mkm2: 15.4, annual_min_mkm2: 5.68 },
    { year: 2000, september_avg_mkm2: 6.25, march_avg_mkm2: 15.22, annual_min_mkm2: 5.94 },
    { year: 2001, september_avg_mkm2: 6.73, march_avg_mkm2: 15.52, annual_min_mkm2: 6.57 },
    { year: 2002, september_avg_mkm2: 5.83, march_avg_mkm2: 15.35, annual_min_mkm2: 5.63 },
    { year: 2003, september_avg_mkm2: 6.12, march_avg_mkm2: 15.48, annual_min_mkm2: 5.97 },
    { year: 2004, september_avg_mkm2: 5.98, march_avg_mkm2: 14.99, annual_min_mkm2: 5.77 },
    { year: 2005, september_avg_mkm2: 5.5, march_avg_mkm2: 14.69, annual_min_mkm2: 5.31 },
    { year: 2006, september_avg_mkm2: 5.86, march_avg_mkm2: 14.42, annual_min_mkm2: 5.75 },
    { year: 2007, september_avg_mkm2: 4.27, march_avg_mkm2: 14.54, annual_min_mkm2: 4.15 },
    { year: 2008, september_avg_mkm2: 4.69, march_avg_mkm2: 15.18, annual_min_mkm2: 4.55 },
    { year: 2009, september_avg_mkm2: 5.26, march_avg_mkm2: 14.98, annual_min_mkm2: 5.05 },
    { year: 2010, september_avg_mkm2: 4.87, march_avg_mkm2: 15.14, annual_min_mkm2: 4.59 },
    { year: 2011, september_avg_mkm2: 4.56, march_avg_mkm2: 14.55, annual_min_mkm2: 4.33 },
    { year: 2012, september_avg_mkm2: 3.57, march_avg_mkm2: 15.2, annual_min_mkm2: 3.34 },
    { year: 2013, september_avg_mkm2: 5.21, march_avg_mkm2: 15.03, annual_min_mkm2: 5.04 },
    { year: 2014, september_avg_mkm2: 5.22, march_avg_mkm2: 14.76, annual_min_mkm2: 4.99 },
    { year: 2015, september_avg_mkm2: 4.62, march_avg_mkm2: 14.37, annual_min_mkm2: 4.39 },
    { year: 2016, september_avg_mkm2: 4.53, march_avg_mkm2: 14.4, annual_min_mkm2: 4.14 },
    { year: 2017, september_avg_mkm2: 4.82, march_avg_mkm2: 14.29, annual_min_mkm2: 4.64 },
    { year: 2018, september_avg_mkm2: 4.79, march_avg_mkm2: 14.3, annual_min_mkm2: 4.63 },
    { year: 2019, september_avg_mkm2: 4.36, march_avg_mkm2: 14.57, annual_min_mkm2: 4.17 },
    { year: 2020, september_avg_mkm2: 4.0, march_avg_mkm2: 14.73, annual_min_mkm2: 3.79 },
    { year: 2021, september_avg_mkm2: 4.95, march_avg_mkm2: 14.66, annual_min_mkm2: 4.76 },
    { year: 2022, september_avg_mkm2: 4.9, march_avg_mkm2: 14.59, annual_min_mkm2: 4.69 },
    { year: 2023, september_avg_mkm2: 4.38, march_avg_mkm2: 14.43, annual_min_mkm2: 4.24 },
    { year: 2024, september_avg_mkm2: 4.35, march_avg_mkm2: 14.87, annual_min_mkm2: 4.25 },
    { year: 2025, september_avg_mkm2: 4.75, march_avg_mkm2: 14.12, annual_min_mkm2: 4.54 },
  ],
};
