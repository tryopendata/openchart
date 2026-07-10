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
  { name: 'mr-long-title', slug: 'mobile-regression--long-title-mobile' },
  { name: 'mr-grouped-columns-labels-all', slug: 'mobile-regression--grouped-columns-labels-all' },
  { name: 'mr-grouped-bars-many-rows', slug: 'mobile-regression--grouped-bars-many-rows' },
  { name: 'mr-grouped-bars-sparse-ticks', slug: 'mobile-regression--grouped-bars-sparse-ticks' },
  { name: 'mr-one-wide-x-label', slug: 'mobile-regression--one-wide-x-label' },
  { name: 'mr-one-wide-x-label-large-ticks', slug: 'mobile-regression--one-wide-x-label-large-ticks' },
  { name: 'mr-uniform-short-x-labels', slug: 'mobile-regression--uniform-short-x-labels' },
  { name: 'mr-inline-y-title', slug: 'mobile-regression--inline-y-title' },
  { name: 'bar-vertical', slug: 'column--simple-columns' },
  { name: 'line-multi-series', slug: 'line-multiseries--gdp-growth' },
  { name: 'stacked-column', slug: 'column-stacked--energy-mix' },
];

for (const story of stories) {
  test(`visual mobile: ${story.name}`, async ({ page }) => {
    await captureStory(page, story.slug, `${story.name}-mobile.png`);
  });
}
