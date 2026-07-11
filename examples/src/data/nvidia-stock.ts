/**
 * NVIDIA (NVDA) monthly closing price, split-adjusted, Jan 2023 to Dec 2025.
 *
 * Editorial data carried over from the existing financial story with its
 * original citation. Used for the crosshair line demo on the Dashboards page.
 */
export const nvidiaStock = {
  source: 'Source: Nasdaq historical data',
  url: 'https://www.nasdaq.com/market-activity/stocks/nvda/historical',
  data: [
    { date: '2023-01-01', price: 19.52 },
    { date: '2023-02-01', price: 23.19 },
    { date: '2023-03-01', price: 27.75 },
    { date: '2023-04-01', price: 27.73 },
    { date: '2023-05-01', price: 37.8 },
    { date: '2023-06-01', price: 42.27 },
    { date: '2023-07-01', price: 46.7 },
    { date: '2023-08-01', price: 49.32 },
    { date: '2023-09-01', price: 43.47 },
    { date: '2023-10-01', price: 40.75 },
    { date: '2023-11-01', price: 46.74 },
    { date: '2023-12-01', price: 49.49 },
    { date: '2024-01-01', price: 61.49 },
    { date: '2024-02-01', price: 79.07 },
    { date: '2024-03-01', price: 90.31 },
    { date: '2024-04-01', price: 86.36 },
    { date: '2024-05-01', price: 109.58 },
    { date: '2024-06-01', price: 123.49 },
    { date: '2024-07-01', price: 116.97 },
    { date: '2024-08-01', price: 119.32 },
    { date: '2024-09-01', price: 121.4 },
    { date: '2024-10-01', price: 132.72 },
    { date: '2024-11-01', price: 138.2 },
    { date: '2024-12-01', price: 134.25 },
    { date: '2025-01-01', price: 120.04 },
    { date: '2025-02-01', price: 124.89 },
    { date: '2025-03-01', price: 108.36 },
    { date: '2025-04-01', price: 108.9 },
    { date: '2025-05-01', price: 135.11 },
    { date: '2025-06-01', price: 157.97 },
    { date: '2025-07-01', price: 177.85 },
    { date: '2025-08-01', price: 174.16 },
    { date: '2025-09-01', price: 186.57 },
    { date: '2025-10-01', price: 202.48 },
    { date: '2025-11-01', price: 176.99 },
    { date: '2025-12-01', price: 186.5 },
  ],
} as const;
