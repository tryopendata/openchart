/**
 * Demo registry for the Pie & Donut gallery page.
 *
 * Co-located sidecar (not a `.stories.tsx`, so Ladle doesn't treat it as a
 * story) listing every {@link ./charts-pie-donut.stories.tsx} demo anchor in visual order,
 * plus the page's Ladle slug and sidebar group. `registry.ts` assembles these
 * into the Welcome demo index; keep this in sync with the `<Demo>`/`<Section>`
 * anchors on the page so the index can't silently drift.
 */
import type { PageEntry } from './registry';

export const page: PageEntry = {
  group: 'Charts',
  slug: 'charts--pie-and-donut',
  export: 'Pie & Donut',
  demos: [
    { id: 'pie-inline-labels', title: 'Pie with inline labels' },
    { id: 'donut-center-metric', title: 'Donut with center metric' },
    { id: 'small-slice-grouping', title: 'Small-slice grouping' },
    { id: 'many-categories', title: 'Too many categories' },
    { id: 'comparison-donuts', title: 'Side-by-side comparison donuts' },
    { id: 'leader-line-labels', title: 'Leader-line labels' },
    { id: 'waffle', title: 'Waffle' },
    { id: 'parliament', title: 'Parliament (hemicycle)' },
    { id: 'half-donut', title: 'Half-donut (election arc)' },
    { id: 'interactive-donut', title: 'Interactive (hover to read a slice)' },
  ],
};
