/**
 * Auto-thinning footnote reserve.
 *
 * The footnote list renders below the plot, but thinning only discovers how many
 * lines there are after the layout has already been computed against a plot that
 * reserved no room for them. compileChart resolves that circularity by recompiling
 * with the band reserved. These tests pin the two things that used to break:
 * the list overrunning the footer row, and the reserve failing to converge.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../compile';

/**
 * Six callouts in a narrow plot. At this width the labels are far wider than the
 * plot, so most of them must demote — but they sit at different y positions and
 * never pairwise-collide, which is precisely the case collision-only thinning
 * missed.
 */
const crowdedSpec: ChartSpec = {
  mark: 'line',
  data: [
    { date: '2019-01-01', value: 10 },
    { date: '2019-06-01', value: 18 },
    { date: '2020-01-01', value: 15 },
    { date: '2020-06-01', value: 8 },
    { date: '2021-01-01', value: 22 },
    { date: '2021-06-01', value: 28 },
    { date: '2022-01-01', value: 35 },
    { date: '2023-01-01', value: 42 },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
  },
  annotations: [
    { type: 'text', x: '2021-01-01', y: 22, text: 'Recovery begins' },
    { type: 'text', x: '2019-06-01', y: 18, text: 'Early peak' },
    { type: 'text', x: '2021-06-01', y: 28, text: 'Strong rebound' },
    { type: 'text', x: '2022-01-01', y: 35, text: 'New high' },
    { type: 'text', x: '2023-01-01', y: 42, text: 'Record territory' },
  ],
  chrome: { title: 'Crowded', source: 'Illustrative' },
};

describe('auto-thinning footnote reserve', () => {
  it('demotes labels that overflow a narrow plot, even though none collide', () => {
    const layout = compileChart(crowdedSpec, { width: 200, height: 340 });

    // Collision-only thinning left these inline, overflowing the plot. They
    // should now be footnotes instead.
    expect(layout.chrome.footnotes?.length ?? 0).toBeGreaterThan(0);
  });

  it('reserves bottom space so the footnote list clears the footer row', () => {
    const withFootnotes = compileChart(crowdedSpec, { width: 200, height: 340 });
    const footnotes = withFootnotes.chrome.footnotes ?? [];
    expect(footnotes.length).toBeGreaterThan(0);

    // Same chart, same box, no annotations to demote — so no band to reserve.
    // Comparing against it isolates the reserve from the bottom chrome margin
    // that both layouts already pay for. Asserting only "there is space below
    // the plot" would pass with the reserve ripped out; this does not.
    const { annotations: _dropped, ...noAnnotations } = crowdedSpec;
    const baseline = compileChart(noAnnotations, { width: 200, height: 340 });

    const plotBottom = (l: typeof withFootnotes) => l.area.y + l.area.height;
    const pulledUpBy = plotBottom(baseline) - plotBottom(withFootnotes);

    // The band the renderer will draw, measured the way core measures it.
    const band = footnotes.length * withFootnotes.theme.fonts.sizes.small * 1.3 + 4;

    // Epsilon, not a loosened bound: the engine and this line reach the same
    // band through different float op orders, so an exact >= trips on ~1e-14 of
    // accumulated error. A reserve that actually went missing would be short by
    // a whole line (~14px), which this still catches.
    expect(pulledUpBy).toBeGreaterThanOrEqual(band - 1e-9);
  });

  it('leaves the plot alone when nothing demotes', () => {
    const roomy = compileChart(crowdedSpec, { width: 900, height: 500 });
    // Wide enough that the labels fit; no footnotes, so no reserve.
    expect(roomy.chrome.footnotes).toBeUndefined();
  });

  it('converges instead of recursing forever', () => {
    // Reserving space shrinks the plot, which can demote one more label and grow
    // the band again. This must settle, not spin.
    const layout = compileChart(crowdedSpec, { width: 160, height: 260 });
    expect(layout.chrome.footnotes?.length ?? 0).toBeLessThanOrEqual(
      crowdedSpec.annotations?.length ?? 0,
    );
    expect(layout.area.height).toBeGreaterThan(0);
  });
});

