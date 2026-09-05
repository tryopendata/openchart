/**
 * Composed dashboard layouts for the Dashboards gallery page.
 *
 * Deliberately NOT a `.stories.tsx` file: Ladle turns every named export of a
 * story module into a story, and this module exports a dozen helpers. It is
 * imported by `dashboards.stories.tsx`, which owns the `<Demo>` cards.
 *
 * What lives here:
 * - The live-data simulation layer (`useSimTick`, `useLiveSeries`, and the
 *   per-dashboard advance functions): every plausible live tile ticks with a
 *   seeded random walk every ~5s, and the specs keep `animation: true` so each
 *   tick runs the engine's data-update transition.
 * - The shared surface tokens (`dashTokens`), the `pctChange` helper, the
 *   `sparklineSpec` builder, and the single `SparklineCard` renderer — all
 *   moved out of the stories file so the layouts can reuse them.
 * - Three tile primitives (`Panel`, `TileTitle`, `StatCard`) shared by the four
 *   layouts.
 * - Five full dashboards (SaaS, ops, markets, incident intelligence, marketing) plus the hero spec of
 *   each, exported so the story can hand it to `<Demo specForPanel>`.
 *
 * Watermark convention, which these layouts exist to demonstrate: exactly ONE
 * watermark per dashboard, on the hero chart that also carries `chrome.source`.
 * Every other tile at or above 200px sets `watermark: false`. Tiles under 200px
 * write nothing and rely on the engine auto-hiding the brand in cramped
 * containers. Tables and sankeys resolve watermark outside that auto-hide, so
 * they always need the explicit `watermark: false`.
 */

import type { BarListSpec, ChartSpec, SankeySpec, TableSpec } from '@opendata-ai/openchart-core';
import { DEFAULT_THEME } from '@opendata-ai/openchart-core';
import { BarList, Chart, DataTable, Sankey } from '@opendata-ai/openchart-react';
import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useOcMode } from '../components';
import {
  incidentIntelligence,
  indexTotalReturns,
  marketIndices,
  marketingFunnel,
  opsMonitoring,
  saasMetrics,
  sp500SectorReturns,
  userJourney,
} from '../data';
import { vBarGradient } from './helpers';

/** Slot 1 of the library palette: the accent every dashboard hero uses. */
const ACCENT = DEFAULT_THEME.colors.categorical[0];

// ---------------------------------------------------------------------------
// Live data simulation
//
// Every dashboard tile that plausibly backs a live feed ticks every ~5s with a
// random walk seeded from its static series. The chart specs keep
// `animation: true`, so each tick runs the engine's data-update transition
// (path morphs on lines/areas/sparklines, angle tweens on the donut, geometry
// tweens on bars) instead of an instant swap. Ticking pauses entirely under
// prefers-reduced-motion.
// ---------------------------------------------------------------------------

/** How often live tiles advance, in ms. */
export const LIVE_INTERVAL_MS = 5000;

/**
 * Run `tick` every `intervalMs`, offset by `phaseMs` so a grid of tiles
 * doesn't update on one synchronized beat. The first tick fires after
 * `phaseMs + intervalMs`, leaving the entrance animation undisturbed.
 *
 * Reduced motion is a live gate, mirroring the transition system's own
 * per-update check: toggling the OS setting stops or restarts the simulation
 * without a reload.
 */
export function useSimTick(tick: () => void, intervalMs = LIVE_INTERVAL_MS, phaseMs = 0): void {
  const tickRef = useRef(tick);
  tickRef.current = tick;
  useEffect(() => {
    let mq: MediaQueryList | null = null;
    if (typeof window.matchMedia === 'function') {
      try {
        mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      } catch {
        mq = null;
      }
    }

    let timeout: number | undefined;
    let interval: number | undefined;
    const stop = () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
      if (interval !== undefined) window.clearInterval(interval);
      timeout = interval = undefined;
    };
    const start = () => {
      timeout = window.setTimeout(() => {
        tickRef.current();
        interval = window.setInterval(() => tickRef.current(), intervalMs);
      }, phaseMs + intervalMs);
    };

    if (!mq?.matches) start();
    const onChange = (e: MediaQueryListEvent) => {
      stop();
      if (!e.matches) start();
    };
    mq?.addEventListener('change', onChange);
    return () => {
      stop();
      mq?.removeEventListener('change', onChange);
    };
  }, [intervalMs, phaseMs]);
}

/** Center-weighted random step in roughly [-1, 1]. */
export function randStep(): number {
  return (Math.random() + Math.random() + Math.random()) / 1.5 - 1;
}

/** Median absolute step of a series — sizes the simulated random walk so the
 *  live tail looks like the seeded history, not noise pasted onto it. */
export function seriesVolatility(series: ReadonlyArray<{ value: number }>): number {
  const steps: number[] = [];
  for (let i = 1; i < series.length; i++) {
    steps.push(Math.abs(series[i].value - series[i - 1].value));
  }
  steps.sort((a, b) => a - b);
  return steps[Math.floor(steps.length / 2)] || 1;
}

/** Advance a {t, value} series one step, sliding the window left. */
export function advanceSeries(
  series: ReadonlyArray<{ t: number; value: number }>,
  volatility: number,
): { t: number; value: number }[] {
  const last = series[series.length - 1];
  const value = Math.max(last.value + randStep() * volatility, 0);
  return [...series.slice(1), { t: last.t + 1, value }];
}

/** Live sparkline series: seeded from static data, advancing every ~5s. */
export function useLiveSeries(
  seed: ReadonlyArray<{ t: number; value: number }>,
  phaseMs = 0,
): ReadonlyArray<{ t: number; value: number }> {
  const [series, setSeries] = useState<ReadonlyArray<{ t: number; value: number }>>(seed);
  const volatility = useMemo(() => seriesVolatility(seed), [seed]);
  useSimTick(() => setSeries((s) => advanceSeries(s, volatility)), LIVE_INTERVAL_MS, phaseMs);
  return series;
}

// ---------------------------------------------------------------------------
// Shared helpers (moved here from dashboards.stories.tsx)
// ---------------------------------------------------------------------------

/** Minimal sparkline spec; trend color, endpoint dot, and area gradient all
 *  come from the engine's sparkline defaults. */
