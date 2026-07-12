/**
 * US electricity generation share by source, 2010 vs 2024 (% of total).
 *
 * Wide format: one row per source with a start (`y2010`) and end (`y2024`)
 * share. Mixed directions (coal collapsed, gas and renewables grew), which is
 * what makes it a good arrow-plot / colorByDirection dataset. Values from EIA
 * Electric Power Monthly, rounded.
 */
export const electricityShareChange = {
  source: 'Source: US Energy Information Administration, Electric Power Monthly',
  url: 'https://www.eia.gov/electricity/monthly/',
  data: [
    { source: 'Coal', y2010: 44.8, y2024: 15.0 },
    { source: 'Natural gas', y2010: 23.9, y2024: 43.2 },
    { source: 'Nuclear', y2010: 19.6, y2024: 18.2 },
    { source: 'Wind', y2010: 2.3, y2024: 10.3 },
    { source: 'Hydro', y2010: 6.3, y2024: 5.6 },
    { source: 'Solar', y2010: 0.1, y2024: 6.9 },
  ],
} as const;
