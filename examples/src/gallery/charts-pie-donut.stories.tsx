/**
 * Charts / Pie & Donut.
 *
 * Part-to-whole marks. OpenChart labels slices directly with leader lines
 * instead of leaning on a legend, auto-buckets tiny slices into "Other", and
 * turns a pie into a donut with a single `innerRadius`. Seven demos across
 * three sections (Basics, Comparison, Interaction), all pulling from the shared
 * dataset pool with cited chrome.
 */

import type { ChartSpec, MarkEvent } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import { useState } from 'react';
import { Demo, GalleryPage, Section } from '../components';
import {
  browserShare,
  co2Emissions,
  electricityMix,
  federalBudget,
  programmingLanguages,
  smartphoneShare,
} from '../data';

// Muted palette with Renewables (domain index 4) picked out in vivid green so
// the comparison donuts tell the "renewables quadrupled" story at a glance.
const ELECTRICITY_PALETTE = ['#b0b0b0', '#c8c8c8', '#a0a0a0', '#d0d0d0', '#2d8a4e', '#e0e0e0'];

// ---------------------------------------------------------------------------
// 1. Pie with inline (leader-line) slice labels — the default
// ---------------------------------------------------------------------------

const basicPieSpec: ChartSpec = {
  animation: true,
  mark: 'arc',
  data: [...browserShare.data],
  encoding: {
    y: { field: 'share', type: 'quantitative' },
    color: { field: 'browser', type: 'nominal' },
  },
  chrome: {
    title: 'Chrome Owns Nearly Two-Thirds of the Browser Market',
    subtitle: 'Global desktop and mobile browser share, January 2024 (%)',
    source: browserShare.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 2. Donut (innerRadius) with a center metric
// ---------------------------------------------------------------------------

const donutSpec: ChartSpec = {
  animation: true,
  mark: { type: 'arc', innerRadius: 70 },
  data: [...federalBudget.data],
  encoding: {
    y: { field: 'spending', type: 'quantitative' },
    color: { field: 'category', type: 'nominal' },
  },
  chrome: {
    title: 'Healthcare and Social Security Eat Nearly Half the Budget',
    subtitle: 'Share of $6.9 trillion in federal spending, fiscal year 2024',
    source: federalBudget.source,
    byline: 'Chart: OpenChart',
  },
};

/**
 * The engine has no built-in center-metric config, so the metric is a plain
 * absolutely-positioned overlay centered over the donut hole. The donut's
 * `innerRadius` leaves the room; the overlay is `pointer-events: none` so it
 * never steals hover/tooltip targets from the slices underneath.
 */
function CenterMetricDonut() {
  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <Chart spec={donutSpec} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          // Nudge below the chrome so the text sits in the donut hole, not the title.
          paddingTop: 96,
          textAlign: 'center',
        }}
      >
        <span
          style={{
            fontSize: 32,
            fontWeight: 700,
            lineHeight: 1,
            color: 'var(--oc-text)',
          }}
        >
          $6.9T
        </span>
        <span
          style={{
            marginTop: 4,
            fontSize: 'var(--oc-type-caption)',
            color: 'var(--oc-text-muted)',
          }}
        >
          total outlays
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Small-slice grouping — automatic "Other" bucketing
// ---------------------------------------------------------------------------

const smallSliceSpec: ChartSpec = {
  animation: true,
  mark: 'arc',
  data: [...co2Emissions.data],
  encoding: {
    y: { field: 'emissions', type: 'quantitative' },
    color: { field: 'country', type: 'nominal' },
  },
  chrome: {
    title: 'China and the US Alone Drive Nearly Half of Top-Emitter CO₂',
    subtitle:
      'Annual CO₂ emissions, million tonnes, 2024. Slices under ~3% are auto-grouped into "Other".',
    source: co2Emissions.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 4. Many categories — when a pie stops working, reach for a bar
// ---------------------------------------------------------------------------

const manyCategoriesSpec: ChartSpec = {
  animation: true,
  mark: 'bar',
  data: [...programmingLanguages.data],
  encoding: {
    x: { field: 'pct', type: 'quantitative', axis: { title: 'Share (%)' } },
    y: { field: 'language', type: 'nominal' },
  },
  labels: { density: 'all', format: '.1f' },
  chrome: {
    title: 'Twelve Slices Is a Bar Chart, Not a Pie',
    subtitle: 'Programming-language popularity index, % share, 2025',
    source: programmingLanguages.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 5. Side-by-side comparison donuts with a shared bottom legend
// ---------------------------------------------------------------------------

const electricity2010Spec: ChartSpec = {
  animation: true,
  mark: { type: 'arc', innerRadius: 45 },
  data: [...electricityMix['2010']],
  encoding: {
    y: { field: 'share', type: 'quantitative' },
    color: { field: 'source', type: 'nominal' },
  },
  labels: { density: 'none' },
  legend: { position: 'bottom' },
  theme: { colors: { categorical: ELECTRICITY_PALETTE } },
  chrome: { subtitle: 'in 2010' },
};

const electricity2023Spec: ChartSpec = {
  ...electricity2010Spec,
  data: [...electricityMix['2023']],
  chrome: { subtitle: 'in 2023' },
};

function ComparisonDonuts() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-3)' }}>
      <div>
        <h3
          style={{
            margin: 0,
            fontSize: 'var(--oc-type-h3, 18px)',
            fontWeight: 600,
            color: 'var(--oc-text)',
          }}
        >
          Renewables Have Quadrupled Their Share Since 2010
        </h3>
        <p
          style={{
            margin: '4px 0 0',
            fontSize: 'var(--oc-type-caption)',
            color: 'var(--oc-text-muted)',
          }}
        >
          Share of global electricity generation by source (%)
        </p>
      </div>
      <div style={{ display: 'flex', gap: 'var(--oc-space-4)', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 260px', height: 360 }}>
          <Chart spec={electricity2010Spec} />
        </div>
        <div style={{ flex: '1 1 260px', height: 360 }}>
          <Chart spec={electricity2023Spec} />
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 'var(--oc-type-caption)', color: 'var(--oc-text-faint)' }}>
        {electricityMix.source}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6. Leader-line labels — smartphone market pattern
// ---------------------------------------------------------------------------

const leaderLineSpec: ChartSpec = {
  animation: true,
  mark: { type: 'arc', innerRadius: 55 },
  data: [...smartphoneShare.data],
  encoding: {
    y: { field: 'share', type: 'quantitative' },
    color: { field: 'brand', type: 'nominal' },
  },
  chrome: {
    title: 'Apple Reclaimed the Top Spot From Samsung in Q4',
    subtitle: 'Global smartphone market share by vendor, Q4 2024 (%)',
    source: smartphoneShare.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 7. Interactive — hover a slice, center metric follows
// ---------------------------------------------------------------------------

const interactiveSpec: ChartSpec = {
  mark: { type: 'arc', innerRadius: 80 },
  data: [...federalBudget.data],
  encoding: {
    y: { field: 'spending', type: 'quantitative' },
    color: { field: 'category', type: 'nominal' },
  },
  labels: { density: 'none' },
  chrome: {
    title: 'Hover a Slice to Read It',
    subtitle: 'onMarkHover drives the center readout; move away to reset',
    source: federalBudget.source,
  },
};

const TOTAL_SHARE = federalBudget.data.reduce((sum, d) => sum + d.spending, 0);

function InteractiveDonut() {
  const [hovered, setHovered] = useState<{ category: string; spending: number } | null>(null);

  const onMarkHover = (e: MarkEvent) => {
    const category = e.datum.category as string;
    const spending = e.datum.spending as number;
    if (typeof category === 'string' && typeof spending === 'number') {
      setHovered({ category, spending });
    }
  };

  const primary = hovered ? `${hovered.spending}%` : `${TOTAL_SHARE}%`;
  const label = hovered ? hovered.category : 'of the budget';

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <Chart
        spec={interactiveSpec}
        onMarkHover={onMarkHover}
        onMarkLeave={() => setHovered(null)}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          paddingTop: 84,
          textAlign: 'center',
        }}
      >
        <span style={{ fontSize: 34, fontWeight: 700, lineHeight: 1, color: 'var(--oc-text)' }}>
          {primary}
        </span>
        <span
          style={{
            marginTop: 4,
            maxWidth: 140,
            fontSize: 'var(--oc-type-caption)',
            color: 'var(--oc-text-muted)',
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default { title: 'Charts' };

export const PieAndDonut = () => (
  <GalleryPage
    title="Pie & Donut"
    lede="Pie and donut charts show parts of a whole. OpenChart labels slices directly with leader lines rather than a legend, auto-buckets tiny slices into an 'Other' wedge, and turns any pie into a donut with a single innerRadius. Keep the category count low: past six or seven slices, a bar chart reads faster."
  >
    <Section
      id="basics"
      title="Basics"
      lede="A pie for a handful of shares, a donut when you want a metric in the hole. Direct slice labels beat a legend."
    >
      <Demo
        id="pie-inline-labels"
        title="Pie with inline labels"
        description="The default. OpenChart draws leader-line labels straight to each slice instead of making you cross-reference a legend."
        spec={basicPieSpec}
        height={480}
      />
      <Demo
        id="donut-center-metric"
        title="Donut with center metric"
        description="One innerRadius turns the pie into a donut; the hole is prime real estate for a headline number, overlaid as a pointer-events-none div."
        specForPanel={donutSpec}
        height={480}
      >
        <CenterMetricDonut />
      </Demo>
      <Demo
        id="small-slice-grouping"
        title="Small-slice grouping"
        description="Slices under ~3% of the total are automatically folded into a single 'Other' wedge, so a long tail of tiny values never shatters the chart."
        spec={smallSliceSpec}
        height={520}
      />
    </Section>

    <Section
      id="comparison"
      title="Comparison"
      lede="When a pie has too many slices, switch marks. When you're comparing two wholes, place donuts side by side under one legend."
    >
      <Demo
        id="many-categories"
        title="Too many categories"
        description="Twelve shares are unreadable as a pie: adjacent slices blur together and labels collide. A ranked horizontal bar keeps every value legible."
        spec={manyCategoriesSpec}
        height={520}
      />
      <Demo
        id="comparison-donuts"
        title="Side-by-side comparison donuts"
        description="Two donuts sharing one color assignment and a bottom legend read as a before/after pair. A fixed domain order keeps each source the same color across both."
        specForPanel={electricity2023Spec}
        height={480}
      >
        <ComparisonDonuts />
      </Demo>
      <Demo
        id="leader-line-labels"
        title="Leader-line labels"
        description="Leader lines let long vendor names sit clear of the arcs without crowding — the editorial pattern for a busy donut."
        spec={leaderLineSpec}
        height={520}
      />
    </Section>

    <Section
      id="interaction"
      title="Interaction"
      lede="Wire slice events to a live readout. Here the donut's center number tracks the hovered slice."
    >
      <Demo
        id="interactive-donut"
        title="Interactive (hover to read a slice)"
        description="onMarkHover updates the center metric; onMarkLeave resets it to the total. The escape hatch renders a stateful React component while the spec panel still shows the base spec."
        specForPanel={interactiveSpec}
        height={520}
      >
        <InteractiveDonut />
      </Demo>
    </Section>
  </GalleryPage>
);
