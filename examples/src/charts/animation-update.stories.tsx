/**
 * Data-update transition stories.
 *
 * Interactive column chart with buttons to add/remove/randomize data,
 * demonstrating smooth transitions between data states.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import { useState } from 'react';

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

const CATEGORIES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const INITIAL_DATA = [
  { month: 'Jan', sales: 120 },
  { month: 'Feb', sales: 200 },
  { month: 'Mar', sales: 150 },
  { month: 'Apr', sales: 80 },
  { month: 'May', sales: 250 },
  { month: 'Jun', sales: 180 },
];

const ALT_DATA = [
  { month: 'Mar', sales: 300 },
  { month: 'Apr', sales: 220 },
  { month: 'May', sales: 160 },
  { month: 'Jun', sales: 90 },
  { month: 'Jul', sales: 270 },
  { month: 'Aug', sales: 200 },
];

function randomValue() {
  return Math.round(50 + Math.random() * 300);
}

// ---------------------------------------------------------------------------
// Story component
// ---------------------------------------------------------------------------

function AnimationUpdateDemo() {
  const [data, setData] = useState(INITIAL_DATA);
  const [useAlt, setUseAlt] = useState(false);

  const spec: ChartSpec = {
    animation: true,
    mark: 'bar',
    data,
    encoding: {
      x: { field: 'month', type: 'nominal' },
      y: {
        field: 'sales',
        type: 'quantitative',
        axis: { title: 'Sales ($K)' },
      },
    },
    chrome: {
      title: 'Monthly Sales Performance',
      subtitle: 'Click buttons below to see data-update transitions',
    },
  };

  const addPoint = () => {
    const usedMonths = new Set(data.map((d) => d.month));
    const next = CATEGORIES.find((c) => !usedMonths.has(c));
    if (!next) return;
    setData([...data, { month: next, sales: randomValue() }]);
  };

  const removePoint = () => {
    if (data.length <= 1) return;
    setData(data.slice(0, -1));
  };

  const randomize = () => {
    setData(data.map((d) => ({ ...d, sales: randomValue() })));
  };

  const replaceDataset = () => {
    setUseAlt(!useAlt);
    setData(useAlt ? INITIAL_DATA : ALT_DATA);
  };

  return (
    <div>
      <div className="story-chart story-h-420">
        <Chart spec={spec} />
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '8px 0' }}>
        <button type="button" onClick={addPoint}>
          Add point
        </button>
        <button type="button" onClick={removePoint}>
          Remove point
        </button>
        <button type="button" onClick={randomize}>
          Randomize values
        </button>
        <button type="button" onClick={replaceDataset}>
          Replace dataset
        </button>
      </div>
    </div>
  );
}

export const UpdateTransitions = () => <AnimationUpdateDemo />;

// ---------------------------------------------------------------------------
// Line chart transitions
// ---------------------------------------------------------------------------

const LINE_INITIAL = [
  { month: 'Jan', sales: 120 },
  { month: 'Feb', sales: 200 },
  { month: 'Mar', sales: 150 },
  { month: 'Apr', sales: 80 },
  { month: 'May', sales: 250 },
  { month: 'Jun', sales: 180 },
];

const LINE_ALT = [
  { month: 'Mar', sales: 300 },
  { month: 'Apr', sales: 220 },
  { month: 'May', sales: 160 },
  { month: 'Jun', sales: 90 },
  { month: 'Jul', sales: 270 },
  { month: 'Aug', sales: 200 },
];

function LineTransitionDemo() {
  const [data, setData] = useState(LINE_INITIAL);
  const [useAlt, setUseAlt] = useState(false);

  const spec: ChartSpec = {
    animation: true,
    mark: { type: 'line', point: true },
    data,
    encoding: {
      x: { field: 'month', type: 'ordinal' },
      y: {
        field: 'sales',
        type: 'quantitative',
        axis: { title: 'Sales ($K)' },
      },
    },
    chrome: {
      title: 'Line Chart Transitions',
      subtitle: 'Add/remove points to see line morphing',
    },
  };

  const addPoint = () => {
    const usedMonths = new Set(data.map((d) => d.month));
    const next = CATEGORIES.find((c) => !usedMonths.has(c));
    if (!next) return;
    setData([...data, { month: next, sales: randomValue() }]);
  };

  const removePoint = () => {
    if (data.length <= 1) return;
    setData(data.slice(0, -1));
  };

  const randomize = () => {
    setData(data.map((d) => ({ ...d, sales: randomValue() })));
  };

  const replaceDataset = () => {
    setUseAlt(!useAlt);
    setData(useAlt ? LINE_INITIAL : LINE_ALT);
  };

  return (
    <div>
      <div className="story-chart story-h-420">
        <Chart spec={spec} />
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '8px 0' }}>
        <button type="button" onClick={addPoint}>
          Add point
        </button>
        <button type="button" onClick={removePoint}>
          Remove point
        </button>
        <button type="button" onClick={randomize}>
          Randomize values
        </button>
        <button type="button" onClick={replaceDataset}>
          Replace dataset
        </button>
      </div>
    </div>
  );
}

export const LineTransitions = () => <LineTransitionDemo />;

// ---------------------------------------------------------------------------
// Area chart transitions
// ---------------------------------------------------------------------------

function AreaTransitionDemo() {
  const [data, setData] = useState(LINE_INITIAL);
  const [useAlt, setUseAlt] = useState(false);

  const spec: ChartSpec = {
    animation: true,
    mark: 'area',
    data,
    encoding: {
      x: { field: 'month', type: 'ordinal' },
      y: {
        field: 'sales',
        type: 'quantitative',
        axis: { title: 'Sales ($K)' },
      },
    },
    chrome: {
      title: 'Area Chart Transitions',
      subtitle: 'Add/remove points to see area morphing',
    },
  };

  const addPoint = () => {
    const usedMonths = new Set(data.map((d) => d.month));
    const next = CATEGORIES.find((c) => !usedMonths.has(c));
    if (!next) return;
    setData([...data, { month: next, sales: randomValue() }]);
  };

  const removePoint = () => {
    if (data.length <= 1) return;
    setData(data.slice(0, -1));
  };

  const randomize = () => {
    setData(data.map((d) => ({ ...d, sales: randomValue() })));
  };

  const replaceDataset = () => {
    setUseAlt(!useAlt);
    setData(useAlt ? LINE_INITIAL : LINE_ALT);
  };

  return (
    <div>
      <div className="story-chart story-h-420">
        <Chart spec={spec} />
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '8px 0' }}>
        <button type="button" onClick={addPoint}>
          Add point
        </button>
        <button type="button" onClick={removePoint}>
          Remove point
        </button>
        <button type="button" onClick={randomize}>
          Randomize values
        </button>
        <button type="button" onClick={replaceDataset}>
          Replace dataset
        </button>
      </div>
    </div>
  );
}

export const AreaTransitions = () => <AreaTransitionDemo />;
