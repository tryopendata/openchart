/**
 * Demo registry for the Showcase gallery page.
 *
 * Co-located sidecar (not a `.stories.tsx`, so Ladle doesn't treat it as a
 * story) listing every {@link ./showcase.stories.tsx} demo anchor in visual order,
 * plus the page's Ladle slug and sidebar group. `registry.ts` assembles these
 * into the Welcome demo index; keep this in sync with the `<Demo>`/`<Section>`
 * anchors on the page so the index can't silently drift.
 */
import type { PageEntry } from './registry';

export const page: PageEntry = {
  group: 'Showcase',
  slug: 'showcase--showcase',
  export: 'Showcase',
  demos: [
    { id: 'multi-series-line', title: 'Multi-series line' },
    { id: 'full-chrome-bar', title: 'Horizontal bar with full chrome' },
    { id: 'stacked-area', title: 'Stacked area' },
    { id: 'data-table', title: 'Dense data table' },
    { id: 'world-choropleth', title: 'World choropleth' },
    { id: 'sankey-flow', title: 'Sankey with path tracing' },
    { id: 'force-graph', title: 'Force-directed graph' },
    { id: 'kpi-row', title: 'KPI row' },
    { id: 'annotated-scatter', title: 'Annotated scatter' },
    { id: 'keyboard-nav', title: 'Keyboard navigation' },
  ],
};
