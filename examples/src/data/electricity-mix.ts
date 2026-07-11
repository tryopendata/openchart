/**
 * Global electricity generation mix by source, 2010 vs 2023 (% of generation).
 *
 * Editorial data carried over from the existing story files with its original
 * citation (IEA World Energy Outlook). Directionally consistent with the IEA's
 * published mix (coal still the largest single source, renewables roughly
 * quadrupling their share over the period), but the exact shares were not
 * re-derived from the OpenData MCP, so the original compiled citation is
 * retained rather than re-attributed.
 *
 * Domain order is by descending 2010 share so both donuts share one color
 * assignment: Coal, Natural Gas, Hydro, Nuclear, Renewables, Oil & Other.
 */
export const electricityMix = {
  source: 'Source: IEA World Energy Outlook',
  '2010': [
    { source: 'Coal', share: 40.6 },
    { source: 'Natural Gas', share: 22.2 },
    { source: 'Hydro', share: 16.3 },
    { source: 'Nuclear', share: 12.8 },
    { source: 'Renewables', share: 3.5 },
    { source: 'Oil & Other', share: 4.6 },
  ],
  '2023': [
    { source: 'Coal', share: 35.2 },
    { source: 'Natural Gas', share: 22.5 },
    { source: 'Hydro', share: 14.8 },
    { source: 'Nuclear', share: 9.2 },
    { source: 'Renewables', share: 15.6 },
    { source: 'Oil & Other', share: 2.7 },
  ],
} as const;
