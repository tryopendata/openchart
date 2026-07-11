/**
 * College net revenue vs. undergraduate enrollment, 2014-2024.
 *
 * Illustrative data (no real institution). Carried over as the canonical
 * dual-axis pattern from the old `charts/dual-axis.stories.tsx`: two series with
 * different units (dollars and headcount) sharing one x-axis, drawn with
 * `resolve: { scale: { y: 'independent' } }`. Net revenue crosses into deficit
 * as enrollment slides — a shape that only reads with two independent y-scales.
 */
export const collegeFinances = {
  source: 'Illustrative data',
  data: [
    { year: '2014', revenue: 68_000_000, enrollment: 61_200 },
    { year: '2015', revenue: 72_000_000, enrollment: 62_400 },
    { year: '2016', revenue: 65_000_000, enrollment: 61_500 },
    { year: '2017', revenue: 58_000_000, enrollment: 60_300 },
    { year: '2018', revenue: 51_000_000, enrollment: 58_900 },
    { year: '2019', revenue: 42_000_000, enrollment: 57_100 },
    { year: '2020', revenue: 18_000_000, enrollment: 55_400 },
    { year: '2021', revenue: 5_000_000, enrollment: 54_200 },
    { year: '2022', revenue: -8_000_000, enrollment: 52_800 },
    { year: '2023', revenue: -21_000_000, enrollment: 51_600 },
    { year: '2024', revenue: -35_000_000, enrollment: 50_300 },
  ],
} as const;
