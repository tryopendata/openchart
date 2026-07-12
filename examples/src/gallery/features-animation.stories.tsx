/**
 * Features / Animation — entrance choreography and data-update transitions.
 *
 * Entrance animations are pure CSS: the engine resolves the AnimationSpec
 * (duration, ease smooth/snappy, stagger order, annotationDelay) and the SVG
 * renderer stamps the keyframes. Update/exit transitions run a rAF loop that
 * interpolates between two computed layouts, morphing marks by their key.
 *
 * Every entrance demo lazy-mounts on scroll (so the animation plays when the
 * card scrolls into view) and carries a Replay button that remounts the chart
 * via a changing React `key`, re-triggering the entrance without scrolling.
 * The two data-driven demos (update transitions, enter/exit) are interactive.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import { useState } from 'react';
import { Demo, GalleryPage, Section } from '../components';
import { energyMix, renewableCapacityAdditions, smartphoneShare, usPayrolls } from '../data';
import { hBarGradient, vBarGradient } from './helpers';

const ACCENT = '#0e7490';

// ---------------------------------------------------------------------------
// ReplayChart: a chart with a "Replay" button that remounts it.
//
// Bumping `nonce` changes the Chart's React `key`, forcing a full unmount +
// remount. Mount treats each fresh createChart() as a first render, so the
// entrance animation fires again — no scroll required.
// ---------------------------------------------------------------------------

function ReplayChart({ spec, height = 420 }: { spec: ChartSpec; height?: number }) {
  const [nonce, setNonce] = useState(0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-3)' }}>
      <div style={{ height }}>
        <Chart key={nonce} spec={spec} />
      </div>
      <div>
        <button type="button" className="oc-spec-copy" onClick={() => setNonce((n) => n + 1)}>
          Replay animation
        </button>
      </div>
    </div>
  );
}

/** Two charts side by side, each replayable together via one button. */
function ReplayPair({
  left,
  right,
  height = 420,
}: {
  left: ChartSpec;
  right: ChartSpec;
  height?: number;
}) {
  const [nonce, setNonce] = useState(0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-3)' }}>
      <div style={{ display: 'flex', gap: 'var(--oc-space-4)', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px', minWidth: 0, height }}>
          <Chart key={nonce} spec={left} />
        </div>
        <div style={{ flex: '1 1 300px', minWidth: 0, height }}>
          <Chart key={nonce} spec={right} />
        </div>
      </div>
      <div>
        <button type="button" className="oc-spec-copy" onClick={() => setNonce((n) => n + 1)}>
          Replay animation
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. Entrance — smooth vs snappy, side by side
// ---------------------------------------------------------------------------

const entranceData = [
  { category: 'Engineering', value: 142 },
  { category: 'Design', value: 98 },
  { category: 'Marketing', value: 76 },
  { category: 'Sales', value: 115 },
  { category: 'Support', value: 63 },
  { category: 'Product', value: 89 },
];

const entranceEncoding = {
  x: { field: 'value', type: 'quantitative' as const, axis: { title: 'Headcount' } },
  y: { field: 'category', type: 'nominal' as const },
};

const smoothSpec: ChartSpec = {
  animation: { enter: { ease: 'smooth' } },
  mark: { type: 'bar', fill: hBarGradient(ACCENT) },
  data: entranceData,
  encoding: entranceEncoding,
  chrome: { title: 'Smooth', subtitle: 'Ease-out: fast start, gentle deceleration (default)' },
};

const snappySpec: ChartSpec = {
  animation: { enter: { ease: 'snappy' } },
  mark: { type: 'bar', fill: hBarGradient(ACCENT) },
  data: entranceData,
  encoding: entranceEncoding,
  chrome: { title: 'Snappy', subtitle: 'Sharper attack, quicker settle' },
};

// ---------------------------------------------------------------------------
// 2. Stagger — index / value / reverse order
// ---------------------------------------------------------------------------

function staggerSpec(order: 'index' | 'value' | 'reverse', title: string): ChartSpec {
  return {
    animation: { enter: { stagger: { delay: 60, order } } },
    mark: { type: 'bar', fill: vBarGradient(ACCENT) },
    data: [...usPayrolls.data],
    encoding: {
      x: { field: 'month', type: 'ordinal' },
      y: { field: 'jobs', type: 'quantitative', axis: { title: 'Jobs added (K)' } },
    },
    labels: { density: 'none' },
    chrome: { title, subtitle: `order: '${order}'` },
  };
}

const staggerIndexSpec = staggerSpec('index', 'Index order');
const staggerValueSpec = staggerSpec('value', 'Value order');
const staggerReverseSpec = staggerSpec('reverse', 'Reverse order');

function StaggerRow() {
  const [nonce, setNonce] = useState(0);
  const specs = [staggerIndexSpec, staggerValueSpec, staggerReverseSpec];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-3)' }}>
      <div style={{ display: 'flex', gap: 'var(--oc-space-4)', flexWrap: 'wrap' }}>
        {specs.map((s, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length static list
            key={i}
            style={{ flex: '1 1 240px', minWidth: 0, height: 360 }}
          >
            <Chart key={nonce} spec={s} />
          </div>
        ))}
      </div>
      <div>
        <button type="button" className="oc-spec-copy" onClick={() => setNonce((n) => n + 1)}>
          Replay animation
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Line drawing + area reveal
// ---------------------------------------------------------------------------

const revenueSeries = [
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
];

const lineDrawSpec: ChartSpec = {
  animation: { enter: { duration: 1000, ease: 'smooth' } },
  mark: { type: 'line', point: true, interpolate: 'monotone' },
  data: revenueSeries,
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: {
      field: 'value',
      type: 'quantitative',
      axis: { title: 'Monthly revenue ($K)', grid: true, tickCount: 6 },
      scale: { domain: [0, 260] },
    },
    color: { field: 'series', type: 'nominal' },
  },
  legend: { position: 'top' },
  chrome: {
    title: 'Lines Draw Left to Right',
    subtitle: 'A clip-path sweep reveals each path; point markers fade in behind it',
  },
};

const areaRevealSpec: ChartSpec = {
  animation: { enter: { duration: 1200, ease: 'smooth' } },
  mark: {
    type: 'area',
    point: true,
    interpolate: 'monotone',
    fill: {
      gradient: 'linear',
      stops: [
        { offset: 0, color: ACCENT, opacity: 0.75 },
        { offset: 1, color: ACCENT, opacity: 0.04 },
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
      axis: { title: 'Daily active users (K)' },
      scale: { domain: [180, 400] },
    },
  },
  chrome: {
    title: 'Areas Reveal Under the Fill',
    subtitle: 'The gradient fades from solid at the line to transparent at the baseline',
  },
};

// ---------------------------------------------------------------------------
// 4. Pie / donut sweep
// ---------------------------------------------------------------------------

const pieSweepSpec: ChartSpec = {
  animation: true,
  mark: 'arc',
  data: [...smartphoneShare.data],
  encoding: {
    theta: { field: 'share', type: 'quantitative' },
    color: { field: 'brand', type: 'nominal' },
  },
  chrome: {
    title: 'Pie Slices Scale In',
    subtitle: 'Arc marks fade and grow from the center (opacity-only, no SVG transform clash)',
    source: smartphoneShare.source,
  },
};

const donutSweepSpec: ChartSpec = {
  animation: true,
  mark: { type: 'arc', innerRadius: 60 },
  data: [...smartphoneShare.data],
  encoding: {
    theta: { field: 'share', type: 'quantitative' },
    color: { field: 'brand', type: 'nominal' },
  },
  chrome: {
    title: 'Donut Sweeps In',
    subtitle: 'innerRadius: 60 — same entrance, hollow center for a KPI',
    source: smartphoneShare.source,
  },
};

// ---------------------------------------------------------------------------
// 5. Stacked bar segment chaining — the linear-easing sweep
// ---------------------------------------------------------------------------

const stackedChainSpec: ChartSpec = {
  animation: { enter: { duration: 900, stagger: { delay: 70, order: 'index' } } },
  mark: 'bar',
  data: [...energyMix.data],
  encoding: {
    x: { field: 'year', type: 'ordinal' },
    y: {
      field: 'energy',
      type: 'quantitative',
      stack: 'zero',
      axis: { title: 'Share of primary energy (%)' },
    },
    color: { field: 'source', type: 'nominal' },
  },
  labels: { density: 'none' },
  legend: { position: 'top' },
  chrome: {
    title: 'Stacked Segments Chain Into One Sweep',
    subtitle: 'Each column reveals bottom-up as a single fluid rise (segments ease linearly)',
    source: energyMix.source,
  },
};

// ---------------------------------------------------------------------------
// 6. Annotation delay — chart enters, then annotations
// ---------------------------------------------------------------------------

const annotationDelaySpec: ChartSpec = {
  animation: { enter: { duration: 1000, ease: 'smooth' }, annotationDelay: 500 },
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
      axis: { title: 'NPS score' },
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
    { type: 'refline', y: 70, label: 'Target NPS', labelAnchor: 'top' },
  ],
  chrome: {
    title: 'Satisfaction Surges After the Relaunch',
    subtitle:
      'The area draws first; annotations fade in 500ms later so the eye lands on data first',
    source: 'Source: Illustrative data',
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 7. Update transitions — interactive data toggle (marks morph by key)
// ---------------------------------------------------------------------------

const UPDATE_MONTHS = [
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

const UPDATE_INITIAL = [
  { month: 'Jan', sales: 120 },
  { month: 'Feb', sales: 200 },
  { month: 'Mar', sales: 150 },
  { month: 'Apr', sales: 80 },
  { month: 'May', sales: 250 },
  { month: 'Jun', sales: 180 },
];

const UPDATE_ALT = [
  { month: 'Mar', sales: 300 },
  { month: 'Apr', sales: 220 },
  { month: 'May', sales: 160 },
  { month: 'Jun', sales: 90 },
  { month: 'Jul', sales: 270 },
  { month: 'Aug', sales: 200 },
];

const randSales = () => Math.round(50 + Math.random() * 300);

const updateSpecForPanel: ChartSpec = {
  animation: true,
  mark: 'bar',
  data: UPDATE_INITIAL,
  encoding: {
    x: { field: 'month', type: 'nominal' },
    y: { field: 'sales', type: 'quantitative', axis: { title: 'Sales ($K)' } },
  },
  chrome: {
    title: 'Bars Morph Between Data States',
    subtitle: 'Toggle the data below — matching bars retarget, new ones enter, dropped ones exit',
    source: 'Source: Illustrative data',
  },
};

function UpdateTransitionsDemo() {
  const [data, setData] = useState(UPDATE_INITIAL);
  const [useAlt, setUseAlt] = useState(false);

  const spec: ChartSpec = { ...updateSpecForPanel, data };

  const addPoint = () => {
    const used = new Set(data.map((d) => d.month));
    const next = UPDATE_MONTHS.find((m) => !used.has(m));
    if (!next) return;
    setData([...data, { month: next, sales: randSales() }]);
  };
  const removePoint = () => {
    if (data.length <= 1) return;
    setData(data.slice(0, -1));
  };
  const randomize = () => setData(data.map((d) => ({ ...d, sales: randSales() })));
  const replaceDataset = () => {
    setUseAlt(!useAlt);
    setData(useAlt ? UPDATE_INITIAL : UPDATE_ALT);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-3)' }}>
      <div style={{ height: 420 }}>
        <Chart spec={spec} />
      </div>
      <div style={{ display: 'flex', gap: 'var(--oc-space-2, 8px)', flexWrap: 'wrap' }}>
        <button type="button" className="oc-spec-copy" onClick={addPoint}>
          Add point
        </button>
        <button type="button" className="oc-spec-copy" onClick={removePoint}>
          Remove point
        </button>
        <button type="button" className="oc-spec-copy" onClick={randomize}>
          Randomize values
        </button>
        <button type="button" className="oc-spec-copy" onClick={replaceDataset}>
          Replace dataset
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 8. Enter / exit — add and remove series, with ghost exits
// ---------------------------------------------------------------------------

const ALL_SOURCES = ['Solar', 'Wind', 'Hydro'] as const;

const enterExitSpecForPanel: ChartSpec = {
  animation: true,
  mark: 'bar',
  data: [...renewableCapacityAdditions.data],
  encoding: {
    x: { field: 'year', type: 'ordinal' },
    y: {
      field: 'capacity',
      type: 'quantitative',
      stack: null,
      axis: { title: 'Capacity added (GW)' },
    },
    color: { field: 'type', type: 'nominal' },
  },
  labels: { density: 'none' },
  legend: { position: 'top' },
  chrome: {
    title: 'Adding and Removing Series',
    subtitle: 'Toggle a source — new bars enter, removed bars leave as fading ghosts',
    source: renewableCapacityAdditions.source,
  },
};

function EnterExitDemo() {
  const [active, setActive] = useState<Set<string>>(new Set(ALL_SOURCES));

  const data = renewableCapacityAdditions.data.filter((d) => active.has(d.type));
  const spec: ChartSpec = { ...enterExitSpecForPanel, data };

  const toggle = (source: string) => {
    setActive((cur) => {
      const next = new Set(cur);
      if (next.has(source)) {
        if (next.size > 1) next.delete(source);
      } else {
        next.add(source);
      }
      return next;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-3)' }}>
      <div style={{ height: 440 }}>
        <Chart spec={spec} />
      </div>
      <div style={{ display: 'flex', gap: 'var(--oc-space-2, 8px)', flexWrap: 'wrap' }}>
        {ALL_SOURCES.map((source) => {
          const on = active.has(source);
          return (
            <button
              key={source}
              type="button"
              className="oc-spec-copy"
              aria-pressed={on}
              onClick={() => toggle(source)}
              style={
                on ? { borderColor: 'var(--oc-accent)', color: 'var(--oc-accent)' } : undefined
              }
            >
              {on ? `Hide ${source}` : `Show ${source}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default { title: 'Features' };

export const Animation = () => (
  <GalleryPage
    title="Animation"
    lede="Entrance animations are pure CSS: the engine resolves an AnimationSpec (duration, easing, stagger order, annotation delay) and the SVG renderer stamps the keyframes. Data-update transitions run a small requestAnimationFrame loop that morphs marks between two computed layouts, matched by key. Every entrance demo replays when it scrolls into view — the Replay button re-triggers it in place. All motion honors the OS prefers-reduced-motion setting; when it is on, charts render straight to their final state with no animation."
  >
    <Section
      id="entrance"
      title="Entrance"
      lede="How marks arrive on first render. Easing sets the character; stagger sets the order."
    >
      <Demo
        id="easing"
        title="Easing — smooth vs snappy"
        description="The same bars under both presets. Smooth decelerates into place; snappy hits harder and settles fast."
        specForPanel={smoothSpec}
      >
        <ReplayPair left={smoothSpec} right={snappySpec} height={380} />
      </Demo>
      <Demo
        id="stagger"
        title="Stagger order — index, value, reverse"
        description="Stagger delays each element's start. Order by DOM index, by data value (biggest first), or reversed."
        specForPanel={staggerValueSpec}
      >
        <StaggerRow />
      </Demo>
    </Section>

    <Section
      id="by-mark"
      title="By mark type"
      lede="Each mark family has its own entrance: lines draw, areas reveal under the fill, arcs scale from the center, stacked segments chain."
    >
      <Demo
        id="line-drawing"
        title="Line drawing"
        description="Paths sweep in left to right via a clip-path reveal; point markers fade in behind the sweep."
        specForPanel={lineDrawSpec}
        height={440}
      >
        <ReplayChart spec={lineDrawSpec} height={440} />
      </Demo>
      <Demo
        id="area-reveal"
        title="Area reveal"
        description="The area draws under an opacity gradient that fades to transparent at the baseline."
        specForPanel={areaRevealSpec}
        height={440}
      >
        <ReplayChart spec={areaRevealSpec} height={440} />
      </Demo>
      <Demo
        id="pie-sweep"
        title="Pie sweep"
        description="Arc marks fade and scale in from the center. Arcs use opacity-only animation because SVG translate positioning would clash with a CSS transform."
        specForPanel={pieSweepSpec}
      >
        <ReplayPair left={pieSweepSpec} right={donutSweepSpec} height={420} />
      </Demo>
      <Demo
        id="stacked-chain"
        title="Stacked segment chaining"
        description="Segments in a stacked column chain their reveal so the whole bar rises as one fluid sweep. The segments ease linearly to keep constant velocity across the handoffs."
        specForPanel={stackedChainSpec}
        height={460}
      >
        <ReplayChart spec={stackedChainSpec} height={460} />
      </Demo>
    </Section>

    <Section
      id="sequencing"
      title="Sequencing"
      lede="Choreograph the order in which layers arrive so the reader's eye lands on the data before the labels."
    >
      <Demo
        id="annotation-delay"
        title="Annotation delay"
        description="The chart enters first; annotations fade in after annotationDelay milliseconds, so the takeaway callouts don't compete with the data reveal."
        specForPanel={annotationDelaySpec}
        height={440}
      >
        <ReplayChart spec={annotationDelaySpec} height={440} />
      </Demo>
    </Section>

    <Section
      id="transitions"
      title="Update & exit"
      lede="When the data behind a mounted chart changes, marks morph rather than re-entering. Matching keys retarget in place; new keys enter, dropped keys leave as ghosts."
    >
      <Demo
        id="update-transitions"
        title="Update transitions (interactive)"
        description="Change the data and watch matching bars retarget smoothly to their new heights instead of restarting the entrance. Add, remove, randomize, or swap the whole dataset."
        specForPanel={updateSpecForPanel}
        height={500}
      >
        <UpdateTransitionsDemo />
      </Demo>
      <Demo
        id="enter-exit"
        title="Enter / exit (interactive)"
        description="Toggle a series on or off. Added series animate in; removed series leave as fading ghost clones rendered from the previous layout, then are cleaned up."
        specForPanel={enterExitSpecForPanel}
        height={520}
      >
        <EnterExitDemo />
      </Demo>
    </Section>
  </GalleryPage>
);