/**
 * Faceted charts take a separate compile path that used to skip thinning
 * entirely: every panel kept every label inline, and labels routinely sprawled
 * out of their panel and across the neighbouring one. A panel is its own little
 * chart, so it thins against its own rect, not the figure's.
 */
describe('auto-thinning in faceted charts', () => {
  // Deliberately long labels: at 640px each panel is only ~280px wide, so a label
  // wider than that cannot fit inline no matter where it's placed. Short labels
  // would leave the containment assertion below vacuous.
  const facetedSpec: ChartSpec = {
    ...crowdedSpec,
    data: ['North', 'South'].flatMap((region) =>
      (crowdedSpec.data as Array<Record<string, unknown>>).map((row) => ({ ...row, region })),
    ),
    encoding: {
      ...crowdedSpec.encoding,
      facet: { field: 'region', type: 'nominal', columns: 2 },
    },
    annotations: [
      { type: 'text', x: '2021-01-01', y: 22, text: 'Recovery begins in earnest here' },
      { type: 'text', x: '2019-06-01', y: 18, text: 'An unusually early peak arrives' },
      { type: 'text', x: '2021-06-01', y: 28, text: 'A strong rebound takes hold' },
      { type: 'text', x: '2022-01-01', y: 35, text: 'The series posts a new high' },
      { type: 'text', x: '2023-01-01', y: 42, text: 'Firmly in record territory now' },
    ],
  } as ChartSpec;

  it('demotes labels that escape their panel', () => {
    const layout = compileChart(facetedSpec, { width: 640, height: 400 });
    expect(layout.facet).toBeDefined();
    expect(layout.chrome.footnotes?.length ?? 0).toBeGreaterThan(0);

    const demoted = layout.facet!.panels.flatMap((p) =>
      p.annotations.filter((a) => a.footnoteIndex != null),
    );
    expect(demoted.length).toBeGreaterThan(0);
  });

  it('keeps every inline label inside its own panel', () => {
    const layout = compileChart(facetedSpec, { width: 640, height: 400 });

    for (const panel of layout.facet!.panels) {
      for (const a of panel.annotations) {
        if (a.footnoteIndex != null || !a.bounds) continue;
        expect(a.bounds.x).toBeGreaterThanOrEqual(panel.area.x);
        expect(a.bounds.x + a.bounds.width).toBeLessThanOrEqual(
          panel.area.x + panel.area.width + 1e-9,
        );
      }
    }
  });

  it('numbers a demoted annotation once, not once per panel', () => {
    const layout = compileChart(facetedSpec, { width: 640, height: 400 });
    const footnotes = layout.chrome.footnotes ?? [];

    // The spec's annotations resolve into every panel, so a naive per-panel pool
    // would repeat each footnote once per panel.
    const texts = footnotes.map((f) => f.text);
    expect(new Set(texts).size).toBe(texts.length);
    expect(footnotes.length).toBeLessThanOrEqual(facetedSpec.annotations?.length ?? 0);

    // The same spec annotation gets the same number in every panel it demoted in.
    const [first, second] = layout.facet!.panels;
    for (let i = 0; i < first.annotations.length; i++) {
      const a = first.annotations[i];
      const b = second.annotations[i];
      if (a.footnoteIndex != null && b.footnoteIndex != null) {
        expect(b.footnoteIndex).toBe(a.footnoteIndex);
      }
    }
  });

  it('reserves a band for the footnote list below the grid', () => {
    const withFootnotes = compileChart(facetedSpec, { width: 640, height: 400 });
    const footnotes = withFootnotes.chrome.footnotes ?? [];
    expect(footnotes.length).toBeGreaterThan(0);

    const { annotations: _dropped, ...noAnnotations } = facetedSpec;
    const baseline = compileChart(noAnnotations as ChartSpec, { width: 640, height: 400 });

    const plotBottom = (l: typeof withFootnotes) => l.area.y + l.area.height;
    const pulledUpBy = plotBottom(baseline) - plotBottom(withFootnotes);
    const band = footnotes.length * withFootnotes.theme.fonts.sizes.small * 1.3 + 4;

    expect(pulledUpBy).toBeGreaterThanOrEqual(band - 1e-9);
  });

  // Regression: footnote numbers were keyed on the annotation's position in the
  // *resolved* array. With `resolve.scale.x: 'independent'` each panel derives its
  // own domain, so an annotation on a category that only exists in one panel
  // resolves there and is dropped from the other. Position i then means a
  // different spec annotation in each panel, and the markers pointed at other
  // panels' text: South's callout carried marker 1, and footnote 1 read "AAA…".
  // Keying on the stamped `specIndex` is what fixes it.
  const long = (s: string) => s.repeat(12);

  // Each panel gets its own x domain, so the North categories don't exist in South
  // and vice versa: every annotation resolves in exactly ONE panel and is dropped
  // from the other. That's what makes resolved-array position stop meaning spec
  // position, which is the whole point of these two tests.
  const independentDomainSpec: ChartSpec = {
    mark: 'bar',
    autoThin: true,
    resolve: { scale: { x: 'independent' } },
    data: [
      { region: 'North', cat: 'A', v: 10 },
      { region: 'North', cat: 'B', v: 20 },
      { region: 'North', cat: 'C', v: 15 },
      { region: 'South', cat: 'X', v: 12 },
      { region: 'South', cat: 'Y', v: 22 },
      { region: 'South', cat: 'Z', v: 17 },
    ],
    encoding: {
      x: { field: 'cat', type: 'nominal' },
      y: { field: 'v', type: 'quantitative' },
      facet: { field: 'region', type: 'nominal', columns: 2 },
    },
    // Interleaved on purpose: North, South, North, South. If numbering keys on
    // resolved position, South's first annotation takes North's first number.
    annotations: [
      { type: 'text', x: 'A', y: 10, text: long('AAA ') },
      { type: 'text', x: 'X', y: 12, text: long('XXX ') },
      { type: 'text', x: 'B', y: 20, text: long('BBB ') },
      { type: 'text', x: 'Y', y: 22, text: long('YYY ') },
    ],
  } as ChartSpec;

  it('points every marker at its own text when panels resolve different annotations', () => {
    const layout = compileChart(independentDomainSpec, { width: 420, height: 300 });

    const footnotes = layout.chrome.footnotes ?? [];
    expect(footnotes.length).toBeGreaterThan(0);
    const textByNumber = new Map(footnotes.map((f) => [f.index, f.text]));

    let checked = 0;
    for (const panel of layout.facet!.panels) {
      for (const a of panel.annotations) {
        if (a.footnoteIndex == null) continue;
        // The whole contract: follow the marker, land on your own words.
        expect(textByNumber.get(a.footnoteIndex)).toBe(a.label?.text);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('lists every demoted annotation exactly once, in every panel', () => {
    const layout = compileChart(independentDomainSpec, { width: 420, height: 300 });

    const texts = (layout.chrome.footnotes ?? []).map((f) => f.text);
    expect(texts.length).toBeGreaterThan(0);
    // No duplicates: a panel that demotes the same spec annotation reuses its
    // number rather than appending a second copy of the text.
    expect(new Set(texts).size).toBe(texts.length);
    // And both panels' annotations are represented -- the pre-fix bug listed only
    // the first panel's, and pointed the second panel's markers at them.
    expect(texts.some((t) => t.startsWith('AAA'))).toBe(true);
    expect(texts.some((t) => t.startsWith('XXX'))).toBe(true);
  });
});
