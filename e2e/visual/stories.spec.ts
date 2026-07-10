import { test } from '@playwright/test';

import { captureStory } from './capture';

/**
 * Visual regression: canonical story set.
 *
 * These scenarios are the pixel-level contract for v7 refactoring.
 * If any of these screenshots drift, the refactor changed rendered output.
 *
 * Each entry targets a Ladle story by slug (path segment after `?story=`).
 * We use `?mode=preview` to hide the Ladle sidebar that would otherwise
 * compress the chart area.
 */
const stories: Array<{ name: string; slug: string; note?: string }> = [
  { name: 'bar-vertical', slug: 'column--simple-columns' },
  { name: 'bar-horizontal-gradient', slug: 'bar--simple-bars' },
  { name: 'line-multi-series', slug: 'line-multiseries--gdp-growth' },
  { name: 'stacked-column', slug: 'column-stacked--energy-mix' },
  {
    name: 'sankey-narrow-long-labels',
    slug: 'sankey--compact',
    note: '360px width with multi-word node names',
  },
  {
    name: 'pie-with-legend',
    slug: 'donut-leaders--smartphone-market',
    note: 'Closest existing story: donut with leader-line labels. OpenChart pies label slices inline rather than using an external legend by default.',
  },
  { name: 'chart-with-annotations', slug: 'column-diverging--temperature-anomaly' },
  { name: 'chart-with-watermark', slug: 'chrome--chrome-all-elements' },
  { name: 'sparklines-markets', slug: 'sparkline--markets-dashboard' },
  { name: 'sparklines-sizes', slug: 'sparkline--sizes' },
  {
    name: 'multi-series-area-overlap',
    slug: 'line--multi-series-area-overlap',
    note: 'Overlapping multi-series areas with bottom legend, endpoint column, and a dot+subtitle text annotation.',
  },
  {
    name: 'multi-series-area-stacked',
    slug: 'line--multi-series-area-stacked',
    note: 'Stacked multi-series areas with gradient fills, endpoint column with markers, no bottom legend.',
  },
  // --- Dark mode ---
  {
    name: 'dark-mode-line',
    slug: 'line--editorial-single-line',
    note: 'Line chart with darkMode: force, annotations, range highlight, and refline.',
  },
  // --- Legend positions ---
  {
    name: 'legend-top',
    slug: 'line--five-series',
    note: 'Five-series line chart with legend: { position: top }, metrics bar, and annotations.',
  },
  {
    name: 'legend-bottom-right',
    slug: 'infographic--multi-series-line',
    note: 'Multi-series line with legend: { position: bottom-right } and endpoint labels.',
  },
  {
    name: 'legend-bottom',
    slug: 'donut-comparison--electricity-mix',
    note: 'Side-by-side donuts with legend: { position: bottom }.',
  },
  // --- Long axis labels + truncation ---
  {
    name: 'long-axis-labels',
    slug: 'column--long-axis-labels',
    note: 'Column chart with very long category names that test label rotation and truncation.',
  },
  // --- Sub-400px container ---
  {
    name: 'compact-line-320px',
    slug: 'line-multiseries--gdp-growth-compact',
    note: '320x300 container testing layout compression at small sizes.',
  },
  {
    name: 'compact-bar-320px',
    slug: 'bar-horizontal--population-bar-compact',
    note: '320x400 horizontal bar chart in a compact container.',
  },
  // --- Footer + rotated x-axis ---
  {
    name: 'rotated-labels-with-source',
    slug: 'rotated-with-source--rotated-with-source',
    note: 'Column chart with long category labels that auto-rotate, plus source chrome below.',
  },
];

for (const story of stories) {
  test(`visual: ${story.name}`, async ({ page }) => {
    await captureStory(page, story.slug, `${story.name}.png`);
  });
}
