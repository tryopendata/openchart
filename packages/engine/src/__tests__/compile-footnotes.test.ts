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
