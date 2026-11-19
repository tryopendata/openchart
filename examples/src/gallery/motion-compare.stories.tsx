/**
 * Motion / Compare: OpenChart entrance and update motion next to Decks.
 *
 * A dev page for eyeballing the phase 4 tuning in plans/rfc-motion-quality.md.
 * Not a gallery page: no Demo/Section anchors, no demos sidecar, and it is
 * deliberately absent from the explicit story list in e2e/visual/stories.spec.ts
 * so it never enters the visual baseline set.
 *
 * Decks cannot be embedded. Its charts (`bar-board`, `donut-build`, the Ink*
 * marks) call `useSlide()` and run on a gsap timeline advanced by deck clicks,
 * so they throw outside a deck runtime. The right-hand cells are placeholders
 * that point at the reference to run beside this page.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import { type CSSProperties, useEffect, useState } from 'react';

const ACCENT = '#0e7490';
const DECKS_REF = '~/Projects/decks/examples/motion (slides 72-mt-bar-board, 75-mt-donut-build)';

type Trigger = 'visible' | 'mount';

/** `visible` is the library default (`animation: true`); `mount` opts out of play-when-seen. */
function withMotion(spec: ChartSpec, trigger: Trigger): ChartSpec {
  const animation = trigger === 'mount' ? { enter: { trigger: 'mount' as const } } : true;
  return { ...spec, animation } as ChartSpec;
}

// ---------------------------------------------------------------------------
// Specs
// ---------------------------------------------------------------------------

const barSpec: ChartSpec = {
  mark: { type: 'bar', fill: ACCENT },
  data: [
    { label: 'Engineering', value: 142 },
    { label: 'Product', value: 118 },
    { label: 'Sales', value: 96 },
    { label: 'Design', value: 71 },
    { label: 'Support', value: 44 },
  ],
  encoding: {
    x: { field: 'value', type: 'quantitative' },
    y: { field: 'label', type: 'nominal', sort: '-x' },
  },
  chrome: { title: 'Headcount by team' },
};

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
  chrome: { title: 'Revenue by region' },
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

/** Deterministic pseudo-random so replays draw the same points. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

const rand = seeded(42);
const scatterSpec: ChartSpec = {
  mark: { type: 'point' },
  data: Array.from({ length: 60 }, (_, i) => {
    const x = rand() * 100;
    return { id: i, x, y: x * 0.6 + rand() * 40 };
  }),
  encoding: {
    x: { field: 'x', type: 'quantitative' },
    y: { field: 'y', type: 'quantitative' },
  },
  chrome: { title: 'Correlated points' },
};

const pairs: Array<{ id: string; label: string; spec: ChartSpec; decksNote: string }> = [
  { id: 'bar', label: 'Horizontal bar, five rows', spec: barSpec, decksNote: 'bar-board' },
  { id: 'line', label: 'Line', spec: lineSpec, decksNote: 'InkLine' },
  { id: 'stacked', label: 'Stacked bar', spec: stackedSpec, decksNote: 'InkBars (stacked)' },
  { id: 'donut', label: 'Donut', spec: donutSpec, decksNote: 'donut-build' },
  { id: 'scatter', label: 'Scatter', spec: scatterSpec, decksNote: 'story stage scatter' },
];

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

const cell: CSSProperties = { flex: '1 1 320px', minWidth: 0, height: 320 };

function DecksPlaceholder({ note }: { note: string }) {
  return (
    <div
      data-testid="decks-placeholder"
      style={{
        ...cell,
        border: '1px dashed currentColor',
        borderRadius: 8,
        opacity: 0.7,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: 16,
        textAlign: 'center',
        fontSize: 13,
      }}
    >
      <strong>Decks counterpart: {note}</strong>
      <span>Not embeddable: it needs a deck runtime (useSlide, click timeline).</span>
      <span>Run the reference at {DECKS_REF}.</span>
    </div>
  );
}

function PairRow({
  label,
  spec,
  decksNote,
  trigger,
  nonce,
}: {
  label: string;
  spec: ChartSpec;
  decksNote: string;
  trigger: Trigger;
  nonce: number;
}) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h3 style={{ margin: '0 0 8px' }}>{label}</h3>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={cell} data-testid="oc-cell">
          <Chart key={`${nonce}-${trigger}`} spec={withMotion(spec, trigger)} />
        </div>
        <DecksPlaceholder note={decksNote} />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 12-chart dashboard
// ---------------------------------------------------------------------------

const dashboardBases = [barSpec, lineSpec, stackedSpec, donutSpec, scatterSpec];
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
        <div key={`${i}-${nonce}-${trigger}`} style={{ height: 380 }}>
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
// Page
// ---------------------------------------------------------------------------

export default { title: 'Motion' };

export const Compare = () => {
  const [nonce, setNonce] = useState(0);
  const [trigger, setTrigger] = useState<Trigger>('visible');

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          padding: '8px 0',
          background: 'Canvas',
        }}
      >
        <h2 style={{ margin: 0, flex: 1 }}>Motion compare: OpenChart vs Decks</h2>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={trigger === 'mount'}
            onChange={(e) => setTrigger(e.target.checked ? 'mount' : 'visible')}
          />
          trigger: 'mount' (off = play when seen)
        </label>
        <button type="button" onClick={() => setNonce((n) => n + 1)}>
          Replay
        </button>
      </header>

      <h2>Matched pairs</h2>
      {pairs.map((p) => (
        <PairRow
          key={p.id}
          label={p.label}
          spec={p.spec}
          decksNote={p.decksNote}
          trigger={trigger}
          nonce={nonce}
        />
      ))}

      <h2>Live sparkline (1 Hz)</h2>
      <LiveSparkline trigger={trigger} nonce={nonce} />

      <h2>Dashboard (12 charts, default animation)</h2>
      <p>Charts below the fold hold their from-state until scrolled into view.</p>
      <Dashboard trigger={trigger} nonce={nonce} />
    </div>
  );
};
