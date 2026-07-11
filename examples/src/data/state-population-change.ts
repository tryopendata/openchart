/**
 * Percent population change by US state, April 2020 to July 2024.
 *
 * Editorial data carried over from the existing lollipop story with its original
 * citation (US Census Population Estimates). Values straddle zero — ideal for a
 * diverging lollipop where the stem length reads growth or decline.
 */
export const statePopulationChange = {
  source: 'Source: U.S. Census Bureau Population Estimates',
  url: 'https://www.census.gov/programs-surveys/popest.html',
  data: [
    { state: 'Idaho', change: 10.4 },
    { state: 'Florida', change: 8.9 },
    { state: 'Texas', change: 8.8 },
    { state: 'Montana', change: 7.5 },
    { state: 'South Carolina', change: 6.8 },
    { state: 'North Carolina', change: 5.9 },
    { state: 'Georgia', change: 4.1 },
    { state: 'Colorado', change: 3.2 },
    { state: 'California', change: -0.5 },
    { state: 'Illinois', change: -0.8 },
    { state: 'New York', change: -1.0 },
    { state: 'Hawaii', change: -1.5 },
    { state: 'West Virginia', change: -1.5 },
  ],
} as const;
