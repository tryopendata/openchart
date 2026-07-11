/**
 * Life expectancy at birth by gender, selected countries, 2023 (years).
 *
 * Editorial data carried over from the existing dumbbell story with its original
 * citation (World Bank / UN World Population Prospects 2024). Two rows per
 * country (Male, Female): a categorical color encoding with 2+ series makes the
 * circle/lollipop mark auto-switch to dumbbell mode, spanning min-to-max.
 */
export const lifeExpectancyGender = {
  source: 'Source: World Bank, UN World Population Prospects 2024',
  url: 'https://population.un.org/wpp/',
  data: [
    { country: 'Japan', years: 81.9, gender: 'Male' },
    { country: 'Japan', years: 87.9, gender: 'Female' },
    { country: 'Switzerland', years: 82.0, gender: 'Male' },
    { country: 'Switzerland', years: 85.9, gender: 'Female' },
    { country: 'Australia', years: 81.7, gender: 'Male' },
    { country: 'Australia', years: 85.6, gender: 'Female' },
    { country: 'Sweden', years: 81.6, gender: 'Male' },
    { country: 'Sweden', years: 85.0, gender: 'Female' },
    { country: 'Canada', years: 80.6, gender: 'Male' },
    { country: 'Canada', years: 84.5, gender: 'Female' },
    { country: 'Germany', years: 78.9, gender: 'Male' },
    { country: 'Germany', years: 83.5, gender: 'Female' },
    { country: 'UK', years: 79.5, gender: 'Male' },
    { country: 'UK', years: 83.2, gender: 'Female' },
    { country: 'USA', years: 76.4, gender: 'Male' },
    { country: 'USA', years: 81.3, gender: 'Female' },
    { country: 'China', years: 75.5, gender: 'Male' },
    { country: 'China', years: 81.0, gender: 'Female' },
    { country: 'Brazil', years: 73.1, gender: 'Male' },
    { country: 'Brazil', years: 80.3, gender: 'Female' },
    { country: 'India', years: 69.8, gender: 'Male' },
    { country: 'India', years: 72.8, gender: 'Female' },
    { country: 'Russia', years: 68.2, gender: 'Male' },
    { country: 'Russia', years: 78.2, gender: 'Female' },
  ],
} as const;
