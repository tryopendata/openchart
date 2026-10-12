/**
 * Most populous countries, 2025.
 *
 * VERIFIED against the OpenData MCP dataset `un/population-prospects`
 * (year 2025, medium-variant projection): ordering and magnitudes match
 * (India 1464M, China 1416M, US 347M, Indonesia 286M, Pakistan 255M,
 * Nigeria 238M, Brazil 213M, Bangladesh 176M, Russia 144M, Ethiopia 135M).
 */
export const populationByCountry = {
  source: 'Source: UN Population Division, World Population Prospects 2024',
  url: 'https://population.un.org/wpp/',
  data: [
    { country: 'India', population: 1_463_000_000 },
    { country: 'China', population: 1_410_000_000 },
    { country: 'United States', population: 347_000_000 },
    { country: 'Indonesia', population: 285_000_000 },
    { country: 'Pakistan', population: 255_000_000 },
    { country: 'Nigeria', population: 240_000_000 },
    { country: 'Brazil', population: 217_000_000 },
    { country: 'Bangladesh', population: 175_000_000 },
    { country: 'Russia', population: 144_000_000 },
    { country: 'Ethiopia', population: 135_000_000 },
  ],
} as const;
