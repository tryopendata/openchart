/**
 * Demo registry for the Tables gallery page.
 *
 * Co-located sidecar (not a `.stories.tsx`, so Ladle doesn't treat it as a
 * story) listing every {@link ./tables.stories.tsx} demo anchor in visual order,
 * plus the page's Ladle slug and sidebar group. `registry.ts` assembles these
 * into the Welcome demo index; keep this in sync with the `<Demo>`/`<Section>`
 * anchors on the page so the index can't silently drift.
 */
import type { PageEntry } from './registry';

export const page: PageEntry = {
  group: 'Tables',
  slug: 'tables--tables',
  export: 'Tables',
  demos: [
    { id: 'basic', title: 'Basic table' },
    { id: 'heatmap-cells', title: 'Heatmap cells' },
    { id: 'inline-bar-cells', title: 'Inline bar cells' },
    { id: 'sparkline-cells', title: 'Sparkline cells' },
    { id: 'flag-cells', title: 'Flag cells' },
    { id: 'image-cells', title: 'Image cells' },
    { id: 'category-color-cells', title: 'Category color cells' },
    { id: 'sort-search-pagination', title: 'Sort, search & pagination' },
    { id: 'controlled-state', title: 'Interactive (controlled state)' },
  ],
};
