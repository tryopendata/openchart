/**
 * Demo registry for the Line & Area gallery page.
 *
 * Co-located sidecar (not a `.stories.tsx`, so Ladle doesn't treat it as a
 * story) listing every {@link ./charts-line-area.stories.tsx} demo anchor in visual order,
 * plus the page's Ladle slug and sidebar group. `registry.ts` assembles these
 * into the Welcome demo index; keep this in sync with the `<Demo>`/`<Section>`
 * anchors on the page so the index can't silently drift.
 */
import type { PageEntry } from './registry';

export const page: PageEntry = {
  group: 'Charts',
  slug: 'charts--line-and-area',
  export: 'Line & Area',
  demos: [
    { id: 'single-line', title: 'Single line' },
    { id: 'multi-series-labels', title: 'Multi-series with endpoint labels' },
    { id: 'five-series-legend', title: 'Five-plus series with legend' },
    { id: 'series-search', title: 'Series search (find your line)' },
    { id: 'area', title: 'Area (single series)' },
    { id: 'stacked-area', title: 'Stacked area' },
    { id: 'interpolation', title: 'Step and interpolation modes' },
    { id: 'time-axis', title: 'Time axis formats' },
    { id: 'log-scale', title: 'Log scale' },
    { id: 'interactive', title: 'Interactive (hover to highlight)' },
  ],
};
