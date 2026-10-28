import type { ChartSpec, LayerSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';

export default { title: 'Static' };
const frame = { left: 48, right: 96 };
const domain = ['2026-10-08', '2026-11-01'];
const data = ['2026-10-12', '2026-10-19', '2026-10-26'].flatMap((week) => [
  { week, preset: 'First', count: 40, rate: 0.8 },
  { week, preset: 'Second', count: 25, rate: 0.6 },
]);
const encoding = {
  x: { field: 'week', type: 'temporal' as const, scale: { domain } },
  color: { field: 'preset', type: 'nominal' as const },
};
const history: LayerSpec = {
  data,
  frame,
  encoding,
  layer: [
    {
      mark: 'area',
      data,
      encoding: { ...encoding, y: { field: 'rate', type: 'quantitative', stack: null } },
    },
    { mark: 'line', data, encoding: { ...encoding, y: { field: 'rate', type: 'quantitative' } } },
  ],
  annotations: [
    { type: 'refline', x: '2026-10-20', label: 'Release' },
    { type: 'refline', y: 0.7, label: 'Target', labelPlacement: 'outside' },
  ],
  chrome: { title: 'Success stayed steady', subtitle: 'Illustrative rates by preset' },
};
const weekly: ChartSpec = {
  mark: 'bar',
  endpointLabels: { show: true, content: 'label' },
  data,
  frame,
  encoding: {
    ...encoding,
    x: { ...encoding.x, interval: 'week' },
    y: { field: 'count', type: 'quantitative' },
  },
  annotations: [{ type: 'refline', x: '2026-10-20', label: 'Release' }],
  labels: { density: 'none' },
  chrome: {
    title: 'Weekly project counts stayed steady',
    subtitle: 'Same date domain and fixed left/right gutters as the history above',
  },
};
export const AlignedPair = () => (
  <main style={{ maxWidth: 680, padding: '64px 16px 16px', display: 'grid', gap: 24 }}>
    <section data-aligned-history>
      <Chart spec={history} style={{ height: 340 }} />
    </section>
    <section data-aligned-weekly>
      <Chart spec={weekly} style={{ height: 340 }} />
    </section>
  </main>
);
