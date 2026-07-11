/**
 * Twelve large economies: population, GDP per capita, and life expectancy.
 *
 * The table page's anchor dataset — a wide, one-row-per-country shape (unlike
 * the long chart datasets) that exercises flags (ISO 3166-1 alpha-2 codes),
 * heatmaps, and inline bars.
 *
 * Values verified via the OpenData MCP:
 * - `code`: ISO 3166-1 alpha-2 (drives the flag-cell emoji).
 * - `population`: World Bank WDI indicator SP.POP.TOTL, 2023.
 * - `gdpPerCapita`: constant international dollars, PPP-adjusted (OWID / World
 *   Bank), most recent year available (~2022).
 * - `lifeExpectancy`: WHO Global Health Observatory, most recent year (~2021).
 */
export const countryIndicators = {
  source: 'Source: World Bank WDI, OWID (PPP GDP), WHO Global Health Observatory',
  url: 'https://data.worldbank.org/indicator/SP.POP.TOTL',
  data: [
    {
      code: 'IN',
      country: 'India',
      population: 1438069596,
      gdpPerCapita: 9818,
      lifeExpectancy: 68.3,
    },
    {
      code: 'CN',
      country: 'China',
      population: 1410710000,
      gdpPerCapita: 23846,
      lifeExpectancy: 76.1,
    },
    {
      code: 'US',
      country: 'United States',
      population: 336806231,
      gdpPerCapita: 75489,
      lifeExpectancy: 79.2,
    },
    {
      code: 'ID',
      country: 'Indonesia',
      population: 281190067,
      gdpPerCapita: 14470,
      lifeExpectancy: 69.0,
    },
    {
      code: 'BR',
      country: 'Brazil',
      population: 211140729,
      gdpPerCapita: 19652,
      lifeExpectancy: 75.3,
    },
    {
      code: 'MX',
      country: 'Mexico',
      population: 129739759,
      gdpPerCapita: 22040,
      lifeExpectancy: 76.9,
    },
    {
      code: 'JP',
      country: 'Japan',
      population: 124516650,
      gdpPerCapita: 46107,
      lifeExpectancy: 83.6,
    },
    {
      code: 'DE',
      country: 'Germany',
      population: 83287273,
      gdpPerCapita: 63676,
      lifeExpectancy: 80.8,
    },
    {
      code: 'GB',
      country: 'United Kingdom',
      population: 68492000,
      gdpPerCapita: 53139,
      lifeExpectancy: 81.4,
    },
    {
      code: 'FR',
      country: 'France',
      population: 68372286,
      gdpPerCapita: 54799,
      lifeExpectancy: 82.4,
    },
    {
      code: 'KR',
      country: 'South Korea',
      population: 51712619,
      gdpPerCapita: 55071,
      lifeExpectancy: 81.9,
    },
    {
      code: 'CA',
      country: 'Canada',
      population: 40083484,
      gdpPerCapita: 58321,
      lifeExpectancy: 82.2,
    },
  ],
} as const;
