/**
 * Annual real GDP growth by major economy, 2018-2024 (%).
 *
 * Editorial data carried over from the existing `line-multiseries` story with
 * its original citation (IMF World Economic Outlook / World Bank). Three series
 * (United States, Euro Area, China) with the shared COVID trough in 2020 and a
 * clean divergence afterward — the canonical multi-series line with endpoint
 * labels and no legend.
 */
export const gdpGrowthByCountry = {
  source: 'Source: IMF World Economic Outlook, World Bank',
  url: 'https://www.imf.org/en/Publications/WEO',
  data: [
    // United States
    { date: '2018-01-01', gdp: 3.0, country: 'United States' },
    { date: '2019-01-01', gdp: 2.5, country: 'United States' },
    { date: '2020-01-01', gdp: -2.2, country: 'United States' },
    { date: '2021-01-01', gdp: 6.1, country: 'United States' },
    { date: '2022-01-01', gdp: 2.5, country: 'United States' },
    { date: '2023-01-01', gdp: 2.9, country: 'United States' },
    { date: '2024-01-01', gdp: 2.8, country: 'United States' },
    // Euro Area
    { date: '2018-01-01', gdp: 1.8, country: 'Euro Area' },
    { date: '2019-01-01', gdp: 1.6, country: 'Euro Area' },
    { date: '2020-01-01', gdp: -6.1, country: 'Euro Area' },
    { date: '2021-01-01', gdp: 5.9, country: 'Euro Area' },
    { date: '2022-01-01', gdp: 3.4, country: 'Euro Area' },
    { date: '2023-01-01', gdp: 0.5, country: 'Euro Area' },
    { date: '2024-01-01', gdp: 0.8, country: 'Euro Area' },
    // China
    { date: '2018-01-01', gdp: 6.7, country: 'China' },
    { date: '2019-01-01', gdp: 6.0, country: 'China' },
    { date: '2020-01-01', gdp: 2.2, country: 'China' },
    { date: '2021-01-01', gdp: 8.4, country: 'China' },
    { date: '2022-01-01', gdp: 3.0, country: 'China' },
    { date: '2023-01-01', gdp: 5.2, country: 'China' },
    { date: '2024-01-01', gdp: 5.0, country: 'China' },
  ],
} as const;
