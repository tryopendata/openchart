/**
 * Median usual weekly earnings and unemployment rate by educational attainment, 2024.
 *
 * Rows come from the OpenData dataset `bls/education-pays` (view `all`), verified
 * 2026-11-22, eight education levels from less than a high school diploma to a
 * professional degree. `annual_earnings` is the weekly figure times 52, added when the
 * rows were pulled.
 */
export const blsEducationPays = {
  source: 'Source: US Bureau of Labor Statistics, Education Pays (Current Population Survey, 2024)',
  url: 'https://www.bls.gov/emp/chart-unemployment-earnings-education.htm',
  data: [
    {
      education_level: 'Professional degree',
      median_weekly_earnings: 2363,
      unemployment_rate: 1.3,
      annual_earnings: 122876,
    },
    {
      education_level: 'Doctoral degree',
      median_weekly_earnings: 2278,
      unemployment_rate: 1.2,
      annual_earnings: 118456,
    },
    {
      education_level: "Master's degree",
      median_weekly_earnings: 1840,
      unemployment_rate: 2.2,
      annual_earnings: 95680,
    },
    {
      education_level: "Bachelor's degree",
      median_weekly_earnings: 1543,
      unemployment_rate: 2.5,
      annual_earnings: 80236,
    },
    {
      education_level: "Associate's degree",
      median_weekly_earnings: 1099,
      unemployment_rate: 2.8,
      annual_earnings: 57148,
    },
    {
      education_level: 'Some college, no degree',
      median_weekly_earnings: 1020,
      unemployment_rate: 3.8,
      annual_earnings: 53040,
    },
    {
      education_level: 'High school diploma',
      median_weekly_earnings: 930,
      unemployment_rate: 4.2,
      annual_earnings: 48360,
    },
    {
      education_level: 'Less than a high school diploma',
      median_weekly_earnings: 738,
      unemployment_rate: 6.2,
      annual_earnings: 38376,
    },
  ],
};
