/**
 * Responsive stories.
 *
 * Demonstrates charts at different widths and heights, showing how the
 * layout strategy adapts: legend position, axis density, chrome compression,
 * font scaling, padding scaling, and label auto-rotation.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import { useState } from 'react';

const spec: ChartSpec = {
  mark: 'line',
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

// Many-series spec for legend overflow testing
const manySeriesSpec: ChartSpec = {
  mark: 'line',
  data: Array.from({ length: 8 }, (_, seriesIdx) =>
    Array.from({ length: 4 }, (_, i) => ({
      date: `${2020 + i}-01-01`,
      value: Math.round(10 + Math.random() * 40),
      category: `Series ${String.fromCharCode(65 + seriesIdx)}`,
    })),
  ).flat(),
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
    color: { field: 'category', type: 'nominal' },
  },
  chrome: {
    title: 'Many Series Legend Test',
    subtitle: '8 series to test legend overflow',
  },
};

// Column chart with many categories for label rotation testing
const columnSpec: ChartSpec = {
  mark: 'bar',
  data: [
    'United States',
    'United Kingdom',
    'Germany',
    'France',
    'Japan',
    'Canada',
    'Australia',
    'Brazil',
    'India',
    'South Korea',
    'Netherlands',
    'Switzerland',
  ].map((country) => ({ country, value: Math.round(20 + Math.random() * 80) })),
  encoding: {
    x: { field: 'country', type: 'nominal' },
    y: { field: 'value', type: 'quantitative' },
  },
  chrome: {
    title: 'GDP by Country',
    subtitle: '12 categories test label auto-rotation at narrow widths',
    source: 'Source: Sample data',
  },
};

// Long title spec for wrapping/collision testing
const longTitleSpec: ChartSpec = {
  mark: 'line',
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
    title: 'Global Economic Recovery Trends Show Surprising Resilience Across Major Markets',
    subtitle: 'Year-over-year comparison of key economic indicators',
    source: 'Source: International Monetary Fund, 2024',
  },
};

export const LongTitleWrapping = () => (
  <div className="story-column-tight">
    <div>
      <h3 className="story-heading">
        Long title at 320px - Title wraps, no collision with subtitle
      </h3>
      <div className="story-debug-border" style={{ width: 320, height: 350 }}>
        <Chart spec={longTitleSpec} />
      </div>
    </div>
    <div>
      <h3 className="story-heading">Long title at 400px - Title may wrap</h3>
      <div className="story-debug-border" style={{ width: 400, height: 350 }}>
        <Chart spec={longTitleSpec} />
      </div>
    </div>
    <div>
      <h3 className="story-heading">Long title at 600px - Title fits on one line</h3>
      <div className="story-debug-border" style={{ width: 600, height: 350 }}>
        <Chart spec={longTitleSpec} />
      </div>
    </div>
    <div>
      <h3 className="story-heading">Long title at 800px - Full width</h3>
      <div className="story-debug-border" style={{ width: 800, height: 400 }}>
        <Chart spec={longTitleSpec} />
      </div>
    </div>
  </div>
);

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

export const HeightVariations = () => (
  <div className="story-column-tight">
    <div>
      <h3 className="story-heading">Wide + Short (800x150) - Chrome hidden (cramped)</h3>
      <div className="story-debug-border" style={{ width: 800, height: 150 }}>
        <Chart spec={spec} />
      </div>
    </div>
    <div>
      <h3 className="story-heading">Wide + Short (800x250) - Chrome compact (short)</h3>
      <div className="story-debug-border" style={{ width: 800, height: 250 }}>
        <Chart spec={spec} />
      </div>
    </div>
    <div>
      <h3 className="story-heading">Compact + Short (400x200) - Double squeeze</h3>
      <div className="story-debug-border" style={{ width: 400, height: 200 }}>
        <Chart spec={spec} />
      </div>
    </div>
    <div>
      <h3 className="story-heading">Narrow + Tall (300x500) - Portrait layout</h3>
      <div className="story-debug-border" style={{ width: 300, height: 500 }}>
        <Chart spec={spec} />
      </div>
    </div>
  </div>
);

export const ExtremeRatios = () => (
  <div className="story-column-tight">
    <div>
      <h3 className="story-heading">Ultra-wide (1000x100) - Chrome stripped, minimal ticks</h3>
      <div className="story-debug-border" style={{ width: 1000, height: 100 }}>
        <Chart spec={spec} />
      </div>
    </div>
    <div>
      <h3 className="story-heading">Tall + Narrow (200x400) - Extreme portrait</h3>
      <div className="story-debug-border" style={{ width: 200, height: 400 }}>
        <Chart spec={spec} />
      </div>
    </div>
    <div>
      <h3 className="story-heading">Tiny (250x180) - Everything compressed</h3>
      <div className="story-debug-border" style={{ width: 250, height: 180 }}>
        <Chart spec={spec} />
      </div>
    </div>
  </div>
);

export const ManySeriesCompact = () => (
  <div className="story-column-tight">
    <div>
      <h3 className="story-heading">8 series at 320px - Legend truncation</h3>
      <div className="story-debug-border" style={{ width: 320, height: 350 }}>
        <Chart spec={manySeriesSpec} />
      </div>
    </div>
    <div>
      <h3 className="story-heading">8 series at 500px - Medium legend</h3>
      <div className="story-debug-border" style={{ width: 500, height: 350 }}>
        <Chart spec={manySeriesSpec} />
      </div>
    </div>
    <div>
      <h3 className="story-heading">8 series at 800px - Full legend on right</h3>
      <div className="story-debug-border" style={{ width: 800, height: 400 }}>
        <Chart spec={manySeriesSpec} />
      </div>
    </div>
  </div>
);

export const ColumnNarrow = () => (
  <div className="story-column-tight">
    <div>
      <h3 className="story-heading">12 categories at 320px - Labels should rotate</h3>
      <div className="story-debug-border" style={{ width: 320, height: 350 }}>
        <Chart spec={columnSpec} />
      </div>
    </div>
    <div>
      <h3 className="story-heading">12 categories at 500px - May rotate</h3>
      <div className="story-debug-border" style={{ width: 500, height: 350 }}>
        <Chart spec={columnSpec} />
      </div>
    </div>
    <div>
      <h3 className="story-heading">12 categories at 900px - Labels fit normally</h3>
      <div className="story-debug-border" style={{ width: 900, height: 400 }}>
        <Chart spec={columnSpec} />
      </div>
    </div>
  </div>
);

export const ResizableContainer = () => {
  const [width, setWidth] = useState(600);
  const [height, setHeight] = useState(400);

  return (
    <div>
      <div className="story-heading" style={{ marginBottom: 12, display: 'flex', gap: 24 }}>
        <label>
          Width: {width}px
          <input
            type="range"
            min={150}
            max={1000}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            style={{ marginLeft: 8, width: 150 }}
          />
        </label>
        <label>
          Height: {height}px
          <input
            type="range"
            min={80}
            max={600}
            value={height}
            onChange={(e) => setHeight(Number(e.target.value))}
            style={{ marginLeft: 8, width: 150 }}
          />
        </label>
      </div>
      <div
        className="story-debug-border"
        style={{ width, height, transition: 'width 0.1s, height 0.1s' }}
      >
        <Chart spec={spec} />
      </div>
    </div>
  );
};
