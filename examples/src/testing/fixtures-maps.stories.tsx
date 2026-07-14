/**
 * Testing / Fixtures Maps — pinned visual regression stories for the Map
 * (choropleth) component.
 *
 * Three scenarios: US states in light and dark mode (pre-projected Albers)
 * and a world equal-earth projection. Inline data keeps fixtures frozen.
 * Do not restyle: this content is a frozen contract.
 */

import type { MapSpec } from '@opendata-ai/openchart-core';
import { GeoMap } from '@opendata-ai/openchart-react';
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

const usStatesSpec: MapSpec = {
  type: 'map',
  geo: { features: usStatesTopo, projection: 'identity' },
  data: usData,
  encoding: {
    key: { field: 'id', type: 'nominal' },
    color: { field: 'rate', type: 'quantitative' },
  },
  animation: false,
};

const worldEqualEarthSpec: MapSpec = {
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
