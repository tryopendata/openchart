import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import { useState } from 'react';

export default { title: 'Gallery / Accessibility' };

const data = [
  { stack: 'React', count: 40 },
  { stack: 'Vue', count: 28 },
  { stack: 'Svelte', count: 18 },
];
const spec: ChartSpec = {
  mark: 'bar',
  animation: { enter: { duration: 1500 } },
  data,
  encoding: {
    x: { field: 'count', type: 'quantitative' },
    y: { field: 'stack', type: 'nominal' },
  },
  a11y: { description: 'React appears in 40 projects, Vue in 28 and Svelte in 18.', table: false },
  chrome: { title: 'React appears in the most projects', subtitle: 'Illustrative project counts' },
};

/** A host owns its disclosure table and live status while the chart owns navigation. */
export const Island = () => {
  const [status, setStatus] = useState('Focus the chart, then use the arrow keys.');
  const [revision, setRevision] = useState(0);
  return (
    <main style={{ maxWidth: 680, padding: '64px 24px 24px' }}>
      <button type="button" onClick={() => setRevision((value) => value + 1)}>
        Replay entrance
      </button>
      <section data-a11y-island>
        <Chart
          key={revision}
          spec={spec}
          autoResize={false}
          onMarkFocus={(event) => setStatus(`${event.datum.stack}: ${event.datum.count} projects`)}
          style={{ width: '100%', height: 340 }}
        />
        <output style={{ display: 'block', margin: '16px 0' }}>{status}</output>
        <details>
          <summary>Project counts</summary>
          <table>
            <thead>
              <tr>
                <th>Stack</th>
                <th>Projects</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.stack}>
                  <th>{row.stack}</th>
                  <td>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>
    </main>
  );
};
