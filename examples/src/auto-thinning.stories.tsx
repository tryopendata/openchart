/**
 * Auto-thinning torture stories.
 *
 * Annotation-heavy line chart at multiple widths to verify that
 * auto-thinning demotes overlapping annotations to footnote markers
 * at narrow widths while rendering all inline at full width.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';

const annotationHeavySpec: ChartSpec = {
  mark: 'line',
  data: [
    { date: '2019-01-01', value: 10 },
    { date: '2019-06-01', value: 18 },
    { date: '2020-01-01', value: 15 },
    { date: '2020-06-01', value: 8 },
    { date: '2021-01-01', value: 22 },
    { date: '2021-06-01', value: 28 },
    { date: '2022-01-01', value: 35 },
    { date: '2022-06-01', value: 30 },
    { date: '2023-01-01', value: 42 },
    { date: '2023-06-01', value: 45 },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
  },
  annotations: [
    { type: 'text', x: '2019-06-01', y: 18, text: 'Early peak', priority: 3 },
    { type: 'text', x: '2020-06-01', y: 8, text: 'Pandemic low', priority: 1 },
    { type: 'text', x: '2021-01-01', y: 22, text: 'Recovery begins', priority: 2 },
    { type: 'text', x: '2021-06-01', y: 28, text: 'Strong rebound', priority: 4 },
    { type: 'text', x: '2022-01-01', y: 35, text: 'New high', priority: 5 },
    { type: 'text', x: '2023-01-01', y: 42, text: 'Record territory', priority: 6 },
  ],
  chrome: {
    title: 'Auto-Thinning Torture Test',
    subtitle: '6 annotations at different priorities',
    source: 'Source: Sample data',
  },
};

const pinnedSpec: ChartSpec = {
  ...annotationHeavySpec,
  annotations: [
    { type: 'text', x: '2020-06-01', y: 8, text: 'Always visible', responsive: false, priority: 1 },
    { type: 'text', x: '2021-01-01', y: 22, text: 'May thin', priority: 2 },
    { type: 'text', x: '2021-06-01', y: 28, text: 'Lower priority', priority: 5 },
    { type: 'text', x: '2022-01-01', y: 35, text: 'May thin too', priority: 4 },
    { type: 'text', x: '2023-01-01', y: 42, text: 'Lowest priority', priority: 6 },
  ],
  chrome: {
    title: 'Pinned Annotations',
    subtitle: 'First annotation has responsive: false',
    source: 'Source: Sample data',
  },
};

const disabledSpec: ChartSpec = {
  ...annotationHeavySpec,
  responsive: { autoThin: false },
  chrome: {
    title: 'Auto-Thinning Disabled',
    subtitle: 'responsive: { autoThin: false }',
    source: 'Source: Sample data',
  },
};

export const AnnotationThinning = () => (
  <div className="story-column-tight">
    <div>
      <h3 className="story-heading">800px - All annotations inline</h3>
      <div className="story-debug-border" style={{ width: 800, height: 400 }}>
        <Chart spec={annotationHeavySpec} />
      </div>
    </div>
    <div>
      <h3 className="story-heading">600px - Some may thin</h3>
      <div className="story-debug-border" style={{ width: 600, height: 350 }}>
        <Chart spec={annotationHeavySpec} />
      </div>
    </div>
    <div>
      <h3 className="story-heading">400px - More thinning</h3>
      <div className="story-debug-border" style={{ width: 400, height: 300 }}>
        <Chart spec={annotationHeavySpec} />
      </div>
    </div>
    <div>
      <h3 className="story-heading">320px - Maximum thinning</h3>
      <div className="story-debug-border" style={{ width: 320, height: 300 }}>
        <Chart spec={annotationHeavySpec} />
      </div>
    </div>
  </div>
);

export const PinnedAnnotations = () => (
  <div className="story-column-tight">
    <div>
      <h3 className="story-heading">800px - All visible</h3>
      <div className="story-debug-border" style={{ width: 800, height: 400 }}>
        <Chart spec={pinnedSpec} />
      </div>
    </div>
    <div>
      <h3 className="story-heading">320px - Pinned stays, others may thin</h3>
      <div className="story-debug-border" style={{ width: 320, height: 300 }}>
        <Chart spec={pinnedSpec} />
      </div>
    </div>
  </div>
);

export const AutoThinDisabled = () => (
  <div className="story-column-tight">
    <div>
      <h3 className="story-heading">320px with autoThin: false</h3>
      <div className="story-debug-border" style={{ width: 320, height: 300 }}>
        <Chart spec={disabledSpec} />
      </div>
    </div>
  </div>
);
