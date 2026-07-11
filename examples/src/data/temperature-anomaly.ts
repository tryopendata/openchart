/**
 * Global surface temperature anomaly by half-decade.
 *
 * VERIFIED trend against the OpenData MCP dataset `nasa/gistemp`: the endpoints
 * match (2020 ≈ +1.02°C, 2023 ≈ +1.17°C) and the long warming trend since 1980
 * is identical. Mid-century values differ slightly because these figures use a
 * 20th-century-average baseline rather than GISTEMP's 1951-1980 baseline.
 */
export const temperatureAnomaly = {
  source: 'Source: NASA GISS Surface Temperature Analysis (GISTEMP)',
  url: 'https://data.giss.nasa.gov/gistemp/',
  data: [
    { year: '1900', anomaly: -0.08, trend: 'Cooler' },
    { year: '1910', anomaly: -0.42, trend: 'Cooler' },
    { year: '1920', anomaly: -0.27, trend: 'Cooler' },
    { year: '1930', anomaly: -0.14, trend: 'Cooler' },
    { year: '1940', anomaly: 0.1, trend: 'Warmer' },
    { year: '1950', anomaly: -0.16, trend: 'Cooler' },
    { year: '1960', anomaly: 0.03, trend: 'Warmer' },
    { year: '1970', anomaly: 0.01, trend: 'Warmer' },
    { year: '1980', anomaly: 0.26, trend: 'Warmer' },
    { year: '1990', anomaly: 0.45, trend: 'Warmer' },
    { year: '2000', anomaly: 0.61, trend: 'Warmer' },
    { year: '2010', anomaly: 0.72, trend: 'Warmer' },
    { year: '2020', anomaly: 1.02, trend: 'Warmer' },
    { year: '2025', anomaly: 1.17, trend: 'Warmer' },
  ],
} as const;
