/**
 * Household income distribution by US Census region, sampled percentiles ($K).
 *
 * Illustrative data (a sampled sketch of the distribution shape, not the full
 * microdata), carried over from the old `charts/marks.stories.tsx`. Each row is
 * one household draw; a `tick` mark renders them as a strip/rug plot per region
 * so the spread and skew read directly. Directionally consistent with Census
 * CPS regional patterns (Northeast/West skew richer) but not the source table.
 */
export const incomeDistribution = {
  source: 'Illustrative data',
  data: [
    { income: 22, region: 'South' },
    { income: 28, region: 'South' },
    { income: 31, region: 'South' },
    { income: 35, region: 'South' },
    { income: 38, region: 'South' },
    { income: 42, region: 'South' },
    { income: 45, region: 'South' },
    { income: 48, region: 'South' },
    { income: 55, region: 'South' },
    { income: 62, region: 'South' },
    { income: 78, region: 'South' },
    { income: 30, region: 'Northeast' },
    { income: 36, region: 'Northeast' },
    { income: 42, region: 'Northeast' },
    { income: 48, region: 'Northeast' },
    { income: 52, region: 'Northeast' },
    { income: 58, region: 'Northeast' },
    { income: 65, region: 'Northeast' },
    { income: 72, region: 'Northeast' },
    { income: 82, region: 'Northeast' },
    { income: 95, region: 'Northeast' },
    { income: 115, region: 'Northeast' },
    { income: 25, region: 'Midwest' },
    { income: 30, region: 'Midwest' },
    { income: 34, region: 'Midwest' },
    { income: 38, region: 'Midwest' },
    { income: 42, region: 'Midwest' },
    { income: 46, region: 'Midwest' },
    { income: 50, region: 'Midwest' },
    { income: 55, region: 'Midwest' },
    { income: 60, region: 'Midwest' },
    { income: 68, region: 'Midwest' },
    { income: 85, region: 'Midwest' },
    { income: 32, region: 'West' },
    { income: 38, region: 'West' },
    { income: 44, region: 'West' },
    { income: 50, region: 'West' },
    { income: 56, region: 'West' },
    { income: 62, region: 'West' },
    { income: 70, region: 'West' },
    { income: 78, region: 'West' },
    { income: 88, region: 'West' },
    { income: 105, region: 'West' },
    { income: 130, region: 'West' },
  ],
} as const;
