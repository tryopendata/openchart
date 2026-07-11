/**
 * Playground — a live spec explorer.
 *
 * One shared dataset (Big Tech annual revenue) mapped onto a base ChartSpec that
 * the Ladle controls addon drives: chart type, theme preset, legend position,
 * stacking mode, animation easing, stagger, and annotations. The story renders
 * the chart PLUS the live spec JSON side by side (via the Demo spec panel), so
 * the copyable JSON updates as you turn the knobs in Ladle's controls panel.
 *
 * Every control combination must render something sensible. Nonsensical pairings
 * are COERCED, not crashed: stacking is dropped on line/donut/scatter, donut
 * ignores axis-oriented legend placement but still shows a legend, scatter
 * ignores stacking, and annotations only attach where they read cleanly
 * (skipped for donut/scatter). See `buildSpec` for the full coercion table.
 */

import type { Story } from '@ladle/react';
import type { ChartSpec, ThemeConfig } from '@opendata-ai/openchart-core';
import { editorial, essay, wire } from '@opendata-ai/openchart-core';
import { Demo, GalleryPage } from '../components';
import { bigTechRevenue } from '../data';

// ---------------------------------------------------------------------------
// Control value unions — kept small so every combination renders sensibly.
// ---------------------------------------------------------------------------

type ChartTypeArg = 'line' | 'bar' | 'column' | 'area' | 'donut' | 'scatter';
type ThemeArg = 'editorial' | 'essay' | 'wire';
type LegendArg = 'none' | 'top' | 'bottom' | 'right';
type StackArg = 'none' | 'stacked' | 'normalize';
type EaseArg = 'smooth' | 'snappy';

type PlaygroundArgs = {
  chartType: ChartTypeArg;
  theme: ThemeArg;
  legend: LegendArg;
  stacking: StackArg;
  ease: EaseArg;
  stagger: boolean;
  annotations: boolean;
};

// ---------------------------------------------------------------------------
// Shared dataset. One pool source, reused across every chart type. For donut we
// aggregate to a single-series-per-category slice (2024 revenue by company);
// the rest use the full multi-series time table.
// ---------------------------------------------------------------------------

const SERIES = [...bigTechRevenue.data];

/** 2024 revenue by company — the single-series shape a donut wants. */
const DONUT_DATA = SERIES.filter((d) => d.year === '2024-01-01').map((d) => ({
  company: d.company,
  revenue: d.revenue,
}));

const THEMES: Record<ThemeArg, ThemeConfig> = { editorial, essay, wire };

/** Presets that support stacking (parts-of-a-whole marks). */
const STACKABLE: ReadonlySet<ChartTypeArg> = new Set<ChartTypeArg>(['bar', 'column', 'area']);

/** Map the stacking control onto the encoding's `stack` value. */
function stackValue(mode: StackArg): 'zero' | 'normalize' | null {
  if (mode === 'stacked') return 'zero';
  if (mode === 'normalize') return 'normalize';
  return null;
}

// ---------------------------------------------------------------------------
// Spec builder — maps args onto a base ChartSpec, coercing nonsensical combos.
// ---------------------------------------------------------------------------

