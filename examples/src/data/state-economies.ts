/**
 * The ten largest US state economies: GDP vs. population, 2023.
 *
 * Editorial data carried over from the old `charts/marks.stories.tsx` with its
 * original citation (Bureau of Economic Analysis, GDP by State). GDP is in
 * trillions of current dollars; population in millions. Two quantitative fields
 * plus a short label make this the canonical `text`-mark demo: labels are
 * positioned by data, not drawn as an axis adornment.
 */
export const stateEconomies = {
  source: 'Source: Bureau of Economic Analysis, GDP by State',
  url: 'https://www.bea.gov/data/gdp/gdp-state',
  data: [
    { state: 'California', label: 'CA', gdp: 3.9, pop: 39.0 },
    { state: 'Texas', label: 'TX', gdp: 2.6, pop: 30.5 },
    { state: 'New York', label: 'NY', gdp: 2.1, pop: 19.6 },
    { state: 'Florida', label: 'FL', gdp: 1.6, pop: 22.6 },
    { state: 'Illinois', label: 'IL', gdp: 1.1, pop: 12.5 },
    { state: 'Pennsylvania', label: 'PA', gdp: 1.0, pop: 12.9 },
    { state: 'Ohio', label: 'OH', gdp: 0.9, pop: 11.8 },
    { state: 'Georgia', label: 'GA', gdp: 0.8, pop: 11.0 },
    { state: 'New Jersey', label: 'NJ', gdp: 0.8, pop: 9.3 },
    { state: 'Washington', label: 'WA', gdp: 0.8, pop: 7.8 },
  ],
} as const;
