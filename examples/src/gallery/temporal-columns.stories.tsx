import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';

export default { title: 'Bar' };
const data = ['2026-10-12', '2026-10-19', '2026-10-26'].flatMap((week) => [
  { week, preset: 'First', projects: 40 },
  { week, preset: 'Second', projects: 25 },
]);
const weeklySpec: ChartSpec = {
  mark: 'bar',
  data,
  animation: false,
  encoding: {
    x: { field: 'week', type: 'temporal', interval: 'week' },
    y: { field: 'projects', type: 'quantitative' },
    color: { field: 'preset', type: 'nominal' },
  },
  annotations: [{ type: 'refline', x: '2026-10-20', label: 'Release', labelPlacement: 'auto' }],
  labels: { density: 'none' },
  chrome: {
    title: 'Weekly project counts stay steady',
    subtitle: 'Illustrative counts by preset; weeks remain on a continuous date axis',
  },
};
export const TemporalColumns = () => (
  <main style={{ padding: '64px 16px 16px', maxWidth: 680 }}>
    <Chart spec={weeklySpec} style={{ height: 380 }} />
  </main>
);
