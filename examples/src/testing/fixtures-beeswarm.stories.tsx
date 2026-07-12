/**
 * Testing / Fixtures: beeswarm pinned e2e stories.
 *
 * New pinned stories for the beeswarm mark (plan 12), covering the three
 * canonical layouts: single-lane swarm (~300 dots), grouped lanes (4 census
 * regions), and sized dots. Pinned by the Playwright visual suite. Do not
 * restyle: this content is a pixel-baseline contract.
 *
 * Data: 300 synthetic county rows (median household income $K, census
 * region, population in thousands). A seeded PRNG produced the draws, then
 * they were frozen to static arrays so the module carries no runtime
 * randomness and the dodge layout stays baseline-stable.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import './testing.css';

export default { title: 'Testing / Fixtures' };

// ---------------------------------------------------------------------------
// Frozen dataset: [income $K, population thousands] per county, by region
// ---------------------------------------------------------------------------

const NORTHEAST: Array<[number, number]> = [
  [71.2, 136],
  [81.8, 581],
  [71.3, 789],
  [94.3, 273],
  [82.9, 184],
  [70.3, 28],
  [81.1, 32],
  [111.7, 25],
  [67.5, 40],
  [81.5, 21],
  [107.6, 61],
  [75.6, 93],
  [76.2, 55],
  [91.8, 50],
  [72.2, 1280],
  [80.4, 694],
  [79.8, 25],
  [75.1, 1318],
  [74.5, 58],
  [52.4, 38],
  [77.9, 41],
  [94.1, 26],
  [87.8, 113],
  [111, 22],
  [75.1, 260],
  [97.9, 22],
  [92.2, 106],
  [67, 705],
  [72.1, 365],
  [66.8, 21],
  [90.3, 630],
  [99.5, 45],
  [91.8, 917],
  [77.3, 554],
  [80.5, 43],
  [94.9, 72],
  [129.9, 1017],
  [62.9, 568],
  [89.9, 1157],
  [59.8, 1080],
  [71.5, 151],
  [64, 896],
  [75.4, 203],
  [95, 121],
  [64.8, 384],
  [82.9, 155],
  [74.9, 421],
  [73.5, 219],
  [76.5, 187],
  [74.3, 585],
  [79, 104],
  [63.5, 109],
  [101.9, 1237],
  [115.9, 211],
  [96.3, 447],
];
const MIDWEST: Array<[number, number]> = [
  [70.6, 28],
  [54.7, 454],
  [72.4, 263],
  [109.3, 216],
  [56, 33],
  [58.2, 49],
  [53, 87],
  [56.9, 1243],
  [66.9, 1176],
  [64.5, 43],
  [84, 874],
  [58.6, 49],
  [56.2, 559],
  [64.3, 1176],
  [70.8, 545],
  [93.9, 1273],
  [89.4, 236],
  [77.1, 43],
  [61.7, 507],
  [59.3, 746],
  [96.6, 1298],
  [60.2, 268],
  [81.6, 103],
  [96, 267],
  [66.8, 46],
  [52.6, 922],
  [86.7, 1125],
  [68.9, 24],
  [84.2, 21],
  [59.9, 236],
  [72.7, 83],
  [54.1, 960],
  [40, 168],
  [80.2, 384],
  [85.3, 372],
  [51, 155],
  [80.1, 46],
  [64.4, 385],
  [82.3, 137],
  [64.3, 1250],
  [64.7, 118],
  [56.1, 27],
  [71.2, 797],
  [61.4, 69],
  [67.8, 54],
  [58.5, 636],
  [60.2, 59],
  [72.3, 55],
  [73.9, 294],
  [69.5, 23],
  [78.5, 127],
  [55.6, 25],
  [49.9, 121],
  [79.7, 573],
  [76.4, 573],
  [55.1, 26],
  [48.2, 21],
  [73.2, 1090],
  [93.5, 22],
  [87.1, 40],
  [70.3, 83],
  [60.3, 446],
  [85.2, 21],
  [63.9, 87],
  [66, 153],
  [81, 144],
  [80.8, 216],
  [107.1, 70],
  [53.2, 533],
  [63, 33],
  [65.9, 335],
  [63.3, 23],
  [72.3, 524],
  [75.8, 414],
  [79.7, 117],
];
const SOUTH: Array<[number, number]> = [
  [64.3, 22],
  [85.6, 452],
  [73.2, 46],
  [90.3, 162],
  [66.9, 1239],
  [63.6, 1001],
  [38, 354],
  [59.2, 96],
  [59.4, 690],
  [50.2, 136],
  [57.2, 37],
  [59.1, 595],
  [32.6, 419],
  [59.4, 529],
  [58.8, 37],
  [108, 373],
  [79.6, 189],
  [36.6, 526],
  [52.6, 413],
  [54, 263],
  [62.8, 135],
  [45.8, 256],
  [58.7, 282],
  [40.9, 555],
  [68.7, 45],
  [51.6, 52],
  [70.8, 103],
  [41, 54],
  [94.7, 34],
  [70, 960],
  [67, 995],
  [74.5, 677],
  [51.7, 485],
  [54, 59],
  [42.7, 50],
  [87.4, 704],
  [63.3, 20],
  [55.1, 85],
  [85.4, 108],
  [62.9, 300],
  [59.9, 153],
  [83.5, 77],
  [65.4, 190],
  [58, 619],
  [48.3, 25],
  [60.7, 655],
  [49.1, 41],
  [116, 37],
  [71.2, 517],
  [60, 197],
  [54.6, 81],
  [89.2, 424],
  [64, 323],
  [76.4, 122],
  [75, 1183],
  [45.3, 48],
  [55.4, 89],
  [58.9, 86],
  [57.5, 891],
  [55.8, 23],
  [67.9, 291],
  [48.7, 41],
  [81.5, 704],
  [37.4, 194],
  [60.7, 632],
  [66.5, 226],
  [53, 146],
  [64.7, 67],
  [54.1, 153],
  [51.3, 61],
  [63.6, 291],
  [72.4, 109],
  [62.3, 397],
  [78, 182],
  [54.5, 385],
  [83.5, 127],
  [67.7, 117],
  [92, 470],
  [49.1, 427],
  [52.1, 651],
  [40.7, 51],
  [47.5, 29],
  [99.2, 928],
  [70.9, 152],
  [48.7, 22],
  [64.1, 764],
  [78.7, 83],
  [36, 685],
  [63.7, 149],
  [56.2, 117],
  [67.8, 45],
  [72.5, 193],
  [55.8, 103],
  [62.2, 37],
  [57, 85],
  [53.5, 256],
  [78.8, 159],
  [58.3, 68],
  [55.9, 77],
  [64.4, 205],
  [106.2, 35],
  [76.7, 77],
  [66.2, 80],
  [58, 295],
  [57.9, 46],
];
const WEST: Array<[number, number]> = [
  [77.3, 30],
  [63.7, 43],
  [46.3, 188],
  [54.3, 83],
  [44.7, 118],
  [102.6, 543],
  [105.6, 27],
  [62.6, 1228],
  [87.8, 211],
  [75.8, 224],
  [95.9, 125],
  [50.6, 261],
  [103.6, 42],
  [57, 680],
  [73.6, 185],
  [86.6, 242],
  [73.5, 34],
  [84.9, 31],
  [46.8, 237],
  [81.9, 331],
  [57, 463],
  [75.9, 116],
  [72, 211],
  [51.6, 846],
  [136.3, 744],
  [71.2, 161],
  [75.4, 368],
  [78.1, 86],
  [79.3, 23],
  [105.8, 43],
  [90.6, 248],
  [58.5, 115],
  [67, 62],
  [69.2, 233],
  [93.4, 341],
  [93.8, 75],
  [92.8, 37],
  [70.7, 697],
  [77.4, 857],
  [28, 554],
  [74.9, 42],
  [102, 254],
  [83.5, 50],
  [81, 39],
  [48.4, 211],
  [65.3, 26],
  [28.7, 1049],
  [59.7, 124],
  [104.5, 260],
  [62.9, 210],
  [94.2, 84],
  [38.1, 65],
  [69.4, 45],
  [92.6, 897],
  [86.4, 156],
  [77.8, 198],
  [87.8, 92],
  [60.1, 411],
  [68.5, 264],
  [104.9, 83],
  [82.3, 49],
  [116.3, 594],
  [51.3, 1315],
  [84.5, 568],
  [100, 771],
];

const countyIncomes = (
  [
    ['Northeast', NORTHEAST],
    ['Midwest', MIDWEST],
    ['South', SOUTH],
    ['West', WEST],
  ] as Array<[string, Array<[number, number]>]>
).flatMap(([region, rows]) => rows.map(([income, pop]) => ({ region, income, pop })));

const INCOME_TOOLTIP = [
  { field: 'income', type: 'quantitative' as const, title: 'Income ($K)' },
  { field: 'region', type: 'nominal' as const, title: 'Region' },
  { field: 'pop', type: 'quantitative' as const, title: 'Population (K)' },
];

// ---------------------------------------------------------------------------
// BeeswarmBasic: single-lane swarm, ~300 dots
// ---------------------------------------------------------------------------

const beeswarmBasicSpec: ChartSpec = {
  animation: true,
  mark: { type: 'beeswarm', fill: '#1b7fa3' },
  data: countyIncomes,
  encoding: {
    x: {
      field: 'income',
      type: 'quantitative',
      axis: { title: 'Median household income ($K)' },
    },
    tooltip: INCOME_TOOLTIP,
  },
  chrome: {
    title: 'Most Counties Cluster Below $80K',
    subtitle: 'Median household income across 300 counties. Each dot is one county.',
    source: 'Illustrative data',
  },
};

export const BeeswarmBasic = () => (
  <div className="tfix-chart tfix-h-320">
    <Chart spec={beeswarmBasicSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// BeeswarmGrouped: 4 lanes via the nominal y channel
// ---------------------------------------------------------------------------

const beeswarmGroupedSpec: ChartSpec = {
  animation: true,
  mark: 'beeswarm',
  data: countyIncomes,
  encoding: {
    x: {
      field: 'income',
      type: 'quantitative',
      axis: { title: 'Median household income ($K)' },
    },
    y: { field: 'region', type: 'nominal' },
    color: { field: 'region', type: 'nominal' },
    tooltip: INCOME_TOOLTIP,
  },
  chrome: {
    title: 'The Northeast Earns More, the South Spreads Wider',
    subtitle: 'Median household income by county, grouped by census region',
    source: 'Illustrative data',
  },
};

export const BeeswarmGrouped = () => (
  <div className="tfix-chart tfix-h-480">
    <Chart spec={beeswarmGroupedSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// BeeswarmSized: dot area carries county population
// ---------------------------------------------------------------------------

const beeswarmSizedSpec: ChartSpec = {
  animation: true,
  mark: { type: 'beeswarm', fill: '#0e7490' },
  data: countyIncomes,
  encoding: {
    x: {
      field: 'income',
      type: 'quantitative',
      axis: { title: 'Median household income ($K)' },
    },
    // Capped radius range keeps the tallest stacks inside the chart area at
    // this container height (default range tops out at r=10).
    size: { field: 'pop', type: 'quantitative', scale: { range: [2, 8] } },
    tooltip: INCOME_TOOLTIP,
  },
  chrome: {
    title: 'Big Counties Sit in the Middle of the Income Range',
    subtitle: 'Median household income across 300 counties. Dot size = population (thousands).',
    source: 'Illustrative data',
  },
};

export const BeeswarmSized = () => (
  <div className="tfix-chart tfix-h-400">
    <Chart spec={beeswarmSizedSpec} />
  </div>
);
