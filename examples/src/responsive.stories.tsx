/**
 * Responsive stories.
 *
 * Demonstrates charts at different widths, showing how the layout
 * strategy changes (legend position, axis density) at breakpoints.
 */

import type { ChartSpec } from '@openchart/core';
import { Chart } from '@openchart/react';
import { useState } from 'react';

const spec: ChartSpec = {
  type: 'line',
  data: [
    { date: '2020-01-01', value: 10, category: 'Alpha' },
    { date: '2021-01-01', value: 30, category: 'Alpha' },
    { date: '2022-01-01', value: 25, category: 'Alpha' },
    { date: '2023-01-01', value: 45, category: 'Alpha' },
    { date: '2020-01-01', value: 20, category: 'Beta' },
    { date: '2021-01-01', value: 15, category: 'Beta' },
    { date: '2022-01-01', value: 35, category: 'Beta' },
    { date: '2023-01-01', value: 30, category: 'Beta' },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
    color: { field: 'category', type: 'nominal' },
  },
  chrome: {
    title: 'Responsive Chart',
    subtitle: 'Drag the slider to resize',
    source: 'Source: Sample data',
  },
};

export const FixedWidths = () => (
  <div className="story-column-tight">
    <div>
      <h3 className="story-heading">Compact (320px) - Legend on top</h3>
      <div className="story-debug-border" style={{ width: 320, height: 300 }}>
        <Chart spec={spec} />
      </div>
    </div>
    <div>
      <h3 className="story-heading">Medium (500px) - Legend on top</h3>
      <div className="story-debug-border" style={{ width: 500, height: 350 }}>
        <Chart spec={spec} />
      </div>
    </div>
    <div>
      <h3 className="story-heading">Full (800px) - Legend on right</h3>
      <div className="story-debug-border" style={{ width: 800, height: 400 }}>
        <Chart spec={spec} />
      </div>
    </div>
  </div>
);

export const ResizableContainer = () => {
  const [width, setWidth] = useState(600);

  return (
    <div>
      <div className="story-heading" style={{ marginBottom: 12 }}>
        <label>
          Width: {width}px
          <input
            type="range"
            min={200}
            max={900}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            style={{ marginLeft: 12, width: 200 }}
          />
        </label>
      </div>
      <div className="story-debug-border" style={{ width, height: 400, transition: 'width 0.1s' }}>
        <Chart spec={spec} />
      </div>
    </div>
  );
};
