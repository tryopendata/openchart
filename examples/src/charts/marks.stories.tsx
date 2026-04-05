/**
 * New mark type stories: text, rule, tick.
 *
 * Demonstrates the three new mark types added in the Vega-Lite alignment:
 * - Text marks: data-positioned labels
 * - Rule marks: reference lines as data marks
 * - Tick marks: strip/rug plots for distribution visualization
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';

// ---------------------------------------------------------------------------
// Text mark: US state population labels at GDP coordinates
// ---------------------------------------------------------------------------

const textMarkSpec: ChartSpec = {
  animation: true,
  mark: 'text',
  data: [
    { state: 'California', gdp: 3.9, pop: 39.0, label: 'CA' },
    { state: 'Texas', gdp: 2.0, pop: 30.5, label: 'TX' },
    { state: 'New York', gdp: 1.9, pop: 19.6, label: 'NY' },
    { state: 'Florida', gdp: 1.4, pop: 22.6, label: 'FL' },
    { state: 'Illinois', gdp: 1.0, pop: 12.5, label: 'IL' },
    { state: 'Pennsylvania', gdp: 0.9, pop: 12.9, label: 'PA' },
    { state: 'Ohio', gdp: 0.7, pop: 11.8, label: 'OH' },
    { state: 'Georgia', gdp: 0.7, pop: 11.0, label: 'GA' },
    { state: 'New Jersey', gdp: 0.7, pop: 9.3, label: 'NJ' },
    { state: 'Washington', gdp: 0.7, pop: 7.8, label: 'WA' },
  ],
  encoding: {
    x: {
      field: 'gdp',
      type: 'quantitative',
      axis: { title: 'GDP ($ trillions)' },
    },
    y: {
      field: 'pop',
      type: 'quantitative',
      axis: { title: 'Population (millions)' },
    },
    text: { field: 'label', type: 'nominal' },
    size: { field: 'gdp', type: 'quantitative' },
  },
  chrome: {
    title: 'California Towers Over Every Other State Economy',
    subtitle: 'US states by GDP and population, 2024. Text size reflects GDP.',
    source: 'Source: Bureau of Economic Analysis',
    byline: 'Chart: OpenChart',
  },
};

export const TextMark = () => (
  <div className="story-chart story-h-420">
    <Chart spec={textMarkSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Rule mark: key interest rate levels as horizontal lines
// ---------------------------------------------------------------------------

const ruleMarkSpec: ChartSpec = {
  animation: true,
  mark: 'rule',
  data: [
    { rate: 5.33, label: 'Fed Funds Rate', category: 'Policy' },
    { rate: 4.25, label: '10-Year Treasury', category: 'Market' },
    { rate: 3.5, label: '2-Year Treasury', category: 'Market' },
    { rate: 2.0, label: 'Fed Inflation Target', category: 'Policy' },
    { rate: 0.0, label: 'Zero Bound', category: 'Policy' },
  ],
  encoding: {
    y: {
      field: 'rate',
      type: 'quantitative',
      axis: { title: 'Interest Rate (%)', format: '.2f' },
    },
    color: { field: 'category', type: 'nominal' },
  },
  chrome: {
    title: 'Key Interest Rate Levels at a Glance',
    subtitle: 'Reference interest rates as of Q4 2024',
    source: 'Source: Federal Reserve, U.S. Treasury',
    byline: 'Chart: OpenChart',
  },
};

export const RuleMark = () => (
  <div className="story-chart story-h-380">
    <Chart spec={ruleMarkSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Tick mark: income distribution strip plot
// ---------------------------------------------------------------------------

const tickMarkSpec: ChartSpec = {
  animation: true,
  mark: 'tick',
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
  encoding: {
    x: {
      field: 'income',
      type: 'quantitative',
      axis: { title: 'Household Income ($K)', format: '$,.0f' },
    },
    y: { field: 'region', type: 'nominal' },
    color: { field: 'region', type: 'nominal' },
  },
  chrome: {
    title: 'Northeast and West Skew Richer Than South and Midwest',
    subtitle: 'Household income distribution by US Census region, 2024 (sampled percentiles)',
    source: 'Source: U.S. Census Bureau, Current Population Survey',
    byline: 'Chart: OpenChart',
  },
};

export const TickMark = () => (
  <div className="story-chart story-h-380">
    <Chart spec={tickMarkSpec} />
  </div>
);
