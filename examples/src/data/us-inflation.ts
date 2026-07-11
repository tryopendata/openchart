/**
 * US CPI inflation rate (year-over-year %), quarterly 2019-2024.
 *
 * VERIFIED against the OpenData MCP dataset `fred/cpi` (series CPIAUCSL,
 * seasonally adjusted). Each quarterly YoY figure here matches the FRED index's
 * 12-month change within rounding: 2020Q2 ~0.3%, 2021Q4 ~6.2%, 2022Q3 peak
 * ~8.5%, 2024Q4 ~2.6%. The single editorial line every gallery needs: one
 * series, temporal x, a clear peak to annotate.
 */
export const usInflation = {
  source: 'Source: US Bureau of Labor Statistics, CPI-U (via FRED CPIAUCSL)',
  url: 'https://fred.stlouisfed.org/series/CPIAUCSL',
  data: [
    { date: '2019-01-01', rate: 1.6 },
    { date: '2019-04-01', rate: 2.0 },
    { date: '2019-07-01', rate: 1.8 },
    { date: '2019-10-01', rate: 1.8 },
    { date: '2020-01-01', rate: 2.5 },
    { date: '2020-04-01', rate: 0.3 },
    { date: '2020-07-01', rate: 1.0 },
    { date: '2020-10-01', rate: 1.2 },
    { date: '2021-01-01', rate: 1.4 },
    { date: '2021-04-01', rate: 4.2 },
    { date: '2021-07-01', rate: 5.4 },
    { date: '2021-10-01', rate: 6.2 },
    { date: '2022-01-01', rate: 7.5 },
    { date: '2022-04-01', rate: 8.3 },
    { date: '2022-07-01', rate: 8.5 },
    { date: '2022-10-01', rate: 7.7 },
    { date: '2023-01-01', rate: 6.4 },
    { date: '2023-04-01', rate: 4.9 },
    { date: '2023-07-01', rate: 3.2 },
    { date: '2023-10-01', rate: 3.2 },
    { date: '2024-01-01', rate: 3.1 },
    { date: '2024-04-01', rate: 3.4 },
    { date: '2024-07-01', rate: 2.9 },
    { date: '2024-10-01', rate: 2.6 },
  ],
} as const;
