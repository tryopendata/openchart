/**
 * Scrollytelling stories (plan 11).
 *
 * `ScrollyNarrative` is the interactive dogfood: a 5-step narrative
 * (base -> highlight -> annotate -> camera -> re-encode) driven by scroll
 * through the React `<ChartStory>` shell. Scroll the preview to advance.
 *
 * The `Fixture*` exports pin individual steps at a deterministic state
 * (`animation: false`, controlled `step`) so the Playwright visual suite can
 * lock the rendered chart at each stage. They render into a plain `.tfix-chart`
 * container (not the sticky shell) so the screenshot captures only the chart.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart, ChartStory, type ChartStoryProps } from '@opendata-ai/openchart-react';
import '../testing/testing.css';

export default { title: 'Charts / Scrollytelling' };

// ---------------------------------------------------------------------------
// Shared data: emissions per capita by country, 2000-2020.
// ---------------------------------------------------------------------------

type Row = {
  year: string;
  value: number;
  perCapita: number;
  country: string;
};

const DATA: Row[] = [
  { year: '2000', value: 5.9, perCapita: 20.5, country: 'United States' },
  { year: '2005', value: 6.0, perCapita: 20.2, country: 'United States' },
  { year: '2010', value: 5.6, perCapita: 18.0, country: 'United States' },
  { year: '2015', value: 5.2, perCapita: 16.2, country: 'United States' },
  { year: '2020', value: 4.6, perCapita: 13.9, country: 'United States' },
  { year: '2000', value: 0.9, perCapita: 10.1, country: 'Germany' },
  { year: '2005', value: 0.8, perCapita: 9.9, country: 'Germany' },
  { year: '2010', value: 0.8, perCapita: 9.6, country: 'Germany' },
  { year: '2015', value: 0.8, perCapita: 8.9, country: 'Germany' },
  { year: '2020', value: 0.6, perCapita: 7.7, country: 'Germany' },
  { year: '2000', value: 3.4, perCapita: 2.7, country: 'China' },
  { year: '2005', value: 5.9, perCapita: 4.5, country: 'China' },
  { year: '2010', value: 8.8, perCapita: 6.5, country: 'China' },
  { year: '2015', value: 9.7, perCapita: 7.0, country: 'China' },
  { year: '2020', value: 10.7, perCapita: 7.4, country: 'China' },
];

const baseSpec: ChartSpec<Row> = {
  animation: false,
  mark: 'line',
  data: DATA,
  encoding: {
    x: { field: 'year', type: 'ordinal' },
    y: {
      field: 'value',
      type: 'quantitative',
      axis: { title: 'Gt CO2', grid: true },
    },
    color: { field: 'country', type: 'nominal' },
  },
  chrome: {
    title: 'Total emissions by country',
    subtitle: 'Gigatonnes of CO2, 2000-2020',
    source: 'Global Carbon Project',
  },
};

// The five cumulative step patches. Each is a deep-partial VizSpec.
const steps: ChartStoryProps<Row>['steps'] = [
  // 0: base
  {},
  // 1: highlight China (emphasis sugar)
  { highlight: ['China'] },
  // 2: annotate the crossover moment
  {
    spec: {
      annotations: [
        {
          type: 'text',
          x: '2010',
          y: 8.8,
          text: 'China overtakes the US',
          offset: { dy: -18 },
        },
      ],
    },
  },
  // 3: camera pans/zooms to the 2010-2020 region
  { camera: { x: ['2010', '2020'] } },
  // 4: re-encode to per-capita (outside the morph gate -> crossfade)
  {
    spec: {
      encoding: {
        y: {
          field: 'perCapita',
          type: 'quantitative',
          axis: { title: 'Tonnes CO2 per person', grid: true },
        },
      },
      chrome: {
        title: 'Emissions per person',
        subtitle: 'Tonnes of CO2 per capita, 2000-2020',
      },
    },
  },
];

const narrative = [
  <div key="0">
    <h3>Three trajectories</h3>
    <p>
      Total emissions tell three very different stories. Scroll to follow how the leaders changed
      over two decades.
    </p>
  </div>,
  <div key="1">
    <h3>China&apos;s rise</h3>
    <p>
      China&apos;s total output climbed steeply through the 2000s as its economy industrialized.
    </p>
  </div>,
  <div key="2">
    <h3>The crossover</h3>
    <p>Around 2010, China passed the United States to become the largest total emitter.</p>
  </div>,
  <div key="3">
    <h3>The recent decade</h3>
    <p>Zooming into 2010-2020 shows the gap widening while the US and Germany decline.</p>
  </div>,
  <div key="4">
    <h3>Per person, though</h3>
    <p>
      Switch to per-capita and the picture inverts: an American still emits roughly twice what a
      person in China does.
    </p>
  </div>,
];

export const ScrollyNarrative = () => (
  <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem' }}>
    <ChartStory spec={baseSpec} steps={steps} narrative={narrative} />
    <div style={{ height: '60vh' }} />
  </div>
);

// ---------------------------------------------------------------------------
// Deterministic per-step fixtures for the visual suite. Each renders the
// resolved spec at a pinned step directly through <Chart> so the screenshot
// captures the chart in isolation (no sticky-scroll chrome, no animation).
// ---------------------------------------------------------------------------

const highlightSpec: ChartSpec<Row> = {
  ...baseSpec,
  encoding: {
    ...baseSpec.encoding,
    color: { field: 'country', type: 'nominal', highlight: ['China'] },
  },
};

const annotatedSpec: ChartSpec<Row> = {
  ...highlightSpec,
  annotations: [
    { type: 'text', x: '2010', y: 8.8, text: 'China overtakes the US', offset: { dy: -18 } },
  ],
};

const reEncodedSpec: ChartSpec<Row> = {
  ...annotatedSpec,
  encoding: {
    ...annotatedSpec.encoding,
    y: {
      field: 'perCapita',
      type: 'quantitative',
      axis: { title: 'Tonnes CO2 per person', grid: true },
    },
  },
  chrome: {
    ...baseSpec.chrome,
    title: 'Emissions per person',
    subtitle: 'Tonnes of CO2 per capita, 2000-2020',
  },
};

export const FixtureBase = () => (
  <div className="tfix-chart tfix-h-440">
    <Chart spec={baseSpec} />
  </div>
);

export const FixtureHighlight = () => (
  <div className="tfix-chart tfix-h-440">
    <Chart spec={highlightSpec} />
  </div>
);

export const FixtureAnnotated = () => (
  <div className="tfix-chart tfix-h-440">
    <Chart spec={annotatedSpec} />
  </div>
);

export const FixtureReEncoded = () => (
  <div className="tfix-chart tfix-h-440">
    <Chart spec={reEncodedSpec} />
  </div>
);
