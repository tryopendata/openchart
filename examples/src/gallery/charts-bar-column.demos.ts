/**
 * Demo registry for the Bar & Column gallery page.
 *
 * Co-located sidecar (not a `.stories.tsx`, so Ladle doesn't treat it as a
 * story) listing every {@link ./charts-bar-column.stories.tsx} demo anchor in visual order,
 * plus the page's Ladle slug and sidebar group. `registry.ts` assembles these
 * into the Welcome demo index; keep this in sync with the `<Demo>`/`<Section>`
 * anchors on the page so the index can't silently drift.
 */
import type { PageEntry } from './registry';

export const page: PageEntry = {
  group: 'Charts',
  slug: 'charts--bar-and-column',
  export: 'Bar & Column',
  demos: [
    { id: 'simple-bars', title: 'Simple bars (horizontal)' },
    { id: 'columns', title: 'Columns (vertical)' },
    { id: 'grouped-columns', title: 'Grouped columns' },
    { id: 'stacked-bars', title: 'Stacked bars' },
    { id: 'normalized-stacked', title: '100% stacked' },
    { id: 'bar-list', title: 'Bar list' },
    { id: 'diverging-columns', title: 'Diverging columns' },
    { id: 'negative-values', title: 'Negative values' },
    { id: 'long-labels', title: 'Long category labels' },
    { id: 'interactive', title: 'Interactive (click to highlight)' },
  ],
};
