/**
 * Dashboards — OpenChart in a product context: dense, composed, and small.
 *
 * Ten demos across three sections. The first section shows the dashboard
 * building blocks in isolation (sparkline cards, KPI metric pills, a bar list,
 * a crosshair line, conditional-color sector bars). The second composes them
 * into a single mini-dashboard in a 2x2 grid so you can see how the pieces sit
 * together at product density. The third goes further: four full product
 * dashboards (SaaS analytics, ops monitoring, markets, marketing funnel) that
 * demonstrate the chrome-economy and one-watermark-per-dashboard conventions.
 *
 * The layout components, the shared surface tokens, and the sparkline card
 * renderer live in `./dashboards.layouts.tsx` — a plain module, not a story
 * file, so Ladle doesn't turn each of its exports into a story.
 *
 * Absorbs and replaces the old `sparkline` and `financial` story files. The
 * pinned `sparkline--markets-dashboard` and `sparkline--sizes` fixtures live in
 * Testing with frozen copies, so those slugs are unaffected.
 */

import type { BarListSpec, ChartSpec } from '@opendata-ai/openchart-core';
import { BarList, Chart } from '@opendata-ai/openchart-react';
import { Demo, GalleryPage, Section, useOcMode } from '../components';
import {
  indexTotalReturns,
  marketIndices,
  nvidiaStock,
  programmingLanguages,
  sp500SectorReturns,
} from '../data';
import {
  dashTokens,
  funnelSankeySpec,
  MarketingDashboard,
  MarketsDashboard,
  marketsCompareSpec,
  OpsDashboard,
  opsErrorSpec,
  pctChange,
  SaasDashboard,
  SparklineCard,
  saasMrrSpec,
  sparklineSpec,
} from './dashboards.layouts';
import { vBarGradient } from './helpers';

const ACCENT = '#0e7490';

// ---------------------------------------------------------------------------
// 1. Sparkline card grid — display: 'sparkline'
// ---------------------------------------------------------------------------

// `dashTokens`, `pctChange`, `sparklineSpec`, and the single-card renderer
// (`SparklineCard`) live in ./dashboards.layouts.tsx so the four composed
// dashboards in the Layouts section can reuse them. The markup below is
// unchanged; only the per-card body moved.
function SparklineCards() {
  const t = dashTokens(useOcMode() === 'dark');

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 12,
        color: t.text,
      }}
    >
      {marketIndices.indices.map((idx) => (
        <SparklineCard key={idx.symbol} index={idx} />
      ))}
    </div>
  );
}

const sparklineExampleSpec = sparklineSpec('area', marketIndices.indices[0].series);

// ---------------------------------------------------------------------------
// 2. KPI metric pills — chrome `metrics` on a compact chart
// ---------------------------------------------------------------------------