export function sparklineSpec(
  mark: 'line' | 'area',
  series: ReadonlyArray<{ t: number; value: number }>,
): ChartSpec {
  const base = {
    data: [...series],
    encoding: {
      x: { field: 't', type: 'ordinal' as const },
      y: { field: 'value', type: 'quantitative' as const },
    },
    display: 'sparkline' as const,
    // Entrance draw on mount, plus the update phase that morphs the path when
    // the live simulation slides the window.
    animation: true as const,
  };
  return mark === 'area' ? { mark: 'area', ...base } : { mark: 'line', ...base };
}

export function pctChange(series: ReadonlyArray<{ value: number }>): {
  text: string;
  up: boolean;
  /** Signed percent delta, for magnitude/tone logic. */
  delta: number;
} {
  const first = series[0]?.value ?? 0;
  const last = series[series.length - 1]?.value ?? 0;
  const delta = first === 0 ? 0 : ((last - first) / first) * 100;
  const up = delta >= 0;
  return { text: `${up ? '+' : ''}${delta.toFixed(2)}%`, up, delta };
}

/**
 * Dashboard surface tokens.
 *
 * Every value is a `--oc-*` custom property, not a hex literal: the dashboard
 * roots carry `oc-root` (plus `oc-dark`), so the same cascade that themes the
 * charts themes the tiles around them. When the library's card, border, or
 * semantic colors move, these tiles move with them instead of drifting into a
 * private slate palette.
 */
export function dashTokens() {
  return {
    surface: 'var(--oc-card)',
    border: '1px solid var(--oc-border)',
    text: 'var(--oc-text)',
    muted: 'var(--oc-text-muted)',
    faint: 'var(--oc-text-faint)',
    up: 'var(--oc-positive)',
    down: 'var(--oc-negative)',
    mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  };
}

/** Class list for a dashboard root: the token cascade plus the mode flag. */
export function useDashRootClass(gridClass: string): string {
  const dark = useOcMode() === 'dark';
  return [gridClass, 'oc-root', dark ? 'oc-dark' : ''].filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// Tile primitives
// ---------------------------------------------------------------------------

/** A bordered dashboard surface. `className` carries the layout's grid spans. */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  const t = dashTokens();
  return (
    <div
      className={className}
      style={{
        padding: 16,
        border: t.border,
        borderRadius: 'var(--oc-radius-lg)',
        background: t.surface,
        color: t.text,
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
}

const tileTitleStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 12,
};

/**
 * The delta chip. A signed percentage on a 10% tint of its own semantic color,
 * so it reads as a badge rather than as a second, competing number.
 */
export function DeltaChip({ text, tone }: { text: string; tone: 'up' | 'down' | 'flat' }) {
  const t = dashTokens();
  const color = tone === 'down' ? t.down : tone === 'flat' ? t.muted : t.up;
  const background =
    tone === 'down'
      ? 'var(--oc-negative-tint)'
      : tone === 'flat'
        ? 'var(--oc-hover-bg)'
        : 'var(--oc-positive-tint)';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 6px',
        borderRadius: 'var(--oc-radius-md)',
        fontSize: 12,
        fontWeight: 500,
        fontVariantNumeric: 'tabular-nums',
        color,
        background,
      }}
    >
      {text}
    </span>
  );
}

/** The small caps label a tile carries instead of chart chrome. */
export function TileTitle({ children }: { children: ReactNode }) {
  const t = dashTokens();
  return <div style={{ ...tileTitleStyle, color: t.muted }}>{children}</div>;
}

/**
 * KPI tile. One anatomy, top to bottom: label, value, delta chip, timeframe.
 * The value is the only thing at display size; everything else steps down in
 * size and contrast so a wall of these scans as a single column of numbers.
 */
