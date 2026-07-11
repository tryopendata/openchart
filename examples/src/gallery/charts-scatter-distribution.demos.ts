/**
 * Demo registry for the Scatter & Distribution gallery page.
 *
 * Co-located sidecar (not a `.stories.tsx`, so Ladle doesn't treat it as a
 * story) listing every {@link ./charts-scatter-distribution.stories.tsx} demo anchor in visual order,
 * plus the page's Ladle slug and sidebar group. `registry.ts` assembles these
 * into the Welcome demo index; keep this in sync with the `<Demo>`/`<Section>`
 * anchors on the page so the index can't silently drift.
 */
import type { PageEntry } from './registry';

export const page: PageEntry = {
  group: 'Charts',
  slug: 'charts--scatter-and-distribution',
  export: 'Scatter & Distribution',
  demos: [
    { id: 'basic-scatter', title: 'Basic scatter' },
    { id: 'bubble', title: 'Bubble (size encoding)' },
    { id: 'color-grouping', title: 'Color grouping' },
    { id: 'trend-annotation', title: 'Trend annotation' },
    { id: 'dot-plot', title: 'Dot plot' },
    { id: 'lollipop', title: 'Lollipop (diverging)' },
    { id: 'dumbbell', title: 'Dumbbell' },
    { id: 'strip-plot', title: 'Tick / strip plot' },
    { id: 'interactive', title: 'Interactive (hover to read out)' },
  ],
};
