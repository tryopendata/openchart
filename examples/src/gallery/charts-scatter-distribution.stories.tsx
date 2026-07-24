/**
 * Charts / Scatter & Distribution.
 *
 * Fourteen demos across five sections (Scatter, Distribution, Density over
 * time, Range & Change, Interactive). Scatter marks map two quantitative axes
 * and add size/color to carry a third and fourth dimension; distribution marks
 * (circle, lollipop, dumbbell, tick, beeswarm) place observations along a
 * category axis; the calendar mark lays a daily value out as a year grid; range
 * marks span two values per category (dumbbell, arrow, floating bar). Each carries
 * editorial chrome and pulls from the shared dataset pool. Structure copies
 * charts-bar-column.
 */

import type { ChartSpec, MarkEvent } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import { useState } from 'react';
import { Demo, GalleryPage, Section } from '../components';
import {
  commuteTimes,
  costOfLiving,
  electricityMixMatrix,
  electricityShareChange,
  emissionsRenewables,
  lifeExpectancyChange,
  lifeExpectancyGender,
  marathonFinishTimes,
  nycTemperatureRange,
  pisaScores,
  statePopulationChange,
  wealthHealth,
} from '../data';

const ACCENT = '#0e7490';

// ---------------------------------------------------------------------------
// Beeswarm dataset: 160 synthetic counties, median household income by region.
// A seeded PRNG (mulberry32) draws income around a per-region mean, then the
// rows are frozen at module load so the dodge layout is deterministic across
// runs. Kept inline rather than in the curated data pool because the shape is
// procedural, not a transcribed real-world table.
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const REGION_MEANS: Array<[string, number]> = [
  ['Northeast', 82],
  ['Midwest', 68],
  ['South', 61],
  ['West', 74],
];

const countyIncomes = (() => {
  const rand = mulberry32(0xbee5);
  const rows: Array<{ region: string; income: number }> = [];
  for (const [region, mean] of REGION_MEANS) {
    for (let i = 0; i < 40; i++) {
      // Two draws averaged -> a soft bell around the regional mean.
      const spread = (rand() + rand() - 1) * 34;
      rows.push({ region, income: Math.round((mean + spread) * 10) / 10 });
    }
  }
  return rows;
})();

// ---------------------------------------------------------------------------
// 1. Basic scatter — two quantitative axes
// ---------------------------------------------------------------------------

