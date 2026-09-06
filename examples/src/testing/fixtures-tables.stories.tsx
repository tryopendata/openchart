/**
 * Testing / Fixtures Tables — pinned e2e stories for the phase-4 table design
 * system: the three densities, delta chips, inline bars, heatmap cells in dark
 * mode, shared-domain sparklines, and the sub-400px cards collapse.
 *
 * Inline data keeps the fixtures frozen. Do not restyle: pixel contract.
 */

import type { TableSpec } from '@opendata-ai/openchart-core';
import { DataTable } from '@opendata-ai/openchart-react';
import './testing.css';

export default { title: 'Testing / Fixtures Tables' };

// ---------------------------------------------------------------------------
// Frozen data
// ---------------------------------------------------------------------------

const economies = [
  { country: 'United States', zip: '20500', population: 334_900_000, gdp: 80_035, life: 79.3 },
  { country: 'China', zip: '100000', population: 1_411_000_000, gdp: 12_720, life: 78.2 },
  { country: 'Japan', zip: '100-0001', population: 124_500_000, gdp: 33_815, life: 84.0 },
  { country: 'Germany', zip: '10115', population: 84_500_000, gdp: 51_384, life: 81.2 },
  { country: 'India', zip: '110001', population: 1_428_000_000, gdp: 2_485, life: 70.8 },
  { country: 'United Kingdom', zip: 'SW1A', population: 68_300_000, gdp: 46_125, life: 81.3 },
  { country: 'France', zip: '75001', population: 68_100_000, gdp: 44_408, life: 82.5 },
  { country: 'Brazil', zip: '70000', population: 216_400_000, gdp: 8_918, life: 75.9 },
];

// `flights` and `seats` are counts in thousands, so the totals footer sums
// something a reader would actually add up. `change` and `delayChange` are
// year-on-year moves in percentage points, and delta columns are never summed.
const carriers = [
  { carrier: 'Delta', flights: 1_142, seats: 5_420, onTime: 84.2, change: 3.1, delayChange: -1.4 },
  { carrier: 'United', flights: 1_004, seats: 4_980, onTime: 80.6, change: 1.8, delayChange: -0.6 },
  {
    carrier: 'American',
    flights: 1_236,
    seats: 5_610,
    onTime: 78.4,
    change: -0.6,
    delayChange: 0.9,
  },
  {
    carrier: 'Southwest',
    flights: 1_318,
    seats: 4_310,
    onTime: 76.9,
    change: -4.2,
    delayChange: 2.7,
  },
  { carrier: 'Alaska', flights: 284, seats: 1_180, onTime: 82.1, change: 2.4, delayChange: -0.8 },
  { carrier: 'JetBlue', flights: 262, seats: 1_040, onTime: 71.3, change: -6.5, delayChange: 4.1 },
];

// Every row is the same measure on the same units, which is the only case where
// the shared sparkline domain (the default) is worth having: the height of the
// UK spike against the Japanese line is the story. A shared domain across
// mixed-magnitude series flattens the small ones into straight lines.
const inflationPaths = [
  {
    economy: 'United Kingdom',
    peak: 11.1,
    latest: 2.5,
    change: -8.6,
    trend: [5.5, 9.0, 10.1, 11.1, 10.1, 8.7, 6.7, 2.5],
  },
  {
    economy: 'Euro area',
    peak: 10.6,
    latest: 2.4,
    change: -8.2,
    trend: [5.1, 8.1, 9.9, 10.6, 8.6, 6.1, 5.2, 2.4],
  },
  {
    economy: 'United States',
    peak: 9.1,
    latest: 2.9,
    change: -6.2,
    trend: [7.9, 8.6, 9.1, 7.7, 6.0, 4.0, 3.7, 2.9],
  },
  {
    economy: 'Canada',
    peak: 8.1,
    latest: 2.5,
    change: -5.6,
    trend: [5.7, 7.7, 8.1, 6.9, 5.2, 3.4, 3.8, 2.5],
  },
  {
    economy: 'Japan',
    peak: 4.3,
    latest: 2.8,
    change: -1.5,
    trend: [0.9, 2.5, 3.0, 4.3, 3.3, 3.2, 2.8, 2.8],
  },
];

// ---------------------------------------------------------------------------
// BasicRegular — the default 48px density, inferred alignment (a ZIP-shaped
// key stays left even though its values are numeric), compact formatting.
// ---------------------------------------------------------------------------

const basicSpec: TableSpec = {
  type: 'table',
  data: economies,
  columns: [
    { key: 'country', label: 'Country' },
    { key: 'zip', label: 'Capital ZIP' },
    { key: 'population', label: 'Population', format: 'compact' },
    { key: 'gdp', label: 'GDP/capita (PPP)', format: '$,.0f' },
    { key: 'life', label: 'Life exp.', format: '.1f' },
  ],
  chrome: {
    title: 'Eight Economies, One Row Each',
    subtitle: 'Population, income, and longevity for the largest economies',
    source: 'Source: World Bank, World Development Indicators',
  },
};

