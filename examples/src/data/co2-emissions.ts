/**
 * Annual CO2 emissions by country, 2024 (million tonnes).
 *
 * Editorial data carried over from the existing story files with its original
 * citation (Global Carbon Project). Directionally consistent with the project's
 * published totals (China and the US together near half of the top emitters,
 * a long tail of smaller emitters), but the exact per-country figures were not
 * re-derived from the OpenData MCP, so the original compiled citation is
 * retained rather than re-attributed.
 *
 * The long tail of small emitters is what makes this a good small-slice
 * grouping example: the engine auto-buckets slices under ~3% into "Other".
 */
export const co2Emissions = {
  source: 'Source: Global Carbon Project',
  data: [
    { country: 'China', emissions: 12600 },
    { country: 'United States', emissions: 4500 },
    { country: 'India', emissions: 3000 },
    { country: 'Russia', emissions: 1900 },
    { country: 'Japan', emissions: 1000 },
    { country: 'Germany', emissions: 620 },
    { country: 'South Korea', emissions: 590 },
    { country: 'Iran', emissions: 580 },
    { country: 'Canada', emissions: 530 },
    { country: 'Indonesia', emissions: 490 },
    { country: 'Saudi Arabia', emissions: 480 },
    { country: 'Turkey', emissions: 420 },
  ],
} as const;