const basicScatterSpec: ChartSpec = {
  animation: true,
  mark: { type: 'point', fill: ACCENT },
  data: [...pisaScores.data],
  encoding: {
    x: {
      field: 'spending',
      type: 'quantitative',
      axis: { title: 'Spending per student ($K, PPP)' },
    },
    y: { field: 'math', type: 'quantitative', axis: { title: 'PISA math score' } },
    tooltip: [
      { field: 'country', type: 'nominal', title: 'Country' },
      { field: 'spending', type: 'quantitative', title: 'Spending ($K)' },
      { field: 'math', type: 'quantitative', title: 'Math score' },
    ],
  },
  annotations: [
    { type: 'text', x: 14.5, y: 575, text: 'Singapore', anchor: 'left', fontSize: 10, dot: false },
    {
      type: 'text',
      x: 14.3,
      y: 465,
      text: 'United States',
      anchor: 'right',
      fontSize: 10,
      dot: false,
    },
    { type: 'text', x: 8.4, y: 510, text: 'Estonia', anchor: 'left', fontSize: 10, dot: false },
    {
      type: 'refline',
      y: 472,
      label: 'OECD avg',
      style: 'dashed',
      stroke: '#64748b',
      strokeWidth: 1,
    },
  ],
  chrome: {
    title: "Spending More on Schools Doesn't Guarantee Better Scores",
    subtitle: 'Cumulative per-student spending vs. PISA 2022 math performance, OECD countries',
    source: pisaScores.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 2. Bubble — size encoding (population)
// ---------------------------------------------------------------------------

const bubbleSpec: ChartSpec = {
  animation: true,
  mark: 'point',
  data: [...emissionsRenewables.data],
  encoding: {
    x: { field: 'co2', type: 'quantitative', axis: { title: 'CO2 emissions per capita (tonnes)' } },
    y: {
      field: 'renewables',
      type: 'quantitative',
      axis: { title: 'Renewable electricity share (%)' },
    },
    size: { field: 'pop', type: 'quantitative' },
    color: { field: 'continent', type: 'nominal' },
    tooltip: [
      { field: 'country', type: 'nominal', title: 'Country' },
      { field: 'co2', type: 'quantitative', title: 'CO2 (t/person)' },
      { field: 'renewables', type: 'quantitative', title: 'Renewables (%)' },
      { field: 'pop', type: 'quantitative', title: 'Population (M)' },
    ],
  },
  annotations: [
    {
      type: 'text',
      x: 14.7,
      y: 21,
      text: 'The US has high emissions\nbut modest renewables',
      connector: true,
      anchor: 'left',
      offset: { dx: -24, dy: -50 },
    },
    {
      type: 'text',
      x: 2.3,
      y: 85,
      text: "Brazil's grid is nearly\nall renewable",
      connector: true,
      anchor: 'right',
      offset: { dx: 24, dy: -18 },
    },
  ],
  chrome: {
    title: 'Clean Grids and Low Emissions Rarely Go Together',
    subtitle:
      'CO2 emissions per capita vs. share of electricity from renewables, 2023. Circle size = population (millions).',
    source: emissionsRenewables.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 3. Color grouping — a categorical field splits the cloud into series
// ---------------------------------------------------------------------------

const colorScatterSpec: ChartSpec = {
  animation: true,
  mark: 'point',
  data: [...costOfLiving.data],
  encoding: {
    x: {
      field: 'cost',
      type: 'quantitative',
      axis: { title: 'Cost of living index' },
      scale: { domain: [35, 140] },
    },
    y: {
      field: 'quality',
      type: 'quantitative',
      axis: { title: 'Quality of living index' },
      scale: { domain: [68, 100] },
    },
    color: { field: 'region', type: 'nominal' },
    tooltip: [
      { field: 'city', type: 'nominal', title: 'City' },
      { field: 'cost', type: 'quantitative', title: 'Cost index' },
      { field: 'quality', type: 'quantitative', title: 'Quality index' },
      { field: 'region', type: 'nominal', title: 'Region' },
    ],
  },
  annotations: [
    { type: 'text', x: 131, y: 98, text: 'Zurich', anchor: 'left', fontSize: 10, dot: false },
    { type: 'text', x: 64, y: 91, text: 'Montreal', anchor: 'right', fontSize: 10, dot: false },
    {
      type: 'text',
      x: 120,
      y: 78,
      text: 'Hong Kong:\npricey, lower quality',
      anchor: 'right',
      offset: { dx: 8, dy: -6 },
      fontSize: 10,
      dot: false,
    },
  ],
  chrome: {
    title: "You Don't Have to Pay a Fortune to Live Well",
    subtitle:
      'Cost of living vs. quality of living in global cities, 2024. Color marks the region.',
    source: costOfLiving.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 4. Trend annotation — refline + text callouts on a scatter
// ---------------------------------------------------------------------------

const trendScatterSpec: ChartSpec = {
  animation: true,
  mark: 'point',
  data: [...wealthHealth.data],
  encoding: {
    x: {
      field: 'gdpPerCapita',
      type: 'quantitative',
      axis: { title: 'GDP per capita (USD)', format: '$.2~s' },
    },
    y: {
      field: 'lifeExpectancy',
      type: 'quantitative',
      axis: { title: 'Life expectancy (years)' },
    },
    color: { field: 'region', type: 'nominal' },
    size: { field: 'pop', type: 'quantitative' },
    tooltip: [
      { field: 'country', type: 'nominal', title: 'Country' },
      { field: 'gdpPerCapita', type: 'quantitative', title: 'GDP/capita' },
      { field: 'lifeExpectancy', type: 'quantitative', title: 'Life exp.' },
    ],
  },
  annotations: [
    {
      // Anchored, not nudged. This replaces a `dx: -640` -- a pixel count tuned
      // against one plot width, which at the gallery's 934px dragged the label to
      // x=-31, clean off the canvas.
      //
      // `left` puts it ABOVE the line at the line's start, which is the only
      // corner going spare: the right end is under the US callout, and *below*
      // the left end is India's bubble (the biggest circle here -- the line runs
      // straight through it). No labelOffset: the engine's default 4px nudge
      // already clears the line, and every px added here was what pushed the
      // label back down onto India.
      type: 'refline',
      y: 73,
      label: 'World avg: 73 yrs',
      labelAnchor: 'left',
      style: 'dashed',
      stroke: '#64748b',
      strokeWidth: 1,
    },
    {
      // Below-left of the US bubble, which is the rightmost point on the chart --
      // so the block has to open leftward or it runs off the plot. It used to be
      // anchored ABOVE, where it collided with the Japan label and pushed up under
      // the subtitle. Below the bubble is empty (the US is the high-GDP outlier;
      // nothing else is out here), and the connector still reaches its dot.
      type: 'text',
      x: 63544,
      y: 77.3,
      text: 'The US spends the most\nbut lives shorter than peers',
      connector: true,
      anchor: 'left',
      offset: { dx: 8, dy: 62 },
    },
    {
      // Japan is the highest point on the chart (84.6, the y-max), so `anchor:
      // 'top'` had nowhere to put this but on top of the subtitle. Anchor right
      // and it labels the dot from the side, inside the plot.
      type: 'text',
      x: 39313,
      y: 84.6,
      text: 'Japan',
      anchor: 'right',
      offset: { dx: 8, dy: 0 },
      fontSize: 10,
      dot: false,
    },
    // `anchor: 'left'` means the label ENDS at the point (textAnchor: 'end'), so
    // it renders to the LEFT of it -- and these two are the leftmost bubbles on
    // the chart, which put both labels out on top of the y-axis. Anchoring right
    // starts the text at the point and runs it into open plot instead.
    {
      type: 'text',
      x: 1901,
      y: 70.2,
      text: 'India',
      anchor: 'right',
      offset: { dx: 10, dy: -2 },
      fontSize: 10,
      dot: false,
    },
    {
      type: 'text',
      x: 926,
      y: 66.6,
      text: 'Ethiopia',
      anchor: 'right',
      offset: { dx: 10, dy: 4 },
      fontSize: 10,
      dot: false,
    },
  ],
  chrome: {
    title: 'Richer Countries Live Longer, but America Is an Outlier',
    subtitle: 'GDP per capita vs. life expectancy, 2022. Bubble size = population (millions).',
    source: wealthHealth.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 5. Dot plot — circle mark on a category axis
// ---------------------------------------------------------------------------

const dotPlotSpec: ChartSpec = {
  animation: true,
  mark: { type: 'circle', fill: ACCENT },
  data: [...commuteTimes.data],
  encoding: {
    x: {
      field: 'minutes',
      type: 'quantitative',
      axis: { title: 'Average one-way commute (minutes)' },
    },
    y: { field: 'city', type: 'nominal' },
    tooltip: [
      { field: 'city', type: 'nominal', title: 'Metro' },
      { field: 'minutes', type: 'quantitative', title: 'Minutes' },
    ],
  },
  annotations: [
    {
      type: 'refline',
      x: 30,
      label: 'US avg: 30 min',
      style: 'dashed',
      stroke: '#64748b',
      strokeWidth: 1,
    },
  ],
  chrome: {
    title: 'New Yorkers Commute Twice as Long as Tulsans',
    subtitle: 'Average one-way commute time by major US metro area, 2024 (minutes)',
    source: commuteTimes.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 6. Lollipop — diverging variant (dots on stems around a zero baseline)
// ---------------------------------------------------------------------------

// Derive a direction category so the color scale flags growth vs decline.
const stateChange = statePopulationChange.data.map((d) => ({
  ...d,
  direction: d.change >= 0 ? 'Growing' : 'Shrinking',
}));

const lollipopSpec: ChartSpec = {
  animation: true,
  mark: 'lollipop',
  data: stateChange,
  encoding: {
    x: {
      field: 'change',
      type: 'quantitative',
      axis: { title: 'Population change (%)', format: '+.0f' },
    },
    y: { field: 'state', type: 'nominal' },
    color: {
      field: 'direction',
      type: 'nominal',
      scale: { domain: ['Growing', 'Shrinking'], range: [ACCENT, '#d1495b'] },
    },
    tooltip: [
      { field: 'state', type: 'nominal', title: 'State' },
      { field: 'change', type: 'quantitative', title: 'Change (%)' },
    ],
  },
  legend: { show: false },
  annotations: [{ type: 'refline', x: 0, style: 'solid', stroke: '#334155', strokeWidth: 1.5 }],
  chrome: {
    title: 'Americans Keep Moving South',
    subtitle: 'Percent population change by state, April 2020 to July 2024',
    source: statePopulationChange.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 7. Dumbbell — two series per category auto-switches the dot mark to dumbbell mode
// (Long-format recipe. When your data has start/end columns, prefer the
// first-class range mark in the Range & Change section below.)
// ---------------------------------------------------------------------------

const dumbbellSpec: ChartSpec = {
  animation: true,
  mark: 'circle',
  data: [...lifeExpectancyGender.data],
  encoding: {
    x: {
      field: 'years',
      type: 'quantitative',
      axis: { title: 'Life expectancy (years)' },
      scale: { zero: false },
    },
    y: { field: 'country', type: 'nominal' },
    color: { field: 'gender', type: 'nominal' },
    tooltip: [
      { field: 'country', type: 'nominal', title: 'Country' },
      { field: 'gender', type: 'nominal', title: 'Gender' },
      { field: 'years', type: 'quantitative', title: 'Years' },
    ],
  },
  annotations: [
    {
      type: 'text',
      x: 73,
      y: 'Russia',
      text: "Russia's gender gap\nis 10 years wide",
      connector: true,
      anchor: 'right',
      offset: { dx: 40, dy: 0 },
      fontSize: 10,
    },
  ],
  chrome: {
    title: 'Women Live Longer Nearly Everywhere, but the Gap Varies',
    subtitle:
      'Life expectancy at birth by gender, selected countries, 2023. Each bar spans the gap.',
    source: lifeExpectancyGender.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 8. Tick / strip plot — tick mark as a distribution strip
// ---------------------------------------------------------------------------

const stripSpec: ChartSpec = {
  animation: true,
  mark: 'tick',
  data: [...marathonFinishTimes.data],
  encoding: {
    x: { field: 'hours', type: 'quantitative', axis: { title: 'Finish time (hours)' } },
    y: { field: 'group', type: 'nominal', axis: { title: 'Age group' } },
    color: { field: 'group', type: 'nominal' },
    tooltip: [
      { field: 'group', type: 'nominal', title: 'Age group' },
      { field: 'hours', type: 'quantitative', title: 'Hours' },
    ],
  },
  legend: { show: false },
  chrome: {
    title: 'Finish Times Spread Wider With Age',
    subtitle: 'Individual marathon finishers by age group. Each tick is one runner.',
    source: marathonFinishTimes.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 9. Range dumbbell — x/x2 span per category, first-class range mark
// ---------------------------------------------------------------------------

const rangeDumbbellSpec: ChartSpec = {
  animation: true,
  mark: 'range',
  data: [...lifeExpectancyChange.data],
  encoding: {
    y: {
      field: 'country',
      type: 'nominal',
      sort: { field: 'y2023', order: 'ascending' },
    },
    x: {
      field: 'y2000',
      type: 'quantitative',
      title: '2000',
      axis: { title: 'Life expectancy at birth (years)' },
    },
    x2: { field: 'y2023', type: 'quantitative', title: '2023' },
  },
  chrome: {
    title: 'Everyone Is Living Longer, but the Gaps Persist',
    subtitle:
      'Life expectancy at birth, 2000 (gray) vs. 2023 (accent), selected countries. Hover a row for the exact change.',
    source: lifeExpectancyChange.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 10. Arrow plot — directional change with semantic direction coloring
// ---------------------------------------------------------------------------

const arrowPlotSpec: ChartSpec = {
  animation: true,
  mark: { type: 'range', style: 'arrow', colorByDirection: true },
  data: [...electricityShareChange.data],
  encoding: {
    y: {
      field: 'source',
      type: 'nominal',
      sort: { field: 'y2024', order: 'ascending' },
    },
    x: {
      field: 'y2010',
      type: 'quantitative',
      title: '2010',
      axis: { title: 'Share of US electricity generation (%)' },
    },
    x2: { field: 'y2024', type: 'quantitative', title: '2024' },
  },
  chrome: {
    title: "Gas and Renewables Ate Coal's Lunch",
    subtitle:
      'Share of US electricity generation by source, 2010 to 2024. Green arrows grew, red shrank.',
    source: electricityShareChange.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 11. Range bar — plain floating bar from low to high (vertical form)
// ---------------------------------------------------------------------------

const rangeBarSpec: ChartSpec = {
  animation: true,
  mark: { type: 'range', style: 'bar', fill: ACCENT },
  data: [...nycTemperatureRange.data],
  encoding: {
    x: { field: 'month', type: 'nominal' },
    y: {
      field: 'low',
      type: 'quantitative',
      title: 'Avg low',
      axis: { title: 'Temperature (°C)' },
    },
    y2: { field: 'high', type: 'quantitative', title: 'Avg high' },
  },
  chrome: {
    title: 'New York Swings 30 Degrees Across the Year',
    subtitle: 'Average daily low to high temperature by month, Central Park, 2023',
    source: nycTemperatureRange.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 12. Interactive — onMarkHover drives a companion readout
// ---------------------------------------------------------------------------

const interactiveSpec: ChartSpec = {
  mark: 'point',
  data: [...emissionsRenewables.data],
  encoding: {
    x: { field: 'co2', type: 'quantitative', axis: { title: 'CO2 emissions per capita (tonnes)' } },
    y: {
      field: 'renewables',
      type: 'quantitative',
      axis: { title: 'Renewable electricity share (%)' },
    },
    size: { field: 'pop', type: 'quantitative' },
    color: { field: 'continent', type: 'nominal' },
  },
  chrome: {
    title: 'Hover a Bubble to Read It Out',
    subtitle: 'onMarkHover feeds the datum to a companion readout below the chart',
    source: emissionsRenewables.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// Canvas mark mode
// ---------------------------------------------------------------------------

/**
 * Two synthetic campus cohorts sharing most of their ids, so a swap between
 * them is a keyed morph: most dots travel, some leave, some arrive.
 */
function campusCohort(year: 2019 | 2025) {
  const rand = mulberry32(year);
  const count = year === 2019 ? 2900 : 3050;
  const firstId = year === 2019 ? 0 : 150;
  // The 2025 cohort tilts steeper: poverty predicts reading outcomes harder.
  const slope = year === 2019 ? -0.45 : -0.62;
  return Array.from({ length: count }, (_, i) => {
    const lowIncome = rand() * 100;
    const noise = (rand() - 0.5) * 34;
    return {
      id: `campus-${firstId + i}`,
      lowIncome: Math.round(lowIncome * 10) / 10,
      reading:
        Math.round(Math.max(2, Math.min(98, 72 + slope * (lowIncome - 50) + noise)) * 10) / 10,
    };
  });
}

const COHORTS = { 2019: campusCohort(2019), 2025: campusCohort(2025) } as const;

function canvasMorphSpec(year: 2019 | 2025): ChartSpec {
  return {
    // Small, semi-transparent dots. At ~2,900 points the default radius (5)
    // and full opacity pack the cloud into a solid mass and the distribution
    // stops being readable; overplotting is the point of this demo, so let
    // density show through instead.
    // The default white separator stroke is proportionally huge at r=2.5 and
    // turns every dot into a ring, so drop it: at this density the dots are
    // reading as a cloud, not as individually separable marks.
    mark: { type: 'point', trendline: true, size: 2.5, opacity: 0.35, strokeWidth: 0 },
    data: COHORTS[year],
    animation: true,
    encoding: {
      x: {
        field: 'lowIncome',
        type: 'quantitative',
        scale: { domain: [0, 100] },
        axis: { title: 'Students from low-income households (%)' },
      },
      y: {
        field: 'reading',
        type: 'quantitative',
        scale: { domain: [0, 100] },
        axis: { title: 'Reading at grade level (%)' },
      },
      key: { field: 'id', type: 'nominal' },
    },
    chrome: {
      title: 'Poverty Predicts Reading Scores, and the Link Is Tightening',
      subtitle: `${year} campuses. Toggle the year to morph ~3,000 keyed dots and watch the trendline steepen.`,
      source: 'Synthetic data for demonstration',
      byline: 'Chart: OpenChart',
    },
  };
}

/**
 * ~3,000 points with no `render` field set: the auto threshold promotes this to
 * canvas on its own. Toggling the year runs a keyed morph, which the SVG cap
 * (500 marks) would have refused outright.
 *
 * Interactive only -- deliberately NOT baseline-captured, since the entrance
 * animation runs on a JS scheduler the screenshot harness cannot freeze.
 */
function CanvasMorphScatter() {
  const [year, setYear] = useState<2019 | 2025>(2019);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gx-space-3)' }}>
      <div style={{ height: 480 }}>
        <Chart spec={canvasMorphSpec(year)} />
      </div>
      <div style={{ display: 'flex', gap: 'var(--gx-space-2)', alignItems: 'center' }}>
        {([2019, 2025] as const).map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => setYear(y)}
            style={{
              padding: 'var(--gx-space-2) var(--gx-space-4)',
              border: '1px solid var(--gx-border)',
              borderRadius: 'var(--gx-radius-control)',
              background: y === year ? 'var(--gx-surface-raised)' : 'transparent',
              color: y === year ? 'var(--gx-text)' : 'var(--gx-text-muted)',
              fontSize: 'var(--gx-type-caption)',
              cursor: 'pointer',
            }}
          >
            {y}
          </button>
        ))}
        <span style={{ fontSize: 'var(--gx-type-caption)', color: 'var(--gx-text-muted)' }}>
          {COHORTS[year].length.toLocaleString()} campuses on canvas
        </span>
      </div>
    </div>
  );
}

/**
 * The same 200-point cloud rendered both ways, side by side.
 *
 * Small enough that auto leaves it on SVG, so `render: 'canvas'` is explicit.
 * This is the visual-parity check: same layout, same colors, same geometry.
 *
 * Two differences are expected and permanent: the trendline always draws above
 * the dots, and where dots overlap, a stroke can land on a neighbour's fill.
 * The latter is a paint-order effect -- canvas fills every dot, then strokes
 * every dot, whereas SVG paints each dot's fill and stroke together. Sparse
 * clouds are indistinguishable; tight clusters show it.
 *
 * Translucent overlaps do NOT differ: each dot composites individually on
 * canvas exactly as it does in SVG. That parity is pinned by
 * `e2e/invariants/canvas-alpha-parity.spec.ts`.
 *
 * `animation: false` because a baseline screenshot cannot freeze the canvas
 * entrance.
 */
function parityScatterSpec(render: 'svg' | 'canvas'): ChartSpec {
  const rand = mulberry32(7);
  const data = Array.from({ length: 200 }, (_, i) => ({
    id: `p${i}`,
    x: Math.round(rand() * 1000) / 10,
    y: Math.round(rand() * 1000) / 10,
  }));
  return {
    mark: { type: 'point', render },
    data,
    animation: false,
    encoding: {
      x: { field: 'x', type: 'quantitative', scale: { domain: [0, 100] } },
      y: { field: 'y', type: 'quantitative', scale: { domain: [0, 100] } },
      key: { field: 'id', type: 'nominal' },
    },
    chrome: {
      title: render === 'canvas' ? 'Canvas' : 'SVG',
      subtitle: 'Same 200 points, same layout, different surface',
    },
  };
}

const svgParitySpec = parityScatterSpec('svg');
const canvasParitySpec = parityScatterSpec('canvas');

function CanvasParity() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gx-space-4)' }}>
      <div style={{ height: 360 }}>
        <Chart spec={svgParitySpec} />
      </div>
      <div style={{ height: 360 }}>
        <Chart spec={canvasParitySpec} />
      </div>
    </div>
  );
}

function InteractiveScatter() {
  const [hovered, setHovered] = useState<{
    country: string;
    co2: number;
    renewables: number;
    continent: string;
  } | null>(null);

  const onMarkHover = (e: MarkEvent) => {
    setHovered({
      country: e.datum.country as string,
      co2: e.datum.co2 as number,
      renewables: e.datum.renewables as number,
      continent: e.datum.continent as string,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gx-space-3)' }}>
      <div style={{ height: 460 }}>
        <Chart
          spec={interactiveSpec}
          onMarkHover={onMarkHover}
          onMarkLeave={() => setHovered(null)}
        />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--gx-space-3)',
          padding: 'var(--gx-space-3) var(--gx-space-4)',
          border: '1px solid var(--gx-border)',
          borderRadius: 'var(--gx-radius-control)',
          background: 'var(--gx-surface-raised)',
          fontSize: 'var(--gx-type-caption)',
          color: 'var(--gx-text-muted)',
          fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
        }}
      >
        <span style={{ color: 'var(--gx-text-muted)' }}>hovered</span>
        {hovered ? (
          <span style={{ color: 'var(--gx-text)' }}>
            {hovered.country} — {hovered.co2}t CO2/person, {hovered.renewables}% renewable
          </span>
        ) : (
          <span>move over a bubble</span>
        )}
        <span style={{ marginLeft: 'auto', color: 'var(--gx-text-muted)' }}>
          {hovered ? hovered.continent : ''}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 13. Beeswarm — dodge a whole distribution into a readable cloud
// ---------------------------------------------------------------------------

const beeswarmSpec: ChartSpec = {
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
    tooltip: [
      { field: 'region', type: 'nominal', title: 'Region' },
      { field: 'income', type: 'quantitative', title: 'Income ($K)' },
    ],
  },
  legend: { show: false },
  chrome: {
    title: 'The Northeast Earns More, the South Sits Lower',
    subtitle:
      'Median household income across 160 counties, grouped by census region. Each dot is one county.',
    source: 'Illustrative data',
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// Calendar dataset: one year of daily temperature anomalies. Same seeded-PRNG
// + triangle-wave approach as the pinned fixture, kept inline because it is a
// generated series, not a curated table. Frozen at module load.
// ---------------------------------------------------------------------------

const DAY_MS = 86400000;

function anomalyDays(): Array<{ date: string; anomaly: number }> {
  const rand = mulberry32(20240101);
  const start = Date.UTC(2024, 0, 1);
  const rows: Array<{ date: string; anomaly: number }> = [];
  for (let i = 0; i < 366; i++) {
    const phase = (i % 366) / 366;
    const seasonal = 1 - Math.abs(phase * 4 - 2); // -1 at Jan 1, +1 mid-year
    const value = 0.6 + seasonal * 1.2 + (rand() - 0.5) * 2.4;
    rows.push({
      date: new Date(start + i * DAY_MS).toISOString().slice(0, 10),
      anomaly: Math.round(value * 10) / 10,
    });
  }
  return rows;
}

const anomalyData = anomalyDays();

// ---------------------------------------------------------------------------
// 14. Calendar heatmap — a daily value laid out as a GitHub-style year grid
// ---------------------------------------------------------------------------

const calendarSpec: ChartSpec = {
  mark: 'calendar',
  data: anomalyData,
  encoding: {
    x: { field: 'date', type: 'temporal' },
    color: {
      field: 'anomaly',
      type: 'quantitative',
      // redBlue ramps red -> blue low-to-high (the ColorBrewer RdBu convention).
      // Temperature reads the other way round, so reverse it: warm anomalies red,
      // cool ones blue.
      scale: { scheme: 'redBlue', reverse: true },
      format: '+.1f',
    },
  },
  chrome: {
    title: 'A Year That Ran Warm From Spring to Fall',
    subtitle:
      'Daily temperature anomaly vs the 1991-2020 normal, degrees C. One cell per day, weeks run top to bottom.',
    source: 'Illustrative data',
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 15. Rect heatmap — two categorical axes + sequential color
// ---------------------------------------------------------------------------

const heatmapSpec: ChartSpec = {
  animation: true,
  mark: 'rect',
  data: [...electricityMixMatrix.data],
  encoding: {
    x: { field: 'year', type: 'nominal' },
    y: { field: 'source', type: 'nominal' },
    color: {
      field: 'share',
      type: 'quantitative',
      scale: { scheme: 'blues' },
      format: '.1f',
    },
  },
  chrome: {
    title: "Gas Rose as Coal's Share Halved",
    subtitle:
      'Share of US electricity generation by source (%), 2016-2023. Darker cells = larger share.',
    source: electricityMixMatrix.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default { title: 'Charts' };

export const ScatterAndDistribution = () => (
  <GalleryPage
    title="Scatter & Distribution"
    lede="Scatter marks map two quantitative axes to find correlation, clusters, and outliers; add size or color to carry more dimensions in one view. Distribution marks — dot, lollipop, dumbbell, and strip — place observations along a category axis to compare magnitudes and reveal spread."
  >
    <Section
      id="scatter"
      title="Scatter"
      lede="Two quantitative axes. Reach for size to add a third dimension, color to group, and direct annotations instead of a dense legend."
    >
      <Demo
        id="basic-scatter"
        title="Basic scatter"
        description="Two quantitative axes reveal correlation, clusters, and outliers; annotate the notable points directly."
        spec={basicScatterSpec}
        height={480}
      />
      <Demo
        id="bubble"
        title="Bubble (size encoding)"
        description="A size channel maps a third quantitative field to circle area; color separates the categories."
        spec={bubbleSpec}
        height={500}
      />
      <Demo
        id="color-grouping"
        title="Color grouping"
        description="A categorical color channel splits the cloud into series; direct labels name the extremes so no legend is required to read the story."
        spec={colorScatterSpec}
        height={480}
      />
      <Demo
        id="trend-annotation"
        title="Trend annotation"
        description="A reference line marks the benchmark while text callouts name the story — the outlier reads at a glance."
        spec={trendScatterSpec}
        height={500}
      />
    </Section>

    <Section
      id="distribution"
      title="Distribution"
      lede="One measure across a ranked category axis. Dots and lollipops beat bars when values sit far from zero; dumbbells show a gap; strips show the full spread."
    >
      <Demo
        id="dot-plot"
        title="Dot plot"
        description="A circle mark on a category axis — cleaner than a bar when you only need to compare positions, not areas."
        spec={dotPlotSpec}
        height={440}
      />
      <Demo
        id="lollipop"
        title="Lollipop (diverging)"
        description="Dots on stems anchored to a zero baseline; conditional color flags growth versus decline."
        spec={lollipopSpec}
        height={460}
      />
      <Demo
        id="dumbbell"
        title="Dumbbell (two-series recipe)"
        description="Two series per category on the dot mark auto-switch to dumbbell mode. This long-format recipe predates the range mark; prefer mark: 'range' (below) when your data carries start/end columns."
        spec={dumbbellSpec}
        height={520}
      />
      <Demo
        id="strip-plot"
        title="Tick / strip plot"
        description="The tick mark drops one short line per observation, so a whole distribution's shape and spread read at once."
        spec={stripSpec}
        height={420}
      />
      <Demo
        id="beeswarm"
        title="Beeswarm"
        description="When ticks overlap into a solid band, the beeswarm dodges every point off its neighbors so no observation hides another. The pile-up along each lane becomes the distribution's shape."
        spec={beeswarmSpec}
        height={480}
      />
    </Section>

    <Section
      id="density"
      title="Density over time"
      lede="A calendar heatmap trades axes for a date grid: one cell per day, colored by that day's value. It reads seasonality, streaks, and gaps at a glance the way a line chart can't."
    >
      <Demo id="calendar-heatmap" spec={calendarSpec} height={340} />
    </Section>

    <Section
      id="heatmap"
      title="Heatmap"
      lede="The rect mark puts one cell per row on a two-way categorical grid. A sequential color channel maps a quantitative value to intensity — the standard matrix read for source-by-year or feature-by-feature."
    >
      <Demo
        id="rect-heatmap"
        title="Rect heatmap"
        description="Two nominal axes (source, year) and a quantitative color channel produce a matrix heatmap. The diagonal of coal falling and gas rising reads at a glance."
        spec={heatmapSpec}
        height={380}
      />
    </Section>

    <Section
      id="range"
      title="Range & Change"
      lede="One row, two values. The range mark spans start to end per category: dumbbells compare two points in time, arrows read as directional change, floating bars show plain spans."
    >
      <Demo
        id="range-dumbbell"
        title="Dumbbell (range mark)"
        description="x and x2 span each category: muted start dot, accent end dot. Tooltips carry start, end, and the signed change."
        spec={rangeDumbbellSpec}
        height={520}
      />
      <Demo
        id="arrow-plot"
        title="Arrow plot"
        description="style: 'arrow' puts an arrowhead at the x2 end; colorByDirection colors increases and decreases with the theme's semantic tokens."
        spec={arrowPlotSpec}
        height={460}
      />
      <Demo
        id="range-bar"
        title="Range bar"
        description="style: 'bar' draws a plain floating bar from y to y2, the simplest read for low/high spans like temperature ranges."
        spec={rangeBarSpec}
        height={440}
      />
    </Section>

    <Section
      id="interactive"
      title="Interactive"
      lede="Wire chart events to your own React state to build tooltips, readouts, and linked views."
    >
      <Demo id="interactive" specForPanel={interactiveSpec} height={540}>
        <InteractiveScatter />
      </Demo>
    </Section>

    <Section
      id="canvas"
      title="High-cardinality (canvas)"
      lede="Past ~1,000 points, scatter marks move to a canvas layered under the chart SVG. Tooltips, clicks and keyed update transitions all keep working; axes, trendline and annotations stay vector."
    >
      <Demo
        id="high-cardinality-canvas"
        title="Keyed morph at 3,000 points"
        description="No render field set — the auto threshold promotes this to canvas on its own. Toggling the year morphs every dot to its new position, ghosts the campuses that closed, fades in the ones that opened, and steepens the trendline. On SVG this would have exceeded the 500-mark transition cap and swapped instantly."
        specForPanel={canvasMorphSpec(2019)}
        height={600}
      >
        <CanvasMorphScatter />
      </Demo>
      <Demo
        id="canvas-svg-parity"
        title="Canvas vs SVG, same data"
        description="An explicit render: 'canvas' on a 200-point cloud that auto would have left on SVG. Same layout, same geometry. Two differences remain: the trendline always draws above the dots, and canvas fills every dot before stroking any, so overlapping dots can show a stroke over a neighbour's fill. Sparse clouds look identical; tight clusters show it."
        specForPanel={canvasParitySpec}
        height={420}
      >
        <CanvasParity />
      </Demo>
    </Section>
  </GalleryPage>
);
