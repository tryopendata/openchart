/**
 * Motion / Compare: a review page for entrance and update motion.
 *
 * A dev page for eyeballing entrance tuning (plans/motion-polish.md). Each
 * section names what to look for. Not a gallery page: no Demo/Section anchors,
 * no demos sidecar, and it is deliberately absent from the explicit story list
 * in e2e/visual/stories.spec.ts so it never enters the visual baseline set.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import { type CSSProperties, useEffect, useState } from 'react';

const ACCENT = '#0e7490';

type Trigger = 'visible' | 'mount';

/** `visible` is the library default (`animation: true`); `mount` opts out of play-when-seen. */
function withMotion(spec: ChartSpec, trigger: Trigger): ChartSpec {
  const animation = trigger === 'mount' ? { enter: { trigger: 'mount' as const } } : true;
  return { ...spec, animation } as ChartSpec;
}

/** Deterministic pseudo-random so replays draw the same data. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

// ---------------------------------------------------------------------------
// Specs
// ---------------------------------------------------------------------------

const teams = [
  { label: 'Engineering', value: 142 },
  { label: 'Product', value: 118 },
  { label: 'Sales', value: 96 },
  { label: 'Design', value: 71 },
  { label: 'Support', value: 44 },
];

const barSpec: ChartSpec = {
  mark: { type: 'bar', fill: ACCENT },
  data: teams,
  encoding: {
    x: { field: 'value', type: 'quantitative' },
    y: { field: 'label', type: 'nominal', sort: '-x' },
  },
  chrome: { title: 'Headcount by team' },
};

const columnSpec: ChartSpec = {
  mark: { type: 'bar', fill: ACCENT },
  data: teams,
  encoding: {
    x: { field: 'label', type: 'nominal' },
    y: { field: 'value', type: 'quantitative' },
  },
  chrome: { title: 'Headcount by team (columns)' },
};

const stackedSpec: ChartSpec = {
  mark: { type: 'bar' },
  data: ['Q1', 'Q2', 'Q3', 'Q4'].flatMap((q, i) => [
    { quarter: q, region: 'North', value: 30 + i * 6 },
    { quarter: q, region: 'South', value: 22 + i * 3 },
    { quarter: q, region: 'West', value: 16 + i * 8 },
  ]),
  encoding: {
    x: { field: 'quarter', type: 'ordinal' },
    y: { field: 'value', type: 'quantitative', stack: 'zero' },
    color: { field: 'region', type: 'nominal' },
  },
  labels: true,
  chrome: { title: 'Revenue by region' },
};

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pointLineSpec: ChartSpec = {
  mark: { type: 'line', point: true, stroke: ACCENT, strokeWidth: 2 },
  data: months.map((m, i) => ({ month: m, value: 30 + i * 3 + ((i * 7) % 5) * 4 })),
  encoding: {
    x: { field: 'month', type: 'ordinal' },
    y: { field: 'value', type: 'quantitative' },
  },
  chrome: { title: 'Monthly signups' },
};

const lineSpec: ChartSpec = {
  mark: { type: 'line' },
  data: months.flatMap((m, i) => [
    { month: m, series: 'A', value: 20 + i * 4 + (i % 3) * 3 },
    { month: m, series: 'B', value: 55 - i * 2 + (i % 4) * 4 },
  ]),
  encoding: {
    x: { field: 'month', type: 'ordinal' },
    y: { field: 'value', type: 'quantitative' },
    color: { field: 'series', type: 'nominal' },
  },
  chrome: { title: 'Two series over a year' },
};

const donutSpec: ChartSpec = {
  mark: { type: 'arc', innerRadius: 70 },
  data: [
    { category: 'Housing', value: 34 },
    { category: 'Food', value: 22 },
    { category: 'Transport', value: 18 },
    { category: 'Health', value: 14 },
    { category: 'Other', value: 12 },
  ],
  encoding: {
    theta: { field: 'value', type: 'quantitative' },
    color: { field: 'category', type: 'nominal' },
  },
  chrome: { title: 'Spending mix' },
};

const scatterRand = seeded(42);
const scatterSpec: ChartSpec = {
  mark: { type: 'point' },
  data: Array.from({ length: 60 }, (_, i) => {
    const x = scatterRand() * 100;
    return { id: i, x, y: x * 0.6 + scatterRand() * 40 };
  }),
  encoding: {
    x: { field: 'x', type: 'quantitative' },
    y: { field: 'y', type: 'quantitative' },
  },
  chrome: { title: 'Correlated points' },
};

const calendarRand = seeded(7);
const calendarSpec: ChartSpec = {
  mark: 'calendar',
  data: Array.from({ length: 365 * 2 }, (_, i) => {
    const day = i % 365;
    const season = 1 - Math.abs((day / 365) * 4 - 2);
    return {
      date: new Date(Date.UTC(2023, 0, 1) + i * 86400000).toISOString().slice(0, 10),
      reports: Math.round(20 + i * 0.02 + season * 8 + calendarRand() * 10),
    };
  }),
  encoding: {
    x: { field: 'date', type: 'temporal' },
    color: { field: 'reports', type: 'quantitative' },
  },
  chrome: { title: 'Daily reports, 2023-2024' },
};

const HOURS = ['9am', '11am', '1pm', '3pm', '5pm'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const heatmapRand = seeded(11);
const heatmapSpec: ChartSpec = {
  mark: 'rect',
  data: DAYS.flatMap((day) =>
    HOURS.map((hour) => ({ day, hour, visits: Math.round(20 + heatmapRand() * 80) })),
  ),
  encoding: {
    x: { field: 'hour', type: 'nominal' },
    y: { field: 'day', type: 'nominal' },
    color: { field: 'visits', type: 'quantitative' },
  },
  chrome: { title: 'Visits by weekday and hour' },
};

const sections: Array<{ id: string; label: string; look: string; spec: ChartSpec }> = [
  {
    id: 'bar',
    label: 'Horizontal bar',
    look: 'Bars grow from the axis; each value label fades in only once its bar has finished.',
    spec: barSpec,
  },
  {
    id: 'column',
    label: 'Column',
    look: 'Same as the bars, vertically.',
    spec: columnSpec,
  },
  {
    id: 'stacked',
    label: 'Stacked column with segment labels',
    look: 'Each stack grows as one shape; segment labels appear after their stack lands.',
    spec: stackedSpec,
  },
  {
    id: 'point-line',
    label: 'Line with points',
    look: 'The line draws first with no dots on it; then the dots pop in along it.',
    spec: pointLineSpec,
  },
  {
    id: 'line',
    label: 'Two-series line',
    look: 'Endpoint markers and labels wait until their own line reaches the end.',
    spec: lineSpec,
  },
  {
    id: 'donut',
    label: 'Donut',
    look: 'Slices fade and grow out from the centre, one after another.',
    spec: donutSpec,
  },
  {
    id: 'scatter',
    label: 'Scatter',
    look: 'Points fade in on a short stagger.',
    spec: scatterSpec,
  },
  {
    id: 'calendar',
    label: 'Calendar',
    look: 'Cells pop in scattered across the grid, not as a left-to-right wipe.',
    spec: calendarSpec,
  },
  {
    id: 'heatmap',
    label: 'Heatmap',
    look: 'Same scattered pop-in as the calendar.',
    spec: heatmapSpec,
  },
];

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

const chartBox: CSSProperties = { width: '100%', height: 360 };

function SectionRow({
  label,
  look,
  spec,
  trigger,
  nonce,
}: {
  label: string;
  look: string;
  spec: ChartSpec;
  trigger: Trigger;
  nonce: number;
}) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h3 style={{ margin: '0 0 4px' }}>{label}</h3>
      <p style={{ margin: '0 0 12px', opacity: 0.7 }}>{look}</p>
      <div style={chartBox} data-testid="oc-cell">
        <Chart key={`${nonce}-${trigger}`} spec={withMotion(spec, trigger)} />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 12-chart dashboard
// ---------------------------------------------------------------------------

const dashboardBases = [barSpec, pointLineSpec, stackedSpec, donutSpec, scatterSpec, heatmapSpec];
const dashboard: ChartSpec[] = Array.from({ length: 12 }, (_, i) => {
  const base = dashboardBases[i % dashboardBases.length];
  return { ...base, chrome: { title: `${base.chrome?.title ?? 'Chart'} (${i + 1})` } } as ChartSpec;
});

function Dashboard({ trigger, nonce }: { trigger: Trigger; nonce: number }) {
  return (
    <div
      data-testid="dashboard"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}
    >
      {dashboard.map((spec, i) => (
        <div key={`${i}-${nonce}-${trigger}`} style={{ height: 320 }}>
          <Chart spec={withMotion(spec, trigger)} />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live sparkline
// ---------------------------------------------------------------------------

const WINDOW = 30;

function LiveSparkline({ trigger, nonce }: { trigger: Trigger; nonce: number }) {
  const [series, setSeries] = useState(() =>
    Array.from({ length: WINDOW }, (_, t) => ({ t, value: 100 + Math.sin(t / 3) * 10 })),
  );

  useEffect(() => {
    const id = setInterval(() => {
      setSeries((prev) => {
        const last = prev[prev.length - 1];
        const t = (last?.t ?? 0) + 1;
        const value = (last?.value ?? 100) + (Math.random() - 0.5) * 12;
        return [...prev.slice(-(WINDOW - 1)), { t, value }];
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const spec: ChartSpec = {
    mark: { type: 'line' },
    data: series,
    encoding: {
      x: { field: 't', type: 'ordinal' },
      y: { field: 'value', type: 'quantitative' },
    },
    display: 'sparkline',
  };

  return (
    <div style={{ width: 360, height: 90 }} data-testid="live-sparkline">
      <Chart key={`${nonce}-${trigger}`} spec={withMotion(spec, trigger)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Playback speed (review aid): slows every running animation on the page.
// ---------------------------------------------------------------------------

function usePlaybackRate(rate: number, nonce: number) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: a Replay (new nonce) restarts the animations, so the rate must be reapplied
  useEffect(() => {
    if (rate === 1) return;
    const until = performance.now() + 4000 / rate;
    let frame = 0;
    const tick = () => {
      for (const a of document.getAnimations()) a.playbackRate = rate;
      if (performance.now() < until) frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [rate, nonce]);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default { title: 'Motion' };

export const Compare = () => {
  const [nonce, setNonce] = useState(0);
  const [trigger, setTrigger] = useState<Trigger>('visible');
  const [rate, setRate] = useState(1);
  usePlaybackRate(rate, nonce);

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: 24, color: 'inherit' }}>
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          alignItems: 'center',
          padding: '8px 0 16px',
        }}
      >
        <h2 style={{ margin: 0, flex: 1 }}>Motion compare</h2>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={trigger === 'mount'}
            onChange={(e) => setTrigger(e.target.checked ? 'mount' : 'visible')}
          />
          Play on mount
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          Speed
          <select value={rate} onChange={(e) => setRate(Number(e.target.value))}>
            <option value={1}>1x</option>
            <option value={0.5}>0.5x</option>
            <option value={0.25}>0.25x</option>
          </select>
        </label>
        <button type="button" onClick={() => setNonce((n) => n + 1)}>
          Replay
        </button>
      </header>

      {sections.map((s) => (
        <SectionRow
          key={s.id}
          label={s.label}
          look={s.look}
          spec={s.spec}
          trigger={trigger}
          nonce={nonce}
        />
      ))}

      <h3>Live sparkline (1 Hz)</h3>
      <LiveSparkline trigger={trigger} nonce={nonce} />

      <h3 style={{ marginTop: 40 }}>Dashboard (12 charts, default animation)</h3>
      <p style={{ opacity: 0.7 }}>
        Charts below the fold hold their from-state until scrolled into view.
      </p>
      <Dashboard trigger={trigger} nonce={nonce} />
    </div>
  );
};
