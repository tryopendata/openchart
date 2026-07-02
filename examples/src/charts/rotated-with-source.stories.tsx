/**
 * Column chart with long category labels (triggers auto-rotation) and source chrome.
 *
 * Used by e2e/invariants/known-bugs.spec.ts to test that rotated x-axis
 * labels don't overlap the source text below them.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';

const spec: ChartSpec = {
  mark: 'bar',
  data: [
    { category: 'Information Technology', value: 32.4 },
    { category: 'Health Care Services', value: 13.1 },
    { category: 'Financial Services', value: 12.8 },
    { category: 'Consumer Discretionary', value: 10.5 },
    { category: 'Communication Services', value: 8.9 },
    { category: 'Industrial Manufacturing', value: 8.4 },
  ],
  encoding: {
    x: { field: 'category', type: 'nominal' },
    y: {
      field: 'value',
      type: 'quantitative',
      axis: { title: 'Weight (%)' },
    },
  },
  chrome: {
    title: 'S&P 500 Sector Weights',
    subtitle: 'Percentage of index market capitalization, June 2024',
    source: 'Source: S&P Dow Jones Indices',
  },
};

export const RotatedWithSource = () => (
  <div className="story-chart story-h-400">
    <Chart spec={spec} />
  </div>
);
