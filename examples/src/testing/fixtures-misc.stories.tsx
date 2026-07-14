/**
 * Testing / Fixtures — misc pinned e2e stories (sankey, chrome, sparkline,
 * rotated-with-source).
 *
 * Verbatim copies of showcase story exports pinned by the Playwright visual
 * and invariant suites. Copied here (with .story- classes renamed to .tfix-)
 * so the gallery redesign can delete/rewrite the originals without breaking
 * the pixel baselines. Do not restyle: this content is a frozen contract.
 */

import type { Story } from '@ladle/react';
import type { ChartSpec, LayerSpec, SankeySpec } from '@opendata-ai/openchart-core';
import { Chart, Sankey, useDarkMode, useVizDarkMode } from '@opendata-ai/openchart-react';
import './testing.css';

export default { title: 'Testing / Fixtures' };

// ---------------------------------------------------------------------------
// Compact (from charts/sankey.stories.tsx)
// ---------------------------------------------------------------------------

const energyFlowSpec: SankeySpec = {
  type: 'sankey',
  data: [
    // Sources -> Intermediate
    { source: 'Coal', target: 'Electricity', value: 46.5 },
    { source: 'Natural Gas', target: 'Electricity', value: 38.2 },
    { source: 'Natural Gas', target: 'Heating', value: 25.8 },
    { source: 'Nuclear', target: 'Electricity', value: 19.7 },
    { source: 'Solar', target: 'Electricity', value: 10.3 },
    { source: 'Wind', target: 'Electricity', value: 14.1 },
    { source: 'Petroleum', target: 'Transport', value: 55.4 },
    { source: 'Petroleum', target: 'Industry', value: 12.3 },
    // Intermediate -> End use
    { source: 'Electricity', target: 'Residential', value: 38.5 },
    { source: 'Electricity', target: 'Commercial', value: 35.8 },
    { source: 'Electricity', target: 'Industry', value: 34.5 },
    { source: 'Heating', target: 'Residential', value: 15.2 },
    { source: 'Heating', target: 'Commercial', value: 10.6 },
    { source: 'Transport', target: 'Passenger', value: 32.1 },
    { source: 'Transport', target: 'Freight', value: 23.3 },
  ],
  encoding: {
    source: { field: 'source', type: 'nominal' },
    target: { field: 'target', type: 'nominal' },
    value: { field: 'value', type: 'quantitative' },
  },
  chrome: {
    title: 'US Energy Flow',
    subtitle: 'From primary sources to end-use sectors, quadrillion BTU',
    source: 'U.S. Energy Information Administration',
  },
  animation: true,
};

const compactSpec: SankeySpec = {
  ...energyFlowSpec,
  chrome: {
    title: 'Energy Flow',
    subtitle: 'Compact layout at 360px',
  },
};

