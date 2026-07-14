/**
 * Charts / Building Blocks — the primitives, each doing the job it's for.
 *
 * Seven demos across three sections. Every demo leads with the *use case* (label
 * points directly, draw a reference line, show a distribution) rather than the
 * primitive in isolation — a mark is not a use case, and a chart nobody would
 * ship teaches nobody anything. Same Demo-card infra and shared-data rules as
 * the Bar & Column template.
 */

import type { ChartSpec, LayerSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import { useState } from 'react';
import { Demo, GalleryPage, Section } from '../components';
import {
  collegeFinances,
  incomeDistribution,
  nycTemperatureRange,
  referenceRates,
  stateEconomies,
  usPayrolls,
} from '../data';

const BLUE = '#0e7490';
const ORANGE = '#e07b39';

// ---------------------------------------------------------------------------
// 1. Text mark — direct labeling instead of a legend
// ---------------------------------------------------------------------------

// A label offset by `dy` can overhang the plot when its point sits at the top of
// the domain (California here), so give the y-scale headroom for it. Both layers
// pin the same domain so they stay on one scale.
const POP_DOMAIN: [number, number] = [5, 43];
// Same on x: a centered label at the domain edge overhangs by half its width.
const GDP_DOMAIN: [number, number] = [0.6, 4.25];

// Direct labeling means labeling the points that carry the story, not all of
// them: five of these states sit within a label's width of each other down in
// the corner, and stacking five names in that gap would just produce a smear. So
// the label layer takes a subset while the point layer keeps every state — the
// reader still sees all ten, and the separable ones get named on the chart
// instead of in a legend. This is the ordinary editorial move, not a workaround.
const LABELED = new Set(['CA', 'TX', 'NY', 'FL', 'IL']);

const directLabelSpec: LayerSpec = {
  animation: true,
  chrome: {
    title: 'California Towers Over Every Other State Economy',
    subtitle: 'The ten largest US state economies by GDP and population, 2023',
    source: stateEconomies.source,
    byline: 'Chart: OpenChart',
  },
  layer: [
    {
      mark: { type: 'point', fill: BLUE, opacity: 0.85, trendline: false },
      data: [...stateEconomies.data],
      encoding: {
        x: {
          field: 'gdp',
          type: 'quantitative',
          scale: { domain: GDP_DOMAIN },
          axis: { title: 'GDP ($ trillions)' },
        },
        y: {
          field: 'pop',
          type: 'quantitative',
          scale: { domain: POP_DOMAIN },
          axis: { title: 'Population (millions)' },
        },
      },
    },
    {
      mark: { type: 'text', dy: -14 },
      data: stateEconomies.data.filter((d) => LABELED.has(d.label)),
      encoding: {
        x: { field: 'gdp', type: 'quantitative', scale: { domain: GDP_DOMAIN } },
        y: { field: 'pop', type: 'quantitative', scale: { domain: POP_DOMAIN } },
        text: { field: 'label', type: 'nominal' },
        size: { field: 'gdp', type: 'quantitative', scale: { range: [11, 22] } },
      },
    },
  ],
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
// 4. Layered chart — two marks on shared scales
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
// 5. Dual axis — LayerSpec + resolve.scale.y = 'independent'
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
// 6. Spans — x2/y2 range encoding
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
// 7. Interactive — compose a layer, toggle it live
// ---------------------------------------------------------------------------

const scatterLayer: ChartSpec = {
  mark: { type: 'point', fill: BLUE, opacity: 0.85, trendline: false },
  data: [...stateEconomies.data],
  encoding: {
    x: { field: 'gdp', type: 'quantitative', axis: { title: 'GDP ($ trillions)' } },
    y: {
      field: 'pop',
      type: 'quantitative',
      scale: { domain: POP_DOMAIN },
      axis: { title: 'Population (millions)' },
    },
  },
};

// Both layers encode the same fields; `dy` offsets in pixel space, so the label
// layer stays on the point layer's scales instead of shifting the data. The
// domain carries headroom so California's label doesn't overhang the plot.
const labelLayer: ChartSpec = {
  mark: { type: 'text', dy: -14 },
  data: [...stateEconomies.data],
  encoding: {
    x: { field: 'gdp', type: 'quantitative' },
    y: { field: 'pop', type: 'quantitative', scale: { domain: POP_DOMAIN } },
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gx-space-3)' }}>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--gx-space-2)',
          padding: 'var(--gx-space-2) var(--gx-space-3)',
          border: '1px solid var(--gx-border)',
          borderRadius: 'var(--gx-radius-control)',
          background: 'var(--gx-surface-raised)',
          fontSize: 'var(--gx-type-caption)',
          color: 'var(--gx-text-muted)',
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
    lede="OpenChart specs are encoding-centric: you map data fields to visual channels and the engine picks the mark, scale, and axis. These demos show what the smaller marks are actually for — naming points on the chart itself, drawing the line a number has to beat, showing a whole distribution — and how a LayerSpec stacks them onto shared or independent scales."
  >
    <Section
      id="mark-primitives"
      title="Marks with a job"
      lede="Beyond bars and lines, three marks earn their place: labels that replace a legend, reference lines that give a number something to beat, and ticks that show a distribution without binning it."
    >
      <Demo
        id="text-mark"
        title="Label points directly"
        description="Direct labeling beats a legend: name the points on the chart itself and the reader never looks away from the data. Points and labels are separate layers over the same fields, with a pixel-space dy offset lifting each label clear of its dot. The label layer takes a subset — five states sit within a label's width of each other down in the corner, so naming all ten would just smear — which is the ordinary editorial move: label what carries the story, leave the rest as dots."
        spec={directLabelSpec}
        height={460}
      />
      <Demo
        id="rule-mark"
        title="Reference lines"
        description="A benchmark the reader measures against — the policy rate, a target, a prior high. Authored as ordinary data rows, so the levels come from your dataset instead of being hand-placed annotations."
        spec={ruleMarkSpec}
        height={400}
      />
      <Demo
        id="tick-mark"
        title="Distribution strip"
        description="One tick per observation. Shows spread, clustering, and skew without collapsing the data into bins — useful when the shape of the distribution is the story."
        spec={tickMarkSpec}
        height={360}
      />
    </Section>

    <Section
      id="composition"
      title="Composition"
      lede="A LayerSpec stacks marks. Share the scales for a combo chart, or resolve y independently for a dual axis."
    >
      <Demo
        id="layered"
        title="Combo chart (shared scales)"
        description="Columns and a reference rule on one set of scales — the average drawn as a second layer rather than an annotation. Composition is just a `layer` array; each entry is a full spec."
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
      title="Ranges & interaction"
      lede="The x2/y2 channels turn a single mark into a range; layers can be composed on the fly from state."
    >
      <Demo
        id="spans"
        title="Ranges (x2 / y2)"
        description="A second position channel (here y2) extends each mark into a range — the encoding behind error bands, gantt bars, and min/max spreads."
        spec={spanSpec}
        height={420}
      />
      <Demo
        id="interactive"
        title="Toggle a layer live"
        description="A checkbox adds or removes the text-label layer at runtime — proof that layering is ordinary array composition, not a special mode. The spec panel shows the both-layers version."
        specForPanel={composedSpecForPanel}
        height={520}
      >
        <ComposedLayers />
      </Demo>
    </Section>
  </GalleryPage>
);
