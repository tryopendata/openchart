/**
 * S&P 500 total return by sector, full year 2024 (%).
 *
 * Editorial data carried over from the existing story files with its original
 * citation (S&P Global). Includes one negative sector (Materials), useful for
 * negative-value bar demos.
 */
export const sp500SectorReturns = {
  source: 'Source: S&P Global',
  url: 'https://www.spglobal.com/spdji/en/',
  data: [
    { sector: 'Communication Services', return: 39.7 },
    { sector: 'Information Technology', return: 37.6 },
    { sector: 'Consumer Discretionary', return: 29.5 },
    { sector: 'Financials', return: 28.9 },
    { sector: 'Utilities', return: 20.1 },
    { sector: 'Industrials', return: 16.2 },
    { sector: 'Consumer Staples', return: 12.2 },
    { sector: 'Real Estate', return: 2.0 },
    { sector: 'Energy', return: 1.9 },
    { sector: 'Health Care', return: 1.1 },
    { sector: 'Materials', return: -1.2 },
  ],
} as const;
