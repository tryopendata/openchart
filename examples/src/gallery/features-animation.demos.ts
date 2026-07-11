/**
 * Demo registry for the Animation gallery page.
 *
 * Co-located sidecar (not a `.stories.tsx`, so Ladle doesn't treat it as a
 * story) listing every {@link ./features-animation.stories.tsx} demo anchor in visual order,
 * plus the page's Ladle slug and sidebar group. `registry.ts` assembles these
 * into the Welcome demo index; keep this in sync with the `<Demo>`/`<Section>`
 * anchors on the page so the index can't silently drift.
 */
import type { PageEntry } from './registry';

export const page: PageEntry = {
  group: 'Features',
  slug: 'features--animation',
  export: 'Animation',
  demos: [
    { id: 'easing', title: 'Easing — smooth vs snappy' },
    { id: 'stagger', title: 'Stagger order — index, value, reverse' },
    { id: 'line-drawing', title: 'Line drawing' },
    { id: 'area-reveal', title: 'Area reveal' },
    { id: 'pie-sweep', title: 'Pie sweep' },
    { id: 'stacked-chain', title: 'Stacked segment chaining' },
    { id: 'annotation-delay', title: 'Annotation delay' },
    { id: 'update-transitions', title: 'Update transitions (interactive)' },
    { id: 'enter-exit', title: 'Enter / exit (interactive)' },
  ],
};