function buildSpec(args: PlaygroundArgs): ChartSpec {
  const { chartType, theme, legend, stacking, ease, stagger, annotations } = args;

  const themeConfig = THEMES[theme];
  // Stacking only applies to stackable marks; drop it everywhere else.
  const stack = STACKABLE.has(chartType) ? stackValue(stacking) : null;

  // Quantitative-axis config on the value channel. When normalized, the axis
  // reads as a share (0-100%), not dollars — swap the title and format so the
  // labels match what's plotted.
  const valueAxis =
    stack === 'normalize'
      ? { title: 'Share of revenue', format: '.0%' as const, grid: true }
      : { title: 'Annual revenue ($B)', format: ',.0f' as const, grid: true };

  // The $300B refline is an absolute-dollar mark; it's off-scale on a
  // normalized (0-100%) axis, so suppress it when normalized.
  const showRefline = annotations && stack !== 'normalize';

  // Animation: honor the ease/stagger controls uniformly across chart types.
  const animation: ChartSpec['animation'] = {
    enter: { ease, stagger },
  };

  // Legend: 'none' hides it; the rest set an explicit position. Donut has no
  // axis geometry, so 'right' is meaningless there — coerce to a shown legend
  // in a donut-friendly position instead of the axis-oriented placement.
  const legendConfig: ChartSpec['legend'] =
    legend === 'none'
      ? { show: false }
      : chartType === 'donut'
        ? { show: true, position: legend === 'right' ? 'right' : legend }
        : { position: legend };

  const chrome: ChartSpec['chrome'] = {
    title: 'Big Tech Revenue, Your Way',
    subtitle: 'Annual revenue by company, 2019-2024 (billions USD)',
    source: bigTechRevenue.source,
    byline: 'Chart: OpenChart',
  };

  // Donut: single-series category -> value, arc mark, no stacking, no axis
  // annotations. Legend carries the category names.
  if (chartType === 'donut') {
    return {
      animation,
      mark: { type: 'arc', innerRadius: 70 },
      data: DONUT_DATA,
      encoding: {
        y: { field: 'revenue', type: 'quantitative' },
        color: { field: 'company', type: 'nominal' },
      },
      legend: legendConfig,
      chrome,
      theme: themeConfig,
    };
  }

  // Scatter: point mark, x = year, y = revenue, color = series. Stacking and
  // annotations don't fit a scatter cleanly here, so they're ignored.
  if (chartType === 'scatter') {
    return {
      animation,
      mark: 'point',
      data: SERIES,
      encoding: {
        x: { field: 'year', type: 'temporal', axis: { tickCount: 6 } },
        y: {
          field: 'revenue',
          type: 'quantitative',
          axis: { title: 'Annual revenue ($B)', format: ',.0f', grid: true },
        },
        color: { field: 'company', type: 'nominal' },
      },
      legend: legendConfig,
      chrome,
      theme: themeConfig,
    };
  }

  // Line / area: continuous time on x, series color, optional stacking (area).
  // ChartSpec is discriminated by mark literal, so line and area each need a
  // single-literal `mark` — sharing the encoding but returning per-type.
  if (chartType === 'line' || chartType === 'area') {
    const lineAreaEncoding = {
      x: { field: 'year', type: 'temporal' as const, axis: { tickCount: 6 } },
      y: {
        field: 'revenue',
        type: 'quantitative' as const,
        stack,
        axis: valueAxis,
      },
      color: { field: 'company', type: 'nominal' as const },
    };
    const lineAreaAnnotations: ChartSpec['annotations'] = showRefline
      ? [
          {
            type: 'refline',
            y: 300,
            label: '$300B',
            style: 'dashed',
            stroke: '#64748b',
            strokeWidth: 1,
          },
        ]
      : undefined;
    if (chartType === 'area') {
      return {
        animation,
        mark: 'area',
        data: SERIES,
        encoding: lineAreaEncoding,
        legend: legendConfig,
        endpointLabels: false,
        labels: { density: 'none' },
        annotations: lineAreaAnnotations,
        chrome,
        theme: themeConfig,
      };
    }
    return {
      animation,
      mark: 'line',
      data: SERIES,
      encoding: lineAreaEncoding,
      legend: legendConfig,
      endpointLabels: false,
      labels: { density: 'none' },
      annotations: lineAreaAnnotations,
      chrome,
      theme: themeConfig,
    };
  }

  // Bar (horizontal) / column (vertical): categorical year on the band axis,
  // revenue on the quantitative axis, series color. Stacking applies here.
  const isColumn = chartType === 'column';
  const bandEnc = { field: 'year', type: 'nominal' as const };
  const quantEnc = {
    field: 'revenue',
    type: 'quantitative' as const,
    stack,
    axis: valueAxis,
  };

  // Refline runs along the quantitative axis: y for columns, x for bars.
  const refline: ChartSpec['annotations'] = [
    {
      type: 'refline',
      ...(isColumn ? { y: 300 } : { x: 300 }),
      label: '$300B',
      style: 'dashed',
      stroke: '#64748b',
      strokeWidth: 1,
    },
  ];

  return {
    animation,
    mark: 'bar',
    data: SERIES,
    encoding: isColumn
      ? { x: bandEnc, y: quantEnc, color: { field: 'company', type: 'nominal' } }
      : { x: quantEnc, y: bandEnc, color: { field: 'company', type: 'nominal' } },
    legend: legendConfig,
    labels: { density: 'none' },
    annotations: showRefline ? refline : undefined,
    chrome,
    theme: themeConfig,
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default { title: 'Playground' };

export const Playground: Story<PlaygroundArgs> = (args) => {
  const spec = buildSpec(args);
  return (
    <GalleryPage
      title="Playground"
      lede="A live spec explorer. Turn the knobs in Ladle's controls panel — chart type, theme, legend, stacking, animation — and watch the spec rebuild in real time. Copy the JSON to drop it straight into your app. Every combination renders; nonsensical pairings are coerced, not broken."
    >
      <Demo
        id="explorer"
        title="Live spec explorer"
        description="One dataset, one base spec, driven by the controls panel. The chart and its copyable spec update together as you change any control."
        spec={spec}
        height={480}
      />
    </GalleryPage>
  );
};

Playground.args = {
  chartType: 'line',
  theme: 'editorial',
  legend: 'top',
  stacking: 'none',
  ease: 'smooth',
  stagger: true,
  annotations: true,
};

Playground.argTypes = {
  chartType: {
    name: 'Chart type',
    options: ['line', 'bar', 'column', 'area', 'donut', 'scatter'],
    control: { type: 'select' },
  },
  theme: {
    name: 'Theme preset',
    options: ['editorial', 'essay', 'wire'],
    control: { type: 'select' },
  },
  legend: {
    name: 'Legend position',
    options: ['none', 'top', 'bottom', 'right'],
    control: { type: 'select' },
  },
  stacking: {
    name: 'Stacking mode',
    options: ['none', 'stacked', 'normalize'],
    control: { type: 'select' },
  },
  ease: {
    name: 'Animation ease',
    options: ['smooth', 'snappy'],
    control: { type: 'radio' },
  },
  stagger: {
    name: 'Stagger',
    control: { type: 'boolean' },
  },
  annotations: {
    name: 'Annotations',
    control: { type: 'boolean' },
  },
};
