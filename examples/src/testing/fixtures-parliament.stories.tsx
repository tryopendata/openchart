/**
 * Testing / Fixtures: parliament (hemicycle) + election chart pinned e2e stories.
 *
 * Pinned by the Playwright visual suite as the pixel-level contract for the
 * election chart set (plan 22): the US House hemicycle with its 218-seat
 * majority line, an 8-party EU-style hemicycle, the same hemicycle compressed
 * to a mobile container, an election half-donut (arc startAngle/endAngle), and
 * a two-party results bar with a center majority marker. Inline data keeps the
 * fixtures frozen. Do not restyle: this content is a frozen contract.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import './testing.css';

export default { title: 'Testing / Fixtures' };

// ---------------------------------------------------------------------------
// ParliamentUsHouse: 435-seat two-party hemicycle, 218 majority line
// ---------------------------------------------------------------------------

const usHouseSpec: ChartSpec = {
  animation: false,
  mark: 'parliament',
  data: [
    { party: 'Democratic', seats: 213 },
    { party: 'Republican', seats: 222 },
  ],
  encoding: {
    theta: { field: 'seats', type: 'quantitative' },
    color: { field: 'party', type: 'nominal', scale: { range: ['#1b7fa3', '#c44e52'] } },
  },
  chrome: {
    title: 'Republicans Hold a Narrow House Majority',
    subtitle: 'US House of Representatives, 435 seats. 218 seats win control.',
    source: 'Illustrative data',
  },
};

export const ParliamentUsHouse = () => (
  <div className="tfix-chart tfix-h-460">
    <Chart spec={usHouseSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// ParliamentEuMultiParty: 8-party coalition hemicycle, spectrum-ordered
// ---------------------------------------------------------------------------

const euSpec: ChartSpec = {
  animation: false,
  mark: 'parliament',
  data: [
    { group: 'Left', seats: 39 },
    { group: 'Greens', seats: 71 },
    { group: 'S&D', seats: 139 },
    { group: 'Renew', seats: 102 },
    { group: 'EPP', seats: 178 },
    { group: 'ECR', seats: 69 },
    { group: 'ID', seats: 49 },
    { group: 'Non-attached', seats: 58 },
  ],
  encoding: {
    theta: { field: 'seats', type: 'quantitative' },
    color: {
      field: 'group',
      type: 'nominal',
      scale: {
        range: [
          '#8b1a1a',
          '#3d9970',
          '#c44e52',
          '#f0a202',
          '#1b7fa3',
          '#2c3e88',
          '#5b6ee1',
          '#8a8f98',
        ],
      },
    },
  },
  chrome: {
    title: 'No Bloc Nears a Majority in the Chamber',
    subtitle: 'Illustrative 705-seat parliament, ordered left to right by political group.',
    source: 'Illustrative data',
  },
};

export const ParliamentEuMultiParty = () => (
  <div className="tfix-chart tfix-h-500">
    <Chart spec={euSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// ParliamentCompact: US House hemicycle in a 360px mobile container
// ---------------------------------------------------------------------------

export const ParliamentCompact = () => (
  <div className="tfix-chart tfix-h-420" style={{ maxWidth: 360 }}>
    <Chart spec={usHouseSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// ElectionDonut: Datawrapper-style half-donut with arc startAngle/endAngle
// ---------------------------------------------------------------------------

const electionDonutSpec: ChartSpec = {
  animation: false,
  mark: {
    type: 'arc',
    innerRadius: 0.55,
    startAngle: -Math.PI / 2,
    endAngle: Math.PI / 2,
  },
  data: [
    { party: 'Democratic', seats: 213 },
    { party: 'Republican', seats: 222 },
  ],
  encoding: {
    theta: { field: 'seats', type: 'quantitative' },
    color: { field: 'party', type: 'nominal', scale: { range: ['#1b7fa3', '#c44e52'] } },
  },
  chrome: {
    title: 'A Half-Donut of Chamber Control',
    subtitle: 'Seats by party, drawn as a 180-degree election donut.',
    source: 'Illustrative data',
  },
};

export const ElectionDonut = () => (
  <div className="tfix-chart tfix-h-420">
    <Chart spec={electionDonutSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// ResultsBar: two-party horizontal stacked bar with a center majority marker
// ---------------------------------------------------------------------------

const resultsBarSpec: ChartSpec = {
  animation: false,
  mark: { type: 'bar', cornerRadius: 2 },
  data: [
    { chamber: 'House', party: 'Democratic', seats: 213 },
    { chamber: 'House', party: 'Republican', seats: 222 },
  ],
  encoding: {
    x: { field: 'seats', type: 'quantitative', stack: true, axis: { title: 'Seats' } },
    y: { field: 'chamber', type: 'nominal', axis: null },
    color: { field: 'party', type: 'nominal', scale: { range: ['#1b7fa3', '#c44e52'] } },
  },
  annotations: [
    {
      type: 'refline',
      x: 218,
      label: '218 to win',
      style: 'dashed',
      stroke: '#1e293b',
      strokeWidth: 1.5,
    },
  ],
  labels: { density: 'all', format: ',.0f' },
  chrome: {
    title: 'The House Splits Just Past the Majority Line',
    subtitle: 'Seats by party across the 435-seat chamber. Dashed line marks 218.',
    source: 'Illustrative data',
  },
};

export const ResultsBar = () => (
  <div className="tfix-chart tfix-h-300">
    <Chart spec={resultsBarSpec} />
  </div>
);
