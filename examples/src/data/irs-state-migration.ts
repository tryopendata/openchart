/**
 * Net domestic migration by state in 2011-12 and 2022-23, in tax-filer
 * exemptions (a proxy for people), 51 rows: 50 states and DC.
 *
 * VERIFIED 2026-11-22 against the OpenData dataset `irs/state-migration` (view
 * `default`): outflow rows for filing years 2011-2012 and 2022-2023 between
 * state FIPS codes 1 to 56, with net = people moving in minus people moving out,
 * computed per state from the mirrored flows. California went from -13,294 to
 * -200,547. Counts come from address changes on individual tax returns, so they
 * approximate people moving between states, not a census of them.
 */
export const irsStateMigration = {
  source: 'Source: IRS Statistics of Income, State-to-State Migration Data',
  url: 'https://www.irs.gov/statistics/soi-tax-stats-migration-data',
  data: [
    { state: 'AK', net_2011_12: -4123, net_2022_23: -4149 },
    { state: 'AL', net_2011_12: -4229, net_2022_23: 16337 },
    { state: 'AR', net_2011_12: -1228, net_2022_23: 11211 },
    { state: 'AZ', net_2011_12: 20652, net_2022_23: 27127 },
    { state: 'CA', net_2011_12: -13294, net_2022_23: -200547 },
    { state: 'CO', net_2011_12: 20285, net_2022_23: 7288 },
    { state: 'CT', net_2011_12: -10958, net_2022_23: -4767 },
    { state: 'DC', net_2011_12: -1749, net_2022_23: -2568 },
    { state: 'DE', net_2011_12: 2023, net_2022_23: 7803 },
    { state: 'FL', net_2011_12: 43847, net_2022_23: 111742 },
    { state: 'GA', net_2011_12: -1158, net_2022_23: 35536 },
    { state: 'HI', net_2011_12: -2085, net_2022_23: -6825 },
    { state: 'IA', net_2011_12: -739, net_2022_23: -1467 },
    { state: 'ID', net_2011_12: 657, net_2022_23: 12739 },
    { state: 'IL', net_2011_12: -49728, net_2022_23: -54182 },
    { state: 'IN', net_2011_12: -5131, net_2022_23: 4837 },
    { state: 'KS', net_2011_12: -7540, net_2022_23: -4048 },
    { state: 'KY', net_2011_12: -2544, net_2022_23: 5861 },
    { state: 'LA', net_2011_12: -1565, net_2022_23: -17333 },
    { state: 'MA', net_2011_12: -7676, net_2022_23: -28367 },
    { state: 'MD', net_2011_12: -3912, net_2022_23: -20112 },
    { state: 'ME', net_2011_12: 645, net_2022_23: 6497 },
    { state: 'MI', net_2011_12: -15646, net_2022_23: -8442 },
    { state: 'MN', net_2011_12: -4596, net_2022_23: -7561 },
    { state: 'MO', net_2011_12: -7263, net_2022_23: 8839 },
    { state: 'MS', net_2011_12: -4754, net_2022_23: -3142 },
    { state: 'MT', net_2011_12: 3259, net_2022_23: 5332 },
    { state: 'NC', net_2011_12: 26760, net_2022_23: 69108 },
    { state: 'ND', net_2011_12: 9735, net_2022_23: -757 },
    { state: 'NE', net_2011_12: -919, net_2022_23: -1902 },
    { state: 'NH', net_2011_12: 344, net_2022_23: 4195 },
    { state: 'NJ', net_2011_12: -31111, net_2022_23: -29871 },
    { state: 'NM', net_2011_12: -8423, net_2022_23: -1924 },
    { state: 'NV', net_2011_12: 10851, net_2022_23: 11558 },
    { state: 'NY', net_2011_12: -92300, net_2022_23: -157970 },
    { state: 'OH', net_2011_12: -20580, net_2022_23: -6312 },
    { state: 'OK', net_2011_12: 6861, net_2022_23: 12589 },
    { state: 'OR', net_2011_12: 7116, net_2022_23: -4774 },
    { state: 'PA', net_2011_12: -13736, net_2022_23: -14880 },
    { state: 'RI', net_2011_12: -4052, net_2022_23: -1068 },
    { state: 'SC', net_2011_12: 21584, net_2022_23: 59102 },
    { state: 'SD', net_2011_12: 3551, net_2022_23: 2412 },
    { state: 'TN', net_2011_12: 19160, net_2022_23: 42899 },
    { state: 'TX', net_2011_12: 117871, net_2022_23: 112481 },
    { state: 'UT', net_2011_12: -3917, net_2022_23: 1197 },
    { state: 'VA', net_2011_12: 1164, net_2022_23: -42 },
    { state: 'VT', net_2011_12: -1175, net_2022_23: 84 },
    { state: 'WA', net_2011_12: 11784, net_2022_23: -29 },
    { state: 'WI', net_2011_12: -5361, net_2022_23: 2753 },
    { state: 'WV', net_2011_12: 46, net_2022_23: 3137 },
    { state: 'WY', net_2011_12: 3297, net_2022_23: 375 },
  ],
};
