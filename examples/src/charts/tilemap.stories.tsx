/**
 * Tile map stories.
 *
 * Demonstrates US state tile grid maps with sequential color scales,
 * record-map and tabular data formats, palettes, dark mode, chrome,
 * and compact layouts. Data reflects realistic magnitudes.
 */

import type { TileMapSpec } from '@opendata-ai/openchart-core';
import { TileMap } from '@opendata-ai/openchart-react';

// ---------------------------------------------------------------------------
// Shared data: US unemployment rates by state (%)
// ---------------------------------------------------------------------------

const unemploymentData: Record<string, number> = {
  AL: 2.7,
  AK: 6.4,
  AZ: 3.5,
  AR: 3.4,
  CA: 5.4,
  CO: 3.4,
  CT: 4.1,
  DE: 4.4,
  FL: 3.3,
  GA: 3.4,
  HI: 3.2,
  ID: 3.0,
  IL: 4.6,
  IN: 3.3,
  IA: 2.7,
  KS: 3.2,
  KY: 4.4,
  LA: 3.6,
  ME: 3.6,
  MD: 1.8,
  MA: 3.3,
  MI: 4.2,
  MN: 2.8,
  MS: 3.7,
  MO: 3.5,
  MT: 2.9,
  NE: 2.2,
  NV: 5.4,
  NH: 2.4,
  NJ: 4.8,
  NM: 4.1,
  NY: 4.5,
  NC: 3.5,
  ND: 1.9,
  OH: 4.0,
  OK: 3.9,
  OR: 4.2,
  PA: 3.4,
  RI: 3.8,
  SC: 3.3,
  SD: 2.0,
  TN: 3.5,
  TX: 4.1,
  UT: 2.9,
  VT: 2.3,
  VA: 2.9,
  WA: 4.6,
  WV: 4.0,
  WI: 2.9,
  WY: 3.2,
  DC: 5.2,
};

// ---------------------------------------------------------------------------
// Unemployment Rate: record-map data, all 51 states
// ---------------------------------------------------------------------------

const unemploymentSpec: TileMapSpec = {
  type: 'tilemap',
  data: unemploymentData,
  valueFormat: '.1f',
  chrome: {
    title: 'US Unemployment Rate',
    subtitle: 'By state, seasonally adjusted, %',
    source: 'Bureau of Labor Statistics',
  },
  animation: true,
};

export const UnemploymentRate = () => (
  <div className="story-chart story-h-600">
    <TileMap spec={unemploymentSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Partial Data: 10 states to show missing-data handling
// ---------------------------------------------------------------------------

const partialSpec: TileMapSpec = {
  type: 'tilemap',
  data: {
    CA: 5.4,
    TX: 4.1,
    NY: 4.5,
    FL: 3.3,
    IL: 4.6,
    WA: 4.6,
    MA: 3.3,
    GA: 3.4,
    OH: 4.0,
    MI: 4.2,
  },
  valueFormat: '.1f',
  chrome: {
    title: 'Partial State Coverage',
    subtitle: 'Only 10 states with data, remaining show as missing',
  },
};

export const PartialData = () => (
  <div className="story-chart story-h-600">
    <TileMap spec={partialSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Dark Mode: forced dark variant
// ---------------------------------------------------------------------------

const darkModeSpec: TileMapSpec = {
  ...unemploymentSpec,
  darkMode: 'force',
  chrome: {
    title: 'US Unemployment Rate (Dark)',
    subtitle: 'Dark mode variant of the unemployment map',
    source: 'Bureau of Labor Statistics',
  },
};

export const DarkMode = () => (
  <div className="story-chart story-h-600">
    <TileMap spec={darkModeSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Green Palette: population data with green sequential scale
// ---------------------------------------------------------------------------

const populationData: Record<string, number> = {
  AL: 5.1,
  AK: 0.7,
  AZ: 7.4,
  AR: 3.0,
  CA: 39.0,
  CO: 5.8,
  CT: 3.6,
  DE: 1.0,
  FL: 22.2,
  GA: 10.9,
  HI: 1.4,
  ID: 1.9,
  IL: 12.5,
  IN: 6.8,
  IA: 3.2,
  KS: 2.9,
  KY: 4.5,
  LA: 4.6,
  ME: 1.4,
  MD: 6.2,
  MA: 7.0,
  MI: 10.0,
  MN: 5.7,
  MS: 2.9,
  MO: 6.2,
  MT: 1.1,
  NE: 2.0,
  NV: 3.2,
  NH: 1.4,
  NJ: 9.3,
  NM: 2.1,
  NY: 19.5,
  NC: 10.7,
  ND: 0.8,
  OH: 11.8,
  OK: 4.0,
  OR: 4.2,
  PA: 12.8,
  RI: 1.1,
  SC: 5.3,
  SD: 0.9,
  TN: 7.1,
  TX: 30.0,
  UT: 3.4,
  VT: 0.6,
  VA: 8.6,
  WA: 7.7,
  WV: 1.8,
  WI: 5.9,
  WY: 0.6,
  DC: 0.7,
};

const greenPaletteSpec: TileMapSpec = {
  type: 'tilemap',
  data: populationData,
  palette: 'green',
  valueFormat: '.1f',
  chrome: {
    title: 'US Population by State',
    subtitle: 'Estimated population in millions',
    source: 'U.S. Census Bureau',
  },
};

export const GreenPalette = () => (
  <div className="story-chart story-h-600">
    <TileMap spec={greenPaletteSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Tabular Data: DataRow[] format with explicit encoding
// ---------------------------------------------------------------------------

const tabularData = [
  { code: 'CA', rate: 5.4 },
  { code: 'TX', rate: 4.1 },
  { code: 'NY', rate: 4.5 },
  { code: 'FL', rate: 3.3 },
  { code: 'IL', rate: 4.6 },
  { code: 'PA', rate: 3.4 },
  { code: 'OH', rate: 4.0 },
  { code: 'GA', rate: 3.4 },
  { code: 'NC', rate: 3.5 },
  { code: 'MI', rate: 4.2 },
];

const tabularSpec: TileMapSpec = {
  type: 'tilemap',
  data: tabularData,
  encoding: {
    state: { field: 'code', type: 'nominal' },
    value: { field: 'rate', type: 'quantitative' },
  },
  valueFormat: '.1f',
  chrome: {
    title: 'Tabular Data Format',
    subtitle: 'Using DataRow[] with explicit encoding channels',
  },
};

export const TabularData = () => (
  <div className="story-chart story-h-600">
    <TileMap spec={tabularSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// With Chrome: full editorial chrome
// ---------------------------------------------------------------------------

const withChromeSpec: TileMapSpec = {
  type: 'tilemap',
  data: unemploymentData,
  valueFormat: '.1f',
  chrome: {
    title: 'US Unemployment Rate',
    subtitle: 'By state, seasonally adjusted, %',
    source: 'Bureau of Labor Statistics',
    byline: 'Data as of March 2025',
  },
};

export const WithChrome = () => (
  <div className="story-chart story-h-600">
    <TileMap spec={withChromeSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Compact: narrow width variant for responsive testing
// ---------------------------------------------------------------------------

const compactSpec: TileMapSpec = {
  ...unemploymentSpec,
  chrome: {
    title: 'Unemployment Rate',
    subtitle: 'Compact layout at 360px',
  },
};

export const Compact = () => (
  <div className="story-chart story-h-420" style={{ maxWidth: '360px' }}>
    <TileMap spec={compactSpec} />
  </div>
);
