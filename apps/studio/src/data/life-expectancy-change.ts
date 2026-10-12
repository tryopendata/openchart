/**
 * Life expectancy at birth, selected countries, 2000 vs 2023 (years, both sexes).
 *
 * Wide format: one row per country with a start (`y2000`) and end (`y2023`)
 * value, the natural shape for the range mark's x/x2 encoding (dumbbell and
 * arrow plots). Values from UN World Population Prospects 2024, rounded to
 * one decimal.
 */
export const lifeExpectancyChange = {
  source: 'Source: UN World Population Prospects 2024',
  url: 'https://population.un.org/wpp/',
  data: [
    { country: 'Japan', y2000: 81.1, y2023: 84.7 },
    { country: 'South Korea', y2000: 76.0, y2023: 84.3 },
    { country: 'USA', y2000: 76.7, y2023: 79.3 },
    { country: 'China', y2000: 71.6, y2023: 78.6 },
    { country: 'Brazil', y2000: 70.1, y2023: 75.8 },
    { country: 'Russia', y2000: 65.5, y2023: 73.0 },
    { country: 'India', y2000: 62.7, y2023: 72.0 },
    { country: 'Nigeria', y2000: 46.5, y2023: 54.6 },
  ],
} as const;