const kpiSpec: ChartSpec = {
  animation: true,
  mark: { type: 'area', fill: vBarGradient(ACCENT), stroke: ACCENT, strokeWidth: 2 },
  data: [...nvidiaStock.data],
  encoding: {
    x: { field: 'date', type: 'temporal', axis: { tickCount: 4 } },
    y: {
      field: 'price',
      type: 'quantitative',
      axis: { title: 'Share price', format: '$,.0f' },
      scale: { zero: false },
    },
  },
  metrics: [
    { label: 'Close', value: '$186.50', delta: '+7.7%', deltaTone: 'up' },
    { label: '52-wk high', value: '$202.48' },
    { label: '52-wk low', value: '$108.36' },
    { label: '3-yr return', value: '+855%', delta: '9.6×', deltaTone: 'up' },
  ],
  labels: { density: 'none' },
  chrome: {
    title: 'NVIDIA at a Glance',
    subtitle: 'NVDA monthly close with headline stats, Jan 2023 to Dec 2025',
    source: nvidiaStock.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 3. Bar list — ranked movers in a dashboard card
// ---------------------------------------------------------------------------

const moversSpec: BarListSpec = {
  type: 'barlist',
  data: [...programmingLanguages.data].slice(0, 8),
  encoding: {
    label: { field: 'language', type: 'nominal' as const },
    value: { field: 'pct', type: 'quantitative' as const },
    color: { field: 'category', type: 'nominal' as const },
  },
  valueFormat: '.1f',
  barHeight: 8,
  chrome: {
    title: 'Top Movers',
    subtitle: 'Language popularity index, % share',
    source: programmingLanguages.source,
  },
};

// ---------------------------------------------------------------------------
// 4. Financial line with crosshair — benchmark comparison
// ---------------------------------------------------------------------------

const crosshairSpec: ChartSpec = {
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
    subtitle: 'Cumulative total return by index, rebased to Jan 1 2022 — hover for the crosshair',
    source: indexTotalReturns.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 5. Sector returns — conditional +/- coloring
// ---------------------------------------------------------------------------

const sectorReturns = sp500SectorReturns.data.map((d) => ({
  ...d,
  direction: d.return >= 0 ? 'Gain' : 'Loss',
}));

const sectorSpec: ChartSpec = {
  animation: true,
  mark: 'bar',
  data: sectorReturns,
  encoding: {
    x: {
      field: 'return',
      type: 'quantitative',
      axis: { title: 'Total return (%)', format: '+.0f' },
    },
    y: { field: 'sector', type: 'nominal' },
    color: {
      field: 'direction',
      type: 'nominal',
      scale: { domain: ['Gain', 'Loss'], range: [ACCENT, '#d1495b'] },
    },
  },
  legend: { show: false },
  annotations: [
    { type: 'refline', x: 0, style: 'solid', stroke: '#334155', strokeWidth: 1.5 },
    {
      type: 'refline',
      x: 23.3,
      label: 'S&P 500: +23.3%',
      style: 'dashed',
      stroke: '#64748b',
      strokeWidth: 1,
    },
  ],
  labels: { density: 'all', format: '+.1f' },
  chrome: {
    title: 'Only Materials Ended the Year in the Red',
    subtitle: 'S&P 500 total return by sector, full year',
    source: sp500SectorReturns.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 6. Composed mini-dashboard — 2x2 grid, full-bleed
// ---------------------------------------------------------------------------

const tileTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 12,
};

/** KPI pill row rendered as a compact custom card (not a full chart). */
function KpiTile() {
  const t = dashTokens(useOcMode() === 'dark');
  const pills = [
    { label: 'Revenue', value: '$60.9B', delta: '+94% YoY' },
    { label: 'Net margin', value: '55.6%', delta: '+12pp' },
    { label: 'Data center', value: '$47.5B', delta: '+112% YoY' },
    { label: 'Gross margin', value: '75.0%', delta: '+2pp' },
  ];
  return (
    <div style={{ color: t.text }}>
      <div style={{ ...tileTitleStyle, color: t.muted }}>Quarterly scorecard</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {pills.map((p) => (
          <div key={p.label}>
            <div style={{ fontSize: 11, color: t.muted, marginBottom: 2 }}>{p.label}</div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {p.value}
            </div>
            <div style={{ fontSize: 11, fontWeight: 500, color: t.up }}>{p.delta}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A single sparkline tile for the composed grid. */
function SparkTile() {
  const t = dashTokens(useOcMode() === 'dark');
  const idx = marketIndices.indices[1]; // Nasdaq
  const change = pctChange(idx.series);
  const last = idx.series[idx.series.length - 1]?.value ?? 0;
  return (
    <div style={{ color: t.text }}>
      <div style={{ ...tileTitleStyle, color: t.muted }}>Nasdaq</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span
          style={{
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {last.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            fontVariantNumeric: 'tabular-nums',
            color: change.up ? t.up : t.down,
          }}
        >
          {change.text}
        </span>
      </div>
      <div style={{ height: 56, marginTop: 12 }}>
        <Chart spec={sparklineSpec('area', idx.series)} />
      </div>
    </div>
  );
}

/** Compact bar list for the composed grid. */
const composedMoversSpec: BarListSpec = {
  type: 'barlist',
  data: [...programmingLanguages.data].slice(0, 5),
  encoding: {
    label: { field: 'language', type: 'nominal' as const },
    value: { field: 'pct', type: 'quantitative' as const },
    color: { field: 'category', type: 'nominal' as const },
  },
  valueFormat: '.1f',
  barHeight: 8,
  chrome: { title: 'Language leaders' },
  watermark: false,
};

/** Compact sector bars for the composed grid. */
const composedSectorSpec: ChartSpec = {
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
  labels: { density: 'none' },
  annotations: [{ type: 'refline', x: 0, style: 'solid', strokeWidth: 1 }],
  chrome: { title: 'Sector returns' },
  watermark: false,
};

// Scoped grid CSS for the composed dashboard: a true 2x2 at wide widths that
// collapses to a single column under 640px. Inline styles can't express a media
// query, so this one small scoped block lives in the story rather than touching
// the shared gallery.css. The `.oc-dash-2x2` class is unique to this page.
const COMPOSED_GRID_CSS = `
.oc-dash-2x2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
@media (max-width: 640px) {
  .oc-dash-2x2 { grid-template-columns: minmax(0, 1fr); }
}
`;

function ComposedDashboard() {
  const t = dashTokens(useOcMode() === 'dark');
  const panelStyle: React.CSSProperties = {
    padding: 16,
    border: t.border,
    borderRadius: 8,
    background: t.surface,
  };
  // The 2x2 grid fills its Demo card. It is NOT wrapped in `.oc-bleed`: that
  // breakout is for Showcase pieces where `.oc-bleed` wraps the whole Demo from
  // OUTSIDE. Here the composition lives INSIDE a `.oc-demo` card (border +
  // `overflow: hidden`), so a `.oc-bleed` child would break past the card's
  // clip boundary and get its left edge cut off at wide widths.
  return (
    <>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, page-local CSS */}
      <style dangerouslySetInnerHTML={{ __html: COMPOSED_GRID_CSS }} />
      <div className="oc-dash-2x2">
        <div style={panelStyle}>
          <KpiTile />
        </div>
        <div style={panelStyle}>
          <SparkTile />
        </div>
        <div style={panelStyle}>
          <div style={{ height: 300 }}>
            <Chart spec={composedSectorSpec} />
          </div>
        </div>
        <div style={panelStyle}>
          <div style={{ height: 300 }}>
            <BarList spec={composedMoversSpec} />
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default { title: 'Dashboards' };

export const Dashboards = () => (
  <GalleryPage
    title="Dashboards"
    lede="The same spec grammar, shrunk for product surfaces. Sparklines strip every bit of chrome to fit a KPI card, metric pills sit above a compact chart, bar lists rank at a glance, and a crosshair tracks the nearest point. The last section assembles them into four complete dashboards — SaaS analytics, ops monitoring, markets, and a marketing funnel — each following the same chrome economy: one hero chart carries the title, source, and watermark, and every other tile stays quiet."
  >
    <Section
      id="building-blocks"
      title="Building blocks"
      lede="Each dashboard primitive on its own: sparkline cards, KPI pills, a bar list, a crosshair line, and conditional-color bars."
    >
      <Demo
        id="sparkline-cards"
        title="Sparkline card grid"
        description="display: 'sparkline' strips chrome, axes, and legend so a mini-chart fits in a card. Trend color, endpoint dot, and area gradient come from the engine's sparkline defaults."
        specForPanel={sparklineExampleSpec}
      >
        <SparklineCards />
      </Demo>
      <Demo
        id="kpi-metrics"
        title="KPI metric pills"
        description="The chrome `metrics` array renders a row of label/value pills above the plot, each with an optional delta and secondary value. They auto-strip when the container is too narrow or short."
        spec={kpiSpec}
        height={520}
      />
      <Demo
        id="bar-list"
        title="Bar list (ranked movers)"
        description="A compact ranked list with inline proportional bars — the densest way to show a leaderboard in a dashboard card."
        spec={moversSpec}
        height={360}
      />
      <Demo
        id="crosshair-line"
        title="Financial line with crosshair"
        description="crosshair: true drops a vertical snap line that tracks the nearest data point across every series — hover the plot to see it. Endpoint labels replace a legend."
        spec={crosshairSpec}
        height={440}
      />
      <Demo
        id="sector-returns"
        title="Sector returns (conditional color)"
        description="A direction field in the data drives a two-color scale so the single losing sector reads instantly against a solid zero reference line."
        spec={sectorSpec}
        height={440}
      />
    </Section>

    <Section
      id="composed"
      title="Composed dashboard"
      lede="The primitives assembled into one product layout: a 2x2 grid mixing KPI pills, a sparkline tile, and two compact charts. It reflows to a single column on narrow screens."
    >
      {/* No fixed height: the grid reflows to one column on narrow screens
          and would clip inside a pinned wrapper. Tiles pin their own chart
          heights, so auto-height is stable. Same for the card grid above. */}
      <Demo id="mini-dashboard" specForPanel={composedSectorSpec}>
        <ComposedDashboard />
      </Demo>
    </Section>

    <Section
      id="layouts"
      title="Full layouts"
      lede="Four complete product dashboards. Each follows the same two rules: one hero chart owns the takeaway title, the cited source, and the watermark, while supporting tiles carry a terse label or nothing at all. Every grid collapses to a single column under 640px."
    >
      <Demo
        id="saas-overview"
        title="SaaS analytics overview"
        description="Stat cards, a hero MRR area chart, a signups tile, a bar list, and a compact table. The signups tile is the one to watch: its spec sets no watermark key at all, and its container is pinned to 180px, so the engine auto-hides the brand in that cramped height. The table sets watermark: false explicitly — tables resolve it outside the auto-hide."
        specForPanel={saasMrrSpec}
      >
        <SaasDashboard />
      </Demo>
      <Demo
        id="ops-monitoring"
        title="Ops / monitoring"
        description="A strip of four 44px sparkline cards over the hero incident timeline, with an SLO reference line at 1% and a text annotation on the spike. The status donut pins Healthy/Degraded/Down to green/amber/red so the color never shifts with the data."
        specForPanel={opsErrorSpec}
      >
        <OpsDashboard />
      </Demo>
      <Demo
        id="markets-overview"
        title="Finance / markets"
        description="The sparkline card renderer from the first demo, reused over four indices, above a crosshair index comparison and a diverging sector chart. Endpoint labels replace the legend on the hero so the tile spends no vertical space on chrome it doesn't need."
        specForPanel={marketsCompareSpec}
      >
        <MarketsDashboard />
      </Demo>
      <Demo
        id="marketing-funnel"
        title="Marketing funnel"
        description="A sankey hero traces the cohort from landing page to paying user; conversion trends and channel mix sit underneath. Sankeys resolve their watermark outside the chart auto-hide, so the hero keeps the brand deliberately and both supporting tiles opt out."
        specForPanel={funnelSankeySpec}
      >
        <MarketingDashboard />
      </Demo>
    </Section>
  </GalleryPage>
);
