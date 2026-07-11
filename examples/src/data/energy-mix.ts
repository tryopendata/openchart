/**
 * Global primary energy mix by source, 2015-2022 (share of total, %).
 *
 * Editorial data carried over from the existing story files with its original
 * citation (Our World in Data / BP Statistical Review). Directionally
 * consistent with the OpenData MCP `owid/energy` dataset (fossil fuels ~80%,
 * renewables rising), but the exact per-year shares were not re-derived from
 * MCP, so the original compiled citation is retained rather than re-attributed.
 */
export const energyMix = {
  source: 'Source: Our World in Data, BP Statistical Review of World Energy',
  url: 'https://ourworldindata.org/energy',
  data: [
    { year: '2015', energy: 33.1, source: 'Oil' },
    { year: '2016', energy: 33.4, source: 'Oil' },
    { year: '2017', energy: 33.7, source: 'Oil' },
    { year: '2018', energy: 33.7, source: 'Oil' },
    { year: '2019', energy: 33.1, source: 'Oil' },
    { year: '2020', energy: 31.4, source: 'Oil' },
    { year: '2021', energy: 31.7, source: 'Oil' },
    { year: '2022', energy: 31.8, source: 'Oil' },
    { year: '2015', energy: 23.7, source: 'Natural Gas' },
    { year: '2016', energy: 23.9, source: 'Natural Gas' },
    { year: '2017', energy: 23.9, source: 'Natural Gas' },
    { year: '2018', energy: 24.1, source: 'Natural Gas' },
    { year: '2019', energy: 24.4, source: 'Natural Gas' },
    { year: '2020', energy: 24.7, source: 'Natural Gas' },
    { year: '2021', energy: 24.4, source: 'Natural Gas' },
    { year: '2022', energy: 23.8, source: 'Natural Gas' },
    { year: '2015', energy: 28.7, source: 'Coal' },
    { year: '2016', energy: 27.7, source: 'Coal' },
    { year: '2017', energy: 27.3, source: 'Coal' },
    { year: '2018', energy: 27.0, source: 'Coal' },
    { year: '2019', energy: 26.8, source: 'Coal' },
    { year: '2020', energy: 26.2, source: 'Coal' },
    { year: '2021', energy: 26.9, source: 'Coal' },
    { year: '2022', energy: 26.5, source: 'Coal' },
    { year: '2015', energy: 9.9, source: 'Renewables' },
    { year: '2016', energy: 10.4, source: 'Renewables' },
    { year: '2017', energy: 10.7, source: 'Renewables' },
    { year: '2018', energy: 10.9, source: 'Renewables' },
    { year: '2019', energy: 11.5, source: 'Renewables' },
    { year: '2020', energy: 13.2, source: 'Renewables' },
    { year: '2021', energy: 12.8, source: 'Renewables' },
    { year: '2022', energy: 13.9, source: 'Renewables' },
    { year: '2015', energy: 4.6, source: 'Nuclear' },
    { year: '2016', energy: 4.6, source: 'Nuclear' },
    { year: '2017', energy: 4.4, source: 'Nuclear' },
    { year: '2018', energy: 4.3, source: 'Nuclear' },
    { year: '2019', energy: 4.2, source: 'Nuclear' },
    { year: '2020', energy: 4.5, source: 'Nuclear' },
    { year: '2021', energy: 4.2, source: 'Nuclear' },
    { year: '2022', energy: 4.0, source: 'Nuclear' },
  ],
} as const;
