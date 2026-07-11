/**
 * Demo registry for the Annotations gallery page.
 *
 * Co-located sidecar (not a `.stories.tsx`, so Ladle doesn't treat it as a
 * story) listing every {@link ./features-annotations.stories.tsx} demo anchor in visual order,
 * plus the page's Ladle slug and sidebar group. `registry.ts` assembles these
 * into the Welcome demo index; keep this in sync with the `<Demo>`/`<Section>`
 * anchors on the page so the index can't silently drift.
 */
import type { PageEntry } from './registry';

export const page: PageEntry = {
  group: 'Features',
  slug: 'features--annotations',
  export: 'Annotations',
  demos: [
    { id: 'text-annotation', title: 'Text callout with a dot marker' },
    { id: 'connectors', title: 'Straight, curve, and drop-line' },
    { id: 'range-bands', title: 'x-band and y-band' },
    { id: 'range-rectangle', title: 'Rectangle with extendToEdges: false' },
    { id: 'reference-lines', title: 'Averages, thresholds, and event markers' },
    { id: 'resize-stability', title: 'Annotations stay pinned through resize' },
    { id: 'auto-thinning', title: 'Narrow-width demotion to numbered footnotes' },
  ],
};
