/**
 * Charts / Line & Area.
 *
 * Ten demos across three sections (Lines, Areas, Scales & interaction). Line
 * and area marks trace change over a continuous axis, usually time. Each demo
 * carries editorial chrome (takeaway title + cited source) and pulls from the
 * shared dataset pool.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import { useState } from 'react';
import { Demo, GalleryPage, Section } from '../components';
import {
  bigTechRevenue,
  energyMix,
  evFleet,
  gdpGrowthByCountry,
  monthlyTemperature,
  usInflation,
} from '../data';

const ACCENT = '#0e7490';

// ---------------------------------------------------------------------------
// Series-search dataset: 30 economies indexed to 2000 = 100. A deterministic
// formula (per-series growth slope + bounded sine wobble, no Math.random)
// keeps the layout stable. Kept inline because the shape is generated, not a
// transcribed real-world table.
// ---------------------------------------------------------------------------

const SEARCH_COUNTRIES = [
  'United States',
  'China',
  'Japan',
  'Germany',
  'India',
  'United Kingdom',
  'France',
  'Italy',
  'Brazil',
  'Canada',
  'South Korea',
  'Australia',
  'Mexico',
  'Spain',
  'Indonesia',
  'Netherlands',
  'Türkiye',
  'Switzerland',
  'Poland',
  'Sweden',
  'Norway',
  'Ireland',
  'Israel',
  'Nigeria',
  'Egypt',
  'South Africa',
  'Singapore',
  'Vietnam',
  'Chile',
  'Portugal',
];

const searchSeries = SEARCH_COUNTRIES.flatMap((country, i) =>
  Array.from({ length: 13 }, (_, t) => {
    const growth = 1.5 + (i % 7) * 0.55;
    const wobble = Math.sin(t * (0.6 + (i % 5) * 0.13) + i) * (2 + (i % 4));
    return {
      year: `${2000 + t * 2}-01-01`,
      index: Math.round((100 + growth * t * 2 + wobble) * 10) / 10,
      country,
    };
  }),
);

// ---------------------------------------------------------------------------
// 1. Single line — one series, temporal x, annotation on the key moment
// ---------------------------------------------------------------------------

const singleLineSpec: ChartSpec = {
  animation: true,
  mark: { type: 'line', stroke: ACCENT, strokeWidth: 2 },
  data: [...usInflation.data],
  encoding: {
    x: { field: 'date', type: 'temporal', axis: { tickCount: 6 } },
    y: {
      field: 'rate',
      type: 'quantitative',
      axis: { title: 'CPI (year-over-year %)', format: '.1f', grid: true },
    },
  },
  annotations: [
    {
      type: 'text',
      x: '2022-07-01',
      y: 8.5,
      text: 'Peak: 8.5%',
      anchor: 'top',
      offset: { dx: 0, dy: -20 },
      connector: true,
    },
    {
      type: 'refline',
      y: 2,
      label: 'Fed 2% target',
      style: 'dashed',
      stroke: '#64748b',
      strokeWidth: 1,
    },
  ],
  labels: { density: 'endpoints', format: '.1f' },
  chrome: {
    title: "Inflation's Wild Ride: From 1% to 8.5% and Back",
    subtitle: 'US consumer price index, year-over-year % change, quarterly 2019-2024',
    source: usInflation.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 2. Multi-series with endpoint labels — direct labeling, no legend
// ---------------------------------------------------------------------------

const multiSeriesSpec: ChartSpec = {
  animation: true,
  mark: 'line',
  data: [...gdpGrowthByCountry.data],
  encoding: {
    x: { field: 'date', type: 'temporal', axis: { tickCount: 4 } },
    y: {
      field: 'gdp',
      type: 'quantitative',
      axis: { title: 'GDP growth (%)', format: '+.0f', grid: true },
    },
    color: { field: 'country', type: 'nominal' },
  },
  annotations: [
    { type: 'refline', y: 0, style: 'solid', stroke: '#94a3b8', strokeWidth: 1 },
    {
      type: 'range',
      x1: '2019-09-01',
      x2: '2020-06-01',
      label: 'Pandemic',
      fill: '#dc2626',
      opacity: 0.06,
    },
  ],
  labels: { density: 'endpoints', format: '.1f' },
  chrome: {
    title: 'Three Economies, Three Recoveries',
    subtitle: 'Annual real GDP growth rate, 2018-2024',
    source: gdpGrowthByCountry.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 3. Five series with legend — when direct labels stop working
// ---------------------------------------------------------------------------

const fiveSeriesSpec: ChartSpec = {
  animation: true,
  mark: 'line',
  data: [...bigTechRevenue.data],
  encoding: {
    x: { field: 'year', type: 'temporal', axis: { tickCount: 6 } },
    y: {
      field: 'revenue',
      type: 'quantitative',
      axis: { title: 'Annual revenue ($B)', format: ',.0f', grid: true },
    },
    color: { field: 'company', type: 'nominal' },
  },
  // legend.position implies show:true; endpointLabels:false hands series
  // identification to the legend alone (see the suppression truth table in
  // packages/core/src/types/spec.ts) so the two keys don't duplicate.
  legend: { position: 'top' },
  endpointLabels: false,
  labels: { density: 'none' },
  chrome: {
    title: 'Amazon Pulls Away at the Top of Big Tech',
    subtitle: 'Annual revenue by company, 2019-2024 (billions USD)',
    source: bigTechRevenue.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 4. Area (single, overlap default) — v6 semantics
// ---------------------------------------------------------------------------

const singleAreaSpec: ChartSpec = {
  animation: true,
  mark: { type: 'area', stroke: ACCENT, strokeWidth: 2 },
  data: [...evFleet.data],
  encoding: {
    x: { field: 'year', type: 'temporal', axis: { tickCount: 5 } },
    y: {
      field: 'fleet',
      type: 'quantitative',
      axis: { title: 'Cumulative EV fleet (millions)', format: ',.0f', grid: true },
    },
  },
  annotations: [
    {
      type: 'text',
      x: '2020-01-01',
      y: 10.5,
      text: '10M milestone',
      anchor: 'top',
      offset: { dx: 0, dy: -22 },
      connector: true,
    },
  ],
  labels: { density: 'endpoints', format: ',.0f' },
  chrome: {
    title: 'The Electric Surge: From Niche to 58 Million on the Road',
    subtitle: 'Cumulative global electric car fleet, 2015-2024 (BEV + PHEV)',
    source: evFleet.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 5. Stacked area — composition over time (opt into stacking on the y channel)
// ---------------------------------------------------------------------------

const stackedAreaSpec: ChartSpec = {
  animation: true,
  mark: 'area',
  data: [...energyMix.data],
  encoding: {
    x: { field: 'year', type: 'ordinal' },
    y: {
      field: 'energy',
      type: 'quantitative',
      // Multi-series areas default to overlap; opt back into stacking with
      // `stack: 'zero'` on the position channel when the story is parts-of-a-whole.
      stack: 'zero',
      axis: { title: 'Share of primary energy (%)', format: '.0f', grid: true },
    },
    color: { field: 'source', type: 'nominal' },
  },
  legend: { position: 'top' },
  labels: { density: 'none' },
  chrome: {
    title: 'Renewables Are Rising, but Fossil Fuels Still Dominate',
    subtitle: 'Global primary energy mix by source, 2015-2022 (% of total)',
    source: energyMix.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 6. Step and interpolation modes — MarkDef curve options side by side
// ---------------------------------------------------------------------------

function interpolationSpec(
  mode: 'linear' | 'step' | 'monotone' | 'natural',
  title: string,
): ChartSpec {
  return {
    animation: true,
    mark: { type: 'line', interpolate: mode, point: true, stroke: ACCENT, strokeWidth: 2 },
    data: [...monthlyTemperature.data],
    encoding: {
      x: { field: 'month', type: 'ordinal' },
      y: {
        field: 'temp',
        type: 'quantitative',
        axis: { title: 'Temp (°C)', grid: true, tickCount: 5 },
      },
    },
    labels: { density: 'none' },
    chrome: { title, subtitle: `interpolate: "${mode}"`, source: monthlyTemperature.source },
  };
}

function InterpolationModes() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 'var(--gx-space-4)',
      }}
    >
      <div style={{ height: 260 }}>
        <Chart spec={interpolationSpec('linear', 'Linear (default)')} />
      </div>
      <div style={{ height: 260 }}>
        <Chart spec={interpolationSpec('step', 'Step')} />
      </div>
      <div style={{ height: 260 }}>
        <Chart spec={interpolationSpec('monotone', 'Monotone')} />
      </div>
      <div style={{ height: 260 }}>
        <Chart spec={interpolationSpec('natural', 'Natural')} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 7. Time axis formats — compact temporal ticks, custom axis.format
// ---------------------------------------------------------------------------

// The rate field is a whole-number percent (8.5 = 8.5%). Store it as a fraction
// so the d3-format `.0%` on the y-axis prints "8%" without a manual suffix.
const timeAxisData = usInflation.data.map((d) => ({ date: d.date, rate: d.rate / 100 }));

const timeAxisSpec: ChartSpec = {
  animation: true,
  mark: { type: 'line', stroke: ACCENT, strokeWidth: 2 },
  data: timeAxisData,
  encoding: {
    // %b '%y renders compact "Jan '19" ticks; the temporal scale still owns the
    // spacing, so the axis stays honest as the container narrows.
    x: { field: 'date', type: 'temporal', axis: { format: "%b '%y", tickCount: 8 } },
    y: {
      field: 'rate',
      type: 'quantitative',
      axis: { title: 'CPI (year-over-year)', format: '.0%', grid: true },
    },
  },
  labels: { density: 'none' },
  chrome: {
    title: 'A Custom Tick Format Keeps a Dense Time Axis Readable',
    subtitle: 'axis.format: "%b \'%y" compacts the x ticks; ".0%" reframes the y-axis',
    source: usInflation.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 8. Log scale — scale: { type: 'log' } on y
// ---------------------------------------------------------------------------

const logScaleSpec: ChartSpec = {
  animation: true,
  mark: { type: 'line', stroke: ACCENT, strokeWidth: 2, point: true },
  data: [...evFleet.data],
  encoding: {
    x: { field: 'year', type: 'temporal', axis: { tickCount: 5 } },
    y: {
      field: 'fleet',
      type: 'quantitative',
      scale: { type: 'log' },
      axis: { title: 'Cumulative EV fleet (millions, log)', format: ',.0f', grid: true },
    },
  },
  labels: { density: 'endpoints', format: ',.0f' },
  chrome: {
    title: 'On a Log Scale, the Hockey Stick Becomes a Straight Line',
    subtitle: 'Same EV fleet series — a log y-axis reveals a steady ~45% annual growth rate',
    source: evFleet.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 9. Interactive — highlight prop driven by a custom series list
// ---------------------------------------------------------------------------

const interactiveSpec: ChartSpec = {
  mark: 'line',
  data: [...bigTechRevenue.data],
  encoding: {
    x: { field: 'year', type: 'temporal', axis: { tickCount: 6 } },
    y: {
      field: 'revenue',
      type: 'quantitative',
      axis: { title: 'Annual revenue ($B)', format: ',.0f', grid: true },
    },
    color: { field: 'company', type: 'nominal' },
  },
  legend: { show: false },
  labels: { density: 'none' },
  chrome: {
    title: 'Hover a Company to Emphasize Its Line',
    subtitle: 'The highlight prop mutes every other series; the chips below drive it',
    source: bigTechRevenue.source,
  },
};

const COMPANIES = ['Amazon', 'Apple', 'Alphabet', 'Microsoft', 'Meta'];

function HighlightLines() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gx-space-3)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--gx-space-2)' }}>
        {COMPANIES.map((company) => (
          <button
            key={company}
            type="button"
            onMouseEnter={() => setActive(company)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(company)}
            onBlur={() => setActive(null)}
            aria-pressed={active === company}
            style={{
              padding: 'var(--gx-space-2) var(--gx-space-3)',
              border: '1px solid var(--gx-border)',
              borderRadius: 'var(--gx-radius-control)',
              background: active === company ? ACCENT : 'var(--gx-surface-raised)',
              color: active === company ? '#ffffff' : 'var(--gx-text)',
              fontSize: 'var(--gx-type-caption)',
              cursor: 'pointer',
            }}
          >
            {company}
          </button>
        ))}
      </div>
      <div style={{ height: 460 }}>
        <Chart spec={interactiveSpec} highlight={active ? [active] : null} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 10. Series search — a "find your line" combobox over a 30-series tangle
// ---------------------------------------------------------------------------

const seriesSearchSpec: ChartSpec = {
  animation: true,
  mark: 'line',
  data: searchSeries,
  encoding: {
    x: { field: 'year', type: 'temporal', axis: { tickCount: 6 } },
    y: {
      field: 'index',
      type: 'quantitative',
      axis: { title: 'Output per person (2000 = 100)', grid: true },
    },
    color: { field: 'country', type: 'nominal', highlight: ['United States'] },
  },
  seriesSearch: { placeholder: 'Find a country' },
  legend: { show: false },
  labels: { density: 'none' },
  chrome: {
    title: 'Find Your Country in the Tangle',
    subtitle:
      'Economic output per person for 30 economies, indexed to 2000 = 100. Search to pull one line to the front.',
    source: 'Illustrative data',
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default { title: 'Charts' };

export const LineAndArea = () => (
  <GalleryPage
    title="Line & Area"
    lede="Lines trace change over a continuous axis, usually time. Add a fill and they become areas: single areas read as magnitude, stacked areas as composition. Direct-label the endpoints when a handful of series can be told apart; reach for a legend only when they can't."
  >
    <Section
      id="lines"
      title="Lines"
      lede="One series, a few series with direct labels, or many with a legend — the choice is about how readers tell the lines apart."
    >
      <Demo
        id="single-line"
        title="Single line"
        description="One series on a temporal axis; annotate the key moment and mark a reference threshold."
        spec={singleLineSpec}
        height={440}
      />
      <Demo
        id="multi-series-labels"
        title="Multi-series with endpoint labels"
        description="With a handful of series, label the line ends directly instead of a legend — the reader's eye never leaves the data. The library defaults to endpoint labels for exactly this reason (see .claude/rules/design-philosophy.md: prefer direct labeling over legends)."
        spec={multiSeriesSpec}
        height={460}
      />
      <Demo
        id="five-series-legend"
        title="Five-plus series with legend"
        description="Past four or five crossing lines, endpoint labels collide and a legend earns its place. Set legend.position to pin it; the legend is interactive out of the box — click an entry to toggle that series."
        spec={fiveSeriesSpec}
        height={460}
      />
      <Demo
        id="series-search"
        title="Series search (find your line)"
        description="Once a chart holds dozens of series a legend collapses. seriesSearch adds a combobox above the plot: context lines mute to a wash, and typing a name pulls that one line forward. The initial highlight seeds a starting story."
        spec={seriesSearchSpec}
        height={520}
      />
    </Section>

    <Section
      id="areas"
      title="Areas"
      lede="A filled line is an area. Single areas show magnitude; stacked areas show parts of a whole. Multi-series areas default to overlap — opt into stacking on the position channel."
    >
      <Demo
        id="area"
        title="Area (single series)"
        description="Fill under one line to emphasize accumulated magnitude. Multi-series areas default to overlap, so a single series needs no stack setting."
        spec={singleAreaSpec}
        height={440}
      />
      <Demo
        id="stacked-area"
        title="Stacked area"
        description="Set stack: 'zero' on the y channel to add series into a running total — the classic composition-over-time read."
        spec={stackedAreaSpec}
        height={460}
      />
      {/* No fixed height: the 2x2 grid collapses to one column under ~640px
          and would clip inside a pinned wrapper. Tiles pin their own heights. */}
      <Demo
        id="interpolation"
        title="Step and interpolation modes"
        description="mark.interpolate picks the curve between points: linear connects them straight, step holds each value, monotone and natural smooth without overshooting the data."
      >
        <InterpolationModes />
      </Demo>
    </Section>

    <Section
      id="scales"
      title="Scales & interaction"
      lede="Formatters reshape a dense time axis; a log scale linearizes exponential growth; a highlight prop lets the reader isolate one line."
    >
      <Demo
        id="time-axis"
        title="Time axis formats"
        description="A custom axis.format on the temporal x-axis (%b '%y) compacts tick labels, while a percent format on y reframes the same series."
        spec={timeAxisSpec}
        height={420}
      />
      <Demo
        id="log-scale"
        title="Log scale"
        description="scale: { type: 'log' } on y turns exponential growth into a straight line, exposing a constant growth rate the linear view hides."
        spec={logScaleSpec}
        height={440}
      />
      <Demo
        id="interactive"
        title="Interactive (hover to highlight)"
        description="The highlight prop takes a list of color-encoding values and mutes the rest. Here a row of chips drives it; the spec panel shows the base spec the escape-hatch component renders."
        specForPanel={interactiveSpec}
        height={560}
      >
        <HighlightLines />
      </Demo>
    </Section>
  </GalleryPage>
);
