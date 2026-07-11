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
  { name: 'bar-vertical', slug: 'testing--fixtures--simple-columns' },
  { name: 'bar-horizontal-gradient', slug: 'testing--fixtures--simple-bars' },
  { name: 'line-multi-series', slug: 'testing--fixtures--gdp-growth' },
  { name: 'stacked-column', slug: 'testing--fixtures--energy-mix' },
  {
    name: 'sankey-narrow-long-labels',
    slug: 'testing--fixtures--compact',
    note: '360px width with multi-word node names',
  },
  {
    name: 'pie-with-legend',
    slug: 'testing--fixtures--smartphone-market',
    note: 'Closest existing story: donut with leader-line labels. OpenChart pies label slices inline rather than using an external legend by default.',
  },
  { name: 'chart-with-annotations', slug: 'testing--fixtures--temperature-anomaly' },
  { name: 'chart-with-watermark', slug: 'testing--fixtures--chrome-all-elements' },
  { name: 'sparklines-markets', slug: 'testing--fixtures--markets-dashboard' },
  { name: 'sparklines-sizes', slug: 'testing--fixtures--sizes' },
  {
    name: 'multi-series-area-overlap',
    slug: 'testing--fixtures--multi-series-area-overlap',
    note: 'Overlapping multi-series areas with bottom legend, endpoint column, and a dot+subtitle text annotation.',
  },
  {
    name: 'multi-series-area-stacked',
    slug: 'testing--fixtures--multi-series-area-stacked',
    note: 'Stacked multi-series areas with gradient fills, endpoint column with markers, no bottom legend.',
  },
  // --- Dark mode ---
  {
    name: 'dark-mode-line',
    slug: 'testing--fixtures--editorial-single-line',
    note: 'Line chart with darkMode: force, annotations, range highlight, and refline.',
  },
  // --- Legend positions ---
  {
    name: 'legend-top',
    slug: 'testing--fixtures--five-series',
    note: 'Five-series line chart with legend: { position: top }, metrics bar, and annotations.',
  },
  {
    name: 'legend-bottom-right',
    slug: 'testing--fixtures--multi-series-line',
    note: 'Multi-series line with legend: { position: bottom-right } and endpoint labels.',
  },
  {
    name: 'legend-bottom',
    slug: 'testing--fixtures--electricity-mix',
    note: 'Side-by-side donuts with legend: { position: bottom }.',
  },
  // --- Long axis labels + truncation ---
  {
    name: 'long-axis-labels',
    slug: 'testing--fixtures--long-axis-labels',
    note: 'Column chart with very long category names that test label rotation and truncation.',
  },
  // --- Sub-400px container ---
  {
    name: 'compact-line-320px',
    slug: 'testing--fixtures--gdp-growth-compact',
    note: '320x300 container testing layout compression at small sizes.',
  },
  {
    name: 'compact-bar-320px',
    slug: 'testing--fixtures--population-bar-compact',
    note: '320x400 horizontal bar chart in a compact container.',
  },
  // --- Footer + rotated x-axis ---
  {
    name: 'rotated-labels-with-source',
    slug: 'testing--fixtures--rotated-with-source',
    note: 'Column chart with long category labels that auto-rotate, plus source chrome below.',
  },
  // --- Accessibility (plan 06) ---
  {
    name: 'a11y-pattern-fills-stacked',
    slug: 'testing--a11y--pattern-fills-stacked',
    note: '4-series stacked column with fillPattern: auto (diagonal, dot, crosshatch, vertical).',
  },
  {
    name: 'a11y-pattern-fills-stacked-dark',
    slug: 'testing--a11y--pattern-fills-stacked-dark',
    note: 'Same stacked column with darkMode: force; pattern line colors adapt per mode.',
  },
  {
    name: 'a11y-pattern-fills-compact',
    slug: 'testing--a11y--pattern-fills-compact',
    note: '360px mobile container; thin segments fall back to solid via the minimum-area rule.',
  },
  {
    name: 'a11y-pattern-fills-donut',
    slug: 'testing--a11y--pattern-fills-donut',
    note: 'Donut with patterned slices; the sub-1% sliver keeps a solid fill.',
  },
  {
    name: 'a11y-colorblind-palette-audit',
    slug: 'testing--a11y--colorblind-palette-audit',
    note: 'Default categorical palette simulated for protanopia, deuteranopia, tritanopia, achromatopsia.',
  },
];

for (const story of stories) {
  test(`visual: ${story.name}`, async ({ page }) => {
    await captureStory(page, story.slug, `${story.name}.png`);
  });
}
