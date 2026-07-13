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
  // --- Beeswarm ---
  {
    name: 'beeswarm-basic',
    slug: 'testing--fixtures--beeswarm-basic',
    note: 'Single-lane horizontal swarm, ~300 dodged dots, value axis only.',
  },
  {
    name: 'beeswarm-grouped',
    slug: 'testing--fixtures--beeswarm-grouped',
    note: 'Four region lanes via nominal y channel with band-scale lane labels.',
  },
  {
    name: 'beeswarm-sized',
    slug: 'testing--fixtures--beeswarm-sized',
    note: 'Size encoding drives per-dot radii; dodge keeps sized dots collision-free.',
  },
  // --- Continuous color legend ---
  {
    name: 'color-legend-gradient',
    slug: 'testing--fixtures--color-legend-gradient',
    note: 'Sequential color scale with the default-on gradient-bar legend (min/max labels).',
  },
  {
    name: 'color-legend-binned',
    slug: 'testing--fixtures--color-legend-binned',
    note: 'Threshold scale with 4 breaks: 5 swatches, boundary labels at the class breaks.',
  },
  {
    name: 'color-legend-dark-diverging',
    slug: 'testing--fixtures--color-legend-dark-diverging',
    note: 'Dark mode diverging ramp with min/neutral/max labels; neutral at the scale center.',
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
  // --- Range marks (dumbbell / arrow / bar) ---
  {
    name: 'range-dumbbell',
    slug: 'testing--fixtures--range-dumbbell',
    note: 'Horizontal x/x2 dumbbell sorted by end value, muted start dot, both-end labels.',
  },
  {
    name: 'range-arrow',
    slug: 'testing--fixtures--range-arrow',
    note: 'Arrow style with colorByDirection: increases green, decreases red, arrowhead at x2.',
  },
  {
    name: 'range-bar',
    slug: 'testing--fixtures--range-bar',
    note: 'Vertical y/y2 floating range bars (monthly temperature low to high).',
  },
  // --- Waffle marks ---
  {
    name: 'waffle-basic',
    slug: 'testing--fixtures--waffle-basic',
    note: '10x10 unit grid, three categories, rows fill bottom-left to top-right.',
  },
  {
    name: 'waffle-highlight',
    slug: 'testing--fixtures--waffle-highlight',
    note: 'color.highlight singles out one category; fractional shares exercise largest-remainder rounding.',
  },
  // --- Series search (find your country) ---
  {
    name: 'series-search',
    slug: 'testing--fixtures--series-search',
    note: '40-series line chart with the seriesSearch band, muted context lines, and a highlighted baseline.',
  },
  {
    name: 'series-search-mobile',
    slug: 'testing--fixtures--series-search-mobile',
    note: 'Same seriesSearch chart in a 360px container.',
  },
  // --- You draw it (draw-then-reveal) ---
  {
    name: 'you-draw-it',
    slug: 'testing--fixtures--you-draw-it',
    note: 'Single-series income line drawn up to `from`, then a hatched draw-here region with prompt + skip-to-reveal button. Static pre-interaction state.',
  },
  {
    name: 'you-draw-it-dark',
    slug: 'testing--fixtures--you-draw-it-dark',
    note: 'Same you-draw-it chart with darkMode: force; hatch, guess pen, and controls adapt to dark tokens.',
  },
  {
    name: 'you-draw-it-mobile',
    slug: 'testing--fixtures--you-draw-it-mobile',
    note: '360px container: prompt + reveal button stay within the drawing region at the compact breakpoint.',
  },
  // --- Slope + bump recipes (ranking and change) ---
  {
    name: 'slope-market-share',
    slug: 'testing--fixtures--slope-market-share',
    note: '5-series 2-point slope: both-end name+value labels, no y axis, no gridlines.',
  },
  {
    name: 'slope-market-share-compact',
    slug: 'testing--fixtures--slope-market-share-compact',
    note: '320px container: explicit endpointLabels config keeps both-end labels at the compact breakpoint.',
  },
  {
    name: 'bump-constructors',
    slug: 'testing--fixtures--bump-constructors',
    note: '6-season bump: rank 1 at top via scale.reverse, ordinal rank ticks, monotone lines, step points, both-end name labels.',
  },
  // --- Calendar heatmap ---
  {
    name: 'calendar-diverging-year',
    slug: 'testing--fixtures--calendar-diverging-year',
    note: 'One-year temperature anomaly, diverging redBlue ramp, missing-day gaps, gradient legend.',
  },
  {
    name: 'calendar-sequential-two-years',
    slug: 'testing--fixtures--calendar-sequential-two-years',
    note: 'Two stacked year bands (2023/2024) sharing one sequential scale and legend.',
  },
  {
    name: 'calendar-compact',
    slug: 'testing--fixtures--calendar-compact',
    note: '360px scroll host with a 520px min-width inner container; 7px cell floor engaged.',
  },
  // --- Scrollytelling per-step fixtures (plan 11) ---
  {
    name: 'scrolly-step-base',
    slug: 'testing--fixtures--scrolly-base',
    note: 'Story step 0: obesity + diabetes, full 2011-2024 run, no highlight, animation off.',
  },
  {
    name: 'scrolly-step-highlight',
    slug: 'testing--fixtures--scrolly-highlight',
    note: 'Story step 1: color.highlight singles out obesity, diabetes muted to gray.',
  },
  {
    name: 'scrolly-step-zoomed',
    slug: 'testing--fixtures--scrolly-zoomed',
    note: 'Story step 2: x-domain clipped to 2019-2024. The axis must relabel to the window.',
  },
  {
    name: 'scrolly-step-annotated',
    slug: 'testing--fixtures--scrolly-annotated',
    note: 'Story step 3: text annotation names the 2021 divergence, zoom + highlight retained.',
  },
  {
    name: 'scrolly-step-payoff',
    slug: 'testing--fixtures--scrolly-payoff',
    note: 'Story step 4: highlight flips to diabetes, the curve that never bent. Retitled.',
  },
  // --- Parliament (hemicycle) + election set (plan 22) ---
  {
    name: 'parliament-us-house',
    slug: 'testing--fixtures--parliament-us-house',
    note: '435-seat two-party hemicycle with the 218-seat majority line and label.',
  },
  {
    name: 'parliament-eu-multi-party',
    slug: 'testing--fixtures--parliament-eu-multi-party',
    note: '8-party coalition hemicycle, spectrum-ordered blocks, per-party legend.',
  },
  {
    name: 'parliament-compact',
    slug: 'testing--fixtures--parliament-compact',
    note: 'US House hemicycle in a 360px mobile container; auto seat radius shrinks.',
  },
  {
    name: 'election-donut',
    slug: 'testing--fixtures--election-donut',
    note: 'Datawrapper-style half-donut via arc startAngle/endAngle (-90 to +90 deg).',
  },
  {
    name: 'election-results-bar',
    slug: 'testing--fixtures--results-bar',
    note: 'Two-party horizontal stacked bar with a dashed 218-seat majority refline.',
  },
  // --- Text mark (direct labeling) ---
  {
    name: 'text-mark-labels',
    slug: 'testing--fixtures--text-mark-labels',
    note: 'Text layer over a point layer: labels must sit on their dots (they used to drift up to 160px), centered on the anchor, offset by dy. The label layer holds a subset, which used to re-fit the domain and slide every label sideways.',
  },
  // --- Rect mark (heatmap) ---
  {
    name: 'rect-heatmap',
    slug: 'testing--fixtures--rect-heatmap',
    note: 'Two-way heatmap: band scales on BOTH axes (rect used to alias the column renderer, which needs a linear y, so it emitted zero marks and rendered blank). Cells tile with a hairline gutter and draw no gridlines.',
  },
];

for (const story of stories) {
  test(`visual: ${story.name}`, async ({ page }) => {
    await captureStory(page, story.slug, `${story.name}.png`);
  });
}
