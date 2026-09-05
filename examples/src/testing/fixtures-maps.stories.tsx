/**
 * Testing / Fixtures Maps — pinned visual regression stories for the Map
 * (choropleth) component.
 *
 * Three scenarios: US states in light and dark mode (pre-projected Albers)
 * and a world equal-earth projection, plus (design refresh, phase 5) a US
 * bubble overlay and a diverging quantize choropleth. Inline data keeps
 * fixtures frozen. Do not restyle: this content is a frozen contract.
 */

import type { GeoMapSpec } from '@opendata-ai/openchart-core';
import { DIVERGING_PALETTES } from '@opendata-ai/openchart-core';
import { GeoMap } from '@opendata-ai/openchart-react';
import usStatesUnprojected from 'us-atlas/states-10m.json';
import usStatesTopo from 'us-atlas/states-albers-10m.json';
import worldTopo from 'world-atlas/countries-110m.json';
import './testing.css';

// ---------------------------------------------------------------------------
// Frozen data
// ---------------------------------------------------------------------------

const usData = [
  { id: '01', rate: 2.7 },
  { id: '02', rate: 4.8 },
  { id: '04', rate: 4.7 },
  { id: '05', rate: 4.2 },
  { id: '06', rate: 5.3 },
  { id: '08', rate: 3.8 },
  { id: '09', rate: 4.8 },
  { id: '10', rate: 5.4 },
  { id: '11', rate: 5.7 },
  { id: '12', rate: 4.4 },
  { id: '13', rate: 3.5 },
  { id: '15', rate: 2.4 },
  { id: '16', rate: 3.6 },
  { id: '17', rate: 5.1 },
  { id: '18', rate: 3.6 },
  { id: '19', rate: 3.3 },
  { id: '20', rate: 3.8 },
  { id: '21', rate: 4.2 },
  { id: '22', rate: 4.4 },
  { id: '23', rate: 3.3 },
  { id: '24', rate: 4.3 },
  { id: '25', rate: 4.7 },
  { id: '26', rate: 5.1 },
  { id: '27', rate: 4.9 },
  { id: '28', rate: 3.8 },
  { id: '29', rate: 4.2 },
  { id: '30', rate: 3.6 },
  { id: '31', rate: 3.1 },
  { id: '32', rate: 5.1 },
  { id: '33', rate: 3.0 },
  { id: '34', rate: 4.9 },
  { id: '35', rate: 4.8 },
  { id: '36', rate: 4.4 },
  { id: '37', rate: 3.7 },
  { id: '38', rate: 2.8 },
  { id: '39', rate: 4.0 },
  { id: '40', rate: 3.9 },
  { id: '41', rate: 5.2 },
  { id: '42', rate: 4.2 },
  { id: '44', rate: 4.9 },
  { id: '45', rate: 4.2 },
  { id: '46', rate: 2.3 },
  { id: '47', rate: 3.3 },
  { id: '48', rate: 4.3 },
  { id: '49', rate: 3.8 },
  { id: '50', rate: 2.6 },
  { id: '51', rate: 3.8 },
  { id: '53', rate: 5.1 },
  { id: '54', rate: 4.5 },
  { id: '55', rate: 4.0 },
  { id: '56', rate: 3.8 },
];

const worldData = [
  { id: '840', gdp: 80035 },
  { id: '156', gdp: 12720 },
  { id: '392', gdp: 33815 },
  { id: '276', gdp: 51384 },
  { id: '356', gdp: 2485 },
  { id: '826', gdp: 46125 },
  { id: '250', gdp: 44408 },
  { id: '380', gdp: 37146 },
  { id: '076', gdp: 8918 },
  { id: '124', gdp: 52722 },
  { id: '643', gdp: 12195 },
  { id: '036', gdp: 63529 },
  { id: '410', gdp: 32423 },
  { id: '484', gdp: 10948 },
  { id: '360', gdp: 4788 },
  { id: '528', gdp: 57025 },
  { id: '682', gdp: 30436 },
  { id: '756', gdp: 99994 },
  { id: '792', gdp: 10674 },
  { id: '616', gdp: 18321 },
];

// ---------------------------------------------------------------------------
// Specs
// ---------------------------------------------------------------------------

const usStatesSpec: GeoMapSpec = {
  type: 'map',
  geo: { features: usStatesTopo, projection: 'identity' },
  data: usData,
  encoding: {
    key: { field: 'id', type: 'nominal' },
    color: { field: 'rate', type: 'quantitative' },
  },
  animation: false,
};

const worldEqualEarthSpec: GeoMapSpec = {
  type: 'map',
  geo: { features: worldTopo, projection: 'equalEarth' },
  data: worldData,
  encoding: {
    key: { field: 'id', type: 'nominal' },
    color: { field: 'gdp', type: 'quantitative' },
  },
  animation: false,
};

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export default { title: 'Testing / Fixtures Maps' };

export const UsStatesLight = () => (
  <div className="tfix-chart tfix-h-500">
    <GeoMap spec={usStatesSpec} />
  </div>
);

export const UsStatesDark = () => (
  <div className="tfix-chart tfix-h-500">
    <GeoMap spec={usStatesSpec} darkMode="force" />
  </div>
);

