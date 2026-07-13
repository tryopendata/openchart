/**
 * Shared spec data for the scrollytelling narrative and its visual fixtures.
 *
 * This is deliberately NOT a `.stories.ts` file: Ladle's story glob is
 * `src/**\/*.stories.{tsx,ts}` and it treats every named export from a matched
 * file as a story, so exporting these specs from either story file would
 * surface a bogus entry in the sidebar. Keeping them in a plain module lets
 * `charts/scrollytelling.stories.tsx` (the live narrative) and
 * `testing/fixtures-scrollytelling.stories.tsx` (the pinned per-step fixtures)
 * share one source of truth without either drifting.
 *
 * The story: obesity and diabetes climbed together for a decade, then came
 * apart. Obesity flattened after 2021; diagnosed diabetes kept going to a
 * record. Source: CDC BRFSS median state prevalence, 2011-2024, as published in
 * "Obesity Stalled. Diabetes Hit a Record. The Drugs Only Bent One Curve."
 *
 * Each step exists because the argument needs it, not because the API has
 * another feature to show off. The stall in particular is INVISIBLE at full
 * scale -- four points inside a 40-point axis -- which is what earns the zoom.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import type { ChartStoryProps } from '@opendata-ai/openchart-react';

export type ScrollyRow = {
  year: string;
  pct: number;
  series: string;
};

/** Median state prevalence (%), self-reported, CDC BRFSS 2011-2024. */
export const SCROLLY_DATA: ScrollyRow[] = [
  { year: '2011', pct: 27.7, series: 'Obesity' },
  { year: '2012', pct: 28.1, series: 'Obesity' },
  { year: '2013', pct: 28.9, series: 'Obesity' },
  { year: '2014', pct: 29.5, series: 'Obesity' },
  { year: '2015', pct: 29.8, series: 'Obesity' },
  { year: '2016', pct: 30.1, series: 'Obesity' },
  { year: '2017', pct: 31.6, series: 'Obesity' },
  { year: '2018', pct: 30.9, series: 'Obesity' },
  { year: '2019', pct: 32.4, series: 'Obesity' },
  { year: '2020', pct: 31.9, series: 'Obesity' },
  { year: '2021', pct: 33.9, series: 'Obesity' },
  { year: '2022', pct: 33.6, series: 'Obesity' },
  { year: '2023', pct: 34.4, series: 'Obesity' },
  { year: '2024', pct: 34.3, series: 'Obesity' },
  { year: '2011', pct: 9.5, series: 'Diabetes' },
  { year: '2012', pct: 9.7, series: 'Diabetes' },
  { year: '2013', pct: 9.8, series: 'Diabetes' },
  { year: '2014', pct: 10.1, series: 'Diabetes' },
  { year: '2015', pct: 10.0, series: 'Diabetes' },
  { year: '2016', pct: 10.5, series: 'Diabetes' },
  { year: '2017', pct: 10.5, series: 'Diabetes' },
  { year: '2018', pct: 11.0, series: 'Diabetes' },
  { year: '2019', pct: 10.8, series: 'Diabetes' },
  { year: '2020', pct: 10.8, series: 'Diabetes' },
  { year: '2021', pct: 11.1, series: 'Diabetes' },
  { year: '2022', pct: 11.6, series: 'Diabetes' },
  { year: '2023', pct: 11.8, series: 'Diabetes' },
  { year: '2024', pct: 12.3, series: 'Diabetes' },
];

/** The window the stall is actually visible in. Step 2 clips the x-domain to it. */
const RECENT_YEARS = ['2019', '2020', '2021', '2022', '2023', '2024'];

/**
 * Base spec for the live narrative. Animation ON: each scroll step morphs the
 * chart into the next state, which is the entire point of the demo.
 *
 * The visual fixtures below re-derive from this with `animation: false` — they
 * need a deterministic single frame to screenshot, and that pin must NOT leak
 * back into the narrative (it did once: the demo sat frozen on every step).
 */
export const baseSpec: ChartSpec<ScrollyRow> = {
  animation: true,
  mark: 'line',
  data: SCROLLY_DATA,
  encoding: {
    x: { field: 'year', type: 'ordinal' },
    y: {
      field: 'pct',
      type: 'quantitative',
      axis: { title: 'Median state prevalence', grid: true, format: '.0f' },
    },
    color: { field: 'series', type: 'nominal' },
  },
  // Endpoint values want the tenth even where the axis ticks are whole numbers:
  // the record is 12.3, and "12" is not the claim. Endpoint labels read
  // `endpointLabels.format` and otherwise inherit `axis.format`, so the override
  // belongs here rather than on the y channel.
  endpointLabels: { format: '.1f' },
  chrome: {
    title: 'Two curves that stopped moving together',
    subtitle: 'Share of adults, median US state, 2011-2024',
    source: 'CDC BRFSS. Self-reported; median across states, not a national rate.',
  },
};

/**
 * The five steps. Cumulative deep-partial patches onto the base spec.
 *
 * Note what is NOT here: a `camera` step. Zooming with the story camera scales
 * the marks group only, so the lines would magnify while the axis kept reading
 * 2011-2024 (see the warning in vanilla/src/story/story-camera.ts). Step 2
 * narrows the x-domain instead, so the engine recompiles the axis honestly and
 * the marks still morph into it.
 */
