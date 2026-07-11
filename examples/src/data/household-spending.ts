/**
 * Household expenditure share by category and income bracket, 2022 (%).
 *
 * Editorial data carried over from the existing story files with its original
 * citation (BLS Consumer Expenditure Survey). Not independently re-derived
 * from an OpenData MCP dataset; the original compiled citation is retained.
 */
export const householdSpending = {
  source: 'Source: Bureau of Labor Statistics, Consumer Expenditure Survey',
  url: 'https://www.bls.gov/cex/',
  data: [
    { bracket: 'Under $30K', pct: 40, category: 'Housing' },
    { bracket: 'Under $30K', pct: 18, category: 'Food' },
    { bracket: 'Under $30K', pct: 15, category: 'Transport' },
    { bracket: 'Under $30K', pct: 12, category: 'Healthcare' },
    { bracket: 'Under $30K', pct: 15, category: 'Other' },
    { bracket: '$30K - $50K', pct: 35, category: 'Housing' },
    { bracket: '$30K - $50K', pct: 16, category: 'Food' },
    { bracket: '$30K - $50K', pct: 18, category: 'Transport' },
    { bracket: '$30K - $50K', pct: 10, category: 'Healthcare' },
    { bracket: '$30K - $50K', pct: 21, category: 'Other' },
    { bracket: '$50K - $80K', pct: 32, category: 'Housing' },
    { bracket: '$50K - $80K', pct: 14, category: 'Food' },
    { bracket: '$50K - $80K', pct: 19, category: 'Transport' },
    { bracket: '$50K - $80K', pct: 9, category: 'Healthcare' },
    { bracket: '$50K - $80K', pct: 26, category: 'Other' },
    { bracket: '$80K - $120K', pct: 30, category: 'Housing' },
    { bracket: '$80K - $120K', pct: 12, category: 'Food' },
    { bracket: '$80K - $120K', pct: 17, category: 'Transport' },
    { bracket: '$80K - $120K', pct: 8, category: 'Healthcare' },
    { bracket: '$80K - $120K', pct: 33, category: 'Other' },
    { bracket: 'Over $120K', pct: 27, category: 'Housing' },
    { bracket: 'Over $120K', pct: 10, category: 'Food' },
    { bracket: 'Over $120K', pct: 14, category: 'Transport' },
    { bracket: 'Over $120K', pct: 6, category: 'Healthcare' },
    { bracket: 'Over $120K', pct: 43, category: 'Other' },
  ],
} as const;