export const Compact = () => (
  <div className="tfix-chart tfix-h-420" style={{ maxWidth: '360px' }}>
    <Sankey spec={compactSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// ChromeAllElements (from chrome.stories.tsx)
// ---------------------------------------------------------------------------

const chromeSpec: ChartSpec = {
  animation: true,
  mark: 'line',
  data: [
    { date: '2020-01-01', value: 10, country: 'US' },
    { date: '2021-01-01', value: 40, country: 'US' },
    { date: '2022-01-01', value: 30, country: 'US' },
    { date: '2020-01-01', value: 15, country: 'UK' },
    { date: '2021-01-01', value: 35, country: 'UK' },
    { date: '2022-01-01', value: 45, country: 'UK' },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
    color: { field: 'country', type: 'nominal' },
  },
  chrome: {
    title: 'GDP Growth Rate',
    subtitle: 'Annual percentage change, 2020-2022',
    source: 'Source: World Bank Open Data',
  },
};

const fullChromeSpec: ChartSpec = {
  ...chromeSpec,
  chrome: {
    title: 'GDP Growth Rate',
    subtitle: 'Annual percentage change, 2020-2022',
    source: 'Source: World Bank Open Data',
    byline: 'By OpenData Team',
    footer: 'Note: Values are seasonally adjusted',
  },
};

export const ChromeAllElements = () => (
  <div className="tfix-chart tfix-h-450">
    <Chart spec={fullChromeSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// RotatedWithSource (from charts/rotated-with-source.stories.tsx)
// ---------------------------------------------------------------------------

const rotatedSpec: ChartSpec = {
  mark: 'bar',
  data: [
    { category: 'Information Technology', value: 32.4 },
    { category: 'Health Care Services', value: 13.1 },
    { category: 'Financial Services', value: 12.8 },
    { category: 'Consumer Discretionary', value: 10.5 },
    { category: 'Communication Services', value: 8.9 },
    { category: 'Industrial Manufacturing', value: 8.4 },
  ],
  encoding: {
    x: { field: 'category', type: 'nominal' },
    y: {
      field: 'value',
      type: 'quantitative',
      axis: { title: 'Weight (%)' },
    },
  },
  chrome: {
    title: 'S&P 500 Sector Weights',
    subtitle: 'Percentage of index market capitalization, June 2024',
    source: 'Source: S&P Dow Jones Indices',
  },
};

export const RotatedWithSource = () => (
  <div className="tfix-chart tfix-h-400">
    <Chart spec={rotatedSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// MarketsDashboard + Sizes (from sparkline.stories.tsx)
// ---------------------------------------------------------------------------

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

// Minimal sparkline spec — trend color, endpoint dot, and area gradient all
// come from the engine's sparkline defaults. No hand-crafted styling.
function minimalSpec(
  mark: 'line' | 'area' | 'bar',
  data: { date: string; value: number }[],
): ChartSpec {
  const y = { field: 'value', type: 'quantitative' } as const;
  // ChartSpec is a union discriminated on `mark`, so an object with a widened
  // 'line' | 'area' | 'bar' mark matches no single arm. Building each spec under
  // a literal mark keeps the discriminant narrow enough for TS to pick the arm.
  if (mark === 'bar') {
    return {
      mark,
      data,
      encoding: { x: { field: 'date', type: 'ordinal' }, y },
      display: 'sparkline',
    };
  }
  const x = { field: 'date', type: 'temporal' } as const;
  if (mark === 'line') {
    return { mark, data, encoding: { x, y }, display: 'sparkline' };
  }
  return { mark, data, encoding: { x, y }, display: 'sparkline' };
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

// ---------------------------------------------------------------------------
// Text mark: direct labeling in a layer
// ---------------------------------------------------------------------------

/**
 * Pins the text mark's positioning contract, which shipped broken and untested:
 * a text layer must resolve the *same* scale domain as the point layer it labels
 * (it didn't — labels drifted up to 160px off their dots), labels must center on
 * their anchor, and `dy` must offset in pixel space. The label layer deliberately
 * carries a subset of the rows, since a narrower extent used to re-fit the
 * domain and slide every label sideways.
 */
const textLabelStates = [
  { label: 'CA', gdp: 3.9, pop: 39.0 },
  { label: 'TX', gdp: 2.6, pop: 30.5 },
  { label: 'NY', gdp: 2.1, pop: 19.6 },
  { label: 'FL', gdp: 1.6, pop: 22.6 },
  { label: 'IL', gdp: 1.1, pop: 12.5 },
  { label: 'PA', gdp: 1.0, pop: 12.9 },
  { label: 'OH', gdp: 0.9, pop: 11.8 },
  { label: 'GA', gdp: 0.8, pop: 11.0 },
  { label: 'NJ', gdp: 0.8, pop: 9.3 },
  { label: 'WA', gdp: 0.8, pop: 7.8 },
];

const TEXT_LABEL_POP_DOMAIN: [number, number] = [5, 43];
// A centered label at the domain edge overhangs by half its width, and nothing
// in the engine reserves room for it, so pad the x-domain for California's.
const TEXT_LABEL_GDP_DOMAIN: [number, number] = [0.6, 4.25];
const TEXT_LABELED = new Set(['CA', 'TX', 'NY', 'FL', 'IL']);

const textMarkLabelSpec: LayerSpec = {
  chrome: {
    title: 'California Towers Over Every Other State Economy',
    subtitle: 'Direct labeling: a text layer over a point layer on shared scales',
  },
  layer: [
    {
      mark: { type: 'point', fill: '#0e7490', opacity: 0.85, trendline: false },
      data: textLabelStates,
      encoding: {
        x: {
          field: 'gdp',
          type: 'quantitative',
          scale: { domain: TEXT_LABEL_GDP_DOMAIN },
          axis: { title: 'GDP ($ trillions)' },
        },
        y: {
          field: 'pop',
          type: 'quantitative',
          scale: { domain: TEXT_LABEL_POP_DOMAIN },
          axis: { title: 'Population (millions)' },
        },
      },
    },
    {
      mark: { type: 'text', dy: -14 },
      data: textLabelStates.filter((d) => TEXT_LABELED.has(d.label)),
      encoding: {
        x: { field: 'gdp', type: 'quantitative', scale: { domain: TEXT_LABEL_GDP_DOMAIN } },
        y: { field: 'pop', type: 'quantitative', scale: { domain: TEXT_LABEL_POP_DOMAIN } },
        text: { field: 'label', type: 'nominal' },
        size: { field: 'gdp', type: 'quantitative', scale: { range: [11, 22] } },
      },
    },
  ],
};

export const TextMarkLabels: Story = () => (
  <div className="tfix-chart" style={{ width: 720, height: 440 }}>
    <Chart spec={textMarkLabelSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Rect mark (heatmap)
//
// `mark: 'rect'` used to alias the column renderer, which needs a linear y
// scale; a heatmap bands both axes, so it emitted zero marks and rendered a
// blank chart. Pinned so the cells can't silently vanish again.
// ---------------------------------------------------------------------------

const HOURS = ['9am', '11am', '1pm', '3pm', '5pm'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

/** Deterministic pseudo-traffic: no Math.random, so the baseline is stable. */
const trafficByHour: ChartSpec = {
  mark: { type: 'rect' },
  data: DAYS.flatMap((day, di) =>
    HOURS.map((hour, hi) => ({
      day,
      hour,
      visits: 20 + ((di * 7 + hi * 13) % 11) * 8 + (hi === 2 ? 30 : 0),
    })),
  ),
  chrome: {
    title: 'Midday Is When the Office Fills Up',
    subtitle: 'Average visits by weekday and hour',
  },
  encoding: {
    x: { field: 'day', type: 'nominal' },
    y: { field: 'hour', type: 'nominal' },
    color: { field: 'visits', type: 'quantitative' },
  },
};

export const RectHeatmap: Story = () => (
  <div className="tfix-chart" style={{ width: 720, height: 440 }}>
    <Chart spec={trafficByHour} />
  </div>
);