export const BasicRegular = () => (
  <div className="tfix-chart">
    <DataTable spec={basicSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// DeltaBarsCondensed — delta chips, an inline bar column, condensed 40px rows,
// and the sticky totals footer.
// ---------------------------------------------------------------------------

const deltaSpec: TableSpec = {
  type: 'table',
  data: carriers,
  columns: [
    { key: 'carrier', label: 'Carrier' },
    { key: 'flights', label: 'Flights (000)', format: ',.0f', bar: {} },
    { key: 'seats', label: 'Seats (000)', format: ',.0f' },
    { key: 'change', label: 'On time vs 2023', format: '.1f', delta: true },
    { key: 'delayChange', label: 'Delay vs 2023', format: '.1f', delta: { invert: true } },
  ],
  chrome: {
    title: 'Southwest Flew the Most, JetBlue Slipped the Furthest',
    subtitle: 'Mainline departures and the year-on-year move in punctuality, 2024',
    source: 'Source: Bureau of Transportation Statistics',
  },
  density: 'condensed',
  striped: true,
  totalRow: true,
};

export const DeltaBarsCondensed = () => (
  <div className="tfix-chart">
    <DataTable spec={deltaSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// HeatmapDark — heatmap cells picking accessible ink against the filled
// background, in dark mode.
// ---------------------------------------------------------------------------

const heatmapSpec: TableSpec = {
  type: 'table',
  data: carriers,
  columns: [
    { key: 'carrier', label: 'Carrier' },
    { key: 'onTime', label: 'On time (%)', format: '.1f', heatmap: { palette: 'green' } },
    { key: 'flights', label: 'Flights (000)', format: ',.0f', heatmap: { palette: 'orange' } },
    { key: 'seats', label: 'Seats (000)', format: ',.0f' },
  ],
  chrome: {
    title: 'The Same Ranking, Read as Temperature',
    subtitle: 'Punctuality and departures by carrier, 2024',
    source: 'Source: Bureau of Transportation Statistics',
  },
};

// The Ladle host page is light, and a table paints no full-bleed background of
// its own, so the fixture container carries the dark surface. `oc-dark` pulls
// the dark token values in, and the background reads --oc-bg from them rather
// than pinning a hex.
export const HeatmapDark = () => (
  <div className="tfix-chart oc-dark" style={{ background: 'var(--oc-bg)' }}>
    <DataTable spec={heatmapSpec} darkMode="force" />
  </div>
);

// ---------------------------------------------------------------------------
// SparklinesShared — the default shared sparkline domain, where every row is
// normalized against one extent so heights compare down the column.
// ---------------------------------------------------------------------------

const sparklineSpec: TableSpec = {
  type: 'table',
  data: inflationPaths,
  columns: [
    { key: 'economy', label: 'Economy' },
    { key: 'peak', label: 'Peak (%)', format: '.1f' },
    { key: 'latest', label: 'Latest (%)', format: '.1f' },
    { key: 'change', label: 'Since peak', format: '.1f', delta: { invert: true } },
    { key: 'trend', label: '8-quarter path', sparkline: { type: 'line' } },
  ],
  chrome: {
    title: 'Britain Climbed Highest and Had the Furthest to Fall',
    subtitle: 'Annual CPI inflation by quarter, 2022-2024, on one shared domain',
    source: 'Source: OECD Main Economic Indicators',
  },
};

export const SparklinesShared = () => (
  <div className="tfix-chart">
    <DataTable spec={sparklineSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// CardsMobile — under 400px the table collapses to one card per row, with the
// header text carried into each cell's `data-label` and priority-3 columns
// dropped. Captured by the mobile visual project.
// ---------------------------------------------------------------------------

const cardsSpec: TableSpec = {
  type: 'table',
  data: carriers,
  columns: [
    // Exactly one priority-1 column: it becomes the card's headline row with
    // its label suppressed, so a second one would print a big unlabelled
    // number.
    { key: 'carrier', label: 'Carrier', priority: 1 },
    { key: 'onTime', label: 'On time (%)', format: '.1f', priority: 2 },
    { key: 'change', label: 'vs 2023', format: '.1f', delta: true, priority: 2 },
    { key: 'flights', label: 'Flights (000)', format: ',.0f', priority: 2 },
    { key: 'seats', label: 'Seats (000)', format: ',.0f', priority: 3 },
  ],
  chrome: {
    title: 'Punctuality on a Phone',
    subtitle: 'The same table, collapsed to one card per carrier',
    source: 'Source: Bureau of Transportation Statistics',
  },
};

export const CardsMobile = () => (
  <div className="tfix-chart">
    <DataTable spec={cardsSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// ExplicitColumnWidth — a `width: '200px'` column in a fixed 1000px container.
// Regression fixture for the column-width overflow bug (RFC 26 group G): the
// header cell must render at exactly 200px, not 232px (padding without
// border-box) and not rescaled by proportional flex-sizing.
// ---------------------------------------------------------------------------

const explicitWidthSpec: TableSpec = {
  type: 'table',
  data: economies,
  columns: [
    { key: 'country', label: 'Country', width: '200px' },
    { key: 'zip', label: 'Capital ZIP' },
    { key: 'population', label: 'Population', format: 'compact' },
    { key: 'gdp', label: 'GDP/capita (PPP)', format: '$,.0f' },
  ],
  chrome: {
    title: 'Fixed-Width Country Column',
    subtitle: 'One 200px column in a 1000px table',
  },
};

export const ExplicitColumnWidth = () => (
  <div style={{ width: '1000px' }}>
    <DataTable spec={explicitWidthSpec} />
  </div>
);
