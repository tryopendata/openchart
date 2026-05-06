/**
 * Sparklines: tiny inline charts for KPI cards, dashboards, and tight
 * editorial layouts. Same VizSpec grammar as a regular chart, just with
 * `display: 'sparkline'` to strip chrome, axes, legend, and watermark.
 *
 * Stories:
 *  - MarketsDashboard: 6-card grid matching the Sparkline.png mock. Minimal
 *    specs lean on the new sparkline defaults (trend color, endpoint dot,
 *    area gradient).
 *  - TrendColors: up / down / neutral side-by-side. Demonstrates the linear
 *    regression slope + deadband classifier.
 *  - BarVariants: full-range default vs explicit zero-baseline vs stacked.
 *  - Sizes: same data rendered at five widths to verify endpoint-dot scaling
 *    and y-domain auto-tightening at small sizes.
 */

import type { Story } from '@ladle/react';
import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart, useDarkMode, useVizDarkMode } from '@opendata-ai/openchart-react';

const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif';

const pageViewsSeries = [
  82, 91, 78, 88, 102, 95, 87, 110, 98, 92, 115, 105, 99, 122, 108, 101, 128, 114, 106, 132,
];

// Markets-dashboard series — generated as biased random walks so each sparkline
// shows realistic chop, dips, and rallies. A deterministic mulberry32 PRNG
// keeps the look stable across reloads (no flicker between renders).
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build a noisy walk that ends near `start * (1 + drift)`. `volatility`
 * controls per-step swing relative to the value (0.005 = ~0.5% chop).
 */
function walk(
  start: number,
  steps: number,
  drift: number,
  volatility: number,
  seed: number,
): number[] {
  const rng = mulberry32(seed);
  const values: number[] = [start];
  // Per-step expected drift to land near the target.
  const stepDrift = drift / (steps - 1);
  for (let i = 1; i < steps; i++) {
    const last = values[i - 1];
    const noise = (rng() - 0.5) * 2 * volatility * last;
    values.push(last * (1 + stepDrift) + noise);
  }
  return values;
}

const N_POINTS = 40;
const sp500Series = walk(4180, N_POINTS, 0.062, 0.006, 17);
const nasdaqSeries = walk(13420, N_POINTS, 0.089, 0.009, 41);
const russellSeries = walk(1965, N_POINTS, -0.032, 0.007, 73);
const dowSeries = walk(33420, N_POINTS, 0.03, 0.006, 109);
const ftseSeries = walk(7510, N_POINTS, -0.013, 0.005, 137);
const nikkeiSeries = walk(29810, N_POINTS, 0.086, 0.01, 211);

// Up/down/neutral demo series.
const trendUpSeries = [100, 102, 105, 104, 108, 110, 113, 115, 117, 119, 122, 124, 127, 129, 132];
const trendDownSeries = [132, 129, 127, 124, 122, 119, 117, 115, 113, 110, 108, 104, 105, 102, 100];
const trendNoisySeries = [100, 105, 95, 102, 98, 103, 97, 100, 97, 103, 98, 102, 95, 105, 100];

function toSeries(values: number[]): { date: string; value: number }[] {
  return values.map((value, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    value,
  }));
}

const pageViewsData = toSeries(pageViewsSeries);

const sp500Data = toSeries(sp500Series);
const nasdaqData = toSeries(nasdaqSeries);
const russellData = toSeries(russellSeries);
const dowData = toSeries(dowSeries);
const ftseData = toSeries(ftseSeries);
const nikkeiData = toSeries(nikkeiSeries);

const trendUpData = toSeries(trendUpSeries);
const trendDownData = toSeries(trendDownSeries);
const trendNoisyData = toSeries(trendNoisySeries);

// Minimal sparkline spec — trend color, endpoint dot, and area gradient all
// come from the engine's sparkline defaults. No hand-crafted styling.
function minimalSpec(
  mark: 'line' | 'area' | 'bar',
  data: { date: string; value: number }[],
): ChartSpec {
  return {
    mark,
    data,
    encoding: {
      x: { field: 'date', type: mark === 'bar' ? 'ordinal' : 'temporal' },
      y: { field: 'value', type: 'quantitative' },
    },
    display: 'sparkline',
  };
}

