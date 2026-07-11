/**
 * Key US interest-rate levels, mid-2024 snapshot (%).
 *
 * Editorial data carried over from the old `charts/marks.stories.tsx` with its
 * original citation (Federal Reserve, U.S. Treasury). A handful of reference
 * levels, each drawn as a horizontal `rule` mark — reference lines authored as
 * data rather than as annotations.
 */
export const referenceRates = {
  source: 'Source: Federal Reserve, U.S. Treasury (mid-2024)',
  url: 'https://www.federalreserve.gov/releases/h15/',
  data: [
    { rate: 5.33, label: 'Fed Funds Rate', category: 'Policy' },
    { rate: 4.25, label: '10-Year Treasury', category: 'Market' },
    { rate: 3.5, label: '2-Year Treasury', category: 'Market' },
    { rate: 2.0, label: 'Fed Inflation Target', category: 'Policy' },
    { rate: 0.0, label: 'Zero Bound', category: 'Policy' },
  ],
} as const;
