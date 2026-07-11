/**
 * Average one-way commute time by major US metro area, 2024 (minutes).
 *
 * Editorial data carried over from the existing dot-plot story with its original
 * citation (US Census, American Community Survey). A single quantitative measure
 * across a ranked category axis — the canonical dot plot.
 */
export const commuteTimes = {
  source: 'Source: U.S. Census Bureau, American Community Survey',
  url: 'https://www.census.gov/programs-surveys/acs',
  data: [
    { city: 'New York', minutes: 40.6 },
    { city: 'Chicago', minutes: 33.5 },
    { city: 'Philadelphia', minutes: 33.2 },
    { city: 'San Francisco', minutes: 32.2 },
    { city: 'Boston', minutes: 31.7 },
    { city: 'Los Angeles', minutes: 31.7 },
    { city: 'Baltimore', minutes: 30.2 },
    { city: 'Seattle', minutes: 28.8 },
    { city: 'Houston', minutes: 28.4 },
    { city: 'Denver', minutes: 26.1 },
    { city: 'Phoenix', minutes: 25.8 },
    { city: 'Tulsa', minutes: 19.7 },
  ],
} as const;
