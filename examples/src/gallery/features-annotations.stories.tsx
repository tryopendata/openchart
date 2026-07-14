/**
 * Features / Annotations — the editorial layer over the data layer.
 *
 * Annotations live in DATA coordinates and resolve to pixels through the same
 * scale system as the marks, so they stay pinned to their data through resize
 * (see the "Data-coordinate stability" demo). Text callouts, rich text
 * (`**bold**` spans and the lede stack), the connector styles (straight /
 * curve / drop-line, with the #103 arrow object form), range bands, reference
 * lines, resize-stability, and auto-thinning.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import { useState } from 'react';
import { Demo, GalleryPage, Section } from '../components';
import { nvidiaStock, temperatureAnomaly, usInflation, usPayrolls } from '../data';

const ACCENT = '#0e7490';

// ---------------------------------------------------------------------------
// 1. Text annotation — callout at a data coordinate
// ---------------------------------------------------------------------------

const textAnnotationSpec: ChartSpec = {
  animation: true,
  mark: 'line',
  data: [...usInflation.data],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'rate', type: 'quantitative', axis: { title: 'CPI, year-over-year (%)' } },
  },
  annotations: [
    // The peak sits at the very top of the plot, so "above the point" lands in
    // the chrome band. Hang the block off the LEFT of the peak instead: the
    // upper-left plot region (2021, above the line's climb) is open whitespace.
    {
      type: 'text',
      x: '2022-07-01',
      y: 8.5,
      text: 'Inflation peaked at **8.5%**',
      subtitle: 'July 2022 — a 40-year high',
      dot: true,
      anchor: 'left',
      offset: { dx: -28, dy: -4 },
    },
    // Right of the trough the line runs flat well ABOVE 0.5 for a year, so a
    // right-anchored label at the point's own height sits in clear space and the
    // leader stays horizontal — no line crossings.
    {
      type: 'text',
      x: '2020-04-01',
      y: 0.3,
      text: 'Pandemic trough',
      dot: { radius: 4, stroke: ACCENT },
      anchor: 'right',
      offset: { dx: 8, dy: -4 },
    },
  ],
  chrome: {
    title: 'Inflation Ran Hot, Then Cooled',
    subtitle: 'US consumer price index, year-over-year change (%)',
    source: usInflation.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 2. Connectors — straight / curve / drop-line, object form with `arrow`
// ---------------------------------------------------------------------------

const connectorsSpec: ChartSpec = {
  animation: true,
  mark: 'line',
  data: [...nvidiaStock.data],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'price', type: 'quantitative', axis: { title: 'Split-adjusted close ($)' } },
  },
  annotations: [
    // Curve connector with an explicit arrowhead (object form — the #103 feature).
    {
      type: 'text',
      x: '2024-05-01',
      y: 109.58,
      text: 'Curve + arrow',
      subtitle: 'connector: { type: "curve", arrow: true }',
      dot: true,
      anchor: 'top',
      offset: { dx: -190, dy: -60 },
      connector: { type: 'curve', arrow: true },
    },
    // Straight connector, arrow opted out (the default for straight).
    // Points at the mid-2024 plateau, with the block hung in the empty trough
    // under the 2024–2025 stretch of the line. Anywhere near the chart's
    // bottom-left corner fights the drop-line's label for the same space and
    // gets it demoted to a footnote.
    {
      type: 'text',
      x: '2024-07-01',
      y: 116.97,
      text: 'Straight, no arrow',
      subtitle: 'connector: { type: "straight", arrow: false }',
      dot: true,
      anchor: 'right',
      offset: { dx: 0, dy: 55 },
      connector: { type: 'straight', arrow: false },
    },
    // Drop-line: a vertical guide through the point's x (never takes an arrow).
    // NOT at the 2025 peak: the peak touches the plot top, the drop-line label
    // has no headroom there, and auto-thinning demotes it to a footnote. The
    // Oct 2023 dip has a tall clear column above it.
    {
      type: 'text',
      x: '2023-10-01',
      y: 40.75,
      text: 'Drop-line',
      subtitle: 'connector: "drop-line"',
      dot: true,
      anchor: 'left',
      connector: 'drop-line',
    },
  ],
  chrome: {
    title: 'Three Ways to Point at the Same Data',
    subtitle: "NVIDIA monthly close — connector styles from the annotation's connector field",
    source: nvidiaStock.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 3. Rich text — `**bold**` spans, the lede + subtitle stack
// ---------------------------------------------------------------------------

// Emphasis lives inside the sentence, not on the whole block: a regular-weight
// annotation with the one phrase that carries the finding set in bold.
const richTextSpec: ChartSpec = {
  animation: true,
  mark: 'bar',
  data: [...usPayrolls.data],
  encoding: {
    x: { field: 'month', type: 'nominal' },
    y: { field: 'jobs', type: 'quantitative', axis: { title: 'Jobs added (thousands)' } },
  },
  annotations: [
    // Lift the block clear of the Sep/Nov bar tops and their value labels: at
    // dy -150 it sat right on "254"/"227". Above ~300K the right half of the
    // plot is open, and the leader drops through the empty October column.
    {
      type: 'text',
      x: 'Oct',
      y: 12,
      text: 'Hurricanes and a strike cut\nOctober to **12,000 jobs**',
      dot: true,
      anchor: 'top',
      offset: { dx: -100, dy: -190 },
      connector: { type: 'curve', arrow: true },
    },
    {
      type: 'text',
      x: 'Jan',
      y: 353,
      text: 'The year opened at **353,000**',
      dot: true,
      anchor: 'right',
      offset: { dx: 8, dy: -18 },
    },
  ],
  chrome: {
    title: 'One Bad Month in an Otherwise Steady Year',
    subtitle: 'US nonfarm payroll additions by month, 2024',
    source: usPayrolls.source,
    byline: 'Chart: OpenChart',
  },
};

// The lede stack: set `subtitle` and the primary line takes bold automatically,
// with the subtitle in muted regular below it. No fontWeight authoring.
const ledeSpec: ChartSpec = {
  animation: true,
  mark: 'line',
  data: [...temperatureAnomaly.data],
  encoding: {
    x: { field: 'year', type: 'ordinal' },
    y: { field: 'anomaly', type: 'quantitative', axis: { title: 'Anomaly (°C)' } },
  },
  annotations: [
    {
      type: 'text',
      x: '2025',
      y: 1.17,
      text: '+1.17°C',
      subtitle: 'the warmest year on record',
      dot: true,
      anchor: 'left',
      offset: { dx: -16, dy: -22 },
    },
    // Shifted left so the subtitle's right end clears the line rising through
    // the 1990s — centered on the point, "0.3°C" sat directly on the curve.
    {
      type: 'text',
      x: '1980',
      y: 0.26,
      text: 'Baseline era',
      subtitle: 'anomalies stayed under **0.3°C**',
      dot: true,
      anchor: 'top',
      offset: { dx: -60, dy: -26 },
    },
  ],
  chrome: {
    title: 'A Lede, Then the Context',
    subtitle: 'Global surface temperature anomaly — subtitle promotes the first line to bold',
    source: temperatureAnomaly.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 4. Range annotations — x-band, y-band, and rectangle
// ---------------------------------------------------------------------------

const rangeSpec: ChartSpec = {
  animation: true,
  mark: 'line',
  data: [...usInflation.data],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'rate', type: 'quantitative', axis: { title: 'CPI, year-over-year (%)' } },
  },
  annotations: [
    // x-band: a vertical region marking a time span.
    {
      type: 'range',
      x1: '2021-04-01',
      x2: '2023-01-01',
      label: 'The inflation surge',
      labelAnchor: 'top',
      // Centered, the label sits right on the CPI peak — the curve clips the
      // tail of the text. Shift left onto the rising slope, where the line is
      // still well below label height.
      labelOffset: { dx: -70, dy: -6 },
      fill: '#d1495b',
      opacity: 0.1,
    },
    // y-band: a horizontal region marking the Fed's 2% target zone.
    // labelOffset drops the label into the band's lower half — at the band top
    // it sat directly on the CPI line entering the plot at ~1.5%. Not all the
    // way to the band floor, though: there it runs into the "0" axis tick.
    {
      type: 'range',
      y1: 0,
      y2: 2,
      label: 'Target band (0–2%)',
      labelAnchor: 'left',
      labelOffset: { dx: 6, dy: 20 },
      fill: ACCENT,
      opacity: 0.1,
    },
  ],
  chrome: {
    title: 'One Band for Time, One for a Target Zone',
    subtitle: 'Range annotations shade a region between two data values on either axis',
    source: usInflation.source,
    byline: 'Chart: OpenChart',
  },
};

const rectangleRangeSpec: ChartSpec = {
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
  },
  labels: { density: 'none' },
  annotations: [
    // Rectangle: x1/x2 AND y1/y2 bound a 2D region. extendToEdges: false anchors
    // the band at the data-point centers instead of spanning full columns.
    {
      type: 'range',
      x1: '1980',
      x2: '2025',
      y1: 0,
      y2: 1.3,
      label: 'The modern warming era',
      labelAnchor: 'top',
      fill: '#d1495b',
      opacity: 0.12,
      extendToEdges: false,
    },
    { type: 'refline', y: 0, style: 'solid', strokeWidth: 1 },
  ],
  chrome: {
    title: 'A Rectangle Bounds a Region in Both Axes',
    subtitle: 'Global surface temperature anomaly by decade; the box marks post-1980 warming',
    source: temperatureAnomaly.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 4. Reference lines — horizontal / vertical, dash styles, target lines
// ---------------------------------------------------------------------------

const reflineSpec: ChartSpec = {
  animation: true,
  mark: 'bar',
  data: [...usPayrolls.data],
  encoding: {
    x: { field: 'month', type: 'nominal' },
    y: { field: 'jobs', type: 'quantitative', axis: { title: 'Jobs added (thousands)' } },
  },
  labels: { density: 'none' },
  annotations: [
    // Horizontal target line, dashed. At the right edge the label sat on the
    // Nov/Dec bars; slide it into the Jun–Aug valley, where the line runs
    // clear above every bar top.
    {
      type: 'refline',
      y: 216,
      label: 'Avg: 216K/mo',
      style: 'dashed',
      stroke: '#64748b',
      strokeWidth: 1,
      labelAnchor: 'right',
      labelOffset: { dx: -245 },
    },
    // Horizontal threshold, dotted, styled as a soft floor. Every bar except
    // October crosses the 100K line, and October's gap has the storm-marker
    // line running through it, so there is no bar-free stretch at label height.
    // Park the label in the Jun–Aug valley above the bar tops instead; the red
    // text ties it to the red dotted line below it.
    {
      type: 'refline',
      y: 100,
      label: '100K "stall speed"',
      style: 'dotted',
      stroke: '#d1495b',
      strokeWidth: 1,
      labelAnchor: 'left',
      labelOffset: { dx: 381, dy: -30 },
    },
    // Vertical marker with a raw strokeDash override (takes precedence over style).
    {
      type: 'refline',
      x: 'Oct',
      label: 'Storm-hit October',
      strokeDash: [2, 3],
      stroke: '#94a3b8',
      strokeWidth: 1,
      labelAnchor: 'top',
    },
  ],
  chrome: {
    title: 'Reference Lines Give the Bars Context',
    subtitle: 'Monthly US payroll additions, 2024, with average, threshold, and event markers',
    source: usPayrolls.source,
    byline: 'Chart: OpenChart',
  },
};

// ---------------------------------------------------------------------------
// 5. Data-coordinate stability — annotations stay pinned through resize
// ---------------------------------------------------------------------------

const stabilitySpec: ChartSpec = {
  animation: false,
  mark: 'line',
  data: [...usInflation.data],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'rate', type: 'quantitative', axis: { title: 'CPI YoY (%)' } },
  },
  annotations: [
    {
      type: 'range',
      x1: '2021-04-01',
      x2: '2023-01-01',
      label: 'Surge',
      labelAnchor: 'top',
      fill: '#d1495b',
      opacity: 0.1,
    },
    {
      type: 'text',
      x: '2022-07-01',
      y: 8.5,
      text: 'Peak: 8.5%',
      dot: true,
      anchor: 'top',
      offset: { dx: 0, dy: -22 },
      connector: { type: 'curve', arrow: true },
    },
    { type: 'refline', y: 2, label: 'Target 2%', style: 'dashed', stroke: '#64748b' },
  ],
  chrome: {
    title: 'Annotations Track the Data, Not the Pixels',
    subtitle: 'Resize the container — the peak dot, the band, and the target line all stay pinned',
    source: usInflation.source,
  },
};

function ResizableStability() {
  const [width, setWidth] = useState(560);
  const [height, setHeight] = useState(360);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gx-space-3)' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--gx-space-5)',
          padding: 'var(--gx-space-3) var(--gx-space-4)',
          border: '1px solid var(--gx-border)',
          borderRadius: 'var(--gx-radius-control)',
          background: 'var(--gx-surface-raised)',
          fontSize: 'var(--gx-type-caption)',
          color: 'var(--gx-text-muted)',
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--gx-space-2)' }}>
          Width: {width}px
          <input
            type="range"
            min={280}
            max={860}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            style={{ width: 160 }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--gx-space-2)' }}>
          Height: {height}px
          <input
            type="range"
            min={240}
            max={520}
            value={height}
            onChange={(e) => setHeight(Number(e.target.value))}
            style={{ width: 160 }}
          />
        </label>
      </div>
      <div
        style={{
          width: `min(${width}px, 100%)`,
          height,
          border: '1px solid var(--gx-border)',
          borderRadius: 'var(--gx-radius-control)',
          transition: 'width 0.12s ease, height 0.12s ease',
        }}
      >
        <Chart spec={stabilitySpec} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6. Auto-thinning — narrow-width demotion to numbered markers + footnotes
// ---------------------------------------------------------------------------

const thinningData = [
  { date: '2019-01-01', value: 10 },
  { date: '2019-06-01', value: 18 },
  { date: '2020-01-01', value: 15 },
  { date: '2020-06-01', value: 8 },
  { date: '2021-01-01', value: 22 },
  { date: '2021-06-01', value: 28 },
  { date: '2022-01-01', value: 35 },
  { date: '2022-06-01', value: 30 },
  { date: '2023-01-01', value: 42 },
  { date: '2023-06-01', value: 45 },
];

// Six annotations, priority-ranked (lower priority = kept longer as width shrinks).
// One is pinned with `responsive: false` so it never demotes.
const thinningSpec: ChartSpec = {
  animation: false,
  mark: 'line',
  data: thinningData,
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative', axis: { title: 'Index level' } },
  },
  // Deliberately bare: no offsets, no connector config. Six minimal callouts,
  // exactly what an author writes first. The defaults have to carry this.
  annotations: [
    { type: 'text', x: '2020-06-01', y: 8, text: 'Pandemic low', responsive: false, priority: 1 },
    { type: 'text', x: '2021-01-01', y: 22, text: 'Recovery begins', priority: 2 },
    { type: 'text', x: '2019-06-01', y: 18, text: 'Early peak', priority: 3 },
    { type: 'text', x: '2021-06-01', y: 28, text: 'Strong rebound', priority: 4 },
    { type: 'text', x: '2022-01-01', y: 35, text: 'New high', priority: 5 },
    { type: 'text', x: '2023-01-01', y: 42, text: 'Record territory', priority: 6 },
  ],
  chrome: {
    title: 'Six Callouts That Never Collide',
    subtitle: 'Priority orders what survives; "Pandemic low" is pinned with responsive: false',
    source: 'Illustrative data',
  },
};

const thinningDisabledSpec: ChartSpec = {
  ...thinningSpec,
  responsive: { autoThin: false },
  chrome: {
    title: 'The Same Chart with Thinning Off',
    subtitle: 'responsive: { autoThin: false } — annotations hide at compact widths instead',
    source: 'Illustrative data',
  },
};

function AutoThinning() {
  const [width, setWidth] = useState(760);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gx-space-4)' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 'var(--gx-space-4)',
          padding: 'var(--gx-space-3) var(--gx-space-4)',
          border: '1px solid var(--gx-border)',
          borderRadius: 'var(--gx-radius-control)',
          background: 'var(--gx-surface-raised)',
          fontSize: 'var(--gx-type-caption)',
          color: 'var(--gx-text-muted)',
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--gx-space-2)' }}>
          Width: {width}px
          <input
            type="range"
            min={300}
            max={860}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            style={{ width: 200 }}
          />
        </label>
        <span style={{ color: 'var(--gx-text-muted)' }}>
          Drag narrow: inline callouts demote to numbered dots with footnotes below.
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--gx-space-5)' }}>
        <div style={{ width, flexShrink: 0 }}>
          <p
            style={{
              margin: '0 0 var(--gx-space-2)',
              fontSize: 'var(--gx-type-caption)',
              color: 'var(--gx-text-muted)',
            }}
          >
            autoThin on (default)
          </p>
          <div
            style={{
              height: 340,
              border: '1px solid var(--gx-border)',
              borderRadius: 'var(--gx-radius-control)',
            }}
          >
            <Chart spec={thinningSpec} />
          </div>
        </div>
        <div style={{ width, flexShrink: 0 }}>
          <p
            style={{
              margin: '0 0 var(--gx-space-2)',
              fontSize: 'var(--gx-type-caption)',
              color: 'var(--gx-text-muted)',
            }}
          >
            autoThin off
          </p>
          <div
            style={{
              height: 340,
              border: '1px solid var(--gx-border)',
              borderRadius: 'var(--gx-radius-control)',
            }}
          >
            <Chart spec={thinningDisabledSpec} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default { title: 'Features' };

export const Annotations = () => (
  <GalleryPage
    title="Annotations"
    lede="Annotations are the editorial layer over the data layer. They're authored in data coordinates and resolved to pixels through the same scales as the marks, so a callout, band, or reference line stays pinned to its data through every resize. Text callouts take dot markers, connectors, and inline bold spans; ranges shade regions; reference lines mark baselines and targets; and when space runs out, auto-thinning demotes overlapping callouts to numbered footnotes."
  >
    <Section
      id="text"
      title="Text callouts"
      lede="A text annotation sits at a data coordinate. A dot marks the point, an anchor picks the side, and a pixel offset nudges the label clear of the data."
    >
      <Demo id="text-annotation" spec={textAnnotationSpec} height={460} />
    </Section>

    <Section
      id="rich-text"
      title="Rich text"
      lede="Annotation text is a regular-weight sentence with the key phrase wrapped in double asterisks — emphasis rides inside the copy, never as a bold block. Add a subtitle and the primary line promotes to a bold lede with muted context beneath it, no fontWeight authoring. Spans work in text and subtitle alike; an unmatched pair of asterisks renders literally."
    >
      <Demo
        id="rich-text-emphasis"
        title="Inline bold spans"
        description="The finding is the number, so the number is what's bold. The rest of the sentence stays regular weight and out of the way."
        spec={richTextSpec}
        height={460}
      />
      <Demo
        id="rich-text-lede"
        title="The lede + subtitle stack"
        description="Setting subtitle promotes the primary line to bold automatically. The subtitle takes its own bold spans and renders muted at 85% of the primary size."
        spec={ledeSpec}
        height={460}
      />
    </Section>

    <Section
      id="connectors"
      title="Connectors"
      lede="A connector links the label back to its data point. Pass a string for a preset, or the object form { type, arrow } to control the arrowhead — the recent connector-arrow feature."
    >
      <Demo id="connectors" spec={connectorsSpec} height={480} />
    </Section>

    <Section
      id="ranges"
      title="Range bands"
      lede="Ranges shade a region. x1/x2 make a vertical band, y1/y2 a horizontal band, and all four a rectangle. extendToEdges controls whether the band reaches the plot edge or stops at the data points."
    >
      <Demo
        id="range-bands"
        title="x-band and y-band"
        description="A vertical band marks a time span; a horizontal band marks a target zone. Each carries a label anchored to an edge."
        spec={rangeSpec}
        height={460}
      />
      <Demo
        id="range-rectangle"
        title="Rectangle with extendToEdges: false"
        description="Bounding both axes makes a rectangle; extendToEdges: false anchors it at the data-point centers instead of spanning full columns."
        spec={rectangleRangeSpec}
        height={460}
      />
    </Section>

    <Section
      id="reflines"
      title="Reference lines"
      lede="A refline is a horizontal or vertical rule at a data value — an average, a threshold, or an event marker. Solid, dashed, and dotted styles, or a raw strokeDash override."
    >
      <Demo id="reference-lines" spec={reflineSpec} height={460} />
    </Section>

    <Section
      id="stability"
      title="Data-coordinate stability"
      lede="Because annotations resolve through the scales, they never drift on resize. Drag the handles and watch the band, the peak dot, and the target line hold their data positions."
    >
      <Demo id="resize-stability" specForPanel={stabilitySpec} height={520}>
        <ResizableStability />
      </Demo>
    </Section>

    <Section
      id="auto-thinning"
      title="Auto-thinning"
      lede="When callouts can't fit without overlapping, the engine demotes the lowest-priority ones to numbered dot markers with footnotes below the chart. priority ranks what survives; responsive: false pins an annotation so it never thins."
    >
      <Demo id="auto-thinning" specForPanel={thinningSpec}>
        <AutoThinning />
      </Demo>
    </Section>
  </GalleryPage>
);
