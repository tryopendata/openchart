/**
 * Demo registry for the Sankey & Tile Maps gallery page.
 *
 * Co-located sidecar (not a `.stories.tsx`, so Ladle doesn't treat it as a
 * story) listing every {@link ./sankey-tilemaps.stories.tsx} demo anchor in visual order,
 * plus the page's Ladle slug and sidebar group. `registry.ts` assembles these
 * into the Welcome demo index; keep this in sync with the `<Demo>`/`<Section>`
 * anchors on the page so the index can't silently drift.
 */
import type { PageEntry } from './registry';

export const page: PageEntry = {
  group: 'Sankey & Tile Maps',
  slug: 'sankey---tile-maps--sankey-and-tile-maps',
  export: 'Sankey & Tile Maps',
  demos: [
    { id: 'energy-flow', title: 'Energy flow' },
    { id: 'budget-allocation', title: 'Budget allocation' },
    { id: 'user-journey', title: 'User journey' },
    { id: 'link-coloring', title: 'Link coloring & node alignment' },
    { id: 'quantitative', title: 'Quantitative (sequential palette)' },
    { id: 'categorical', title: 'Categorical (custom colors)' },
    { id: 'partial-data', title: 'Partial data' },
    { id: 'palettes', title: 'Palette variants' },
    { id: 'interactive', title: 'Interactive (click to read)' },
  ],
};
