/**
 * Showcase — the full-bleed editorial gallery.
 *
 * Six publication-quality pieces that people most want to steal: a multi-series
 * line, a fully-chromed horizontal bar, a stacked-area story, a dense data
 * table, an annotated scatter, and a keyboard-navigable chart. Each piece is
 * wrapped in `.oc-bleed` so it spans wider than body text, carries a real
 * takeaway title with cited data, and exposes its spec via the copy panel.
 *
 * This page absorbs the former `infographic.stories.tsx` and
 * `chrome.stories.tsx`; their legacy slugs redirect here (see
 * .ladle/redirects.ts).
 */

import type { ChartSpec, TableSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import { Demo, GalleryPage, Section } from '../components';
import {
  bigTechRevenue,
  countryIndicators,
  energyMix,
  populationByCountry,
  stockPerformance,
  wealthHealth,
} from '../data';
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
    { key: 'price', label: 'Price', format: '$,.2f', sortable: true, align: 'right' },
    {
      key: 'ytdChange',
      label: 'YTD %',
      format: '+.1f',
      sortable: true,
      align: 'right',
      bar: {},
    },
    { key: 'trend', label: '8-week trend', sparkline: { type: 'line' } },
  ],
  chrome: {
    title: 'Twenty Large Caps, One Dense Table',
    subtitle: 'Price, year-to-date return, and an 8-week trend line per row',
    source: stockPerformance.source,
    byline: 'Table: OpenChart',
  },
  search: true,
  pagination: { pageSize: 10 },
  animation: true,
};

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
    lede="Full-bleed, publication-ready pieces — the specs people most want to steal. Every chart carries a takeaway title, cited data, and a copyable spec. These are the same declarative specs you'd write yourself, rendered at editorial scale."
  >
    <Section
      id="pieces"
      title="Editorial pieces"
      lede="Six patterns, each wider than body text: a multi-series line, a fully-chromed bar, a stacked-area story, a dense table, an annotated scatter, and a keyboard-navigable chart."
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
          description="A DataTable spec with category-color chips, an inline YTD bar, and an 8-week sparkline per row — sortable, searchable, paginated."
          spec={tableSpec}
        />
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
