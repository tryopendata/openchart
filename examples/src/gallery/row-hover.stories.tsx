import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';

export default { title: 'Gallery / Row inspection' };
const spec: ChartSpec = {
  mark: 'bar',
  animation: false,
  chrome: {
    title: 'Compare a row',
    subtitle: 'Move across a category or value, or use arrow keys.',
  },
  data: [
    { name: 'North', value: 82 },
    { name: 'South', value: 61 },
    { name: 'East', value: 49 },
    { name: 'West', value: 33 },
  ],
  encoding: {
    y: { field: 'name', type: 'nominal', sort: null },
    x: { field: 'value', type: 'quantitative' },
  },
  labels: { placement: 'column' },
};
export const RowHover = () => (
  <div style={{ padding: '56px 16px 16px' }}>
    <Chart spec={spec} rowHover style={{ width: '100%', height: 360 }} />
  </div>
);
