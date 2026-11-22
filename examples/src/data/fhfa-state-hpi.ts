/**
 * Percent change in the FHFA all-transactions house price index by state over
 * three periods (51 rows: 50 states and DC).
 *
 * VERIFIED 2026-11-22 against the OpenData dataset `fhfa/state-hpi` (view
 * `default`), reduced with: 100 * (HPI at the end quarter / HPI at the start
 * quarter - 1), rounded to 0.1, for 2019Q4 to 2026Q2, 2012Q1 to 2019Q4 and
 * 2006Q2 to 2026Q2, grouped by state. House prices rose 85.9% in Maine and
 * 83.2% in New Hampshire from 2019Q4 to 2026Q2, against 14.6% in DC. The index
 * base period differs by state, so only these percent changes compare across
 * states. 2026Q2 is the latest quarter loaded.
 */
export const fhfaStateHpi = {
  source: 'Source: Federal Housing Finance Agency, House Price Index (all-transactions, by state)',
  url: 'https://www.fhfa.gov/hpi',
  data: [
    {
      state: 'ME',
      pct_change_2019q4_2026q2: 85.9,
      pct_change_2012q1_2019q4: 28.1,
      pct_change_2006q2_2026q2: 116.1,
    },
    {
      state: 'NH',
      pct_change_2019q4_2026q2: 83.2,
      pct_change_2012q1_2019q4: 33.9,
      pct_change_2006q2_2026q2: 98.9,
    },
    {
      state: 'RI',
      pct_change_2019q4_2026q2: 82.1,
      pct_change_2012q1_2019q4: 32.4,
      pct_change_2006q2_2026q2: 77.8,
    },
    {
      state: 'VT',
      pct_change_2019q4_2026q2: 81.0,
      pct_change_2012q1_2019q4: 13.9,
      pct_change_2006q2_2026q2: 102.1,
    },
    {
      state: 'NJ',
      pct_change_2019q4_2026q2: 79.8,
      pct_change_2012q1_2019q4: 18.3,
      pct_change_2006q2_2026q2: 69.9,
    },
    {
      state: 'CT',
      pct_change_2019q4_2026q2: 79.5,
      pct_change_2012q1_2019q4: 6.2,
      pct_change_2006q2_2026q2: 58.6,
    },
    {
      state: 'SC',
      pct_change_2019q4_2026q2: 77.6,
      pct_change_2012q1_2019q4: 35.5,
      pct_change_2006q2_2026q2: 125.7,
    },
    {
      state: 'MT',
      pct_change_2019q4_2026q2: 77.5,
      pct_change_2012q1_2019q4: 39.8,
      pct_change_2006q2_2026q2: 150.5,
    },
    {
      state: 'ID',
      pct_change_2019q4_2026q2: 77.3,
      pct_change_2012q1_2019q4: 79.7,
      pct_change_2006q2_2026q2: 157.4,
    },
    {
      state: 'TN',
      pct_change_2019q4_2026q2: 76.0,
      pct_change_2012q1_2019q4: 44.9,
      pct_change_2006q2_2026q2: 149.1,
    },
    {
      state: 'NC',
      pct_change_2019q4_2026q2: 75.8,
      pct_change_2012q1_2019q4: 35.1,
      pct_change_2006q2_2026q2: 126.3,
    },
    {
      state: 'WI',
      pct_change_2019q4_2026q2: 73.8,
      pct_change_2012q1_2019q4: 27.7,
      pct_change_2006q2_2026q2: 101.7,
    },
    {
      state: 'FL',
      pct_change_2019q4_2026q2: 72.5,
      pct_change_2012q1_2019q4: 79.1,
      pct_change_2006q2_2026q2: 74.5,
    },
    {
      state: 'GA',
      pct_change_2019q4_2026q2: 71.7,
      pct_change_2012q1_2019q4: 53.3,
      pct_change_2006q2_2026q2: 110.7,
    },
    {
      state: 'OH',
      pct_change_2019q4_2026q2: 70.2,
      pct_change_2012q1_2019q4: 31.3,
      pct_change_2006q2_2026q2: 96.4,
    },
    {
      state: 'IN',
      pct_change_2019q4_2026q2: 69.6,
      pct_change_2012q1_2019q4: 32.3,
      pct_change_2006q2_2026q2: 115.4,
    },
    {
      state: 'AZ',
      pct_change_2019q4_2026q2: 69.2,
      pct_change_2012q1_2019q4: 84.0,
      pct_change_2006q2_2026q2: 75.6,
    },
    {
      state: 'NY',
      pct_change_2019q4_2026q2: 68.0,
      pct_change_2012q1_2019q4: 26.9,
      pct_change_2006q2_2026q2: 88.3,
    },
    {
      state: 'UT',
      pct_change_2019q4_2026q2: 67.7,
      pct_change_2012q1_2019q4: 68.9,
      pct_change_2006q2_2026q2: 163.5,
    },
    {
      state: 'MI',
      pct_change_2019q4_2026q2: 67.1,
      pct_change_2012q1_2019q4: 54.2,
      pct_change_2006q2_2026q2: 87.6,
    },
    {
      state: 'MO',
      pct_change_2019q4_2026q2: 65.3,
      pct_change_2012q1_2019q4: 29.5,
      pct_change_2006q2_2026q2: 97.8,
    },
    {
      state: 'KY',
      pct_change_2019q4_2026q2: 65.0,
      pct_change_2012q1_2019q4: 26.8,
      pct_change_2006q2_2026q2: 110.3,
    },
    {
      state: 'AR',
      pct_change_2019q4_2026q2: 64.0,
      pct_change_2012q1_2019q4: 22.2,
      pct_change_2006q2_2026q2: 96.3,
    },
    {
      state: 'AL',
      pct_change_2019q4_2026q2: 64.0,
      pct_change_2012q1_2019q4: 21.4,
      pct_change_2006q2_2026q2: 94.2,
    },
    {
      state: 'PA',
      pct_change_2019q4_2026q2: 63.8,
      pct_change_2012q1_2019q4: 22.7,
      pct_change_2006q2_2026q2: 91.0,
    },
    {
      state: 'KS',
      pct_change_2019q4_2026q2: 63.7,
      pct_change_2012q1_2019q4: 28.6,
      pct_change_2006q2_2026q2: 110.5,
    },
    {
      state: 'NM',
      pct_change_2019q4_2026q2: 63.5,
      pct_change_2012q1_2019q4: 21.9,
      pct_change_2006q2_2026q2: 83.3,
    },
    {
      state: 'DE',
      pct_change_2019q4_2026q2: 63.5,
      pct_change_2012q1_2019q4: 17.6,
      pct_change_2006q2_2026q2: 61.9,
    },
    {
      state: 'VA',
      pct_change_2019q4_2026q2: 62.9,
      pct_change_2012q1_2019q4: 23.2,
      pct_change_2006q2_2026q2: 71.5,
    },
    {
      state: 'MA',
      pct_change_2019q4_2026q2: 61.9,
      pct_change_2012q1_2019q4: 37.6,
      pct_change_2006q2_2026q2: 86.5,
    },
    {
      state: 'SD',
      pct_change_2019q4_2026q2: 61.3,
      pct_change_2012q1_2019q4: 36.6,
      pct_change_2006q2_2026q2: 137.3,
    },
    {
      state: 'IL',
      pct_change_2019q4_2026q2: 60.6,
      pct_change_2012q1_2019q4: 19.3,
      pct_change_2006q2_2026q2: 55.6,
    },
    {
      state: 'NE',
      pct_change_2019q4_2026q2: 60.4,
      pct_change_2012q1_2019q4: 37.3,
      pct_change_2006q2_2026q2: 121.2,
    },
    {
      state: 'NV',
      pct_change_2019q4_2026q2: 58.6,
      pct_change_2012q1_2019q4: 120.0,
      pct_change_2006q2_2026q2: 55.9,
    },
    {
      state: 'OK',
      pct_change_2019q4_2026q2: 57.9,
      pct_change_2012q1_2019q4: 25.2,
      pct_change_2006q2_2026q2: 109.4,
    },
    {
      state: 'WY',
      pct_change_2019q4_2026q2: 57.4,
      pct_change_2012q1_2019q4: 25.5,
      pct_change_2006q2_2026q2: 111.9,
    },
    {
      state: 'WV',
      pct_change_2019q4_2026q2: 57.0,
      pct_change_2012q1_2019q4: 16.3,
      pct_change_2006q2_2026q2: 78.4,
    },
    {
      state: 'WA',
      pct_change_2019q4_2026q2: 55.9,
      pct_change_2012q1_2019q4: 75.1,
      pct_change_2006q2_2026q2: 124.9,
    },
    {
      state: 'TX',
      pct_change_2019q4_2026q2: 54.0,
      pct_change_2012q1_2019q4: 56.9,
      pct_change_2006q2_2026q2: 154.8,
    },
    {
      state: 'MS',
      pct_change_2019q4_2026q2: 54.0,
      pct_change_2012q1_2019q4: 17.3,
      pct_change_2006q2_2026q2: 77.5,
    },
    {
      state: 'HI',
      pct_change_2019q4_2026q2: 53.5,
      pct_change_2012q1_2019q4: 43.6,
      pct_change_2006q2_2026q2: 87.1,
    },
    {
      state: 'IA',
      pct_change_2019q4_2026q2: 51.1,
      pct_change_2012q1_2019q4: 24.8,
      pct_change_2006q2_2026q2: 93.5,
    },
    {
      state: 'AK',
      pct_change_2019q4_2026q2: 49.9,
      pct_change_2012q1_2019q4: 17.1,
      pct_change_2006q2_2026q2: 82.4,
    },
    {
      state: 'MD',
      pct_change_2019q4_2026q2: 48.8,
      pct_change_2012q1_2019q4: 20.5,
      pct_change_2006q2_2026q2: 39.5,
    },
    {
      state: 'MN',
      pct_change_2019q4_2026q2: 48.5,
      pct_change_2012q1_2019q4: 41.6,
      pct_change_2006q2_2026q2: 68.2,
    },
    {
      state: 'CA',
      pct_change_2019q4_2026q2: 47.1,
      pct_change_2012q1_2019q4: 74.0,
      pct_change_2006q2_2026q2: 51.4,
    },
    {
      state: 'CO',
      pct_change_2019q4_2026q2: 45.9,
      pct_change_2012q1_2019q4: 77.8,
      pct_change_2006q2_2026q2: 141.4,
    },
    {
      state: 'OR',
      pct_change_2019q4_2026q2: 45.8,
      pct_change_2012q1_2019q4: 71.4,
      pct_change_2006q2_2026q2: 100.0,
    },
    {
      state: 'ND',
      pct_change_2019q4_2026q2: 43.6,
      pct_change_2012q1_2019q4: 39.1,
      pct_change_2006q2_2026q2: 135.6,
    },
    {
      state: 'LA',
      pct_change_2019q4_2026q2: 30.7,
      pct_change_2012q1_2019q4: 21.7,
      pct_change_2006q2_2026q2: 65.0,
    },
    {
      state: 'DC',
      pct_change_2019q4_2026q2: 14.6,
      pct_change_2012q1_2019q4: 56.1,
      pct_change_2006q2_2026q2: 70.8,
    },
  ],
};
