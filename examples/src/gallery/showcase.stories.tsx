/**
 * Showcase — the full-bleed editorial gallery.
 *
 * Ten publication-quality pieces that people most want to steal: a multi-series
 * line, a fully-chromed horizontal bar, a stacked-area story, a dense data
 * table, a world choropleth, a path-tracing sankey, a force graph, a KPI row,
 * an annotated scatter, and a keyboard-navigable chart. Each piece is
 * wrapped in `.oc-bleed` so it spans wider than body text, carries a real
 * takeaway title with cited data, and exposes its spec via the copy panel.
 *
 * This page absorbs the former `infographic.stories.tsx` and
 * `chrome.stories.tsx`; their legacy slugs redirect here (see
 * .ladle/redirects.ts).
 */

import type {
  ChartSpec,
  GeoMapSpec,
  GraphSpec,
  SankeySpec,
  TableSpec,
} from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import worldTopo from 'world-atlas/countries-110m.json';
import { Demo, GalleryPage, Section } from '../components';
import {
  bigTechRevenue,
  countryIndicators,
  energyFlow,
  energyMix,
  populationByCountry,
  stockPerformance,
  wealthHealth,
  worldGdp,
} from '../data';
import { StatCard, useDashRootClass } from './dashboards.layouts';
import { hBarGradient } from './helpers';

const ACCENT = '#0e7490';

// ---------------------------------------------------------------------------
// 1. Multi-series line — legend bottom-right, endpoint labels
// ---------------------------------------------------------------------------

