/**
 * Global land-ocean annual mean temperature anomaly, decade samples.
 *
 * Publication: NASA GISS Surface Temperature Analysis (GISTEMP v4), "Land-Ocean:
 * Global Means", column J-D (January to December annual mean).
 * Baseline: 1951-1980 average, in degrees C.
 * URL: https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv
 * Retrieved: 2026-11-20.
 *
 * Values are copied from NASA's file at its published two decimal places. The
 * last row is 2025, the latest year with a complete J-D value (2026 is still
 * partial in the file).
 */
export const gistempGlobalAnnual = {
  source: 'Source: NASA GISS Surface Temperature Analysis (GISTEMP v4)',
  url: 'https://data.giss.nasa.gov/gistemp/',
  data: [
    { year: '1900', anomaly: -0.08, trend: 'Cooler' },
    { year: '1910', anomaly: -0.43, trend: 'Cooler' },
    { year: '1920', anomaly: -0.27, trend: 'Cooler' },
    { year: '1930', anomaly: -0.16, trend: 'Cooler' },
    { year: '1940', anomaly: 0.12, trend: 'Warmer' },
    { year: '1950', anomaly: -0.17, trend: 'Cooler' },
    { year: '1960', anomaly: -0.03, trend: 'Cooler' },
    { year: '1970', anomaly: 0.03, trend: 'Warmer' },
    { year: '1980', anomaly: 0.26, trend: 'Warmer' },
    { year: '1990', anomaly: 0.45, trend: 'Warmer' },
    { year: '2000', anomaly: 0.39, trend: 'Warmer' },
    { year: '2010', anomaly: 0.72, trend: 'Warmer' },
    { year: '2020', anomaly: 1.01, trend: 'Warmer' },
    { year: '2025', anomaly: 1.19, trend: 'Warmer' },
  ],
} as const;
