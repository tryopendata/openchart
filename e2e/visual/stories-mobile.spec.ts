import { test } from '@playwright/test';

import { captureStory } from './capture';

/**
 * Mobile visual regression: pixel baselines at a 390x844 viewport (the
 * `visual-mobile` Playwright project). At this viewport the `.story-chart`
 * container renders at roughly ~358px after Ladle padding — inside the
 * compact (<400px) breakpoint band, which is where the 7.9.x dropped-label
 * bugs lived and which the desktop `visual` project (1280x900) never sees.
 *
 * Story set: all mobile-regression stories plus three canonical chart types.
 * Screenshot names carry a `-mobile` suffix for readability; Playwright
 * already namespaces baselines per spec file and per project name.
 */

const stories = [
  { name: 'mr-long-title', slug: 'testing--mobile-regression--long-title-mobile' },
  { name: 'mr-grouped-columns-labels-all', slug: 'testing--mobile-regression--grouped-columns-labels-all' },
  { name: 'mr-grouped-bars-many-rows', slug: 'testing--mobile-regression--grouped-bars-many-rows' },
  { name: 'mr-grouped-bars-sparse-ticks', slug: 'testing--mobile-regression--grouped-bars-sparse-ticks' },
  { name: 'mr-one-wide-x-label', slug: 'testing--mobile-regression--one-wide-x-label' },
  { name: 'mr-one-wide-x-label-large-ticks', slug: 'testing--mobile-regression--one-wide-x-label-large-ticks' },
  { name: 'mr-uniform-short-x-labels', slug: 'testing--mobile-regression--uniform-short-x-labels' },
  { name: 'mr-inline-y-title', slug: 'testing--mobile-regression--inline-y-title' },
  // Auto-height container (bare .story-chart): the only visual coverage for
  // the auto-height growth contract — 400px viz budget + chrome overheads.
  { name: 'mr-auto-height-chrome-growth', slug: 'testing--mobile-regression--auto-height-chrome-growth' },
  // chromeLayout: 'grow' — fixed 500px plot budget, SVG grows by chrome height
  // so a 4-line title doesn't compress the plot.
  { name: 'mr-chrome-layout-grow', slug: 'testing--mobile-regression--chrome-layout-grow' },
  // maxLines — the same runaway title capped at 2 lines with an ellipsis.
  { name: 'mr-chrome-max-lines', slug: 'testing--mobile-regression--chrome-max-lines' },
  { name: 'bar-vertical', slug: 'testing--fixtures--simple-columns' },
  { name: 'line-multi-series', slug: 'testing--fixtures--gdp-growth' },
  { name: 'stacked-column', slug: 'testing--fixtures--energy-mix' },
];

for (const story of stories) {
  test(`visual mobile: ${story.name}`, async ({ page }) => {
    await captureStory(page, story.slug, `${story.name}-mobile.png`);
  });
}