export function StatCard({
  label,
  value,
  delta,
  timeframe,
  tone = 'up',
}: {
  label: string;
  value: string;
  delta?: string;
  timeframe?: string;
  tone?: 'up' | 'down' | 'flat';
}) {
  const t = dashTokens();
  return (
    <Panel>
      <div style={{ fontSize: 11, fontWeight: 500, color: t.muted, marginBottom: 4 }}>{label}</div>
      <div
        style={{
          fontSize: 30,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      {delta ? (
        <div style={{ marginTop: 6 }}>
          <DeltaChip text={delta} tone={tone} />
        </div>
      ) : null}
      {timeframe ? (
        <div style={{ fontSize: 11, color: t.faint, marginTop: 6 }}>{timeframe}</div>
      ) : null}
    </Panel>
  );
}

type IndexSeries = (typeof marketIndices.indices)[number];

/** One market-index sparkline card: name, symbol, last level, change, spark.
 *  Live: the series advances every ~5s, staggered per card via `phaseMs`. */
export function SparklineCard({ index, phaseMs = 0 }: { index: IndexSeries; phaseMs?: number }) {
  const t = dashTokens();
  const series = useLiveSeries(index.series, phaseMs);
  const change = pctChange(series);
  const last = series[series.length - 1]?.value ?? 0;
  return (
    <div
      style={{
        padding: 16,
        border: t.border,
        borderRadius: 'var(--oc-radius-lg)',
        background: t.surface,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 500, color: t.muted }}>{index.name}</span>
        <span style={{ fontFamily: t.mono, fontSize: 11, color: t.faint }}>{index.symbol}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <span
          style={{
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {last.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
        <DeltaChip text={change.text} tone={change.up ? 'up' : 'down'} />
      </div>
      {/* 36px spark: enough to read the shape, not enough to compete with the
          number above it. */}
      <div style={{ height: 36 }}>
        <Chart spec={sparklineSpec(index.mark, series)} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout 1 — SaaS analytics overview
// ---------------------------------------------------------------------------

/** Hero: two years of MRR. Full chrome, cited source, watermark left on — the
 *  one branded chart in this dashboard. */
export const saasMrrSpec: ChartSpec = {
  animation: true,
  mark: { type: 'area', fill: vBarGradient(ACCENT), stroke: ACCENT, strokeWidth: 2 },
  data: [...saasMetrics.mrr],
  encoding: {
    x: { field: 'month', type: 'temporal', axis: { tickCount: 5 } },
    y: {
      field: 'mrr',
      type: 'quantitative',
      axis: { title: 'MRR', format: '$.2~s', tickCount: 5 },
    },
  },
  labels: { density: 'none' },
  chrome: {
    title: 'Recurring Revenue Has Nearly Tripled in Two Years',
    subtitle: 'Monthly recurring revenue, Jan 2024 to Dec 2025',
    source: saasMetrics.source,
    byline: 'Chart: OpenChart',
  },
};

/**
 * Signups tile. Note what is NOT here: no `watermark` key at all. The mount
 * container below is pinned to 180px, which puts the chart in the engine's
 * `cramped` height class, and the brand auto-hides. This is the live demo of
 * that behavior, so the key must stay absent.
 */
const saasSignupsSpec: ChartSpec = {
  animation: true,
  mark: 'bar',
  data: [...saasMetrics.signups],
  encoding: {
    x: { field: 'month', type: 'nominal' },
    y: { field: 'signups', type: 'quantitative', stack: 'zero' },
    color: { field: 'channel', type: 'nominal' },
  },
  labels: { density: 'none' },
  // A 180px tile has no vertical budget for a legend — the engine would strip
  // it anyway at this height class — so the HTML tile label carries the meaning.
  legend: { show: false },
};

const saasTopPagesSpec: BarListSpec = {
  type: 'barlist',
  animation: true,
  data: [...saasMetrics.topPages],
  encoding: {
    label: { field: 'page', type: 'nominal' as const },
    value: { field: 'sessions', type: 'quantitative' as const },
  },
  valueFormat: ',.0f',
  barHeight: 8,
  chrome: { title: 'Top pages by session' },
  watermark: false,
};

/** Tables resolve `watermark` in `compileTable`, outside the chart auto-hide,
 *  so a compact table tile always needs the explicit opt-out. */
const saasAccountsSpec: TableSpec = {
  type: 'table',
  data: [...saasMetrics.accounts],
  columns: [
    { key: 'account', label: 'Account' },
    { key: 'plan', label: 'Plan' },
    { key: 'mrr', label: 'MRR', format: '$,.0f', align: 'right' },
    { key: 'delta', label: 'MoM', format: '+.1f', align: 'right' },
    { key: 'trend', label: '8-week trend', sparkline: { type: 'line' } },
  ],
  chrome: { title: 'Largest accounts' },
  compact: true,
  watermark: false,
};

const SAAS_GRID_CSS = `
.oc-dash-saas {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.oc-dash-saas .oc-dash-span {
  grid-column: 1 / -1;
}
/* The signups panel wraps a chart pinned to 180px, so it must not stretch to
   the hero's height — that would leave a large empty band under the plot. */
.oc-dash-saas .oc-dash-short {
  align-self: start;
}
.oc-dash-saas .oc-dash-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
@media (max-width: 640px) {
  .oc-dash-saas { grid-template-columns: minmax(0, 1fr); }
  .oc-dash-saas .oc-dash-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`;

type MrrRow = { month: string; mrr: number };
type SignupRow = { month: string; channel: string; signups: number };

const MONTH_NAMES = [
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

/** Append the next month of MRR (steady growth with noise), slide the window. */
function advanceMrr(rows: MrrRow[]): MrrRow[] {
  const last = rows[rows.length - 1];
  const [y, m] = last.month.split('-').map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  const growth = 1.005 + Math.random() * 0.035;
  return [...rows.slice(1), { month: nextMonth, mrr: Math.round(last.mrr * growth) }];
}

/** Append a month of signups per channel; the oldest month's bars exit. */
function advanceSignups(rows: SignupRow[]): SignupRow[] {
  const months: string[] = [];
  for (const r of rows) {
    if (!months.includes(r.month)) months.push(r.month);
  }
  const lastMonth = months[months.length - 1];
  const nextName = MONTH_NAMES[(MONTH_NAMES.indexOf(lastMonth) + 1) % 12];
  const added = rows
    .filter((r) => r.month === lastMonth)
    .map((r) => ({
      month: nextName,
      channel: r.channel,
      signups: Math.max(40, Math.round(r.signups * (0.88 + Math.random() * 0.28))),
    }));
  return [...rows.filter((r) => r.month !== months[0]), ...added];
}

export function SaasDashboard() {
  const [mrrRows, setMrrRows] = useState<MrrRow[]>([...saasMetrics.mrr]);
  useSimTick(() => setMrrRows(advanceMrr), LIVE_INTERVAL_MS, 0);
  const [signupRows, setSignupRows] = useState<SignupRow[]>([...saasMetrics.signups]);
  useSimTick(() => setSignupRows(advanceSignups), LIVE_INTERVAL_MS, 2000);

  const mrrSpec = useMemo<ChartSpec>(() => ({ ...saasMrrSpec, data: mrrRows }), [mrrRows]);
  const signupsSpec = useMemo<ChartSpec>(
    () => ({ ...saasSignupsSpec, data: signupRows }),
    [signupRows],
  );

  // Keep the MRR stat card in lockstep with the live hero so the dashboard
  // reads as one system, not tiles simulating independently.
  const lastMrr = mrrRows[mrrRows.length - 1]?.mrr ?? 0;
  const prevMrr = mrrRows[mrrRows.length - 2]?.mrr ?? lastMrr;
  const mom = prevMrr === 0 ? 0 : ((lastMrr - prevMrr) / prevMrr) * 100;

  return (
    <>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, page-local CSS */}
      <style dangerouslySetInnerHTML={{ __html: SAAS_GRID_CSS }} />
      <div className={useDashRootClass('oc-dash-saas')}>
        <div className="oc-dash-stats oc-dash-span">
          <StatCard
            label="MRR"
            value={`$${(lastMrr / 1000).toFixed(1)}K`}
            delta={`${mom >= 0 ? '+' : ''}${mom.toFixed(1)}% MoM`}
            tone={mom >= 0 ? 'up' : 'down'}
          />
          <StatCard label="Active users" value="8,420" delta="+5.1% MoM" />
          <StatCard label="Gross churn" value="1.8%" delta="-0.3pp MoM" tone="up" />
          <StatCard label="Net revenue retention" value="114%" delta="+2pp QoQ" />
        </div>
        <Panel>
          <div style={{ height: 400 }}>
            <Chart spec={mrrSpec} />
          </div>
        </Panel>
        <Panel className="oc-dash-short">
          <TileTitle>Signups by channel</TileTitle>
          {/*
            180px is pinned on the chart's own mount container, NOT on the grid
            track. Grid stretch sizes auto-height items to the row, so an
            unstyled container here would inherit the hero row's height
            (320px+) and the watermark would stay visible, defeating the demo.
            An explicit pixel height on the inner container is respected
            regardless of stretch, in both the two-column layout and the
            one-column mobile collapse.
          */}
          <div style={{ height: 180 }}>
            <Chart spec={signupsSpec} />
          </div>
        </Panel>
        <Panel>
          <div style={{ height: 280 }}>
            <BarList spec={saasTopPagesSpec} />
          </div>
        </Panel>
        <Panel>
          <DataTable spec={saasAccountsSpec} />
        </Panel>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Layout 2 — Ops / monitoring
// ---------------------------------------------------------------------------

/** The ops series are keyed by timestamp; sparklines only need an index. */
function toSpark(series: ReadonlyArray<{ value: number }>): { t: number; value: number }[] {
  return series.map((d, t) => ({ t, value: d.value }));
}

const OPS_CARDS = [
  {
    label: 'p95 latency',
    format: (v: number) => `${Math.round(v)} ms`,
    goodWhen: 'down' as const,
    series: toSpark(opsMonitoring.latency),
  },
  {
    label: 'Error rate',
    format: (v: number) => `${v.toFixed(2)}%`,
    goodWhen: 'down' as const,
    series: opsMonitoring.errorRate.map((d, t) => ({ t, value: d.errorRate })),
  },
  {
    label: 'Throughput',
    format: (v: number) => `${Math.round(v).toLocaleString()} rps`,
    goodWhen: 'up' as const,
    series: toSpark(opsMonitoring.throughput),
  },
  {
    label: 'CPU',
    format: (v: number) => `${v.toFixed(1)}%`,
    goodWhen: 'down' as const,
    series: toSpark(opsMonitoring.cpu),
  },
];

/** Hero: the incident timeline. Only branded chart in this dashboard. */
export const opsErrorSpec: ChartSpec = {
  animation: true,
  mark: 'line',
  data: [...opsMonitoring.errorRate],
  crosshair: true,
  encoding: {
    x: { field: 'time', type: 'temporal', axis: { tickCount: 5 } },
    y: {
      field: 'errorRate',
      type: 'quantitative',
      axis: { title: '5xx responses (%)', format: '.1f', grid: true, tickCount: 5 },
    },
  },
  annotations: [
    {
      type: 'refline',
      y: 1,
      label: 'SLO: 1%',
      style: 'dashed',
      stroke: '#d1495b',
      strokeWidth: 1,
    },
    {
      type: 'text',
      x: opsMonitoring.incidentPeak,
      y: 2.08,
      text: 'Bad deploy triggered a\ncache eviction storm',
      anchor: 'left',
      offset: { dx: -160, dy: 70 },
      connector: true,
    },
  ],
  labels: { density: 'none' },
  chrome: {
    title: 'One Bad Deploy Blew Through the Error Budget',
    subtitle: 'Share of 5xx responses, hourly over 48 hours — hover for the crosshair',
    source: opsMonitoring.source,
    byline: 'Chart: OpenChart',
  },
};

const opsStatusSpec: ChartSpec = {
  animation: true,
  mark: { type: 'arc', innerRadius: 55 },
  data: [...opsMonitoring.serviceStatus],
  encoding: {
    theta: { field: 'services', type: 'quantitative' },
    color: {
      field: 'status',
      type: 'nominal',
      // Pinned so "Down" is always red no matter how the slices sort.
      scale: {
        domain: ['Healthy', 'Degraded', 'Down'],
        range: ['#16a34a', '#e0a100', '#d1495b'],
      },
    },
  },
  // A third of the grid is too narrow for leader-line slice labels ("Degraded"
  // runs off the left edge), so the legend carries the categories instead.
  labels: { density: 'none' },
  legend: { show: true, position: 'bottom' },
  chrome: { title: 'Service status' },
  watermark: false,
};

const OPS_GRID_CSS = `
.oc-dash-ops {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.oc-dash-ops .oc-dash-span {
  grid-column: 1 / -1;
}
.oc-dash-ops .oc-dash-hero {
  grid-column: span 2;
}
.oc-dash-ops .oc-dash-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
@media (max-width: 640px) {
  .oc-dash-ops { grid-template-columns: minmax(0, 1fr); }
  .oc-dash-ops .oc-dash-hero { grid-column: auto; }
  .oc-dash-ops .oc-dash-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`;

function OpsSparkCard({
  label,
  format,
  goodWhen,
  series: seed,
  phaseMs,
}: (typeof OPS_CARDS)[number] & { phaseMs: number }) {
  const t = dashTokens();
  const series = useLiveSeries(seed, phaseMs);
  const last = series[series.length - 1]?.value ?? 0;
  const change = pctChange(series);
  const delta = `${change.text} vs. 24h`;
  // Tone reads the metric's direction: rising latency is bad, rising
  // throughput is good, and small drifts stay neutral.
  const magnitude = Math.abs(change.delta);
  const tone: 'up' | 'down' | 'flat' =
    magnitude < 2 ? 'flat' : change.up === (goodWhen === 'up') ? 'up' : 'down';
  const deltaColor = tone === 'down' ? t.down : tone === 'flat' ? t.muted : t.up;
  return (
    <Panel>
      <div style={{ fontSize: 11, color: t.muted, marginBottom: 4 }}>{label}</div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {format(last)}
      </div>
      <div style={{ fontSize: 11, fontWeight: 500, color: deltaColor }}>{delta}</div>
      {/* 44px sparkline: `display: 'sparkline'` already strips the watermark. */}
      <div style={{ height: 44, marginTop: 10 }}>
        <Chart spec={sparklineSpec('line', series)} />
      </div>
    </Panel>
  );
}

type ErrorRow = { time: string; errorRate: number };
type StatusRow = { status: string; services: number };

/** Append the next hour to the incident timeline and slide the window. The
 *  simulated tail hovers near the recovered baseline with occasional blips. */
function advanceErrorRate(rows: ErrorRow[]): ErrorRow[] {
  const last = rows[rows.length - 1];
  const nextTime = new Date(new Date(`${last.time}:00Z`).getTime() + 3_600_000)
    .toISOString()
    .slice(0, 16);
  const blip = Math.random() < 0.06 ? 0.5 : 0;
  const value = Math.max(0.12, Math.min(last.errorRate + randStep() * 0.12 + blip, 1.4));
  return [...rows.slice(1), { time: nextTime, errorRate: Number(value.toFixed(2)) }];
}

/**
 * Move one service between status buckets, biased back toward healthy. No
 * bucket ever drops below 2 services: the seed data keeps every slice above
 * the pie compiler's 3% "Other" threshold (see the note in ops-monitoring.ts),
 * and a bucket at 1 of 48 would fall under it, regrouping the slice as "Other"
 * and losing its pinned status color.
 */
function shiftServiceStatus(rows: StatusRow[]): StatusRow[] {
  const next = rows.map((r) => ({ ...r }));
  const byStatus = (s: string) => next.find((r) => r.status === s);
  const healthy = byStatus('Healthy');
  const degraded = byStatus('Degraded');
  const down = byStatus('Down');
  if (!healthy || !degraded || !down) return rows;

  const roll = Math.random();
  if (roll < 0.35 && degraded.services > 2) {
    degraded.services -= 1;
    healthy.services += 1; // recovery
  } else if (roll < 0.55 && down.services > 2) {
    down.services -= 1;
    degraded.services += 1; // partial recovery
  } else if (roll < 0.85 && healthy.services > 2) {
    healthy.services -= 1;
    degraded.services += 1; // fresh degradation
  } else if (degraded.services > 2) {
    degraded.services -= 1;
    down.services += 1; // degradation worsens
  } else {
    // Roll missed or every floor was hit: return the ORIGINAL array so
    // React's state bailout skips the re-render (a fresh clone would force a
    // no-op chart update that tears down hover state for zero visual change).
    return rows;
  }
  return next;
}

export function OpsDashboard() {
  const [errorRows, setErrorRows] = useState<ErrorRow[]>([...opsMonitoring.errorRate]);
  useSimTick(() => setErrorRows(advanceErrorRate), LIVE_INTERVAL_MS, 1600);
  const [status, setStatus] = useState<StatusRow[]>([...opsMonitoring.serviceStatus]);
  useSimTick(() => setStatus(shiftServiceStatus), LIVE_INTERVAL_MS, 3200);

  // Live hero: same spec, advancing data. The incident annotation stays only
  // while its timestamp is still inside the sliding window; once the peak
  // scrolls out of view the callout goes with it.
  const heroSpec = useMemo<ChartSpec>(() => {
    const windowStart = errorRows[0]?.time ?? '';
    return {
      ...opsErrorSpec,
      data: errorRows,
      annotations: (opsErrorSpec.annotations ?? []).filter(
        (a) => a.type !== 'text' || opsMonitoring.incidentPeak >= windowStart,
      ),
    };
  }, [errorRows]);

  const statusSpec = useMemo<ChartSpec>(() => ({ ...opsStatusSpec, data: status }), [status]);

  return (
    <>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, page-local CSS */}
      <style dangerouslySetInnerHTML={{ __html: OPS_GRID_CSS }} />
      <div className={useDashRootClass('oc-dash-ops')}>
        <div className="oc-dash-strip oc-dash-span">
          {OPS_CARDS.map((card, i) => (
            <OpsSparkCard key={card.label} {...card} phaseMs={i * 400} />
          ))}
        </div>
        <Panel className="oc-dash-hero">
          <div style={{ height: 400 }}>
            <Chart spec={heroSpec} />
          </div>
        </Panel>
        <Panel>
          <div style={{ height: 400 }}>
            <Chart spec={statusSpec} />
          </div>
        </Panel>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Layout 3 — Finance / markets
// ---------------------------------------------------------------------------

export type SectorRow = { sector: string; return: number; direction: string };

const sectorReturns: SectorRow[] = sp500SectorReturns.data.map((d) => ({
  ...d,
  direction: d.return >= 0 ? 'Gain' : 'Loss',
}));

const SECTOR_BASE = new Map<string, number>(
  sp500SectorReturns.data.map((d) => [d.sector, d.return]),
);

/** Jitter sector returns with mean reversion toward the published figures, so
 *  the bars breathe without wandering off into fiction. Direction (and with it
 *  the gain/loss color) is recomputed, so a sector near zero can flip. */
function jitterSectors(rows: SectorRow[]): SectorRow[] {
  return rows.map((r) => {
    const base = SECTOR_BASE.get(r.sector) ?? r.return;
    const ret = Number((base + (r.return - base) * 0.7 + randStep() * 1.1).toFixed(1));
    return { ...r, return: ret, direction: ret >= 0 ? 'Gain' : 'Loss' };
  });
}

/** Live sector returns, shared by the markets dashboard and the composed grid. */
export function useLiveSectorReturns(phaseMs = 0): SectorRow[] {
  const [rows, setRows] = useState<SectorRow[]>(sectorReturns);
  useSimTick(() => setRows(jitterSectors), LIVE_INTERVAL_MS, phaseMs);
  return rows;
}

/** Hero: the index comparison. Only branded chart in this dashboard. */
export const marketsCompareSpec: ChartSpec = {
  animation: true,
  mark: 'line',
  data: [...indexTotalReturns.data],
  crosshair: true,
  encoding: {
    x: { field: 'date', type: 'temporal', axis: { tickCount: 4 } },
    y: {
      field: 'totalReturn',
      type: 'quantitative',
      axis: { title: 'Cumulative return (%)', format: '+.0f', grid: true, tickCount: 5 },
    },
    color: { field: 'index', type: 'nominal' },
  },
  annotations: [{ type: 'refline', y: 0, label: 'Breakeven', style: 'solid', strokeWidth: 1 }],
  labels: { density: 'endpoints', format: '+.1f' },
  legend: { show: false },
  seriesStyles: {
    'Russell 2000': { lineStyle: 'dashed', opacity: 0.7 },
  },
  chrome: {
    title: 'Big Tech Roars Back While Small Caps Stall',
    subtitle: 'Cumulative total return by index, rebased to Jan 1 2022',
    source: indexTotalReturns.source,
    byline: 'Chart: OpenChart',
  },
};

const marketsSectorSpec: ChartSpec = {
  animation: true,
  mark: 'bar',
  data: sectorReturns,
  encoding: {
    x: { field: 'return', type: 'quantitative', axis: { format: '+.0f' } },
    y: { field: 'sector', type: 'nominal' },
    color: {
      field: 'direction',
      type: 'nominal',
      scale: { domain: ['Gain', 'Loss'], range: [ACCENT, '#d1495b'] },
    },
  },
  legend: { show: false },
  // No value labels: at a third of the grid width the negative Materials bar
  // would print its label on top of the axis category name.
  labels: { density: 'none' },
  annotations: [{ type: 'refline', x: 0, style: 'solid', strokeWidth: 1 }],
  chrome: { title: 'Sector returns' },
  watermark: false,
};

const MARKETS_GRID_CSS = `
.oc-dash-fin {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.oc-dash-fin .oc-dash-span {
  grid-column: 1 / -1;
}
.oc-dash-fin .oc-dash-hero {
  grid-column: span 2;
}
.oc-dash-fin .oc-dash-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
@media (max-width: 640px) {
  .oc-dash-fin { grid-template-columns: minmax(0, 1fr); }
  .oc-dash-fin .oc-dash-hero { grid-column: auto; }
  .oc-dash-fin .oc-dash-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`;

type ReturnRow = { date: string; totalReturn: number; index: string };

/** Append the next quarter for every index and slide the window left. */
function advanceReturns(rows: ReturnRow[]): ReturnRow[] {
  const dates: string[] = [];
  for (const r of rows) {
    if (!dates.includes(r.date)) dates.push(r.date);
  }
  const lastDate = dates[dates.length - 1];
  const d = new Date(lastDate);
  d.setUTCMonth(d.getUTCMonth() + 3);
  const nextDate = d.toISOString().slice(0, 10);
  const added = rows
    .filter((r) => r.date === lastDate)
    .map((r) => ({
      date: nextDate,
      index: r.index,
      totalReturn: Number((r.totalReturn + randStep() * 7).toFixed(1)),
    }));
  return [...rows.filter((r) => r.date !== dates[0]), ...added];
}

export function MarketsDashboard() {
  const [returnRows, setReturnRows] = useState<ReturnRow[]>([...indexTotalReturns.data]);
  useSimTick(() => setReturnRows(advanceReturns), LIVE_INTERVAL_MS, 800);
  const sectors = useLiveSectorReturns(2600);

  const compareSpec = useMemo<ChartSpec>(
    () => ({ ...marketsCompareSpec, data: returnRows }),
    [returnRows],
  );
  const sectorSpec = useMemo<ChartSpec>(() => ({ ...marketsSectorSpec, data: sectors }), [sectors]);

  return (
    <>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, page-local CSS */}
      <style dangerouslySetInnerHTML={{ __html: MARKETS_GRID_CSS }} />
      <div className={useDashRootClass('oc-dash-fin')}>
        <div className="oc-dash-strip oc-dash-span">
          {marketIndices.indices.slice(0, 4).map((index, i) => (
            <SparklineCard key={index.symbol} index={index} phaseMs={i * 400} />
          ))}
        </div>
        <Panel className="oc-dash-hero">
          <div style={{ height: 360 }}>
            <Chart spec={compareSpec} />
          </div>
        </Panel>
        <Panel>
          <div style={{ height: 360 }}>
            <Chart spec={sectorSpec} />
          </div>
        </Panel>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Layout 4 — Marketing funnel
// ---------------------------------------------------------------------------

/** Hero: the funnel itself. Sankeys sit outside the chart watermark auto-hide,
 *  so this one keeps the default brand deliberately — it is the dashboard's
 *  single watermark and carries the cited source. */
export const funnelSankeySpec: SankeySpec = {
  type: 'sankey',
  data: [...userJourney.data],
  encoding: {
    source: { field: 'source', type: 'nominal' },
    target: { field: 'target', type: 'nominal' },
    value: { field: 'value', type: 'quantitative' },
  },
  valueFormat: ',.0f',
  chrome: {
    title: '10,000 Visitors In, 720 Paying Users Out',
    subtitle: 'Monthly cohort from landing page through conversion',
    source: userJourney.source,
    byline: 'Chart: OpenChart',
  },
  animation: true,
};

const funnelConversionSpec: ChartSpec = {
  animation: true,
  mark: 'line',
  data: [...marketingFunnel.conversionTrend],
  encoding: {
    x: { field: 'week', type: 'ordinal', axis: { tickCount: 4 } },
    y: {
      field: 'rate',
      type: 'quantitative',
      axis: { format: '.0%', grid: true, tickCount: 4 },
    },
    color: { field: 'stage', type: 'nominal' },
  },
  labels: { density: 'endpoints', format: '.1%' },
  legend: { show: false },
  chrome: { title: 'Conversion by stage' },
  watermark: false,
};

const funnelChannelsSpec: ChartSpec = {
  animation: true,
  mark: 'bar',
  data: [...marketingFunnel.channelPerformance],
  encoding: {
    x: { field: 'quarter', type: 'nominal' },
    y: { field: 'leads', type: 'quantitative', stack: null, axis: { format: '.2~s' } },
    color: { field: 'channel', type: 'nominal' },
  },
  labels: { density: 'none' },
  chrome: { title: 'Qualified leads by channel' },
  watermark: false,
};

const MARKETING_GRID_CSS = `
.oc-dash-mkt {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.oc-dash-mkt .oc-dash-span {
  grid-column: 1 / -1;
}
@media (max-width: 640px) {
  .oc-dash-mkt { grid-template-columns: minmax(0, 1fr); }
}
`;

type ConversionRow = { week: string; stage: string; rate: number };

/** Append the next week's conversion rate per stage, sliding the window. */
function advanceConversion(rows: ConversionRow[]): ConversionRow[] {
  const weeks: string[] = [];
  for (const r of rows) {
    if (!weeks.includes(r.week)) weeks.push(r.week);
  }
  const lastWeek = weeks[weeks.length - 1];
  const nextWeek = `W${Number(lastWeek.slice(1)) + 1}`;
  const added = rows
    .filter((r) => r.week === lastWeek)
    .map((r) => ({
      week: nextWeek,
      stage: r.stage,
      rate: Math.max(0.005, Number((r.rate * (0.92 + Math.random() * 0.17)).toFixed(4))),
    }));
  return [...rows.filter((r) => r.week !== weeks[0]), ...added];
}

export function MarketingDashboard() {
  const [conversionRows, setConversionRows] = useState<ConversionRow[]>([
    ...marketingFunnel.conversionTrend,
  ]);
  useSimTick(() => setConversionRows(advanceConversion), LIVE_INTERVAL_MS, 1200);

  const conversionSpec = useMemo<ChartSpec>(
    () => ({ ...funnelConversionSpec, data: conversionRows }),
    [conversionRows],
  );

  return (
    <>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, page-local CSS */}
      <style dangerouslySetInnerHTML={{ __html: MARKETING_GRID_CSS }} />
      <div className={useDashRootClass('oc-dash-mkt')}>
        <Panel className="oc-dash-span">
          <div style={{ height: 400 }}>
            <Sankey spec={funnelSankeySpec} />
          </div>
        </Panel>
        <Panel>
          <div style={{ height: 300 }}>
            <Chart spec={conversionSpec} />
          </div>
        </Panel>
        <Panel>
          <div style={{ height: 300 }}>
            <Chart spec={funnelChannelsSpec} />
          </div>
        </Panel>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Layout 5 — Incident intelligence (AI on-call agent)
//
// The product dashboard an error-ops team would build around an AI on-call
// agent: an error feed correlated with deploys and feature-flag ramps, the
// agent's investigation outcomes, its time-to-root-cause trend against the
// human baseline, deduped error signatures, and a ledger of recent
// investigations with estimated user impact.
// ---------------------------------------------------------------------------

const INCIDENT_RED = '#d1495b';

/** Hero: the error feed with the deploy-correlated spike. Only branded chart
 *  in this dashboard; the annotations carry the incident narrative. */
export const incidentErrorSpec: ChartSpec = {
  animation: true,
  mark: { type: 'area', fill: vBarGradient(INCIDENT_RED), stroke: INCIDENT_RED, strokeWidth: 2 },
  data: [...incidentIntelligence.errorFeed],
  crosshair: true,
  encoding: {
    x: { field: 'time', type: 'temporal', axis: { tickCount: 5 } },
    y: {
      field: 'errors',
      type: 'quantitative',
      axis: { title: 'Errors per 5 min', grid: true, tickCount: 5 },
    },
  },
  annotations: [
    // Only the fix-merged refline carries a label: three labeled reflines 70
    // minutes apart collide in the top gutter, so the flag ramp and the deploy
    // are narrated by the text annotation instead.
    {
      type: 'refline',
      x: incidentIntelligence.markers.flagRamp,
      style: 'dashed',
      stroke: '#64748b',
      strokeWidth: 1,
    },
    {
      type: 'refline',
      x: incidentIntelligence.markers.deploy,
      style: 'solid',
      stroke: INCIDENT_RED,
      strokeWidth: 1,
    },
    {
      type: 'refline',
      x: incidentIntelligence.markers.fixMerged,
      label: 'Fix merged',
      style: 'dashed',
      stroke: '#16a34a',
      strokeWidth: 1,
    },
    {
      type: 'text',
      x: incidentIntelligence.markers.peak,
      y: 185,
      text: 'Agent root-caused the 14:05 deploy in 4 min,\nruled out the 13:30 flag ramp, merged a revert',
      anchor: 'left',
      offset: { dx: -200, dy: 80 },
      connector: true,
    },
  ],
  labels: { density: 'none' },
  chrome: {
    title: 'Deploy 8412 Tripled Checkout Errors — the Agent Reverted It in 35 Minutes',
    subtitle: 'Application errors per 5-minute bucket — hover for the crosshair',
    source: incidentIntelligence.source,
    byline: 'Chart: OpenChart',
  },
};

const incidentOutcomesSpec: ChartSpec = {
  animation: true,
  mark: { type: 'arc', innerRadius: 55 },
  data: [...incidentIntelligence.investigationOutcomes],
  encoding: {
    theta: { field: 'investigations', type: 'quantitative' },
    color: {
      field: 'outcome',
      type: 'nominal',
      // Pinned so each outcome keeps its color while the live counts shift.
      scale: {
        domain: ['Auto-fixed', 'Root-caused', 'Escalated', 'Deduped as noise'],
        range: ['#16a34a', ACCENT, '#e0a100', '#64748b'],
      },
    },
  },
  labels: { density: 'none' },
  legend: { show: true, position: 'bottom' },
  chrome: { title: 'Investigations by outcome (7d)' },
  watermark: false,
};

const incidentTtrcSpec: ChartSpec = {
  animation: true,
  mark: 'line',
  data: [...incidentIntelligence.timeToRootCause],
  encoding: {
    x: { field: 'week', type: 'ordinal', axis: { tickCount: 5 } },
    y: {
      field: 'minutes',
      type: 'quantitative',
      axis: { title: 'Minutes to root cause', grid: true, tickCount: 4 },
    },
    color: {
      field: 'resolver',
      type: 'nominal',
      scale: { domain: ['Agent', 'On-call engineer'], range: [ACCENT, '#94a3b8'] },
    },
  },
  labels: { density: 'endpoints', format: '.0f' },
  legend: { show: false },
  seriesStyles: {
    'On-call engineer': { lineStyle: 'dashed', opacity: 0.7 },
  },
  chrome: { title: 'Time to root cause: agent vs. on-call' },
  watermark: false,
};

const incidentSignaturesSpec: BarListSpec = {
  type: 'barlist',
  animation: true,
  data: [...incidentIntelligence.errorSignatures],
  encoding: {
    label: { field: 'signature', type: 'nominal' },
    value: { field: 'events', type: 'quantitative' },
  },
  valueFormat: ',.0f',
  barHeight: 8,
  chrome: { title: 'Top error signatures (24h)' },
  watermark: false,
};

const incidentActivitySpec: TableSpec = {
  type: 'table',
  data: [...incidentIntelligence.agentActivity],
  columns: [
    { key: 'issue', label: 'Investigation' },
    { key: 'service', label: 'Service' },
    { key: 'outcome', label: 'Outcome' },
    { key: 'confidence', label: 'Confidence', format: '.0%', align: 'right' },
    { key: 'minutes', label: 'Minutes to RCA', format: '.1f', align: 'right' },
    { key: 'usersAffected', label: 'Est. users affected', format: ',.0f', align: 'right' },
  ],
  chrome: { title: 'Recent investigations' },
  compact: true,
  watermark: false,
};

const INCIDENT_GRID_CSS = `
.oc-dash-inc {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.oc-dash-inc .oc-dash-span {
  grid-column: 1 / -1;
}
.oc-dash-inc .oc-dash-hero {
  grid-column: span 2;
}
.oc-dash-inc .oc-dash-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
@media (max-width: 640px) {
  .oc-dash-inc { grid-template-columns: minmax(0, 1fr); }
  .oc-dash-inc .oc-dash-hero { grid-column: auto; }
  .oc-dash-inc .oc-dash-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`;

type ErrorPoint = { time: string; errors: number };
type OutcomeRow = { outcome: string; investigations: number };

/** Advance the error feed: mean-reverting baseline noise with the occasional
 *  fresh spike, so the live tail stays believable and every few minutes the
 *  dashboard gets a new mini-incident to chew on. */
function advanceErrorFeed(rows: ErrorPoint[]): ErrorPoint[] {
  const last = rows[rows.length - 1];
  const nextTime = new Date(new Date(`${last.time}:00Z`).getTime() + 300_000)
    .toISOString()
    .slice(0, 16);
  const spike = Math.random() < 0.05 ? 90 + Math.random() * 60 : 0;
  const value = Math.max(8, Math.round(42 + (last.errors - 42) * 0.75 + randStep() * 7 + spike));
  return [...rows.slice(1), { time: nextTime, errors: value }];
}

/** An investigation closes: move one count between outcome buckets. Floors at
 *  6 keep every slice above the pie compiler's 3% "Other" threshold. */
function shiftOutcomes(rows: OutcomeRow[]): OutcomeRow[] {
  const next = rows.map((r) => ({ ...r }));
  const from = next[Math.floor(Math.random() * next.length)];
  const to = next[Math.floor(Math.random() * next.length)];
  if (from === to || from.investigations <= 6) {
    // Nothing moved: return the ORIGINAL array so React's state bailout skips
    // the re-render instead of forcing a no-op chart update.
    return rows;
  }
  from.investigations -= 1;
  to.investigations += 1;
  return next;
}

export function IncidentDashboard() {
  const [feed, setFeed] = useState<ErrorPoint[]>([...incidentIntelligence.errorFeed]);
  useSimTick(() => setFeed(advanceErrorFeed), LIVE_INTERVAL_MS, 400);
  const [outcomes, setOutcomes] = useState<OutcomeRow[]>([
    ...incidentIntelligence.investigationOutcomes,
  ]);
  useSimTick(() => setOutcomes(shiftOutcomes), LIVE_INTERVAL_MS, 2800);

  // Live hero: annotations survive only while their timestamp is inside the
  // sliding window, so the incident narrative scrolls away with its data.
  const heroSpec = useMemo<ChartSpec>(() => {
    const windowStart = feed[0]?.time ?? '';
    return {
      ...incidentErrorSpec,
      data: feed,
      annotations: (incidentErrorSpec.annotations ?? []).filter((a) => {
        const x = (a as { x?: unknown }).x;
        return typeof x !== 'string' || x >= windowStart;
      }),
    };
  }, [feed]);

  const outcomesSpec = useMemo<ChartSpec>(
    () => ({ ...incidentOutcomesSpec, data: outcomes }),
    [outcomes],
  );

  // Stat cards derived from the live state so the top row moves with the
  // charts underneath it.
  const recent = feed.slice(-12); // last hour of buckets
  const recentErrors = recent.reduce((sum, d) => sum + d.errors, 0);
  const baseline = 42 * recent.length;
  const excess = Math.max(0, recentErrors - baseline);
  const usersImpacted = Math.round(recentErrors * 2.4);
  const totalInvestigations = outcomes.reduce((sum, o) => sum + o.investigations, 0);
  const autoResolved =
    (outcomes.find((o) => o.outcome === 'Auto-fixed')?.investigations ?? 0) +
    (outcomes.find((o) => o.outcome === 'Deduped as noise')?.investigations ?? 0);
  const autoShare = totalInvestigations === 0 ? 0 : (autoResolved / totalInvestigations) * 100;
  const openIncidents = 2 + Math.min(6, Math.round(excess / 120));

  return (
    <>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, page-local CSS */}
      <style dangerouslySetInnerHTML={{ __html: INCIDENT_GRID_CSS }} />
      <div className={useDashRootClass('oc-dash-inc')}>
        <div className="oc-dash-stats oc-dash-span">
          <StatCard
            label="Open incidents"
            value={String(openIncidents)}
            delta={excess > 200 ? 'error spike active' : 'all quiet'}
            tone={excess > 200 ? 'down' : 'up'}
          />
          <StatCard
            label="Resolved without a human (7d)"
            value={`${autoShare.toFixed(0)}%`}
            delta={`${autoResolved} of ${totalInvestigations} investigations`}
            tone="up"
          />
          <StatCard
            label="Median time to root cause"
            value="4.2 min"
            delta="on-call baseline: 49 min"
            tone="up"
          />
          <StatCard
            label="Est. users impacted (1h)"
            value={usersImpacted.toLocaleString()}
            delta={
              excess > 0
                ? `+${Math.round(excess * 2.4).toLocaleString()} above baseline`
                : 'at baseline'
            }
            tone={excess > 200 ? 'down' : 'flat'}
          />
        </div>
        <Panel className="oc-dash-hero">
          <div style={{ height: 420 }}>
            <Chart spec={heroSpec} />
          </div>
        </Panel>
        <Panel>
          <div style={{ height: 420 }}>
            <Chart spec={outcomesSpec} />
          </div>
        </Panel>
        <Panel className="oc-dash-hero">
          <div style={{ height: 300 }}>
            <Chart spec={incidentTtrcSpec} />
          </div>
        </Panel>
        <Panel>
          <div style={{ height: 300 }}>
            <BarList spec={incidentSignaturesSpec} />
          </div>
        </Panel>
        <Panel className="oc-dash-span">
          <DataTable spec={incidentActivitySpec} />
        </Panel>
      </div>
    </>
  );
}
