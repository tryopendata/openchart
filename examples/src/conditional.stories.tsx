/**
 * Conditional encoding stories.
 *
 * Demonstrates how to use ConditionalValueDef to apply different
 * visual properties based on data values, following the Vega-Lite
 * conditional encoding pattern.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';

// ---------------------------------------------------------------------------
// Positive/negative bar coloring: quarterly earnings surprises
// ---------------------------------------------------------------------------

const conditionalBarSpec: ChartSpec = {
  mark: 'bar',
  data: [
    { quarter: "Q1 '23", surprise: 6.5 },
    { quarter: "Q2 '23", surprise: 7.8 },
    { quarter: "Q3 '23", surprise: 4.2 },
    { quarter: "Q4 '23", surprise: -1.3 },
    { quarter: "Q1 '24", surprise: 8.1 },
    { quarter: "Q2 '24", surprise: -3.5 },
    { quarter: "Q3 '24", surprise: 2.9 },
    { quarter: "Q4 '24", surprise: 10.2 },
  ],
  encoding: {
    x: { field: 'quarter', type: 'nominal' },
    y: {
      field: 'surprise',
      type: 'quantitative',
      axis: { label: 'EPS Surprise (%)', format: '+.1f', grid: true },
    },
    color: {
      condition: [
        { test: { field: 'surprise', gte: 0 }, value: '#15803d' },
        { test: { field: 'surprise', lt: 0 }, value: '#dc2626' },
      ],
      value: '#94a3b8',
    },
  },
  annotations: [
    {
      type: 'refline',
      y: 0,
      style: 'solid',
      stroke: '#334155',
      strokeWidth: 1.5,
    },
  ],
  labels: { density: 'all', format: '+.1f' },
  chrome: {
    title: 'S&P 500 Companies Beat Estimates in 6 of 8 Quarters',
    subtitle:
      'Aggregate S&P 500 EPS surprise (%), green = beat, red = miss. Conditional color encoding.',
    source: 'Source: FactSet Earnings Insight',
    byline: 'Chart: OpenChart',
  },
};

export const PositiveNegativeBars = () => (
  <div className="story-chart" style={{ height: 400 }}>
    <Chart spec={conditionalBarSpec} />
  </div>
);
