/**
 * Animation showcase stories.
 *
 * Exercises the full surface area of the animation system:
 * easing presets, stagger modes, per-mark overrides, duration
 * comparisons, and mark-type-specific entrance behavior.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';

// ---------------------------------------------------------------------------
// Shared data for easing comparison stories
// ---------------------------------------------------------------------------

// Gradient fill helpers for bar/column marks (opacity 0.4 -> 1)
const hBarGradient = (color: string) => ({
  gradient: 'linear' as const,
  x1: 0,
  y1: 0,
  x2: 1,
  y2: 0,
  stops: [
    { offset: 0, color, opacity: 0.4 },
    { offset: 1, color },
  ],
});

const vBarGradient = (color: string) => ({
  gradient: 'linear' as const,
  x1: 0,
  y1: 1,
  x2: 0,
  y2: 0,
  stops: [
    { offset: 0, color, opacity: 0.4 },
    { offset: 1, color },
  ],
});

const easingData = [
  { category: 'Engineering', value: 142 },
  { category: 'Design', value: 98 },
  { category: 'Marketing', value: 76 },
  { category: 'Sales', value: 115 },
  { category: 'Support', value: 63 },
  { category: 'Product', value: 89 },
];

const easingEncoding = {
  x: { field: 'value', type: 'quantitative' as const, axis: { title: 'Headcount' } },
  y: { field: 'category', type: 'nominal' as const, axis: { title: '' } },
};

// ---------------------------------------------------------------------------
// 1. BarSmooth: Default smooth easing on bars
// ---------------------------------------------------------------------------

const barSmoothSpec: ChartSpec = {
  mark: { type: 'bar', fill: hBarGradient('#1b7fa3') },
  data: easingData,
  encoding: easingEncoding,
  chrome: {
    title: 'Smooth Easing (Default)',
    subtitle: 'Decelerating ease-out, clean deceleration',
  },
  animation: true,
};

export const BarSmooth = () => (
  <div className="story-chart story-h-420">
    <Chart spec={barSmoothSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// 2. BarSnappy: Snappy easing
// ---------------------------------------------------------------------------

const barSnappySpec: ChartSpec = {
  mark: { type: 'bar', fill: hBarGradient('#1b7fa3') },
  data: easingData,
  encoding: easingEncoding,
  chrome: { title: 'Snappy Easing', subtitle: 'Fast attack, gentle settle' },
  animation: { enter: { ease: 'snappy' } },
};

export const BarSnappy = () => (
  <div className="story-chart story-h-420">
    <Chart spec={barSnappySpec} />
  </div>
);

// ---------------------------------------------------------------------------
// 5. ColumnStagger: Vertical columns with value-ordered stagger
// ---------------------------------------------------------------------------

const columnStaggerSpec: ChartSpec = {
  mark: { type: 'bar', fill: vBarGradient('#1b7fa3') },
  data: [
    { month: 'Jan', revenue: 42 },
    { month: 'Feb', revenue: 38 },
    { month: 'Mar', revenue: 55 },
    { month: 'Apr', revenue: 47 },
    { month: 'May', revenue: 61 },
    { month: 'Jun', revenue: 58 },
    { month: 'Jul', revenue: 72 },
    { month: 'Aug', revenue: 68 },
    { month: 'Sep', revenue: 53 },
    { month: 'Oct', revenue: 49 },
    { month: 'Nov', revenue: 65 },
    { month: 'Dec', revenue: 78 },
  ],
  encoding: {
    x: { field: 'month', type: 'ordinal' },
    y: { field: 'revenue', type: 'quantitative', axis: { title: 'Revenue ($K)', format: '$,.0f' } },
  },
  chrome: {
    title: 'Value-Ordered Stagger',
    subtitle: 'Elements reveal ordered by data value, not position',
  },
  animation: { enter: { stagger: { delay: 50, order: 'value' } } },
};

export const ColumnStagger = () => (
  <div className="story-chart story-h-420">
    <Chart spec={columnStaggerSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// 6. LineDrawing: Line chart path drawing animation
// ---------------------------------------------------------------------------

const lineDrawingSpec: ChartSpec = {
  mark: { type: 'area', interpolate: 'monotone' },
  data: [
    { date: '2024-01', series: 'Product A', value: 120 },
    { date: '2024-02', series: 'Product A', value: 135 },
    { date: '2024-03', series: 'Product A', value: 128 },
    { date: '2024-04', series: 'Product A', value: 152 },
    { date: '2024-05', series: 'Product A', value: 168 },
    { date: '2024-06', series: 'Product A', value: 155 },
    { date: '2024-07', series: 'Product A', value: 172 },
    { date: '2024-08', series: 'Product A', value: 189 },
    { date: '2024-09', series: 'Product A', value: 178 },
    { date: '2024-10', series: 'Product A', value: 195 },
    { date: '2024-11', series: 'Product A', value: 210 },
    { date: '2024-12', series: 'Product A', value: 225 },
    { date: '2024-01', series: 'Product B', value: 85 },
    { date: '2024-02', series: 'Product B', value: 92 },
    { date: '2024-03', series: 'Product B', value: 88 },
    { date: '2024-04', series: 'Product B', value: 105 },
    { date: '2024-05', series: 'Product B', value: 118 },
    { date: '2024-06', series: 'Product B', value: 112 },
    { date: '2024-07', series: 'Product B', value: 125 },
    { date: '2024-08', series: 'Product B', value: 138 },
    { date: '2024-09', series: 'Product B', value: 132 },
    { date: '2024-10', series: 'Product B', value: 148 },
    { date: '2024-11', series: 'Product B', value: 155 },
    { date: '2024-12', series: 'Product B', value: 162 },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: {
      field: 'value',
      type: 'quantitative',
      axis: { title: 'Monthly Revenue ($K)', grid: true, tickCount: 8 },
      scale: { domain: [0, 400] },
    },
    color: { field: 'series', type: 'nominal' },
  },
  legend: { position: 'top' },
  chrome: {
    title: 'Area Path Drawing',
    subtitle: 'Areas draw in via CSS clip-path reveal with opacity gradient',
  },
  animation: { enter: { duration: 1000, ease: 'smooth' } },
};

export const LineDrawing = () => (
  <div className="story-chart story-h-420">
    <Chart spec={lineDrawingSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// 7. PieAnimation: Arc mark entrance
// ---------------------------------------------------------------------------

const pieAnimationSpec: ChartSpec = {
  mark: 'arc',
  data: [
    { category: 'Desktop', share: 58.2 },
    { category: 'Mobile', share: 32.4 },
    { category: 'Tablet', share: 6.8 },
    { category: 'Other', share: 2.6 },
  ],
  encoding: {
    y: { field: 'share', type: 'quantitative' },
    color: { field: 'category', type: 'nominal' },
  },
  chrome: { title: 'Arc Entrance', subtitle: 'Pie slices scale and fade in from center' },
  animation: true,
};

export const PieAnimation = () => (
  <div className="story-chart story-h-420">
    <Chart spec={pieAnimationSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// 8. DonutAnimation: Donut with smooth easing
// ---------------------------------------------------------------------------

const donutAnimationSpec: ChartSpec = {
  mark: { type: 'arc', innerRadius: 50 },
  data: [
    { category: 'Desktop', share: 58.2 },
    { category: 'Mobile', share: 32.4 },
    { category: 'Tablet', share: 6.8 },
    { category: 'Other', share: 2.6 },
  ],
  encoding: {
    y: { field: 'share', type: 'quantitative' },
    color: { field: 'category', type: 'nominal' },
  },
  chrome: { title: 'Donut Entrance', subtitle: 'innerRadius: 50, smooth easing' },
  animation: true,
};

export const DonutAnimation = () => (
  <div className="story-chart story-h-420">
    <Chart spec={donutAnimationSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// 9. ScatterAnimation: Points fade+scale
// ---------------------------------------------------------------------------

const scatterSpec: ChartSpec = {
  mark: 'point',
  data: [
    { x: 12, y: 45, group: 'A' },
    { x: 28, y: 62, group: 'A' },
    { x: 35, y: 38, group: 'A' },
    { x: 42, y: 71, group: 'B' },
    { x: 55, y: 55, group: 'B' },
    { x: 18, y: 82, group: 'A' },
    { x: 62, y: 48, group: 'B' },
    { x: 72, y: 35, group: 'B' },
    { x: 48, y: 88, group: 'A' },
    { x: 38, y: 52, group: 'A' },
    { x: 82, y: 42, group: 'B' },
    { x: 25, y: 68, group: 'A' },
    { x: 58, y: 75, group: 'B' },
    { x: 68, y: 58, group: 'B' },
    { x: 15, y: 32, group: 'A' },
    { x: 78, y: 28, group: 'B' },
    { x: 45, y: 92, group: 'A' },
    { x: 32, y: 78, group: 'A' },
    { x: 88, y: 52, group: 'B' },
    { x: 52, y: 42, group: 'B' },
  ],
  encoding: {
    x: { field: 'x', type: 'quantitative' },
    y: { field: 'y', type: 'quantitative' },
    color: { field: 'group', type: 'nominal' },
  },
  chrome: {
    title: 'Scatter Point Entrance',
    subtitle: 'Points fade and scale in with snappy easing',
  },
  animation: { enter: { ease: 'snappy', stagger: { delay: 60 } } },
};

export const ScatterAnimation = () => (
  <div className="story-chart story-h-420">
    <Chart spec={scatterSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// 10. AreaAnimation: Area chart with draw + fade
// ---------------------------------------------------------------------------

const areaSpec: ChartSpec = {
  mark: {
    type: 'area',
    point: true,
    interpolate: 'monotone',
    fill: {
      gradient: 'linear',
      stops: [
        { offset: 0, color: '#6366f1', opacity: 0.8 },
        { offset: 1, color: '#6366f1', opacity: 0.05 },
      ],
    },
  },
  data: [
    { date: '2024-01', value: 220 },
    { date: '2024-02', value: 245 },
    { date: '2024-03', value: 238 },
    { date: '2024-04', value: 272 },
    { date: '2024-05', value: 295 },
    { date: '2024-06', value: 288 },
    { date: '2024-07', value: 312 },
    { date: '2024-08', value: 328 },
    { date: '2024-09', value: 315 },
    { date: '2024-10', value: 342 },
    { date: '2024-11', value: 365 },
    { date: '2024-12', value: 378 },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: {
      field: 'value',
      type: 'quantitative',
      axis: { title: 'Daily Active Users' },
      scale: { domain: [180, 400] },
    },
  },
  chrome: {
    title: 'Area Entrance',
    subtitle: 'Opacity gradient fades from solid to transparent at baseline',
  },
  animation: { enter: { duration: 1200 } },
};

export const AreaAnimation = () => (
  <div className="story-chart story-h-420">
    <Chart spec={areaSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// 11. SlowLineWithPoints: Long duration line with point markers
// ---------------------------------------------------------------------------

const slowLineSpec: ChartSpec = {
  mark: { type: 'line', point: true, interpolate: 'monotone' },
  data: [
    { date: '2024-01', value: 120 },
    { date: '2024-02', value: 135 },
    { date: '2024-03', value: 118 },
    { date: '2024-04', value: 152 },
    { date: '2024-05', value: 141 },
    { date: '2024-06', value: 168 },
    { date: '2024-07', value: 155 },
    { date: '2024-08', value: 189 },
    { date: '2024-09', value: 172 },
    { date: '2024-10', value: 195 },
    { date: '2024-11', value: 182 },
    { date: '2024-12', value: 210 },
    { date: '2025-01', value: 198 },
    { date: '2025-02', value: 225 },
    { date: '2025-03', value: 215 },
    { date: '2025-04', value: 242 },
    { date: '2025-05', value: 230 },
    { date: '2025-06', value: 258 },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: {
      field: 'value',
      type: 'quantitative',
      scale: { domain: [100, 270] },
      axis: { grid: true, tickCount: 8 },
    },
  },
  chrome: {
    title: 'Slow Line Draw',
    subtitle: 'Extended duration (1200ms) with point markers delayed',
  },
  animation: {
    enter: {
      ease: 'smooth',
      duration: 1200,
    },
  },
};

export const SlowLineWithPoints = () => (
  <div className="story-chart story-h-420">
    <Chart spec={slowLineSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// 12. ManyBars: Large element count to test auto-stagger clamping
// ---------------------------------------------------------------------------

const manyBarsSpec: ChartSpec = {
  mark: { type: 'bar', fill: hBarGradient('#1b7fa3') },
  data: Array.from({ length: 50 }, (_, i) => ({
    category: `Item ${String(i + 1).padStart(2, '0')}`,
    value: Math.round(20 + Math.random() * 80),
  })),
  encoding: {
    x: { field: 'value', type: 'quantitative' },
    y: { field: 'category', type: 'nominal', axis: { tickCount: 10 } },
  },
  labels: { density: 'none' },
  chrome: {
    title: 'Auto-Stagger Clamping',
    subtitle: '50 bars: stagger auto-reduces to cap total at ~2s',
  },
  animation: { enter: { stagger: { delay: 60 } } },
};

export const ManyBars = () => (
  <div className="story-chart story-h-420">
    <Chart spec={manyBarsSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// 13. CustomDuration: Fast vs slow side-by-side comparison
// ---------------------------------------------------------------------------

const durationData = easingData;
const durationEncoding = easingEncoding;

const fastSpec: ChartSpec = {
  mark: { type: 'bar', fill: hBarGradient('#1b7fa3') },
  data: durationData,
  encoding: durationEncoding,
  chrome: { title: 'Fast (300ms)', subtitle: 'Snappy easing, quick reveal' },
  animation: { enter: { duration: 300, ease: 'snappy' } },
};

const slowSpec: ChartSpec = {
  mark: { type: 'bar', fill: hBarGradient('#1b7fa3') },
  data: durationData,
  encoding: durationEncoding,
  chrome: { title: 'Slow (1200ms)', subtitle: 'Smooth easing, gradual reveal' },
  animation: { enter: { duration: 1200, ease: 'smooth' } },
};

export const CustomDuration = () => (
  <div style={{ display: 'flex', gap: '16px' }}>
    <div className="story-chart story-h-420" style={{ flex: 1 }}>
      <Chart spec={fastSpec} />
    </div>
    <div className="story-chart story-h-420" style={{ flex: 1 }}>
      <Chart spec={slowSpec} />
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// 14. AnnotationDelay: Annotations fade in after marks
// ---------------------------------------------------------------------------

const annotationDelaySpec: ChartSpec = {
  mark: {
    type: 'area',
    point: true,
    interpolate: 'monotone',
    fill: {
      gradient: 'linear',
      stops: [
        { offset: 0, color: '#0ea5e9', opacity: 0.7 },
        { offset: 0.6, color: '#0ea5e9', opacity: 0.25 },
        { offset: 1, color: '#0ea5e9', opacity: 0.02 },
      ],
    },
  },
  data: [
    { month: '2023-07', score: 38 },
    { month: '2023-08', score: 41 },
    { month: '2023-09', score: 39 },
    { month: '2023-10', score: 43 },
    { month: '2023-11', score: 40 },
    { month: '2023-12', score: 44 },
    { month: '2024-01', score: 46 },
    { month: '2024-02', score: 42 },
    { month: '2024-03', score: 48 },
    { month: '2024-04', score: 53 },
    { month: '2024-05', score: 67 },
    { month: '2024-06', score: 62 },
    { month: '2024-07', score: 71 },
    { month: '2024-08', score: 68 },
    { month: '2024-09', score: 74 },
    { month: '2024-10', score: 78 },
    { month: '2024-11', score: 85 },
    { month: '2024-12', score: 92 },
  ],
  encoding: {
    x: { field: 'month', type: 'temporal', scale: { domain: ['2023-07', '2024-12'] } },
    y: {
      field: 'score',
      type: 'quantitative',
      axis: { title: 'NPS Score' },
      scale: { domain: [25, 100] },
    },
  },
  annotations: [
    {
      type: 'text',
      text: 'Product relaunch',
      x: '2024-04',
      y: 53,
      offset: { dx: -80, dy: -18 },
      connector: true,
    },
    {
      type: 'refline',
      y: 70,
      label: 'Target NPS',
      labelAnchor: 'top',
    },
  ],
  chrome: {
    title: 'Customer Satisfaction Surges After Relaunch',
    subtitle: 'Net Promoter Score, Jul 2023 - Dec 2024',
    source: 'Source: Quarterly customer surveys',
    byline: 'Chart: OpenChart',
  },
  animation: { enter: { duration: 1000, ease: 'smooth' }, annotationDelay: 400 },
};

export const AnnotationDelay = () => (
  <div className="story-chart story-h-420">
    <Chart spec={annotationDelaySpec} />
  </div>
);

// ---------------------------------------------------------------------------
// 15. NoStagger: All elements animate simultaneously
// ---------------------------------------------------------------------------

const noStaggerSpec: ChartSpec = {
  mark: { type: 'bar', fill: hBarGradient('#1b7fa3') },
  data: easingData,
  encoding: easingEncoding,
  chrome: { title: 'No Stagger', subtitle: 'All elements animate simultaneously' },
  animation: { enter: { stagger: false } },
};

export const NoStagger = () => (
  <div className="story-chart story-h-420">
    <Chart spec={noStaggerSpec} />
  </div>
);
