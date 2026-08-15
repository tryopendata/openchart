/**
 * Composed dashboard layouts for the Dashboards gallery page.
 *
 * Deliberately NOT a `.stories.tsx` file: Ladle turns every named export of a
 * story module into a story, and this module exports a dozen helpers. It is
 * imported by `dashboards.stories.tsx`, which owns the `<Demo>` cards.
 *
 * What lives here:
 * - The shared surface tokens (`dashTokens`), the `pctChange` helper, the
 *   `sparklineSpec` builder, and the single `SparklineCard` renderer — all
 *   moved out of the stories file so the layouts can reuse them.
 * - Three tile primitives (`Panel`, `TileTitle`, `StatCard`) shared by the four
 *   layouts.
 * - Four full dashboards (SaaS, ops, markets, marketing) plus the hero spec of
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
import { BarList, Chart, DataTable, Sankey } from '@opendata-ai/openchart-react';
import type { CSSProperties, ReactNode } from 'react';
import { useOcMode } from '../components';
import {
  indexTotalReturns,
  marketIndices,
  marketingFunnel,
  opsMonitoring,
  saasMetrics,
  sp500SectorReturns,
  userJourney,
} from '../data';
import { vBarGradient } from './helpers';

const ACCENT = '#0e7490';

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
  };
  return mark === 'area' ? { mark: 'area', ...base } : { mark: 'line', ...base };
}

export function pctChange(series: ReadonlyArray<{ value: number }>): {
  text: string;
  up: boolean;
} {
  const first = series[0]?.value ?? 0;
  const last = series[series.length - 1]?.value ?? 0;
  const delta = first === 0 ? 0 : ((last - first) / first) * 100;
  const up = delta >= 0;
  return { text: `${up ? '+' : ''}${delta.toFixed(2)}%`, up };
}

/** Dashboard surface tokens derived from the resolved gallery mode. Kept in JS
 *  (inline styles) so these product cards stay self-contained and don't touch
 *  the shared gallery.css. */
export function dashTokens(dark: boolean) {
  return {
    surface: dark ? '#10151d' : '#ffffff',
    border: dark ? '1px solid #232b38' : '1px solid #e2e8f0',
    text: dark ? '#e2e8f0' : '#1e293b',
    muted: dark ? '#94a3b8' : '#64748b',
    faint: dark ? '#64748b' : '#94a3b8',
    up: dark ? '#4ade80' : '#16a34a',
    down: dark ? '#f87171' : '#dc2626',
    mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  };
}

// ---------------------------------------------------------------------------
// Tile primitives
// ---------------------------------------------------------------------------

