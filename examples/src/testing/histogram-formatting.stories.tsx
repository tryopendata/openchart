import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';

// Illustrative pre-binned data: plotted caps are display boundaries, not the
// real upper bound of the pooled tail. The authored tooltip owns that meaning.
const pooled: ChartSpec = {
  mark: 'bar',
  data: [
    { start: 0, end: 1000, band: 'Below $1,000', count: 25 },
    { start: 1000, end: 2000, band: '$1,000 or more', count: 8 },
  ],
  encoding: {
    x: { field: 'start', type: 'quantitative', axis: { title: 'Display bin boundary ($)' } },
    x2: { field: 'end', type: 'quantitative' },
    y: { field: 'count', type: 'quantitative', axis: { title: 'Gifts' } },
    tooltip: [
      { field: 'band', type: 'nominal', title: 'Gift size' },
      { field: 'count', type: 'quantitative', title: 'Gifts', format: ',.0f' },
    ],
  },
  chrome: {
    title: 'Pooled end-bin descriptions',
    subtitle: 'Inspect the second bar: its tooltip must say “$1,000 or more”.',
    source: 'Illustrative data',
  },
};

const percentages: ChartSpec = {
  mark: { type: 'bar', orient: 'horizontal' },
  data: [
    { category: 'Small positive', share: 0.0004 },
    { category: 'Small negative', share: -0.0004 },
    { category: 'Above threshold', share: 0.0012 },
    { category: 'Exact zero', share: 0 },
  ],
  encoding: {
    y: { field: 'category', type: 'nominal', sort: null },
    x: { field: 'share', type: 'quantitative', axis: { format: '.2%', title: 'Share' } },
    tooltip: [
      { field: 'category', type: 'nominal', title: 'Case' },
      { field: 'share', type: 'quantitative', title: 'Readable', format: 'percent' },
      { field: 'share', type: 'quantitative', title: 'Precise', format: '.4%' },
    ],
  },
  labels: { format: 'percent' },
  chrome: {
    title: 'Small nonzero percentages',
    subtitle:
      'Semantic percent preserves tiny values; explicit d3 formats retain decimal precision.',
    source: 'Illustrative data',
  },
};

export const PooledBins = () => (
  <div style={{ maxWidth: 700 }}>
    <Chart spec={pooled} />
  </div>
);
export const SmallPercentages = () => (
  <div style={{ maxWidth: 700 }}>
    <Chart spec={percentages} />
  </div>
);

export default { title: 'Testing/Histogram Formatting' };
