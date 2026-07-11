/**
 * Demo registry for the Responsive gallery page.
 *
 * Co-located sidecar (not a `.stories.tsx`, so Ladle doesn't treat it as a
 * story) listing every {@link ./features-responsive.stories.tsx} demo anchor in visual order,
 * plus the page's Ladle slug and sidebar group. `registry.ts` assembles these
 * into the Welcome demo index; keep this in sync with the `<Demo>`/`<Section>`
 * anchors on the page so the index can't silently drift.
 */
import type { PageEntry } from './registry';

export const page: PageEntry = {
  group: 'Features',
  slug: 'features--responsive',
  export: 'Responsive',
  demos: [
    { id: 'drag-resizable', title: 'Drag-resizable container' },
    { id: 'rotation-ladder', title: 'Label rotation ladder' },
    { id: 'auto-height', title: 'Auto-height' },
    { id: 'extreme-ratios', title: 'Extreme ratios' },
    { id: 'facet-stacking', title: 'Facet column degradation' },
  ],
};
