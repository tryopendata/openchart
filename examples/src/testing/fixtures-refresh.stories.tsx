/**
 * Testing / Fixtures Refresh — pinned e2e stories for the design-refresh
 * defaults that had no baseline of their own.
 *
 * Flat bars with value-end rounding (phase 1), the donut center stat (phase 1),
 * and the two new core presets (phase 8). Frozen contract: do not restyle.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { broadsheet, terminal } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import './testing.css';

export default { title: 'Testing / Fixtures Refresh' };

// ---------------------------------------------------------------------------
// SimpleColumnsFlat — zero-config bar fill: flat palette color with a 2px
// radius on the value end only. The pinned `simple-columns` fixture passes an
// explicit gradient, so nothing covered the default.
// ---------------------------------------------------------------------------

const flatColumnsSpec: ChartSpec = {
  animation: true,
  mark: { type: 'bar' },
  data: [
    { quarter: 'Q1 2023', starts: 1.42 },
    { quarter: 'Q2 2023', starts: 1.45 },
    { quarter: 'Q3 2023', starts: 1.38 },
    { quarter: 'Q4 2023', starts: 1.49 },
    { quarter: 'Q1 2024', starts: 1.52 },
    { quarter: 'Q2 2024', starts: 1.35 },
    { quarter: 'Q3 2024', starts: 1.29 },
    { quarter: 'Q4 2024', starts: 1.33 },
  ],
  encoding: {
    x: { field: 'quarter', type: 'nominal' },
    y: {
      field: 'starts',
      type: 'quantitative',
      axis: { title: 'Annualized starts (millions)' },
    },
  },
  labels: { density: 'all', format: '.2f' },
  chrome: {
    title: 'Homebuilders Pulled Back in the Second Half of 2024',
    subtitle: 'US privately owned housing starts, seasonally adjusted annual rate',
    source: 'Source: US Census Bureau, Survey of Construction',
    byline: 'Chart: OpenChart',
  },
};

export const SimpleColumnsFlat = () => (
  <div className="tfix-chart tfix-h-400">
    <Chart spec={flatColumnsSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// DonutCenterLabel — MarkDef.centerLabel, the opt-in donut center stat.
// ---------------------------------------------------------------------------

const centerLabelSpec: ChartSpec = {
  animation: true,
  mark: {
    type: 'arc',
    innerRadius: 78,
    centerLabel: { text: '41%', subtitle: 'wind and solar' },
  },
  data: [
    { source: 'Wind', share: 24.1 },
    { source: 'Solar', share: 16.9 },
    { source: 'Nuclear', share: 22.8 },
    { source: 'Gas', share: 17.2 },
    { source: 'Hydro', share: 12.4 },
    { source: 'Coal', share: 6.6 },
  ],
  encoding: {
    theta: { field: 'share', type: 'quantitative' },
    color: { field: 'source', type: 'nominal' },
  },
  chrome: {
    title: 'Wind and Solar Now Out-Generate Every Fossil Fuel',
    subtitle: 'Share of gross electricity generation, 2024 (%)',
    source: 'Source: Fraunhofer ISE, Energy-Charts',
  },
};

export const DonutCenterLabel = () => (
  <div className="tfix-chart tfix-h-500">
    <Chart spec={centerLabelSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Presets — broadsheet (warm paper, red masthead rule) and terminal (dark in
// both modes, one cyan accent). One spec, two house styles.
// ---------------------------------------------------------------------------

const presetSpec: ChartSpec = {
  animation: false,
  mark: { type: 'line', interpolate: 'monotone' },
  data: [
    { year: 2019, region: 'Euro area', rate: 1.2 },
    { year: 2020, region: 'Euro area', rate: 0.3 },
    { year: 2021, region: 'Euro area', rate: 2.6 },
    { year: 2022, region: 'Euro area', rate: 8.4 },
    { year: 2023, region: 'Euro area', rate: 5.4 },
    { year: 2024, region: 'Euro area', rate: 2.4 },
    { year: 2019, region: 'United States', rate: 1.8 },
    { year: 2020, region: 'United States', rate: 1.2 },
    { year: 2021, region: 'United States', rate: 4.7 },
    { year: 2022, region: 'United States', rate: 8.0 },
    { year: 2023, region: 'United States', rate: 4.1 },
    { year: 2024, region: 'United States', rate: 2.9 },
  ],
  encoding: {
    x: { field: 'year', type: 'ordinal' },
    y: { field: 'rate', type: 'quantitative', axis: { title: 'Annual CPI (%)' } },
    color: { field: 'region', type: 'nominal' },
  },
  chrome: {
    eyebrow: 'Prices',
    title: 'Inflation Came Down Faster Than It Went Up',
    subtitle: 'Annual consumer price inflation, 2019-2024',
    source: 'Source: OECD Main Economic Indicators',
  },
};

export const PresetBroadsheet = () => (
  <div className="tfix-chart tfix-h-400">
    <Chart spec={presetSpec} theme={broadsheet} />
  </div>
);

export const PresetTerminal = () => (
  <div className="tfix-chart tfix-h-400">
    <Chart spec={presetSpec} theme={terminal} />
  </div>
);
