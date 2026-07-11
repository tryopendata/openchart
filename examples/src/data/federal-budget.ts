/**
 * US federal spending by category, fiscal year 2024 (% of ~$6.9 trillion).
 *
 * Editorial data carried over from the existing story files with its original
 * citation (Congressional Budget Office). Directionally consistent with CBO
 * outlay breakdowns (healthcare and Social Security together near half of
 * spending), but the exact shares were not re-derived from the OpenData MCP,
 * so the original compiled citation is retained rather than re-attributed.
 */
export const federalBudget = {
  source: 'Source: Congressional Budget Office',
  data: [
    { category: 'Healthcare', spending: 24 },
    { category: 'Social Security', spending: 21 },
    { category: 'Defense', spending: 13 },
    { category: 'Net Interest', spending: 13 },
    { category: 'All Other', spending: 29 },
  ],
} as const;
