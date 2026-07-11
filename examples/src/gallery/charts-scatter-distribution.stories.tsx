/**
 * Charts / Scatter & Distribution.
 *
 * Nine demos across three sections (Scatter, Distribution, Interactive). Scatter
 * marks map two quantitative axes and add size/color to carry a third and
 * fourth dimension; distribution marks (circle, lollipop, dumbbell, tick) place
 * observations along a category axis. Each chart carries editorial chrome and
 * pulls from the shared dataset pool. Structure copies charts-bar-column.
 */

import type { ChartSpec, MarkEvent } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import { useState } from 'react';
import { Demo, GalleryPage, Section } from '../components';
import {
  commuteTimes,
  costOfLiving,
  emissionsRenewables,
  lifeExpectancyGender,
  marathonFinishTimes,
  pisaScores,
  statePopulationChange,
  wealthHealth,
} from '../data';

const ACCENT = '#0e7490';

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
    { type: 'text', x: 14.5, y: 575, text: 'Singapore', anchor: 'left', fontSize: 10 },
    { type: 'text', x: 14.3, y: 465, text: 'United States', anchor: 'right', fontSize: 10 },
    { type: 'text', x: 8.4, y: 510, text: 'Estonia', anchor: 'left', fontSize: 10 },
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
      offset: { dx: -150, dy: -50 },
      fontSize: 10,
    },
    {
      type: 'text',
      x: 2.3,
      y: 85,
      text: "Brazil's grid is nearly\nall renewable",
      connector: true,
      anchor: 'top',
      fontSize: 10,
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
    { type: 'text', x: 131, y: 98, text: 'Zurich', anchor: 'left', fontSize: 10 },
    { type: 'text', x: 64, y: 91, text: 'Montreal', anchor: 'right', fontSize: 10 },
    {
      type: 'text',
      x: 120,
      y: 78,
      text: 'Hong Kong:\npricey, lower quality',
      anchor: 'bottom',
      fontSize: 10,
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
      type: 'refline',
      y: 73,
      label: 'World avg: 73 yrs',
      style: 'dashed',
      stroke: '#64748b',
      strokeWidth: 1,
      labelOffset: { dx: -640, dy: 12 },
    },
    {
      type: 'text',
      x: 63544,
      y: 77.3,
      text: 'The US spends the most\nbut lives shorter than peers',
      connector: true,
      anchor: 'top',
      offset: { dx: -90, dy: -70 },
      fontSize: 10,
    },
    {
      type: 'text',
      x: 39313,
      y: 84.6,
      text: 'Japan',
      anchor: 'top',
      offset: { dx: 6, dy: -8 },
      fontSize: 10,
    },
    {
      type: 'text',
      x: 1901,
      y: 70.2,
      text: 'India',
      anchor: 'left',
      offset: { dx: 8, dy: -2 },
      fontSize: 10,
    },
    {
      type: 'text',
      x: 926,
      y: 66.6,
      text: 'Ethiopia',
      anchor: 'left',
      offset: { dx: 8, dy: 4 },
      fontSize: 10,
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
// 9. Interactive — onMarkHover drives a companion readout
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-3)' }}>
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
          gap: 'var(--oc-space-3)',
          padding: 'var(--oc-space-3) var(--oc-space-4)',
          border: '1px solid var(--oc-border)',
          borderRadius: 'var(--oc-radius-control)',
          background: 'var(--oc-surface-raised)',
          fontSize: 'var(--oc-type-caption)',
          color: 'var(--oc-text-muted)',
          fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
        }}
      >
        <span style={{ color: 'var(--oc-text-faint)' }}>hovered</span>
        {hovered ? (
          <span style={{ color: 'var(--oc-text)' }}>
            {hovered.country} — {hovered.co2}t CO2/person, {hovered.renewables}% renewable
          </span>
        ) : (
          <span>move over a bubble</span>
        )}
        <span style={{ marginLeft: 'auto', color: 'var(--oc-text-faint)' }}>
          {hovered ? hovered.continent : ''}
        </span>
      </div>
    </div>
  );
}

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
        title="Dumbbell"
        description="Two series per category on the dot mark auto-switch to dumbbell mode: a bar spans the gap between the two values."
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
    </Section>

    <Section
      id="interactive"
      title="Interactive"
      lede="Wire chart events to your own React state to build tooltips, readouts, and linked views."
    >
      <Demo
        id="interactive"
        title="Interactive (hover to read out)"
        description="onMarkHover feeds the hovered datum to a companion readout; the escape hatch renders a stateful component while the spec panel still shows the base spec."
        specForPanel={interactiveSpec}
        height={540}
      >
        <InteractiveScatter />
      </Demo>
    </Section>
  </GalleryPage>
);