export const WorldEqualEarth = () => (
  <div className="tfix-chart tfix-h-400">
    <GeoMap spec={worldEqualEarthSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// UsBubbles (design refresh, phase 5) — sqrt-area symbols over a basemap:
// knockout strokes, large drawn under small, and the nested size legend.
// ---------------------------------------------------------------------------

const metroPopulations = [
  { metro: 'New York', lat: 40.71, lon: -74.01, people: 19_500_000 },
  { metro: 'Los Angeles', lat: 34.05, lon: -118.24, people: 12_800_000 },
  { metro: 'Chicago', lat: 41.88, lon: -87.63, people: 9_260_000 },
  { metro: 'Dallas', lat: 32.78, lon: -96.8, people: 8_100_000 },
  { metro: 'Houston', lat: 29.76, lon: -95.37, people: 7_510_000 },
  { metro: 'Atlanta', lat: 33.75, lon: -84.39, people: 6_310_000 },
  { metro: 'Miami', lat: 25.76, lon: -80.19, people: 6_180_000 },
  { metro: 'Phoenix', lat: 33.45, lon: -112.07, people: 5_070_000 },
  { metro: 'Boston', lat: 42.36, lon: -71.06, people: 4_920_000 },
  { metro: 'Detroit', lat: 42.33, lon: -83.05, people: 4_340_000 },
  { metro: 'Seattle', lat: 47.61, lon: -122.33, people: 4_020_000 },
  { metro: 'Minneapolis', lat: 44.98, lon: -93.27, people: 3_690_000 },
  { metro: 'Denver', lat: 39.74, lon: -104.99, people: 3_010_000 },
  { metro: 'Salt Lake City', lat: 40.76, lon: -111.89, people: 1_270_000 },
  { metro: 'New Orleans', lat: 29.95, lon: -90.07, people: 1_260_000 },
];

const usBubblesSpec: GeoMapSpec = {
  type: 'map',
  geo: { features: usStatesUnprojected, projection: 'albersUsa' },
  data: [],
  encoding: { key: { field: 'id', type: 'nominal' } },
  points: {
    data: metroPopulations,
    longitude: { field: 'lon', type: 'quantitative' },
    latitude: { field: 'lat', type: 'quantitative' },
    size: { field: 'people', type: 'quantitative', title: 'Metro population' },
    key: { field: 'metro', type: 'nominal' },
  },
  chrome: {
    title: 'A Third of Americans Live in Fifteen Metros',
    subtitle: 'Circle area is proportional to metropolitan population, 2023',
    source: 'Source: US Census Bureau, Metropolitan Statistical Area estimates',
  },
  animation: false,
};

export const UsBubbles = () => (
  <div className="tfix-chart tfix-h-500">
    <GeoMap spec={usBubblesSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// WorldDivergingQuantize (design refresh, phase 5) — a domain straddling zero
// on a diverging ramp: an odd class count centered on 0, with the middle break
// labelled. Maps read the ramp from `scale.range`, not `scale.scheme`, so the
// diverging stops are passed explicitly.
// ---------------------------------------------------------------------------

const growthData = [
  { id: '840', growth: 2.9 },
  { id: '156', growth: 5.2 },
  { id: '392', growth: 1.9 },
  { id: '276', growth: -0.3 },
  { id: '356', growth: 7.8 },
  { id: '826', growth: 0.1 },
  { id: '250', growth: 0.9 },
  { id: '380', growth: 0.7 },
  { id: '076', growth: 2.9 },
  { id: '124', growth: 1.1 },
  { id: '643', growth: 3.6 },
  { id: '036', growth: 2.0 },
  { id: '410', growth: 1.4 },
  { id: '484', growth: 3.2 },
  { id: '360', growth: 5.0 },
  { id: '528', growth: -0.7 },
  { id: '682', growth: -0.8 },
  { id: '756', growth: 0.8 },
  { id: '792', growth: 4.5 },
  { id: '616', growth: 0.2 },
  // The 2023 contractions, so the red half of the ramp is exercised rather
  // than left as a legend swatch nothing on the map ever uses.
  { id: '233', growth: -3.0 },
  { id: '372', growth: -3.2 },
  { id: '246', growth: -1.2 },
  { id: '752', growth: -0.2 },
  { id: '032', growth: -1.6 },
  { id: '710', growth: 0.6 },
  { id: '566', growth: 2.9 },
  { id: '818', growth: 3.8 },
];

const worldDivergingSpec: GeoMapSpec = {
  type: 'map',
  geo: { features: worldTopo, projection: 'equalEarth' },
  data: growthData,
  encoding: {
    key: { field: 'id', type: 'nominal' },
    color: {
      field: 'growth',
      type: 'quantitative',
      title: 'Real GDP growth (%)',
      format: '.1f',
      scale: { range: [...DIVERGING_PALETTES.redBlue] },
    },
  },
  chrome: {
    title: 'Europe Stalled While Asia Kept Growing',
    subtitle: 'Real GDP growth, 2023 (%)',
    source: 'Source: IMF World Economic Outlook',
  },
  animation: false,
};

export const WorldDivergingQuantize = () => (
  <div className="tfix-chart tfix-h-400">
    <GeoMap spec={worldDivergingSpec} />
  </div>
);
