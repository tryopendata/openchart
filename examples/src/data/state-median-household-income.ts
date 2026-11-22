/**
 * State median household income, 2010 and 2024: 50 states and DC, in current
 * (nominal, not inflation-adjusted) dollars.
 *
 * Rows are the OpenData dataset `census/median-household-income` (view `all`),
 * queried on 2026-11-22 with:
 * SELECT state_name, MAX(median_household_income) FILTER (WHERE year=2010) AS income_2010,
 * MAX(median_household_income) FILTER (WHERE year=2024) AS income_2024 FROM data
 * WHERE state_name<>'Puerto Rico' GROUP BY 1 ORDER BY 1
 *
 * American Community Survey 1-year estimates. Verified against the rows: Mississippi is
 * lowest in 2024 ($59,127) and DC highest ($109,707). Metadata lists the data as public domain.
 */
export const stateMedianHouseholdIncome = {
  source: 'Source: US Census Bureau, American Community Survey 1-year estimates',
  url: 'https://www.census.gov/programs-surveys/acs',
  data: [
    { state_name: 'Alabama', income_2010: 40474, income_2024: 66659 },
    { state_name: 'Alaska', income_2010: 64576, income_2024: 95665 },
    { state_name: 'Arizona', income_2010: 46789, income_2024: 81486 },
    { state_name: 'Arkansas', income_2010: 38307, income_2024: 62106 },
    { state_name: 'California', income_2010: 57708, income_2024: 100149 },
    { state_name: 'Colorado', income_2010: 54046, income_2024: 97113 },
    { state_name: 'Connecticut', income_2010: 64032, income_2024: 96049 },
    { state_name: 'Delaware', income_2010: 55847, income_2024: 87534 },
    { state_name: 'District of Columbia', income_2010: 60903, income_2024: 109707 },
    { state_name: 'Florida', income_2010: 44409, income_2024: 77735 },
    { state_name: 'Georgia', income_2010: 46430, income_2024: 79991 },
    { state_name: 'Hawaii', income_2010: 63030, income_2024: 100745 },
    { state_name: 'Idaho', income_2010: 43490, income_2024: 81166 },
    { state_name: 'Illinois', income_2010: 52972, income_2024: 83211 },
    { state_name: 'Indiana', income_2010: 44613, income_2024: 71959 },
    { state_name: 'Iowa', income_2010: 47961, income_2024: 75501 },
    { state_name: 'Kansas', income_2010: 48257, income_2024: 75514 },
    { state_name: 'Kentucky', income_2010: 40062, income_2024: 64526 },
    { state_name: 'Louisiana', income_2010: 42505, income_2024: 60986 },
    { state_name: 'Maine', income_2010: 45815, income_2024: 76442 },
    { state_name: 'Maryland', income_2010: 68854, income_2024: 102905 },
    { state_name: 'Massachusetts', income_2010: 62072, income_2024: 104828 },
    { state_name: 'Michigan', income_2010: 45413, income_2024: 72389 },
    { state_name: 'Minnesota', income_2010: 55459, income_2024: 87117 },
    { state_name: 'Mississippi', income_2010: 36851, income_2024: 59127 },
    { state_name: 'Missouri', income_2010: 44301, income_2024: 71589 },
    { state_name: 'Montana', income_2010: 42666, income_2024: 75340 },
    { state_name: 'Nebraska', income_2010: 48408, income_2024: 76376 },
    { state_name: 'Nevada', income_2010: 51001, income_2024: 81134 },
    { state_name: 'New Hampshire', income_2010: 61042, income_2024: 99782 },
    { state_name: 'New Jersey', income_2010: 67681, income_2024: 104294 },
    { state_name: 'New Mexico', income_2010: 42090, income_2024: 67816 },
    { state_name: 'New York', income_2010: 54148, income_2024: 85820 },
    { state_name: 'North Carolina', income_2010: 43326, income_2024: 73958 },
    { state_name: 'North Dakota', income_2010: 48670, income_2024: 77871 },
    { state_name: 'Ohio', income_2010: 45090, income_2024: 72212 },
    { state_name: 'Oklahoma', income_2010: 42072, income_2024: 66148 },
    { state_name: 'Oregon', income_2010: 46560, income_2024: 85220 },
    { state_name: 'Pennsylvania', income_2010: 49288, income_2024: 77545 },
    { state_name: 'Rhode Island', income_2010: 52254, income_2024: 83504 },
    { state_name: 'South Carolina', income_2010: 42018, income_2024: 72350 },
    { state_name: 'South Dakota', income_2010: 45904, income_2024: 76881 },
    { state_name: 'Tennessee', income_2010: 41461, income_2024: 71997 },
    { state_name: 'Texas', income_2010: 48615, income_2024: 79721 },
    { state_name: 'Utah', income_2010: 54744, income_2024: 96658 },
    { state_name: 'Vermont', income_2010: 49406, income_2024: 82730 },
    { state_name: 'Virginia', income_2010: 60674, income_2024: 92090 },
    { state_name: 'Washington', income_2010: 55631, income_2024: 99389 },
    { state_name: 'West Virginia', income_2010: 38218, income_2024: 60798 },
    { state_name: 'Wisconsin', income_2010: 49001, income_2024: 77488 },
    { state_name: 'Wyoming', income_2010: 53512, income_2024: 75532 },
  ],
};
