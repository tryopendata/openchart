/**
 * Parity test: 100% stacked horizontal bar chart.
 *
 * Shows proportional breakdown per category with segments stacked
 * horizontally. Data is pre-normalized to percentages.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';

// ---------------------------------------------------------------------------
// Household Spending by Income Bracket: Stacked horizontal bars
// ---------------------------------------------------------------------------

const spendingSpec: ChartSpec = {
  animation: true,
  mark: 'bar',
  data: [
    // Lowest bracket
    { bracket: 'Under $30K', pct: 40, category: 'Housing' },
    { bracket: 'Under $30K', pct: 18, category: 'Food' },
    { bracket: 'Under $30K', pct: 15, category: 'Transport' },
    { bracket: 'Under $30K', pct: 12, category: 'Healthcare' },
    { bracket: 'Under $30K', pct: 15, category: 'Other' },
    // Lower middle
    { bracket: '$30K - $50K', pct: 35, category: 'Housing' },
    { bracket: '$30K - $50K', pct: 16, category: 'Food' },
    { bracket: '$30K - $50K', pct: 18, category: 'Transport' },
    { bracket: '$30K - $50K', pct: 10, category: 'Healthcare' },
    { bracket: '$30K - $50K', pct: 21, category: 'Other' },
    // Middle
    { bracket: '$50K - $80K', pct: 32, category: 'Housing' },
    { bracket: '$50K - $80K', pct: 14, category: 'Food' },
    { bracket: '$50K - $80K', pct: 19, category: 'Transport' },
    { bracket: '$50K - $80K', pct: 9, category: 'Healthcare' },
    { bracket: '$50K - $80K', pct: 26, category: 'Other' },
    // Upper middle
    { bracket: '$80K - $120K', pct: 30, category: 'Housing' },
    { bracket: '$80K - $120K', pct: 12, category: 'Food' },
    { bracket: '$80K - $120K', pct: 17, category: 'Transport' },
    { bracket: '$80K - $120K', pct: 8, category: 'Healthcare' },
    { bracket: '$80K - $120K', pct: 33, category: 'Other' },
    // Highest bracket
    { bracket: 'Over $120K', pct: 27, category: 'Housing' },
    { bracket: 'Over $120K', pct: 10, category: 'Food' },
    { bracket: 'Over $120K', pct: 14, category: 'Transport' },
    { bracket: 'Over $120K', pct: 6, category: 'Healthcare' },
    { bracket: 'Over $120K', pct: 43, category: 'Other' },
  ],
  encoding: {
    x: {
      field: 'pct',
      type: 'quantitative',
      stack: 'zero',
      axis: { title: 'Share of spending (%)' },
    },
    y: { field: 'bracket', type: 'nominal' },
    color: { field: 'category', type: 'nominal' },
  },
  labels: { density: 'all' },
  chrome: {
    title: 'The poorer you are, the more housing eats your paycheck',
    subtitle: 'Share of annual household expenditure by category and income bracket, 2022 (%)',
    source: 'Source: Bureau of Labor Statistics, Consumer Expenditure Survey',
  },
};

export const HouseholdSpending = () => (
  <div className="story-chart story-h-420">
    <Chart spec={spendingSpec} />
  </div>
);

const compactSpendingSpec: ChartSpec = {
  ...spendingSpec,
  chrome: {
    ...spendingSpec.chrome,
    title: 'Housing Eats Poor Pay',
    subtitle: 'Spending by category and income (%)',
  },
  labels: { density: 'none' },
};

export const HouseholdSpendingCompact = () => (
  <div
    className="story-debug-border story-fixed-size"
    style={{ '--w': '360px', '--h': '380px' } as React.CSSProperties}
  >
    <Chart spec={compactSpendingSpec} />
  </div>
);

export const HouseholdSpendingWide = () => (
  <div
    className="story-debug-border story-fixed-size"
    style={{ '--w': '1200px', '--h': '500px' } as React.CSSProperties}
  >
    <Chart spec={spendingSpec} />
  </div>
);