export const steps: ChartStoryProps<ScrollyRow>['steps'] = [
  // 0: both lines, the full run. They climb together.
  {},
  // 1: isolate the obesity climb.
  { highlight: ['Obesity'] },
  // 2: zoom to where the stall is legible -- BOTH axes.
  //
  //    x alone is not enough. Leaving y spanning both series (obesity ~34,
  //    diabetes ~11) squeezes the entire claim into the top fifth of the plot,
  //    and the run reads flat only because the scale is crushing it, which
  //    proves nothing. Clipping y to the obesity band puts the 33.9 -> 34.3
  //    wobble at full height, where a reader can actually see it stop climbing.
  //    Diabetes falls outside that window and drops out; it comes back for the
  //    payoff in step 4, which is when it matters.
  {
    spec: {
      encoding: {
        x: { scale: { domain: RECENT_YEARS, clip: true } },
        // Tenths matter now: the whole claim is 33.9 -> 33.6 -> 34.4 -> 34.3.
        y: { scale: { domain: [30, 36], clip: true, nice: false }, axis: { format: '.1f' } },
      },
      chrome: { title: 'The climb stalled' },
    },
  },
  // 3: name the moment.
  {
    spec: {
      annotations: [
        {
          id: 'divergence',
          type: 'text',
          x: '2021',
          y: 33.9,
          text: 'Obesity flattens here',
          anchor: 'top',
          offset: { dy: -26 },
          connector: true,
        },
      ],
    },
  },
  // 4: the payoff. Pull back out to both curves and flip the emphasis. The
  //    argument at this beat is a COMPARISON -- one line went flat, the other
  //    did not -- so both have to be on screen for it to land, even though that
  //    means diabetes climbs at a gentler visual slope than it did in isolation.
  //    The annotation carries the number the slope alone cannot.
  //
  //    Note the annotation from step 3 survives this step. It is keyed by id, so
  //    it holds steady while the scales move instead of blinking out and back.
  {
    spec: {
      encoding: {
        y: { scale: { domain: [0, 40], clip: false, nice: false }, axis: { format: '.0f' } },
      },
      annotations: [
        {
          id: 'divergence',
          type: 'text',
          x: '2021',
          y: 33.9,
          text: 'Obesity flattens here',
          anchor: 'top',
          offset: { dy: -26 },
          connector: true,
        },
        {
          id: 'record',
          type: 'text',
          x: '2022',
          y: 11.6,
          text: 'Still climbing, to a record 12.3%',
          anchor: 'top',
          offset: { dy: -26 },
          connector: true,
        },
      ],
      chrome: { title: 'Diabetes never bent' },
    },
    highlight: ['Diabetes'],
  },
];

// ---------------------------------------------------------------------------
// Per-step specs, each resolved to the state its narrative step lands on. The
// visual suite renders these directly so it can screenshot a stage without
// driving a scroll — hence `animation: false` on every one: a screenshot of a
// mid-flight animation is a flaky baseline.
// ---------------------------------------------------------------------------

/** The narrative's base spec, pinned to a single deterministic frame. */
const fixtureBase: ChartSpec<ScrollyRow> = { ...baseSpec, animation: false };

const highlightSpec: ChartSpec<ScrollyRow> = {
  ...fixtureBase,
  encoding: {
    ...fixtureBase.encoding,
    color: { field: 'series', type: 'nominal', highlight: ['Obesity'] },
  },
};

const zoomedSpec: ChartSpec<ScrollyRow> = {
  ...highlightSpec,
  encoding: {
    ...highlightSpec.encoding,
    x: { field: 'year', type: 'ordinal', scale: { domain: RECENT_YEARS, clip: true } },
    y: {
      field: 'pct',
      type: 'quantitative',
      axis: { title: 'Median state prevalence', grid: true, format: '.1f' },
      scale: { domain: [30, 36], clip: true, nice: false },
    },
  },
  chrome: { ...fixtureBase.chrome, title: 'The climb stalled' },
};

/**
 * The annotations a step declares, read back off `steps` rather than retyped.
 *
 * These used to be a second copy. The file header claimed the fixtures and the live
 * demo "can never drift out of sync", and then they did: fixing a callout in `steps`
 * changed the narrative and left the screenshots -- the things the visual suite
 * actually guards -- rendering the old spec.
 */
const stepAnnotations = (i: number): ChartSpec<ScrollyRow>['annotations'] =>
  steps[i].spec?.annotations as ChartSpec<ScrollyRow>['annotations'];

const annotatedSpec: ChartSpec<ScrollyRow> = {
  ...zoomedSpec,
  annotations: stepAnnotations(3),
};

const payoffSpec: ChartSpec<ScrollyRow> = {
  ...annotatedSpec,
  encoding: {
    ...annotatedSpec.encoding,
    color: { field: 'series', type: 'nominal', highlight: ['Diabetes'] },
    y: {
      field: 'pct',
      type: 'quantitative',
      axis: { title: 'Median state prevalence', grid: true, format: '.0f' },
      scale: { domain: [0, 40], clip: false, nice: false },
    },
  },
  annotations: stepAnnotations(4),
  chrome: { ...fixtureBase.chrome, title: 'Diabetes never bent' },
};

export const scrollySpecs = {
  base: fixtureBase,
  highlight: highlightSpec,
  zoomed: zoomedSpec,
  annotated: annotatedSpec,
  payoff: payoffSpec,
};
