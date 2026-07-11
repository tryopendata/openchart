/**
 * GDP per capita vs life expectancy, 2022 (classic Gapminder scatter).
 *
 * Editorial data carried over from the existing scatter-trend story with its
 * original citation (World Bank Development Indicators). Bubble size = population
 * (millions), color = region. The rich-live-longer relationship with the US as
 * a visible outlier — the canonical trend-annotation scatter.
 */
export const wealthHealth = {
  source: 'Source: World Bank Development Indicators',
  url: 'https://databank.worldbank.org/source/world-development-indicators',
  data: [
    // Americas
    {
      country: 'United States',
      gdpPerCapita: 63544,
      lifeExpectancy: 77.3,
      region: 'Americas',
      pop: 331,
    },
    { country: 'Canada', gdpPerCapita: 43242, lifeExpectancy: 82.2, region: 'Americas', pop: 38 },
    { country: 'Brazil', gdpPerCapita: 6797, lifeExpectancy: 75.9, region: 'Americas', pop: 213 },
    { country: 'Mexico', gdpPerCapita: 8347, lifeExpectancy: 75.1, region: 'Americas', pop: 130 },
    { country: 'Argentina', gdpPerCapita: 8442, lifeExpectancy: 76.5, region: 'Americas', pop: 45 },
    // Europe
    { country: 'Germany', gdpPerCapita: 45724, lifeExpectancy: 81.0, region: 'Europe', pop: 83 },
    { country: 'France', gdpPerCapita: 38625, lifeExpectancy: 82.5, region: 'Europe', pop: 67 },
    {
      country: 'United Kingdom',
      gdpPerCapita: 40285,
      lifeExpectancy: 81.3,
      region: 'Europe',
      pop: 67,
    },
    { country: 'Italy', gdpPerCapita: 31676, lifeExpectancy: 83.5, region: 'Europe', pop: 59 },
    { country: 'Spain', gdpPerCapita: 27057, lifeExpectancy: 83.6, region: 'Europe', pop: 47 },
    // Asia
    { country: 'Japan', gdpPerCapita: 39313, lifeExpectancy: 84.6, region: 'Asia', pop: 125 },
    { country: 'South Korea', gdpPerCapita: 31489, lifeExpectancy: 83.5, region: 'Asia', pop: 52 },
    { country: 'China', gdpPerCapita: 10500, lifeExpectancy: 78.2, region: 'Asia', pop: 1412 },
    { country: 'India', gdpPerCapita: 1901, lifeExpectancy: 70.2, region: 'Asia', pop: 1408 },
    { country: 'Indonesia', gdpPerCapita: 3870, lifeExpectancy: 71.9, region: 'Asia', pop: 273 },
    // Africa
    {
      country: 'South Africa',
      gdpPerCapita: 5091,
      lifeExpectancy: 64.1,
      region: 'Africa',
      pop: 60,
    },
    { country: 'Nigeria', gdpPerCapita: 2066, lifeExpectancy: 54.7, region: 'Africa', pop: 211 },
    { country: 'Egypt', gdpPerCapita: 3019, lifeExpectancy: 72.0, region: 'Africa', pop: 104 },
    { country: 'Ethiopia', gdpPerCapita: 926, lifeExpectancy: 66.6, region: 'Africa', pop: 118 },
    { country: 'Kenya', gdpPerCapita: 1838, lifeExpectancy: 66.7, region: 'Africa', pop: 54 },
  ],
} as const;
