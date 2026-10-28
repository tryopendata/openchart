// biome-ignore-all lint/security/noDangerouslySetInnerHtml: Static renderer escapes the fixture's SVG content.
import type { BarListSpec } from '@opendata-ai/openchart-core';
import { renderStaticSVG } from '@opendata-ai/openchart-vanilla/static';

export default { title: 'Static / Barlist' };
const grouped: BarListSpec = {
  type: 'barlist',
  data: [
    { label: 'Tests', value: 0.35, group: 'steps', description: 'Tests: 35%' },
    { label: 'Build', value: 0.2, group: 'steps', description: 'Build: 20%' },
    { label: 'Environment', value: 0.1, group: 'environment', description: 'Environment: 10%' },
  ],
  encoding: {
    label: { field: 'label', type: 'nominal' },
    value: { field: 'value', type: 'quantitative', scale: { domain: [0, 0.5] }, format: 'percent' },
    group: { field: 'group', type: 'nominal' },
    description: { field: 'description' },
  },
  height: 'auto',
  chrome: { title: 'Step failures', subtitle: 'Share of completed projects' },
  a11y: { description: 'Test failures appear most often.' },
  watermark: false,
};
const reference: BarListSpec = {
  ...grouped,
  data: [
    { label: 'Package A', value: 2.4, description: 'Package A: 2.4 times as likely' },
    { label: 'Package B', value: 1.8, description: 'Package B: 1.8 times as likely' },
    { label: 'Package C', value: 0.8, description: 'Package C: .8 times as likely' },
  ],
  encoding: {
    label: { field: 'label', type: 'nominal' },
    value: { field: 'value', type: 'quantitative', scale: { domain: [0, 3] } },
    description: { field: 'description' },
  },
  labels: { format: '.1f', suffix: '× as likely' },
  annotations: [{ type: 'refline', x: 1, label: 'Baseline', style: 'dashed' }],
  chrome: { title: 'Often used together' },
};
function Pair({ spec }: { spec: BarListSpec }) {
  return (
    <div
      className="story-chart"
      style={{ display: 'flex', width: 1040, maxWidth: 'none', gap: 16, alignItems: 'flex-start' }}
    >
      {(['off', 'force'] as const).map((darkMode) => (
        <div
          key={darkMode}
          style={{ width: 480, padding: 16, background: darkMode === 'force' ? '#09090b' : '#fff' }}
          dangerouslySetInnerHTML={{
            __html: renderStaticSVG(spec, {
              width: 480,
              darkMode,
              idPrefix: `barlist-${darkMode}`,
            }),
          }}
        />
      ))}
    </div>
  );
}
export const Grouped = () => <Pair spec={grouped} />;
export const ReferenceLine = () => <Pair spec={reference} />;