function formatChange(first: number, last: number): { pct: string; up: boolean } {
  const delta = ((last - first) / first) * 100;
  const up = delta >= 0;
  return { pct: `${up ? '+' : ''}${delta.toFixed(2)}%`, up };
}

const marketCards: Array<{
  symbol: string;
  name: string;
  data: { date: string; value: number }[];
  mark: 'line' | 'area';
}> = [
  { symbol: 'SPX', name: 'S&P 500', data: sp500Data, mark: 'area' },
  { symbol: 'IXIC', name: 'Nasdaq', data: nasdaqData, mark: 'area' },
  { symbol: 'RUT', name: 'Russell 2000', data: russellData, mark: 'line' },
  { symbol: 'DJI', name: 'Dow Jones', data: dowData, mark: 'line' },
  { symbol: 'FTSE', name: 'FTSE 100', data: ftseData, mark: 'line' },
  { symbol: 'N225', name: 'Nikkei 225', data: nikkeiData, mark: 'area' },
];

export const MarketsDashboard: Story = () => {
  const contextDark = useVizDarkMode();
  const dark = useDarkMode(contextDark);

  const cardBg = dark ? '#0b1220' : '#ffffff';
  const cardBorder = dark ? '1px solid #1f2937' : '1px solid #e5e7eb';
  const labelColor = dark ? '#94a3b8' : '#6b7280';
  const fgColor = dark ? '#e5e7eb' : '#111827';

  return (
    <div
      style={{
        padding: 24,
        maxWidth: 1080,
        fontFamily: SANS,
        color: fgColor,
      }}
    >
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          marginBottom: 16,
        }}
      >
        Markets
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
        }}
      >
        {marketCards.map((card) => {
          const first = card.data[0]?.value ?? 0;
          const last = card.data[card.data.length - 1]?.value ?? 0;
          const change = formatChange(first, last);
          return (
            <div
              key={card.symbol}
              style={{
                padding: 16,
                border: cardBorder,
                borderRadius: 8,
                background: cardBg,
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
                <div style={{ fontSize: 12, fontWeight: 500, color: labelColor }}>{card.name}</div>
                <div
                  style={{
                    fontFamily:
                      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                    fontSize: 11,
                    color: labelColor,
                  }}
                >
                  {card.symbol}
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {last.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    fontVariantNumeric: 'tabular-nums',
                    color: change.up ? '#16a34a' : '#dc2626',
                  }}
                >
                  {change.pct}
                </div>
              </div>
              <div style={{ height: 48 }}>
                <Chart spec={minimalSpec(card.mark, card.data)} darkMode={dark ? 'force' : 'off'} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const TrendColors: Story = () => {
  const contextDark = useVizDarkMode();
  const dark = useDarkMode(contextDark);

  const cards: Array<{
    label: string;
    note: string;
    data: { date: string; value: number }[];
  }> = [
    { label: 'Clear up-trend', note: 'positive slope > deadband', data: trendUpData },
    { label: 'Clear down-trend', note: 'negative slope > deadband', data: trendDownData },
    { label: 'Noisy / neutral', note: 'slope inside deadband', data: trendNoisyData },
  ];

  return (
    <div
      style={{
        padding: 24,
        fontFamily: SANS,
        color: dark ? '#e5e7eb' : '#111827',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        {cards.map((c) => (
          <div
            key={c.label}
            style={{
              padding: 16,
              border: dark ? '1px solid #1f2937' : '1px solid #e5e7eb',
              borderRadius: 8,
              background: dark ? '#0b1220' : '#fff',
              width: 240,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{c.label}</div>
            <div
              style={{
                fontSize: 11,
                color: dark ? '#94a3b8' : '#6b7280',
                marginBottom: 12,
              }}
            >
              {c.note}
            </div>
            <div style={{ height: 48 }}>
              <Chart spec={minimalSpec('area', c.data)} darkMode={dark ? 'force' : 'off'} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const BarVariants: Story = () => {
  const contextDark = useVizDarkMode();
  const dark = useDarkMode(contextDark);

  // Stacked: same x-categories with two series. Only relevant for the third
  // card; flatten pageViewsData for the others.
  const stackedData = [
    ...pageViewsData.map((d) => ({ ...d, segment: 'a', value: d.value * 0.55 })),
    ...pageViewsData.map((d) => ({ ...d, segment: 'b', value: d.value * 0.45 })),
  ];

  const stackedSpec: ChartSpec = {
    mark: 'bar',
    data: stackedData,
    encoding: {
      x: { field: 'date', type: 'ordinal' },
      y: { field: 'value', type: 'quantitative', stack: 'zero' },
      color: { field: 'segment', type: 'nominal' },
    },
    display: 'sparkline',
  };

  // Explicit zero-baseline override — defeats the new [min, max] default.
  const zeroBaselineSpec: ChartSpec = {
    mark: 'bar',
    data: pageViewsData,
    encoding: {
      x: { field: 'date', type: 'ordinal' },
      y: { field: 'value', type: 'quantitative', scale: { zero: true } },
    },
    display: 'sparkline',
  };

  const cards: Array<{ label: string; note: string; spec: ChartSpec }> = [
    {
      label: 'Default ([min, max] domain)',
      note: 'shortest bar still visible',
      spec: minimalSpec('bar', pageViewsData),
    },
    {
      label: 'Explicit zero baseline',
      note: 'scale: { zero: true }',
      spec: zeroBaselineSpec,
    },
    {
      label: 'Stacked (keeps [0, max])',
      note: 'stack arithmetic preserved',
      spec: stackedSpec,
    },
  ];

  return (
    <div
      style={{
        padding: 24,
        fontFamily: SANS,
        color: dark ? '#e5e7eb' : '#111827',
      }}
    >
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {cards.map((c) => (
          <div
            key={c.label}
            style={{
              padding: 16,
              border: dark ? '1px solid #1f2937' : '1px solid #e5e7eb',
              borderRadius: 8,
              background: dark ? '#0b1220' : '#fff',
              width: 240,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{c.label}</div>
            <div
              style={{
                fontSize: 11,
                color: dark ? '#94a3b8' : '#6b7280',
                marginBottom: 12,
              }}
            >
              {c.note}
            </div>
            <div style={{ height: 48 }}>
              <Chart spec={c.spec} darkMode={dark ? 'force' : 'off'} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const Sizes: Story = () => {
  const contextDark = useVizDarkMode();
  const dark = useDarkMode(contextDark);

  // Same data across all sizes so the only thing varying is dimensions.
  const lineSpec = minimalSpec('line', sp500Data);
  const areaSpec = minimalSpec('area', nasdaqData);
  const barSpec = minimalSpec('bar', pageViewsData);

  const sizes: Array<{ label: string; width: number; height: number }> = [
    { label: 'Tiny (60 × 16)', width: 60, height: 16 },
    { label: 'Small (100 × 24)', width: 100, height: 24 },
    { label: 'Medium (160 × 36)', width: 160, height: 36 },
    { label: 'Large (240 × 56)', width: 240, height: 56 },
    { label: 'XL (360 × 80)', width: 360, height: 80 },
  ];

  const fg = dark ? '#e5e7eb' : '#111827';
  const muted = dark ? '#94a3b8' : '#6b7280';
  const border = dark ? '1px solid #1f2937' : '1px solid #e5e7eb';
  const cardBg = dark ? '#0b1220' : '#fff';

  function Row({ title, spec }: { title: string; spec: ChartSpec }) {
    return (
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: muted,
            marginBottom: 12,
          }}
        >
          {title}
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {sizes.map((s) => (
            <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div
                style={{
                  width: s.width,
                  height: s.height,
                  padding: 4,
                  border,
                  borderRadius: 6,
                  background: cardBg,
                  boxSizing: 'content-box',
                }}
              >
                <Chart spec={spec} darkMode={dark ? 'force' : 'off'} />
              </div>
              <div style={{ fontSize: 10, color: muted, fontVariantNumeric: 'tabular-nums' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, fontFamily: SANS, color: fg }}>
      <div
        style={{
          fontSize: 13,
          color: muted,
          marginBottom: 20,
          maxWidth: 640,
          lineHeight: 1.5,
        }}
      >
        Same spec at five sizes — from inline-with-text up to a full dashboard widget. The endpoint
        dot scales sensibly and the y-domain auto-tightens so variation reads at every size.
      </div>
      <Row title="Line" spec={lineSpec} />
      <Row title="Area" spec={areaSpec} />
      <Row title="Bar" spec={barSpec} />
    </div>
  );
};
