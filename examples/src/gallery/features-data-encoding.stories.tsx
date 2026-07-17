/**
 * Features / Data & Encoding — the transform-and-encoding gallery page.
 *
 * Shows the parts of the grammar that reshape data before it renders
 * (transforms), map values to visuals conditionally (conditional encoding),
 * paint marks with gradients, split one chart into small multiples (facet),
 * and control number/date formatting. Every spec runs a real transform or
 * encoding — the bin demo actually bins and counts, the filter actually drops
 * rows — so the spec panels double as copyable recipes.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import { useState } from 'react';
import { Demo, GalleryPage, Section } from '../components';
import {
  co2Emissions,
  energyMix,
  gdpGrowthByCountry,
  marathonFinishTimes,
  nvidiaStock,
  profitMargins,
  sp500SectorReturns,
} from '../data';

const ACCENT = '#0e7490';

// ---------------------------------------------------------------------------
// 1. Filter transform — interactive on/off toggle (the page's interactive demo)
// ---------------------------------------------------------------------------

// A logical AND of two field predicates: keep only large emitters that are not
// the two outliers at the very top, so the filter visibly reshapes the bars.
const emissionsFilter = {
  and: [
    { field: 'emissions', gte: 500 },
    { not: { field: 'country', oneOf: ['China', 'United States'] } },
  ],
};

const filterBaseSpec: ChartSpec = {
  animation: true,
  mark: 'bar',
  data: [...co2Emissions.data],
  transform: [{ filter: emissionsFilter }],
  encoding: {
    x: {
      field: 'emissions',
      type: 'quantitative',
      axis: { title: 'Emissions (Mt CO₂)', format: ',.0f' },
    },
    y: { field: 'country', type: 'nominal' },
  },
  labels: { density: 'all', format: ',.0f' },
  chrome: {
    title: 'The Mid-Tier Emitters, Once the Giants Are Set Aside',
    subtitle: 'Annual CO₂ ≥ 500 Mt, excluding China and the United States. Filter transform.',
    source: co2Emissions.source,
    byline: 'Chart: OpenChart',
  },
};

// Unfiltered variant reuses the same spec sans the transform array.
const filterOffSpec: ChartSpec = {
  ...filterBaseSpec,
  transform: undefined,
  chrome: {
    ...filterBaseSpec.chrome,
    title: 'Every Country in the Data, Filter Off',
    subtitle: 'The full twelve-country dataset with no filter applied.',
  },
};

// Row counts for the live readout: the predicate keeps emitters >= 500 Mt that
// aren't the two giants.
const TOTAL_ROWS = co2Emissions.data.length;
const KEPT_ROWS = co2Emissions.data.filter(
  (d) => d.emissions >= 500 && d.country !== 'China' && d.country !== 'United States',
).length;

function FilterToggle() {
  const [filtered, setFiltered] = useState(true);
  const spec = filtered ? filterBaseSpec : filterOffSpec;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gx-space-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gx-space-3)' }}>
        <button
          type="button"
          className="oc-spec-copy"
          onClick={() => setFiltered((v) => !v)}
          aria-pressed={filtered}
        >
          {filtered ? 'Filter: on' : 'Filter: off'}
        </button>
        <span
          style={{
            fontSize: 'var(--gx-type-caption)',
            color: 'var(--gx-text-muted)',
            fontFamily:
              'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
          }}
        >
          {filtered
            ? `${TOTAL_ROWS} rows in, ${KEPT_ROWS} kept, ${TOTAL_ROWS - KEPT_ROWS} dropped`
            : `${TOTAL_ROWS} rows, none dropped`}
        </span>
      </div>
      <div style={{ height: 440 }}>
        <Chart spec={spec} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Bin transform — a real histogram (bin then aggregate count)
// ---------------------------------------------------------------------------

// Bin the continuous finish times into 30-minute buckets, then count finishers
// per bucket. The bin transform writes the bucket start into `binStart`; the
// aggregate transform groups by it and counts rows.
const binSpec: ChartSpec = {
  animation: true,
  mark: 'bar',
  data: [...marathonFinishTimes.data],
  transform: [
    { bin: { step: 0.5, nice: false }, field: 'hours', as: 'binStart' },
    { aggregate: [{ op: 'count', field: 'hours', as: 'finishers' }], groupby: ['binStart'] },
  ],
  encoding: {
    x: {
      field: 'binStart',
      type: 'ordinal',
      axis: { title: 'Finish time (hours)', format: '.1f' },
    },
    y: { field: 'finishers', type: 'quantitative', axis: { title: 'Finishers' } },
  },
  labels: { density: 'all', format: ',.0f' },
  chrome: {
    title: 'Most Finishers Cross Between Four and Five Hours',
    subtitle: 'Marathon finish times binned into 30-minute buckets, then counted per bucket.',
    source: marathonFinishTimes.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 3. Calculate transform — derive profit margin from revenue and cost
// ---------------------------------------------------------------------------

const calculateSpec: ChartSpec = {
  animation: true,
  mark: 'bar',
  data: [...profitMargins.data],
  transform: [
    { calculate: { op: '-', field: 'revenue', field2: 'cost' }, as: 'profit' },
    { calculate: { op: '/', field: 'profit', field2: 'revenue' }, as: 'margin' },
    { calculate: { op: '*', field: 'margin', value: 100 }, as: 'marginPct' },
  ],
  encoding: {
    x: {
      field: 'marginPct',
      type: 'quantitative',
      axis: { title: 'Gross margin (%)', format: '.0f' },
    },
    y: { field: 'company', type: 'nominal' },
  },
  labels: { density: 'all', format: '.1f' },
  chrome: {
    title: 'Margin Is Computed, Not Stored',
    subtitle: 'Gross margin derived from revenue and cost via three chained calculate transforms.',
    source: profitMargins.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 4. TimeUnit transform — seasonal aggregation (quarter of year)
// ---------------------------------------------------------------------------

// Extract the quarter (1-4) from each monthly date, then average the price
// within each quarter across all three years: a genuine seasonal roll-up.
const timeUnitSpec: ChartSpec = {
  animation: true,
  mark: 'bar',
  data: [...nvidiaStock.data],
  transform: [
    { timeUnit: 'quarter', field: 'date', as: 'quarter' },
    { aggregate: [{ op: 'mean', field: 'price', as: 'avgPrice' }], groupby: ['quarter'] },
  ],
  encoding: {
    x: { field: 'quarter', type: 'ordinal', sort: 'ascending', axis: { title: 'Quarter (Q1-Q4)' } },
    y: {
      field: 'avgPrice',
      type: 'quantitative',
      axis: { title: 'Avg close ($)', format: '$,.0f' },
    },
  },
  labels: { density: 'all', format: '$,.0f' },
  chrome: {
    title: 'The Back Half of the Year Ran Hotter',
    subtitle:
      'NVIDIA monthly close averaged by quarter across 2023-2025. TimeUnit + aggregate transforms.',
    source: nvidiaStock.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 5. Conditional encoding — value-driven color (multi-predicate)
// ---------------------------------------------------------------------------

const conditionalSpec: ChartSpec = {
  animation: true,
  mark: 'bar',
  data: [...sp500SectorReturns.data],
  encoding: {
    x: {
      field: 'return',
      type: 'quantitative',
      axis: { title: 'Total return (%)', format: '+.0f' },
    },
    y: { field: 'sector', type: 'nominal' },
    // Three predicates evaluated in order per datum: strong gains, the single
    // loss, then the middling pack. First match wins; the fallback catches the
    // rest.
    color: {
      condition: [
        { test: { field: 'return', gte: 25 }, value: '#15803d' },
        { test: { field: 'return', lt: 0 }, value: '#dc2626' },
      ],
      value: '#94a3b8',
    },
  },
  legend: { show: false },
  annotations: [{ type: 'refline', x: 0, style: 'solid', stroke: '#334155', strokeWidth: 1.5 }],
  labels: { density: 'all', format: '+.1f' },
  chrome: {
    title: 'One Field, Three Color Buckets',
    subtitle:
      'S&P 500 sector returns, 2024. Green for a 25%+ gain, red for the lone loss, gray for the pack.',
    source: sp500SectorReturns.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 6a. Gradients — linear on horizontal bars via mark.fill
// ---------------------------------------------------------------------------

const linearGradientSpec: ChartSpec = {
  animation: true,
  mark: {
    type: 'bar',
    fill: {
      gradient: 'linear',
      x1: 0,
      y1: 0,
      x2: 1,
      y2: 0,
      stops: [
        { offset: 0, color: ACCENT, opacity: 0.35 },
        { offset: 1, color: ACCENT },
      ],
    },
  },
  data: [...co2Emissions.data.slice(0, 8)],
  encoding: {
    x: {
      field: 'emissions',
      type: 'quantitative',
      axis: { title: 'Emissions (Mt CO₂)', format: ',.0f' },
    },
    y: { field: 'country', type: 'nominal' },
  },
  labels: { density: 'all', format: ',.0f' },
  chrome: {
    title: 'A Linear Gradient Fades Each Bar In From Its Base',
    subtitle: 'One left-to-right gradient shared across all bars via mark.fill.',
    source: co2Emissions.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 6b. Gradients — area fade to transparent at the baseline
// ---------------------------------------------------------------------------

const areaGradientSpec: ChartSpec = {
  animation: true,
  mark: {
    type: 'area',
    fill: {
      gradient: 'linear',
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 1,
      stops: [
        { offset: 0, color: ACCENT, opacity: 0.85 },
        { offset: 1, color: ACCENT, opacity: 0.05 },
      ],
    },
  },
  data: [...nvidiaStock.data],
  encoding: {
    x: { field: 'date', type: 'temporal', axis: { format: '%b %Y' } },
    y: { field: 'price', type: 'quantitative', axis: { title: 'Close ($)', format: '$,.0f' } },
  },
  chrome: {
    title: 'The Fill Melts Into the Baseline',
    subtitle: 'A top-to-bottom gradient fades the area from solid to transparent.',
    source: nvidiaStock.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 7a. Faceting — small-multiples grid, shared y-scale
// ---------------------------------------------------------------------------

const facetSharedSpec: ChartSpec = {
  mark: 'line',
  data: [...gdpGrowthByCountry.data],
  encoding: {
    x: { field: 'date', type: 'temporal', axis: { format: '%Y' } },
    y: { field: 'gdp', type: 'quantitative', axis: { format: '.0f' } },
    facet: { field: 'country', type: 'nominal', columns: 3 },
  },
  chrome: {
    title: 'One Panel per Economy, One Shared Scale',
    subtitle:
      'Annual real GDP growth split into a small-multiples grid by country (shared y-axis).',
    source: gdpGrowthByCountry.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 7b. Faceting — same grid, independent y-scales per panel
// ---------------------------------------------------------------------------

const facetIndependentSpec: ChartSpec = {
  ...facetSharedSpec,
  resolve: { scale: { y: 'independent' } },
  chrome: {
    ...facetSharedSpec.chrome,
    title: 'Independent Scales Read the Shape, Not the Level',
    subtitle:
      'Each panel gets its own y-domain via resolve.scale.y = independent, so each economy fills its frame.',
  },
};

// ---------------------------------------------------------------------------
// 7c. Row faceting — vertical stack, shared x-scale
// ---------------------------------------------------------------------------

const rowFacetData = [
  { period: '2011-12', state: 'Oregon', rate: 6.4, party: 'Blue' },
  { period: '2011-12', state: 'Washington', rate: 5.2, party: 'Blue' },
  { period: '2011-12', state: 'Vermont', rate: 4.8, party: 'Blue' },
  { period: '2011-12', state: 'Colorado', rate: 4.1, party: 'Blue' },
  { period: '2024-25', state: 'Idaho', rate: 8.1, party: 'Red' },
  { period: '2024-25', state: 'Wyoming', rate: 7.3, party: 'Red' },
  { period: '2024-25', state: 'Alaska', rate: 6.9, party: 'Red' },
  { period: '2024-25', state: 'Utah', rate: 5.8, party: 'Red' },
];

const rowFacetSpec: ChartSpec = {
  mark: { type: 'bar', orient: 'horizontal' },
  data: rowFacetData,
  encoding: {
    x: { field: 'rate', type: 'quantitative', axis: { title: 'Exemption rate (%)' } },
    y: { field: 'state', type: 'nominal', sort: null },
    color: { field: 'party', type: 'nominal', scale: { range: ['#4373b8', '#d1495b'] } },
    row: { field: 'period', type: 'ordinal', sort: null },
  },
  chrome: {
    title: 'Top Exemption States Flipped Parties',
    subtitle:
      'Row faceting stacks panels vertically with a shared x-axis so bar lengths are directly comparable.',
    source: 'Illustrative data',
  },
};

// ---------------------------------------------------------------------------
// 8. Formatters — number and date format on channels and axes
// ---------------------------------------------------------------------------

const formatSpec: ChartSpec = {
  animation: true,
  mark: { type: 'line', point: true },
  data: [...nvidiaStock.data],
  encoding: {
    // Compact temporal ticks: the axis tries short labels before dropping ticks.
    x: { field: 'date', type: 'temporal', axis: { format: '%b %y' } },
    // SI-prefixed currency on the axis, full dollars in the tooltip via channel format.
    y: {
      field: 'price',
      type: 'quantitative',
      format: '$,.2f',
      axis: { title: 'Close ($)', format: '$.2~s' },
    },
  },
  chrome: {
    title: 'Axes and Tooltips Format Independently',
    subtitle: 'Compact SI currency on the axis ($.2~s), full precision in the tooltip ($,.2f).',
    source: nvidiaStock.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 9. Fill patterns — accessibility: mark.fillPattern assigns per-series SVG
// patterns so series remain distinguishable without color
// ---------------------------------------------------------------------------

const fillPatternSpec: ChartSpec = {
  animation: true,
  mark: { type: 'bar', fillPattern: 'auto' },
  data: [...energyMix.data],
  encoding: {
    x: { field: 'year', type: 'ordinal' },
    y: { field: 'energy', type: 'quantitative', stack: 'zero', axis: { title: 'Share (%)' } },
    color: { field: 'source', type: 'nominal' },
  },
  chrome: {
    title: 'Pattern Fills Make Series Readable Without Color',
    subtitle:
      'Global primary energy mix (share of total, %). Each series gets a unique hatch pattern alongside its color.',
    source: energyMix.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 10. Dash encoding — strokeDash maps a nominal field to dash patterns on lines
// ---------------------------------------------------------------------------

const dashEncodingSpec: ChartSpec = {
  mark: 'line',
  data: [...gdpGrowthByCountry.data],
  encoding: {
    x: { field: 'date', type: 'temporal', axis: { format: '%Y' } },
    y: { field: 'gdp', type: 'quantitative', axis: { title: 'GDP growth (%)' } },
    strokeDash: { field: 'country', type: 'nominal' },
  },
  chrome: {
    title: 'Dash Patterns Distinguish Series in Monochrome',
    subtitle:
      'Annual real GDP growth by country. Each country gets a distinct dash pattern via the strokeDash channel.',
    source: gdpGrowthByCountry.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default { title: 'Features' };

export const DataAndEncoding = () => (
  <GalleryPage
    title="Data & Encoding"
    lede="Transforms reshape data before it renders — filter rows, bin into histograms, derive fields, roll up by time. Conditional encoding maps values to color per datum. Gradients and formatters finish the look. Every spec on this page runs the real grammar, so each panel is a copyable recipe."
  >
    <Section
      id="transforms"
      title="Transforms"
      lede="Filter, bin, calculate, and timeUnit run in order over the data array before the chart sees a single row."
    >
      <Demo
        id="filter"
        title="Filter (interactive toggle)"
        description="A logical and/not predicate drops rows before rendering. Toggle the filter to watch the bars reshape; the spec panel shows the filtered base spec."
        specForPanel={filterBaseSpec}
        height={500}
      >
        <FilterToggle />
      </Demo>
      <Demo
        id="bin"
        title="Bin → histogram"
        description="The bin transform buckets continuous finish times; a chained aggregate counts finishers per bucket. This is a genuine histogram, computed in the spec."
        spec={binSpec}
        height={420}
      />
      <Demo
        id="calculate"
        title="Calculate (derived field)"
        description="Three chained calculate transforms turn raw revenue and cost into a profit-margin field that never existed in the source data."
        spec={calculateSpec}
        height={400}
      />
      <Demo
        id="time-unit"
        title="TimeUnit (seasonal roll-up)"
        description="Extract the quarter from each date, then average within quarter across all years — a seasonal aggregation from monthly points."
        spec={timeUnitSpec}
        height={400}
      />
    </Section>

    <Section
      id="conditional"
      title="Conditional encoding"
      lede="Test a predicate per datum and pick a value. Conditions evaluate in order — first match wins — with a fallback for the rest."
    >
      <Demo id="conditional-encoding" spec={conditionalSpec} height={460} />
    </Section>

    <Section
      id="gradients"
      title="Gradients"
      lede="Gradient fills apply via mark.fill for every mark, or per-datum through conditional color. Linear and radial are both supported."
    >
      <Demo
        id="linear-gradient"
        title="Linear gradient on bars"
        description="A single left-to-right linear gradient on mark.fill fades every bar in from its base."
        spec={linearGradientSpec}
        height={420}
      />
      <Demo
        id="area-gradient"
        title="Area fade to transparent"
        description="A top-to-bottom gradient melts the area fill into the baseline — the standard editorial area treatment."
        spec={areaGradientSpec}
        height={400}
      />
    </Section>

    <Section
      id="faceting"
      title="Faceting"
      lede="Facet, row, and column channels split one chart into small multiples. Row stacks vertically, column arranges side by side, and facet wraps into a grid. Scales are shared by default; opt into independent per-panel scales with resolve."
    >
      <Demo
        id="facet-shared"
        title="Small multiples (shared scale)"
        description="A facet field plus columns lays the data out as a grid. A shared y-scale makes panels directly comparable."
        spec={facetSharedSpec}
        height={440}
      />
      <Demo
        id="facet-independent"
        title="Independent scales"
        description="resolve.scale.y = 'independent' gives each panel its own y-domain, trading cross-panel comparison for within-panel detail."
        spec={facetIndependentSpec}
        height={440}
      />
      <Demo
        id="row-facet"
        title="Row faceting"
        description="encoding.row stacks panels vertically in a single column. The x-axis is shared so bar lengths are comparable; y-axes are independent (different categories per panel)."
        spec={rowFacetSpec}
        height={500}
      />
    </Section>

    <Section
      id="formatters"
      title="Formatters"
      lede="Number and date formats are d3-format / d3-time-format strings, set per channel or per axis. Axis and tooltip can format the same field differently."
    >
      <Demo id="formatters" spec={formatSpec} height={420} />
    </Section>

    <Section
      id="accessibility"
      title="Accessibility encoding"
      lede="Fill patterns and dash patterns add a second visual channel that works without color, for print, grayscale, and colorblind readers."
    >
      <Demo
        id="fill-patterns"
        title="Fill patterns"
        description="mark.fillPattern: 'auto' assigns a unique hatch, dot, or crosshatch pattern to each series. Patterns overlay the color fill so the chart remains readable in grayscale."
        spec={fillPatternSpec}
        height={460}
      />
      <Demo
        id="dash-encoding"
        title="Dash encoding"
        description="The strokeDash channel maps a nominal field to distinct dash patterns on line marks, differentiating series without relying on color alone."
        spec={dashEncodingSpec}
        height={420}
      />
    </Section>
  </GalleryPage>
);
