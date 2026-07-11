/**
 * Charts / Bar & Column — the gallery proving ground.
 *
 * Ten demos across three sections (Basics, Composition, Edge cases). Each chart
 * carries editorial chrome (takeaway title + cited source) and pulls from the
 * shared dataset pool. This page is the template every later gallery page copies.
 */

import type { ChartSpec, MarkEvent } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import { useState } from 'react';
import { Demo, GalleryPage, Section } from '../components';
import {
  departmentBudgets,
  householdSpending,
  populationByCountry,
  programmingLanguages,
  renewableCapacityAdditions,
  sp500SectorReturns,
  temperatureAnomaly,
  usPayrolls,
} from '../data';
import { hBarGradient, vBarGradient } from './helpers';

const ACCENT = '#0e7490';

// ---------------------------------------------------------------------------
// 1. Simple horizontal bars — ranked categories
// ---------------------------------------------------------------------------

const simpleBarsSpec: ChartSpec = {
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
    title: 'India Has Overtaken China as the Most Populous Country',
    subtitle: 'Population by country, 2025 estimates',
    source: populationByCountry.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 2. Simple vertical columns — categorical over time
// ---------------------------------------------------------------------------

const columnsSpec: ChartSpec = {
  animation: true,
  mark: { type: 'bar', fill: vBarGradient(ACCENT) },
  data: [...usPayrolls.data],
  encoding: {
    x: { field: 'month', type: 'nominal' },
    y: { field: 'jobs', type: 'quantitative', axis: { title: 'Jobs added (thousands)' } },
  },
  annotations: [
    {
      type: 'text',
      x: 'Oct',
      y: 12,
      text: 'Hurricanes and strikes\nstalled October hiring',
      anchor: 'top',
      offset: { dx: 0, dy: -190 },
      connector: true,
    },
    {
      type: 'refline',
      y: 216,
      label: 'avg: 216K',
      style: 'dashed',
      stroke: '#64748b',
      strokeWidth: 1,
      labelOffset: { dx: -560, dy: -10 },
    },
  ],
  labels: { density: 'all', format: ',.0f' },
  chrome: {
    title: 'The Job Market Cooled but Never Cracked',
    subtitle: 'Monthly US nonfarm payroll additions, 2024 (thousands of jobs)',
    source: usPayrolls.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 3. Grouped columns — series comparison (color = series)
// ---------------------------------------------------------------------------

const groupedColumnsSpec: ChartSpec = {
  animation: true,
  mark: 'bar',
  data: [...renewableCapacityAdditions.data],
  encoding: {
    x: { field: 'year', type: 'nominal' },
    y: {
      field: 'capacity',
      type: 'quantitative',
      stack: null,
      axis: { title: 'Capacity added (GW)' },
    },
    color: { field: 'type', type: 'nominal' },
  },
  annotations: [
    {
      type: 'text',
      x: '2023',
      y: 346,
      text: 'Solar nearly tripled\nwind additions by 2023',
      anchor: 'top',
      offset: { dx: -70, dy: -16 },
      connector: false,
    },
  ],
  labels: { density: 'none' },
  chrome: {
    title: 'Solar Is Running Away With the Energy Transition',
    subtitle: 'Global renewable capacity additions by source, 2019-2023 (gigawatts)',
    source: renewableCapacityAdditions.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 4. Stacked bars — composition
// ---------------------------------------------------------------------------

const stackedBarsSpec: ChartSpec = {
  animation: true,
  mark: 'bar',
  data: [...householdSpending.data],
  encoding: {
    x: {
      field: 'pct',
      type: 'quantitative',
      stack: 'zero',
      axis: { title: 'Share of spending (%)' },
    },
    y: { field: 'bracket', type: 'nominal' },
    color: { field: 'category', type: 'nominal' },
  },
  labels: { density: 'all' },
  chrome: {
    title: 'The Poorer You Are, the More Housing Eats Your Paycheck',
    subtitle: 'Share of annual household expenditure by category and income bracket, 2022 (%)',
    source: householdSpending.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 5. 100% stacked bars — normalize
// ---------------------------------------------------------------------------

const normalizedBarsSpec: ChartSpec = {
  animation: true,
  mark: 'bar',
  data: [...householdSpending.data],
  encoding: {
    x: {
      field: 'pct',
      type: 'quantitative',
      stack: 'normalize',
      axis: { title: 'Share of spending', format: '.0%' },
    },
    y: { field: 'bracket', type: 'nominal' },
    color: { field: 'category', type: 'nominal' },
  },
  labels: { density: 'none' },
  chrome: {
    title: 'Every Bracket Splits Its Budget Differently',
    subtitle: 'Household expenditure normalized to 100% per income bracket, 2022',
    source: householdSpending.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 6. Diverging columns — positive/negative around zero, conditional color
// ---------------------------------------------------------------------------

const divergingColumnsSpec: ChartSpec = {
  animation: true,
  mark: 'bar',
  data: [...temperatureAnomaly.data],
  encoding: {
    x: { field: 'year', type: 'ordinal' },
    y: {
      field: 'anomaly',
      type: 'quantitative',
      axis: { title: 'Temperature anomaly (°C)', format: '+.1f' },
    },
    // Conditional color: the data carries a `trend` category ("Cooler"/"Warmer")
    // and the color scale maps it to a cool/warm pair instead of the default palette.
    color: {
      field: 'trend',
      type: 'nominal',
      scale: { domain: ['Cooler', 'Warmer'], range: ['#3b82c4', '#d1495b'] },
    },
  },
  labels: { density: 'none' },
  annotations: [
    {
      type: 'refline',
      y: 0,
      style: 'solid',
      strokeWidth: 1,
    },
    {
      type: 'text',
      x: '2025',
      y: 1.17,
      text: '2025 ran 1.17°C above\nthe 20th-century average',
      connector: true,
      anchor: 'left',
      offset: { dx: -170, dy: 20 },
    },
  ],
  chrome: {
    title: 'Since 1980, Every Half-Decade Has Been Warmer Than Average',
    subtitle: 'Global surface temperature anomaly vs. 20th-century average, °C',
    source: temperatureAnomaly.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 7. Negative values — genuine negatives with a zero baseline, conditional color
// ---------------------------------------------------------------------------

// Derive a direction category so the color scale can flag the one negative sector.
const sectorReturns = sp500SectorReturns.data.map((d) => ({
  ...d,
  direction: d.return >= 0 ? 'Gain' : 'Loss',
}));

const negativeValuesSpec: ChartSpec = {
  animation: true,
  mark: 'bar',
  data: sectorReturns,
  encoding: {
    x: {
      field: 'return',
      type: 'quantitative',
      axis: { title: 'Total return (%)', format: '+.0f' },
    },
    y: { field: 'sector', type: 'nominal' },
    color: {
      field: 'direction',
      type: 'nominal',
      scale: { domain: ['Gain', 'Loss'], range: [ACCENT, '#d1495b'] },
    },
  },
  legend: { show: false },
  annotations: [
    { type: 'refline', x: 0, style: 'solid', stroke: '#334155', strokeWidth: 1.5 },
    {
      type: 'refline',
      x: 23.3,
      label: 'S&P 500: +23.3%',
      style: 'dashed',
      stroke: '#64748b',
      strokeWidth: 1,
    },
  ],
  labels: { density: 'all', format: '+.1f' },
  chrome: {
    title: 'Only Materials Ended 2024 in the Red',
    subtitle: 'S&P 500 total return by sector, full year 2024',
    source: sp500SectorReturns.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 8. Bar list — ranked list pattern
// ---------------------------------------------------------------------------

const barListSpec = {
  type: 'barlist' as const,
  data: [...programmingLanguages.data],
  encoding: {
    label: { field: 'language', type: 'nominal' as const },
    value: { field: 'pct', type: 'quantitative' as const },
    color: { field: 'category', type: 'nominal' as const },
  },
  valueFormat: '.1f',
  chrome: {
    title: 'Python Leads the Pack',
    subtitle: 'Programming-language popularity index, % share, 2025',
    source: programmingLanguages.source,
  },
};

// ---------------------------------------------------------------------------
// 9. Long category labels — rotation/truncation ladder
// ---------------------------------------------------------------------------

const longLabelsSpec: ChartSpec = {
  animation: true,
  mark: { type: 'bar', fill: vBarGradient(ACCENT) },
  data: [...departmentBudgets.data],
  encoding: {
    x: { field: 'department', type: 'nominal' },
    y: { field: 'budget', type: 'quantitative', axis: { title: 'Budget ($M)' } },
  },
  chrome: {
    title: 'R&D Claims the Biggest Slice',
    subtitle: 'Annual departmental budget allocations, FY 2025 ($M)',
    source: departmentBudgets.source,
  },
};

// ---------------------------------------------------------------------------
// 10. Interactive — onMarkClick + highlight, with a live event readout
// ---------------------------------------------------------------------------

const interactiveSpec: ChartSpec = {
  mark: { type: 'bar', fill: hBarGradient(ACCENT) },
  data: [...populationByCountry.data],
  encoding: {
    x: { field: 'population', type: 'quantitative', axis: { title: 'Population', format: '.2~s' } },
    y: { field: 'country', type: 'nominal' },
  },
  chrome: {
    title: 'Click a Bar to Isolate It',
    subtitle: 'onMarkClick sets the highlight; click again to clear',
    source: populationByCountry.source,
  },
};

function InteractiveBars() {
  const [selected, setSelected] = useState<string | null>(null);
  const [last, setLast] = useState<{ country: string; population: number } | null>(null);

  const onMarkClick = (e: MarkEvent) => {
    const country = e.datum.country as string;
    const population = e.datum.population as number;
    setLast({ country, population });
    setSelected((cur) => (cur === country ? null : country));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-3)' }}>
      <div style={{ height: 460 }}>
        <Chart
          spec={interactiveSpec}
          highlight={selected ? [selected] : null}
          onMarkClick={onMarkClick}
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
        <span style={{ color: 'var(--oc-text-muted)' }}>last click</span>
        {last ? (
          <span style={{ color: 'var(--oc-text)' }}>
            {last.country} — {last.population.toLocaleString()}
          </span>
        ) : (
          <span>none yet</span>
        )}
        <span style={{ marginLeft: 'auto', color: 'var(--oc-text-muted)' }}>
          highlight: {selected ?? '(cleared)'}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default { title: 'Charts' };

export const BarAndColumn = () => (
  <GalleryPage
    title="Bar & Column"
    lede="Bars and columns rank and compare magnitudes. Horizontal bars suit long category labels and rankings; vertical columns suit time and short categories. Group, stack, or normalize to show composition, and let value-driven color carry the story."
  >
    <Section
      id="basics"
      title="Basics"
      lede="Horizontal bars for rankings, vertical columns for time. Direct value labels beat a legend when there is one series."
    >
      <Demo
        id="simple-bars"
        title="Simple bars (horizontal)"
        description="Rank categories by a single measure; sorted, horizontal, with a reference line for context."
        spec={simpleBarsSpec}
        height={480}
      />
      <Demo
        id="columns"
        title="Columns (vertical)"
        description="Use columns for time or short ordered categories; annotate the outlier and mark the average."
        spec={columnsSpec}
        height={420}
      />
      <Demo
        id="grouped-columns"
        title="Grouped columns"
        description="Compare a few series side by side when absolute values (not composition) are the point."
        spec={groupedColumnsSpec}
        height={440}
      />
    </Section>

    <Section
      id="composition"
      title="Composition"
      lede="Stack to show parts of a whole; normalize when the split matters more than the totals."
    >
      <Demo
        id="stacked-bars"
        title="Stacked bars"
        description="Stack segments to read both the total and each part's contribution in one bar."
        spec={stackedBarsSpec}
        height={440}
      />
      <Demo
        id="normalized-stacked"
        title="100% stacked"
        description="Normalize each bar to 100% when you care about the mix, not the absolute totals."
        spec={normalizedBarsSpec}
        height={440}
      />
      <Demo
        id="bar-list"
        title="Bar list"
        description="A compact ranked list with inline proportional bars — ideal for dashboards and dense rankings."
        spec={barListSpec}
        height={520}
      />
    </Section>

    <Section
      id="edge-cases"
      title="Edge cases"
      lede="Negatives, a zero baseline, long labels, and interaction — the situations that break naive bar charts."
    >
      <Demo
        id="diverging-columns"
        title="Diverging columns"
        description="Columns above and below zero with conditional color drawn from a direction field in the data."
        spec={divergingColumnsSpec}
        height={460}
      />
      <Demo
        id="negative-values"
        title="Negative values"
        description="A genuine negative value anchored to a solid zero reference line; value-driven color flags the loss."
        spec={negativeValuesSpec}
        height={460}
      />
      <Demo
        id="long-labels"
        title="Long category labels"
        description="The axis walks a rotation ladder — horizontal, then angled, then truncated — before dropping ticks, so long names stay readable."
        spec={longLabelsSpec}
        height={460}
      />
      <Demo
        id="interactive"
        title="Interactive (click to highlight)"
        description="onMarkClick drives a highlight and a live event readout; the escape hatch renders a stateful React component while the spec panel still shows the base spec."
        specForPanel={interactiveSpec}
        height={540}
      >
        <InteractiveBars />
      </Demo>
    </Section>
  </GalleryPage>
);