const multiLineSpec: ChartSpec = {
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
  annotations: [
    {
      type: 'text',
      x: '2021-01-01',
      y: 470,
      text: 'Amazon crosses\n$470B in 2021',
      anchor: 'right',
      offset: { dx: -16, dy: -12 },
      connector: true,
      background: true,
    },
  ],
  labels: { density: 'endpoints', format: ',.0f' },
  chrome: {
    title: 'Amazon Pulls Away as Big Tech Keeps Climbing',
    subtitle: 'Annual revenue for the five largest US tech companies, 2019-2024 ($B)',
    source: bigTechRevenue.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 2. Horizontal bar — every chrome element (eyebrow through footer)
// ---------------------------------------------------------------------------

const fullChromeSpec: ChartSpec = {
  animation: true,
  mark: { type: 'bar', fill: hBarGradient(ACCENT) },
  data: [...populationByCountry.data],
  encoding: {
    x: { field: 'population', type: 'quantitative', axis: { title: 'Population', format: '.2~s' } },
    y: { field: 'country', type: 'nominal' },
  },
  annotations: [
    { type: 'refline', x: 1_000_000_000, label: '1 billion', style: 'dashed', stroke: '#cc4444' },
  ],
  chrome: {
    eyebrow: 'Demographics',
    title: 'India Has Overtaken China as the Most Populous Country',
    subtitle: 'Population by country, 2025 estimates',
    source: populationByCountry.source,
    byline: 'By the OpenChart team',
    footer: 'Note: figures are mid-year population estimates, rounded to the nearest million.',
  },
};

// ---------------------------------------------------------------------------
// 3. Stacked area — composition over time
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
      stack: 'zero',
      axis: { title: 'Share of primary energy (%)' },
    },
    color: { field: 'source', type: 'nominal' },
  },
  annotations: [
    {
      type: 'text',
      x: '2020',
      y: 92,
      text: 'Renewables edge past\nnuclear and keep rising',
      anchor: 'left',
      offset: { dx: -150, dy: -10 },
      connector: true,
      background: true,
    },
  ],
  chrome: {
    title: 'Fossil Fuels Still Own Four-Fifths of the Energy Mix',
    subtitle: 'Global primary energy consumption by source, 2015-2022 (% of total)',
    source: energyMix.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 4. Dense data table — sparklines, inline bars, sort/search/pagination
// ---------------------------------------------------------------------------

const tableSpec: TableSpec = {
  type: 'table',
  data: [...stockPerformance.data],
  columns: [
    { key: 'ticker', label: 'Ticker', sortable: true },
    { key: 'name', label: 'Company', sortable: true },
    {
      key: 'sector',
      label: 'Sector',
      sortable: true,
      categoryColors: {
        Technology: '#0e7490',
        Communication: '#7c3aed',
        Consumer: '#c2410c',
        Financials: '#15803d',
        Healthcare: '#be123c',
      },
    },
    { key: 'price', label: 'Price', format: '$,.2f', sortable: true, bar: {} },
    { key: 'ytdChange', label: 'YTD', format: '.1f', sortable: true, delta: true },
    { key: 'trend', label: '8-week trend', sparkline: { type: 'line' } },
  ],
  chrome: {
    title: 'Twenty Large Caps, One Dense Table',
    subtitle:
      'Condensed 40px rows: a category chip, an inline price bar, a signed YTD chip, and a shared-domain 8-week spark',
    source: stockPerformance.source,
    byline: 'Table: OpenChart',
  },
  density: 'condensed',
  search: true,
  pagination: { pageSize: 10 },
  animation: true,
};

// ---------------------------------------------------------------------------
// 4b. World choropleth — equal-earth with a titled, unit-carrying legend
// ---------------------------------------------------------------------------

const worldMapSpec: GeoMapSpec = {
  type: 'map',
  geo: { features: worldTopo, projection: 'equalEarth' },
  data: [...worldGdp.data],
  encoding: {
    key: { field: 'id', type: 'nominal' },
    color: { field: 'gdp', type: 'quantitative', title: 'GDP per capita (US$)' },
  },
  valueFormat: '$,.0f',
  chrome: {
    title: 'The World in Dollars Per Person',
    subtitle:
      'GDP per capita, current US$, 2023 — equal-interval classes with a detached “no data” swatch',
    source: worldGdp.source,
    byline: 'Map: OpenChart',
  },
  animation: true,
};

// ---------------------------------------------------------------------------
// 4c. Sankey — hovering any node traces its whole upstream and downstream path
// ---------------------------------------------------------------------------

const sankeySpec: SankeySpec = {
  type: 'sankey',
  data: [...energyFlow.data],
  encoding: {
    source: { field: 'source', type: 'nominal' },
    target: { field: 'target', type: 'nominal' },
    value: { field: 'value', type: 'quantitative' },
  },
  valueFormat: '.1f',
  chrome: {
    title: 'Electricity Is the Grand Central of US Energy',
    subtitle: 'Hover any node: the whole upstream and downstream path lights, everything else dims',
    source: energyFlow.source,
    byline: 'Chart: OpenChart',
  },
  animation: true,
};

// ---------------------------------------------------------------------------
// 4d. Force graph — a supply network, colored by tier
// ---------------------------------------------------------------------------

type SupplyEdge = [string, string];

const supplyTiers: Record<string, string> = {
  Assembly: 'Assembly',
  'Battery Pack': 'Module',
  Powertrain: 'Module',
  Chassis: 'Module',
  Cells: 'Component',
  'Cathode Mill': 'Component',
  Inverter: 'Component',
  'Wire Harness': 'Component',
  Stamping: 'Component',
  Lithium: 'Raw material',
  Nickel: 'Raw material',
  Copper: 'Raw material',
  Aluminium: 'Raw material',
  Graphite: 'Raw material',
};

const supplyEdges: SupplyEdge[] = [
  ['Battery Pack', 'Assembly'],
  ['Powertrain', 'Assembly'],
  ['Chassis', 'Assembly'],
  ['Cells', 'Battery Pack'],
  ['Cathode Mill', 'Cells'],
  ['Inverter', 'Powertrain'],
  ['Wire Harness', 'Powertrain'],
  ['Stamping', 'Chassis'],
  ['Lithium', 'Cathode Mill'],
  ['Nickel', 'Cathode Mill'],
  ['Graphite', 'Cells'],
  ['Copper', 'Wire Harness'],
  ['Copper', 'Inverter'],
  ['Aluminium', 'Stamping'],
  ['Aluminium', 'Chassis'],
];

const graphSpec: GraphSpec = {
  type: 'graph',
  nodes: Object.entries(supplyTiers).map(([id, tier]) => ({ id, label: id, tier })),
  edges: supplyEdges.map(([source, target]) => ({ source, target })),
  encoding: { nodeColor: { field: 'tier', type: 'nominal' } },
  layout: { type: 'force', chargeStrength: -220, linkDistance: 60 },
  chrome: {
    title: 'Five Raw Materials Reach One Assembly Line',
    subtitle: 'Hover a node to isolate its neighbourhood; drag to reheat the layout',
    source: 'Illustrative data',
    byline: 'Graph: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 4e. KPI row — the dashboard tile anatomy at editorial width
// ---------------------------------------------------------------------------

function KpiRow() {
  const rootClass = useDashRootClass('');
  return (
    <div
      className={rootClass}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 'var(--gx-space-4)',
      }}
    >
      <StatCard label="MRR" value="$1.42M" delta="+4.8%" timeframe="vs. last month" />
      <StatCard label="Net new logos" value="218" delta="+12.1%" timeframe="vs. last month" />
      <StatCard
        label="Gross churn"
        value="1.9%"
        delta="-0.4pp"
        tone="up"
        timeframe="vs. last month"
      />
      <StatCard
        label="Support backlog"
        value="341"
        delta="+18.0%"
        tone="down"
        timeframe="vs. last week"
      />
      <StatCard label="p95 latency" value="284ms" delta="0.0%" tone="flat" timeframe="last 24h" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. Annotated scatter — the wealth/health story with a callout
// ---------------------------------------------------------------------------

const scatterSpec: ChartSpec = {
  animation: true,
  mark: 'point',
  data: [...wealthHealth.data],
  encoding: {
    x: {
      field: 'gdpPerCapita',
      type: 'quantitative',
      axis: { title: 'GDP per capita (US$)', format: '$,.0s', grid: true },
    },
    y: {
      field: 'lifeExpectancy',
      type: 'quantitative',
      axis: { title: 'Life expectancy (years)', grid: true },
    },
    size: { field: 'pop', type: 'quantitative' },
    color: { field: 'region', type: 'nominal' },
  },
  annotations: [
    {
      type: 'text',
      x: 63544,
      y: 77.3,
      text: 'The US spends the most\nbut lives shorter than peers',
      anchor: 'left',
      offset: { dx: -24, dy: 40 },
      connector: 'curve',
      background: true,
    },
  ],
  legend: { position: 'bottom-right' },
  chrome: {
    title: 'Wealthier Nations Live Longer, up to a Point',
    subtitle: 'GDP per capita vs. life expectancy, 2022 — bubble size scaled to population',
    source: wealthHealth.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 6. Keyboard navigation — the a11y story surfaced as a prompt
// ---------------------------------------------------------------------------

const keyboardSpec: ChartSpec = {
  mark: { type: 'bar', fill: hBarGradient(ACCENT) },
  data: [...countryIndicators.data],
  encoding: {
    x: {
      field: 'gdpPerCapita',
      type: 'quantitative',
      axis: { title: 'GDP per capita (PPP, US$)', format: '$,.0s' },
    },
    y: { field: 'country', type: 'nominal' },
  },
  chrome: {
    title: 'Every Chart Is Keyboard Navigable',
    subtitle: 'Tab to the plot, then walk the bars with the arrow keys',
    source: countryIndicators.source,
  },
};

function KeyboardDemo() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gx-space-3)' }}>
      <div style={{ height: 460 }}>
        <Chart spec={keyboardSpec} />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--gx-space-3)',
          padding: 'var(--gx-space-3) var(--gx-space-4)',
          border: '1px solid var(--gx-border)',
          borderRadius: 'var(--gx-radius-control)',
          background: 'var(--gx-surface-raised)',
          fontSize: 'var(--gx-type-caption)',
          color: 'var(--gx-text-muted)',
        }}
      >
        <span style={{ color: 'var(--gx-text-muted)' }}>Try it:</span>
        <span>
          <kbd>Tab</kbd> to focus the chart
        </span>
        <span>
          <kbd>&larr;</kbd> <kbd>&rarr;</kbd> to move between marks
        </span>
        <span>
          <kbd>Enter</kbd> to select
        </span>
        <span>
          <kbd>Esc</kbd> to exit
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default { title: 'Showcase' };

export const Showcase = () => (
  <GalleryPage
    title="Showcase"
    lede="Full-bleed, publication-ready pieces — the specs people most want to steal. Charts, a table, a map, a sankey, a graph, and a KPI row, every one carrying a takeaway title, cited data, and a copyable spec. These are the same declarative specs you'd write yourself, rendered at editorial scale."
  >
    <Section
      id="pieces"
      title="Editorial pieces"
      lede="Ten patterns, each wider than body text: a multi-series line, a fully-chromed bar, a stacked-area story, a dense table, a world choropleth, a path-tracing sankey, a force graph, a KPI row, an annotated scatter, and a keyboard-navigable chart."
    >
      <div className="oc-bleed">
        <Demo
          id="multi-series-line"
          title="Multi-series line"
          description="Five series labeled directly at their right endpoints — direct labeling replaces a legend, so each line names itself."
          spec={multiLineSpec}
          height={520}
        />
      </div>

      <div className="oc-bleed">
        <Demo
          id="full-chrome-bar"
          title="Horizontal bar with full chrome"
          description="Every editorial chrome element at once: eyebrow, title, subtitle, source, byline, and footer wrapped around a ranked horizontal bar."
          spec={fullChromeSpec}
          height={520}
        />
      </div>

      <div className="oc-bleed">
        <Demo
          id="stacked-area"
          title="Stacked area"
          description="Composition over time: primary-energy shares stacked to 100-ish percent, annotated where renewables pull ahead of nuclear."
          spec={stackedAreaSpec}
          height={500}
        />
      </div>

      <div className="oc-bleed">
        <Demo
          id="data-table"
          title="Dense data table"
          description="A DataTable spec at condensed density: category-color chips, an inline price bar, a signed YTD delta chip, and an 8-week sparkline per row — sortable, searchable, paginated."
          spec={tableSpec}
        />
      </div>

      <div className="oc-bleed">
        <Demo
          id="world-choropleth"
          title="World choropleth"
          description="Equal-earth projection, equal-interval classes, and a legend that carries its own title, units, and a detached “no data” swatch."
          spec={worldMapSpec}
          height={560}
        />
      </div>

      <div className="oc-bleed">
        <Demo
          id="sankey-flow"
          title="Sankey with path tracing"
          description="Hover any node and the whole upstream and downstream path stays lit while everything else drops back."
          spec={sankeySpec}
          height={560}
        />
      </div>

      <div className="oc-bleed">
        <Demo
          id="force-graph"
          title="Force-directed graph"
          description="A supply network colored by tier. Hovering isolates a neighbourhood; the legend toggles categories."
          spec={graphSpec}
          height={560}
        />
      </div>

      <div className="oc-bleed">
        <Demo
          id="kpi-row"
          title="KPI row"
          description="The tile anatomy: label, value at display size, a delta chip on a tint of its own semantic color, then the timeframe."
        >
          <KpiRow />
        </Demo>
      </div>

      <div className="oc-bleed">
        <Demo
          id="annotated-scatter"
          title="Annotated scatter"
          description="The classic wealth/health bubble scatter with a curved-connector callout flagging the US outlier."
          spec={scatterSpec}
          height={540}
        />
      </div>

      <div className="oc-bleed">
        <Demo
          id="keyboard-nav"
          title="Keyboard navigation"
          description="Charts are keyboard navigable out of the box. Focus the plot and walk the marks — no extra config."
          specForPanel={keyboardSpec}
          height={560}
        >
          <KeyboardDemo />
        </Demo>
      </div>
    </Section>
  </GalleryPage>
);