/** A bordered dashboard surface. `className` carries the layout's grid spans. */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  const t = dashTokens(useOcMode() === 'dark');
  return (
    <div
      className={className}
      style={{
        padding: 16,
        border: t.border,
        borderRadius: 8,
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
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 12,
};

/** The small caps label a tile carries instead of chart chrome. */
export function TileTitle({ children }: { children: ReactNode }) {
  const t = dashTokens(useOcMode() === 'dark');
  return <div style={{ ...tileTitleStyle, color: t.muted }}>{children}</div>;
}

/** A headline number with an optional signed delta underneath. */
export function StatCard({
  label,
  value,
  delta,
  tone = 'up',
}: {
  label: string;
  value: string;
  delta?: string;
  tone?: 'up' | 'down' | 'flat';
}) {
  const t = dashTokens(useOcMode() === 'dark');
  const deltaColor = tone === 'down' ? t.down : tone === 'flat' ? t.muted : t.up;
  return (
    <Panel>
      <div style={{ fontSize: 11, color: t.muted, marginBottom: 4 }}>{label}</div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      {delta ? (
        <div style={{ fontSize: 11, fontWeight: 500, color: deltaColor, marginTop: 2 }}>
          {delta}
        </div>
      ) : null}
    </Panel>
  );
}

type IndexSeries = (typeof marketIndices.indices)[number];

/** One market-index sparkline card: name, symbol, last level, change, spark. */
export function SparklineCard({ index }: { index: IndexSeries }) {
  const t = dashTokens(useOcMode() === 'dark');
  const change = pctChange(index.series);
  const last = index.series[index.series.length - 1]?.value ?? 0;
  return (
    <div style={{ padding: 16, border: t.border, borderRadius: 8, background: t.surface }}>
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
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {last.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            fontVariantNumeric: 'tabular-nums',
            color: change.up ? t.up : t.down,
          }}
        >
          {change.text}
        </span>
      </div>
      <div style={{ height: 44 }}>
        <Chart spec={sparklineSpec(index.mark, index.series)} />
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

export function SaasDashboard() {
  return (
    <>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, page-local CSS */}
      <style dangerouslySetInnerHTML={{ __html: SAAS_GRID_CSS }} />
      <div className="oc-dash-saas">
        <div className="oc-dash-stats oc-dash-span">
          <StatCard label="MRR" value="$513.7K" delta="+3.3% MoM" />
          <StatCard label="Active users" value="8,420" delta="+5.1% MoM" />
          <StatCard label="Gross churn" value="1.8%" delta="-0.3pp MoM" tone="up" />
          <StatCard label="Net revenue retention" value="114%" delta="+2pp QoQ" />
        </div>
        <Panel>
          <div style={{ height: 400 }}>
            <Chart spec={saasMrrSpec} />
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
            <Chart spec={saasSignupsSpec} />
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
    value: '149 ms',
    delta: '+9% vs. 24h',
    tone: 'down' as const,
    series: toSpark(opsMonitoring.latency),
  },
  {
    label: 'Error rate',
    value: '0.50%',
    delta: 'within SLO',
    tone: 'up' as const,
    series: opsMonitoring.errorRate.map((d, t) => ({ t, value: d.errorRate })),
  },
  {
    label: 'Throughput',
    value: '1,768 rps',
    delta: '-0.3% vs. 24h',
    tone: 'flat' as const,
    series: toSpark(opsMonitoring.throughput),
  },
  {
    label: 'CPU',
    value: '44.4%',
    delta: '+1.6pp vs. 24h',
    tone: 'flat' as const,
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

function OpsSparkCard({ label, value, delta, tone, series }: (typeof OPS_CARDS)[number]) {
  const t = dashTokens(useOcMode() === 'dark');
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
        {value}
      </div>
      <div style={{ fontSize: 11, fontWeight: 500, color: deltaColor }}>{delta}</div>
      {/* 44px sparkline: `display: 'sparkline'` already strips the watermark. */}
      <div style={{ height: 44, marginTop: 10 }}>
        <Chart spec={sparklineSpec('line', series)} />
      </div>
    </Panel>
  );
}

export function OpsDashboard() {
  return (
    <>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, page-local CSS */}
      <style dangerouslySetInnerHTML={{ __html: OPS_GRID_CSS }} />
      <div className="oc-dash-ops">
        <div className="oc-dash-strip oc-dash-span">
          {OPS_CARDS.map((card) => (
            <OpsSparkCard key={card.label} {...card} />
          ))}
        </div>
        <Panel className="oc-dash-hero">
          <div style={{ height: 400 }}>
            <Chart spec={opsErrorSpec} />
          </div>
        </Panel>
        <Panel>
          <div style={{ height: 400 }}>
            <Chart spec={opsStatusSpec} />
          </div>
        </Panel>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Layout 3 — Finance / markets
// ---------------------------------------------------------------------------

const sectorReturns = sp500SectorReturns.data.map((d) => ({
  ...d,
  direction: d.return >= 0 ? 'Gain' : 'Loss',
}));

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

export function MarketsDashboard() {
  return (
    <>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, page-local CSS */}
      <style dangerouslySetInnerHTML={{ __html: MARKETS_GRID_CSS }} />
      <div className="oc-dash-fin">
        <div className="oc-dash-strip oc-dash-span">
          {marketIndices.indices.slice(0, 4).map((index) => (
            <SparklineCard key={index.symbol} index={index} />
          ))}
        </div>
        <Panel className="oc-dash-hero">
          <div style={{ height: 360 }}>
            <Chart spec={marketsCompareSpec} />
          </div>
        </Panel>
        <Panel>
          <div style={{ height: 360 }}>
            <Chart spec={marketsSectorSpec} />
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

export function MarketingDashboard() {
  return (
    <>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, page-local CSS */}
      <style dangerouslySetInnerHTML={{ __html: MARKETING_GRID_CSS }} />
      <div className="oc-dash-mkt">
        <Panel className="oc-dash-span">
          <div style={{ height: 400 }}>
            <Sankey spec={funnelSankeySpec} />
          </div>
        </Panel>
        <Panel>
          <div style={{ height: 300 }}>
            <Chart spec={funnelConversionSpec} />
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
