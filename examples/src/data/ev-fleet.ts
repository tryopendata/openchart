/**
 * Cumulative global electric car fleet, 2015-2024 (millions, BEV + PHEV).
 *
 * Editorial data carried over from the existing `line` story with its original
 * citation (IEA Global EV Outlook). A single exponential series: it doubles the
 * duty of a plain area demo and a log-scale demo, where the ~1.3M -> ~58M span
 * turns a hockey stick into a straight line.
 */
export const evFleet = {
  source: 'Source: IEA Global EV Outlook 2025',
  url: 'https://www.iea.org/reports/global-ev-outlook-2025',
  data: [
    { year: '2015-01-01', fleet: 1.3 },
    { year: '2016-01-01', fleet: 2.1 },
    { year: '2017-01-01', fleet: 3.2 },
    { year: '2018-01-01', fleet: 5.4 },
    { year: '2019-01-01', fleet: 7.5 },
    { year: '2020-01-01', fleet: 10.5 },
    { year: '2021-01-01', fleet: 17.1 },
    { year: '2022-01-01', fleet: 27.0 },
    { year: '2023-01-01', fleet: 41.0 },
    { year: '2024-01-01', fleet: 58.0 },
  ],
} as const;
