/**
 * Demo registry for the Building Blocks gallery page.
 *
 * Co-located sidecar (not a `.stories.tsx`, so Ladle doesn't treat it as a
 * story) listing every {@link ./charts-building-blocks.stories.tsx} demo anchor in visual order,
 * plus the page's Ladle slug and sidebar group. `registry.ts` assembles these
 * into the Welcome demo index; keep this in sync with the `<Demo>`/`<Section>`
 * anchors on the page so the index can't silently drift.
 */
import type { PageEntry } from './registry';

export const page: PageEntry = {
  group: 'Charts',
  slug: 'charts--building-blocks',
  export: 'Building Blocks',
  demos: [
    { id: 'text-mark', title: 'Label points directly' },
    { id: 'rule-mark', title: 'Reference lines' },
    { id: 'tick-mark', title: 'Distribution strip' },
    { id: 'layered', title: 'Combo chart (shared scales)' },
    { id: 'dual-axis', title: 'Dual axis (independent scales)' },
    { id: 'dual-axis-temporal', title: 'Dual axis on a shared time axis' },
    { id: 'spans', title: 'Ranges (x2 / y2)' },
    { id: 'interactive', title: 'Toggle a layer live' },
  ],
};
