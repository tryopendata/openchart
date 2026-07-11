/**
 * NYC monthly temperature range: average daily low to average daily high, 2023 (deg C).
 *
 * Verified against the OpenData MCP dataset `noaa/ghcn-central-park` (station
 * USW00094728, Central Park), averaging `temp_min` and `temp_max` per month for
 * 2023. Each row carries `low` and `high`, so a `rule` mark with `y`/`y2`
 * draws a vertical span per month — the range/error-band encoding.
 */
export const nycTemperatureRange = {
  source: 'Source: NOAA GHCN Daily, Central Park (USW00094728)',
  url: 'https://www.ncei.noaa.gov/products/land-based-station/global-historical-climatology-network-daily',
  data: [
    { month: 'Jan', low: 3.5, high: 9.3 },
    { month: 'Feb', low: 0.9, high: 9.2 },
    { month: 'Mar', low: 3.2, high: 10.8 },
    { month: 'Apr', low: 9.4, high: 19.0 },
    { month: 'May', low: 12.0, high: 22.1 },
    { month: 'Jun', low: 16.8, high: 25.4 },
    { month: 'Jul', low: 22.1, high: 30.2 },
    { month: 'Aug', low: 20.2, high: 27.6 },
    { month: 'Sep', low: 17.3, high: 24.3 },
    { month: 'Oct', low: 12.4, high: 19.3 },
    { month: 'Nov', low: 4.5, high: 11.8 },
    { month: 'Dec', low: 4.2, high: 9.8 },
  ],
} as const;
