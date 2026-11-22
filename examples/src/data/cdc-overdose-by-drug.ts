/**
 * US provisional drug overdose deaths by drug class, 12 months ending December, 2015-2025 (11 rows).
 *
 * VERIFIED 2026-11-22 against the OpenData dataset `cdc/vsrr-overdose-by-drug`
 * (view `default`), reduced with: SELECT year, MAX(data_value) FILTER (WHERE
 * indicator LIKE ...) per drug class FROM data WHERE state='US' AND
 * month='December' AND period='12 month-ending' GROUP BY year. Values are
 * rolling 12-month-ending totals, not monthly deaths, and are provisional.
 * Drug classes overlap (one death can involve several), so they must not be
 * stacked. Synthetic opioids passed heroin in 2016 (19,500 vs 15,551), peaked at
 * 74,829 in 2022 and were 38,462 in 2025, 49% lower.
 */
export const cdcOverdoseByDrug = {
  source:
    'Source: CDC NCHS, VSRR Provisional Drug Overdose Death Counts (12 months ending December)',
  url: 'https://data.cdc.gov/National-Center-for-Health-Statistics/VSRR-Provisional-Drug-Overdose-Death-Counts/xkb8-kh2a',
  data: [
    {
      year: 2015,
      synthetic_opioids: 9610.0,
      heroin: 13051.0,
      cocaine: 6841.0,
      psychostimulants: 5777.0,
      natural_semisynthetic_opioids: 12747.0,
      all_drug_overdose: 52623.0,
    },
    {
      year: 2016,
      synthetic_opioids: 19500.0,
      heroin: 15551.0,
      cocaine: 10458.0,
      psychostimulants: 7610.0,
      natural_semisynthetic_opioids: 14534.0,
      all_drug_overdose: 63938.0,
    },
    {
      year: 2017,
      synthetic_opioids: 28659.0,
      heroin: 15593.0,
      cocaine: 14069.0,
      psychostimulants: 10435.0,
      natural_semisynthetic_opioids: 14559.0,
      all_drug_overdose: 70699.0,
    },
    {
      year: 2018,
      synthetic_opioids: 31525.0,
      heroin: 15102.0,
      cocaine: 14802.0,
      psychostimulants: 12843.0,
      natural_semisynthetic_opioids: 12620.0,
      all_drug_overdose: 67850.0,
    },
    {
      year: 2019,
      synthetic_opioids: 36603.0,
      heroin: 14116.0,
      cocaine: 16024.0,
      psychostimulants: 16342.0,
      natural_semisynthetic_opioids: 11941.0,
      all_drug_overdose: 71130.0,
    },
    {
      year: 2020,
      synthetic_opioids: 56894.0,
      heroin: 13253.0,
      cocaine: 19601.0,
      psychostimulants: 24134.0,
      natural_semisynthetic_opioids: 13518.0,
      all_drug_overdose: 92478.0,
    },
    {
      year: 2021,
      synthetic_opioids: 71143.0,
      heroin: 9263.0,
      cocaine: 24710.0,
      psychostimulants: 32962.0,
      natural_semisynthetic_opioids: 13674.0,
      all_drug_overdose: 107573.0,
    },
    {
      year: 2022,
      synthetic_opioids: 74829.0,
      heroin: 5958.0,
      cocaine: 27921.0,
      psychostimulants: 34842.0,
      natural_semisynthetic_opioids: 11934.0,
      all_drug_overdose: 109413.0,
    },
    {
      year: 2023,
      synthetic_opioids: 74091.0,
      heroin: 4062.0,
      cocaine: 29911.0,
      psychostimulants: 35982.0,
      natural_semisynthetic_opioids: 10180.0,
      all_drug_overdose: 106881.0,
    },
    {
      year: 2024,
      synthetic_opioids: 48662.0,
      heroin: 2794.0,
      cocaine: 22283.0,
      psychostimulants: 29641.0,
      natural_semisynthetic_opioids: 8034.0,
      all_drug_overdose: 80860.0,
    },
    {
      year: 2025,
      synthetic_opioids: 38462.0,
      heroin: 2060.0,
      cocaine: 19933.0,
      psychostimulants: 26260.0,
      natural_semisynthetic_opioids: 7142.0,
      all_drug_overdose: 70646.0,
    },
  ],
};
