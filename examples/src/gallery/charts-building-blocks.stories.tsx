/**
 * Charts / Building Blocks — the grammar, one primitive at a time.
 *
 * Eight demos across three sections (Mark primitives, Composition, Spans &
 * interaction). Each isolates one piece of OpenChart's encoding-centric grammar:
 * the text/rule/tick/rect marks, LayerSpec composition, dual independent axes,
 * and the x2/y2 span channels. Same Demo-card infra and shared-data rules as the
 * Bar & Column template.
 *
 * Grammar note (verified against packages/engine/src): the standalone `rect`
 * mark is registered but not renderable today — it never receives a band scale,
 * so rects collapse to zero width, and it cannot compose a 2D nominal x nominal
 * matrix either. The heatmap-style *sequential color fill* it was meant to show
 * is demonstrated on a `bar` mark instead (same rect geometry, correct scale).
 */

import type { ChartSpec, LayerSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import { useState } from 'react';
import { Demo, GalleryPage, Section } from '../components';
import {
  collegeFinances,
  electricityMixMatrix,
  incomeDistribution,
  nycTemperatureRange,
  referenceRates,
  stateEconomies,
  usPayrolls,
} from '../data';

const BLUE = '#0e7490';
const ORANGE = '#e07b39';

// ---------------------------------------------------------------------------
// 1. Text mark — data-positioned labels
// ---------------------------------------------------------------------------

// The text mark's `size` channel maps a field value straight to font size (px,
// clamped 8-48), not through a scale — so derive a readable font size from GDP.
const stateLabels = stateEconomies.data.map((d) => ({
  ...d,
  fontSize: Math.round(13 + d.gdp * 5),
}));

const textMarkSpec: ChartSpec = {
  animation: true,
  mark: 'text',
  data: stateLabels,
  encoding: {
    // Headroom on both axes so the largest (California) label isn't clipped at
    // the plot edge — text marks center on their point, so the glyph overflows.
    x: {
      field: 'gdp',
      type: 'quantitative',
      scale: { domain: [0, 4.6] },
      axis: { title: 'GDP ($ trillions)' },
    },
    y: {
      field: 'pop',
      type: 'quantitative',
      scale: { domain: [0, 44] },
      axis: { title: 'Population (millions)' },
    },
    text: { field: 'label', type: 'nominal' },
    size: { field: 'fontSize', type: 'quantitative' },
  },
  chrome: {
    title: 'California Towers Over Every Other State Economy',
    subtitle:
      'The ten largest US state economies by GDP and population, 2023. Label size tracks GDP.',
    source: stateEconomies.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 2. Rule mark — reference lines authored as data
// ---------------------------------------------------------------------------

const ruleMarkSpec: ChartSpec = {
  animation: true,
  mark: 'rule',
  data: [...referenceRates.data],
  encoding: {
    y: { field: 'rate', type: 'quantitative', axis: { title: 'Interest rate (%)', format: '.2f' } },
    color: { field: 'category', type: 'nominal' },
  },
  chrome: {
    title: 'Every Rate That Matters, on One Scale',
    subtitle: 'Key US policy and market interest-rate levels, mid-2024 snapshot',
    source: referenceRates.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 3. Tick mark — distribution strip / rug plot
// ---------------------------------------------------------------------------

const tickMarkSpec: ChartSpec = {
  animation: true,
  mark: 'tick',
  data: [...incomeDistribution.data],
  encoding: {
    x: {
      field: 'income',
      type: 'quantitative',
      axis: { title: 'Household income ($K)', format: '$,.0f' },
    },
    y: { field: 'region', type: 'nominal' },
    color: { field: 'region', type: 'nominal' },
  },
  legend: { show: false },
  chrome: {
    title: 'The Coasts Skew Richer Than the Interior',
    subtitle: 'Household income by US Census region — each tick is one household',
    source: incomeDistribution.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 4. Sequential color — a quantitative color field builds a heatmap-style fill
// ---------------------------------------------------------------------------

// Pull coal's yearly share out of the source x year matrix so each column is one
// year. A quantitative color field makes the engine build a *sequential* fill
// scale (the same mechanism behind heatmap cells), so the value reads twice:
// from bar height and from color darkness.
//
// Grammar note: the standalone `rect` mark is in the registry but is not
// renderable in the current engine (it never receives a band scale, so rects
// collapse to zero width — verified against packages/engine/src/layout/
// scales.ts). Sequential color is therefore demonstrated on a `bar` mark, which
// shares the rect geometry but resolves its band scale correctly.
const coalShare = electricityMixMatrix.data
  .filter((d) => d.source === 'Coal')
  .map((d) => ({ year: d.year, share: d.share }));

const sequentialColorSpec: ChartSpec = {
  animation: true,
  mark: 'bar',
  data: coalShare,
  encoding: {
    x: { field: 'year', type: 'nominal' },
    y: { field: 'share', type: 'quantitative', axis: { title: 'Coal share (%)' } },
    // Quantitative color triggers a sequential fill scale: darker = more coal.
    color: { field: 'share', type: 'quantitative' },
  },
  labels: { density: 'all', format: '.0f' },
  chrome: {
    title: "Coal's Grip on US Power Is Loosening Fast",
    subtitle: 'Coal as a share of US electricity generation — fill darkens with the value',
    source: electricityMixMatrix.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 5. Layered chart — two marks on shared scales
// ---------------------------------------------------------------------------

const avgJobs = Math.round(
  usPayrolls.data.reduce((s, d) => s + d.jobs, 0) / usPayrolls.data.length,
);

// Each layer resolves its own y-scale from its own data, so pin both to the same
// explicit domain — otherwise the single-value rule layer would scale [0, avg]
// and land at the top of the plot instead of at the average line.
const JOBS_DOMAIN: [number, number] = [0, 400];

const layerSpec: LayerSpec = {
  animation: true,
  chrome: {
    title: 'The Job Market Cooled but Never Cracked',
    subtitle:
      'Monthly US nonfarm payroll additions, 2024, with the yearly average drawn as a second layer',
    source: usPayrolls.source,
    byline: 'Chart: OpenChart',
  },
  layer: [
    {
      mark: { type: 'bar', fill: BLUE, opacity: 0.85 },
      data: [...usPayrolls.data],
      encoding: {
        x: { field: 'month', type: 'nominal' },
        y: {
          field: 'jobs',
          type: 'quantitative',
          scale: { domain: JOBS_DOMAIN },
          axis: { title: 'Jobs added (thousands)' },
        },
      },
      labels: { density: 'none' },
    },
    {
      // The rule renderer draws a 1px line and takes its color from the color
      // scale (mark stroke/width are not read), so a single-entry scale range
      // sets the reference-line color.
      mark: { type: 'rule' },
      data: [{ avg: avgJobs, label: `avg: ${avgJobs}K` }],
      encoding: {
        y: { field: 'avg', type: 'quantitative', scale: { domain: JOBS_DOMAIN } },
        color: { field: 'label', type: 'nominal', scale: { range: ['#334155'] } },
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// 6. Dual axis — LayerSpec + resolve.scale.y = 'independent'
// ---------------------------------------------------------------------------

const dualAxisSpec: LayerSpec = {
  animation: true,
  chrome: {
    title: 'Deficit Grows as Enrollment Slides',
    subtitle:
      'Net revenue (bars) and undergraduate enrollment (line) on independent y-axes, 2014-2024',
    source: collegeFinances.source,
  },
  resolve: { scale: { y: 'independent' } },
  layer: [
    {
      mark: { type: 'bar', opacity: 0.85 },
      data: [...collegeFinances.data],
      encoding: {
        x: { field: 'year', type: 'ordinal' },
        y: {
          field: 'revenue',
          type: 'quantitative',
          axis: {
            title: 'Net revenue ($)',
            format: '~s',
            labelColor: BLUE,
            values: [-40_000_000, -20_000_000, 0, 20_000_000, 40_000_000, 60_000_000, 80_000_000],
          },
        },
        // Value-driven color: green above zero, red in deficit.
        color: {
          condition: { test: { field: 'revenue', gte: 0 }, value: BLUE },
          value: '#d64045',
        },
      },
      labels: { density: 'none' },
    },
    {
      mark: {
        type: 'line',
        stroke: ORANGE,
        strokeWidth: 2.5,
        point: true,
        interpolate: 'monotone',
      },
      data: [...collegeFinances.data],
      encoding: {
        x: { field: 'year', type: 'ordinal' },
        y: {
          field: 'enrollment',
          type: 'quantitative',
          axis: { title: 'Enrollment', format: '~s', labelColor: ORANGE },
          scale: { domain: [46_000, 66_000] },
        },
      },
      labels: { density: 'none' },
    },
  ],
};

// ---------------------------------------------------------------------------
// 7. Spans — x2/y2 range encoding
// ---------------------------------------------------------------------------

const tempRange = nycTemperatureRange.data.map((d) => ({ ...d, band: 'Daily range' }));

const spanSpec: ChartSpec = {
  animation: true,
  mark: { type: 'rule' },
  data: tempRange,
  encoding: {
    x: { field: 'month', type: 'nominal' },
    // y + y2 turn each rule into a vertical span from the month's low to its high.
    y: { field: 'low', type: 'quantitative', axis: { title: 'Temperature (°C)' } },
    y2: { field: 'high', type: 'quantitative' },
    // Rule color comes from the color scale, so a single-entry range colors the spans.
    color: { field: 'band', type: 'nominal', scale: { range: [ORANGE] } },
  },
  legend: { show: false },
  chrome: {
    title: 'How Far NYC Swings Between Dawn and Afternoon',
    subtitle: 'Average daily low to high per month, Central Park, 2023 — each bar is a y/y2 span',
    source: nycTemperatureRange.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 8. Interactive — compose a layer, toggle it live
// ---------------------------------------------------------------------------

const scatterLayer: ChartSpec = {
  mark: { type: 'point', fill: BLUE, opacity: 0.85, trendline: false },
  data: [...stateEconomies.data],
  encoding: {
    x: { field: 'gdp', type: 'quantitative', axis: { title: 'GDP ($ trillions)' } },
    y: { field: 'pop', type: 'quantitative', axis: { title: 'Population (millions)' } },
  },
};

// Text marks sit exactly at (x, y) with no offset, so float labels above the
// points by nudging their y in the data (population + ~1.4M).
const labelRows = stateEconomies.data.map((d) => ({ ...d, labelPop: d.pop + 1.4 }));

const labelLayer: ChartSpec = {
  mark: { type: 'text' },
  data: labelRows,
  encoding: {
    x: { field: 'gdp', type: 'quantitative' },
    y: { field: 'labelPop', type: 'quantitative' },
    text: { field: 'label', type: 'nominal' },
  },
};

function makeComposedSpec(withLabels: boolean): LayerSpec {
  return {
    animation: false,
    chrome: {
      title: 'A Layer Is Just Another Entry in the Array',
      subtitle: withLabels
        ? 'Point layer plus a text-label layer on shared scales'
        : 'Point layer only — toggle the label layer back on',
      source: stateEconomies.source,
    },
    layer: withLabels ? [scatterLayer, labelLayer] : [scatterLayer],
  };
}

const composedSpecForPanel = makeComposedSpec(true);

function ComposedLayers() {
  const [withLabels, setWithLabels] = useState(true);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-3)' }}>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--oc-space-2)',
          padding: 'var(--oc-space-2) var(--oc-space-3)',
          border: '1px solid var(--oc-border)',
          borderRadius: 'var(--oc-radius-control)',
          background: 'var(--oc-surface-raised)',
          fontSize: 'var(--oc-type-caption)',
          color: 'var(--oc-text-muted)',
          alignSelf: 'flex-start',
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={withLabels}
          onChange={(e) => setWithLabels(e.target.checked)}
        />
        Text-label layer
      </label>
      <div style={{ height: 420 }}>
        <Chart spec={makeComposedSpec(withLabels)} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default { title: 'Charts' };

export const BuildingBlocks = () => (
  <GalleryPage
    title="Building Blocks"
    lede="OpenChart specs are encoding-centric: you map data fields to visual channels and the engine picks the mark, scale, and axis. These demos strip that idea to its primitives — the text, rule, tick, and rect marks, and the LayerSpec that composes them onto shared or independent scales."
  >
    <Section
      id="mark-primitives"
      title="Mark primitives"
      lede="Beyond bars and lines, four marks turn raw data into labels, reference lines, distribution strips, and value-colored cells."
    >
      <Demo
        id="text-mark"
        title="Text mark"
        description="Position labels directly by data — x/y place each label, and the size channel scales it. No separate annotation layer."
        spec={textMarkSpec}
        height={440}
      />
      <Demo
        id="rule-mark"
        title="Rule mark"
        description="Reference levels authored as data rows rather than annotations, each drawn as a horizontal rule and colored by category."
        spec={ruleMarkSpec}
        height={400}
      />
      <Demo
        id="tick-mark"
        title="Tick mark"
        description="A strip/rug plot: one short tick per observation makes the spread and skew of a distribution legible without binning."
        spec={tickMarkSpec}
        height={360}
      />
      <Demo
        id="rect-mark"
        title="Sequential color fill"
        description="A quantitative color field makes the engine build a sequential fill scale — the mechanism behind heatmap cells — so the value reads twice, from height and from color darkness."
        spec={sequentialColorSpec}
        height={420}
      />
    </Section>

    <Section
      id="composition"
      title="Composition"
      lede="A LayerSpec stacks marks. Share the scales for a combo chart, or resolve y independently for a dual axis."
    >
      <Demo
        id="layered"
        title="Layered chart (shared scales)"
        description="Two marks — columns and a rule — drawn on one set of scales. Composition is just a `layer` array; each entry is a full spec."
        spec={layerSpec}
        height={440}
      />
      <Demo
        id="dual-axis"
        title="Dual axis (independent scales)"
        description="resolve.scale.y = 'independent' gives each layer its own y-axis, so dollars and headcount coexist. Axis labels are colored to match their series."
        spec={dualAxisSpec}
        height={460}
      />
    </Section>

    <Section
      id="spans-interaction"
      title="Spans & interaction"
      lede="The x2/y2 channels turn a single mark into a range; layers can be composed on the fly from state."
    >
      <Demo
        id="spans"
        title="Spans (x2 / y2)"
        description="A second position channel (here y2) extends each mark into a range — the encoding behind error bands, gantt bars, and min/max spreads."
        spec={spanSpec}
        height={420}
      />
      <Demo
        id="interactive"
        title="Interactive (compose a layer live)"
        description="A checkbox adds or removes the text-label layer at runtime — proof that layering is ordinary array composition, not a special mode. The spec panel shows the both-layers version."
        specForPanel={composedSpecForPanel}
        height={520}
      >
        <ComposedLayers />
      </Demo>
    </Section>
  </GalleryPage>
);
