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
    { id: 'text-mark', title: 'Text mark' },
    { id: 'rule-mark', title: 'Rule mark' },
    { id: 'tick-mark', title: 'Tick mark' },
    { id: 'rect-mark', title: 'Sequential color fill' },
    { id: 'layered', title: 'Layered chart (shared scales)' },
    { id: 'dual-axis', title: 'Dual axis (independent scales)' },
    { id: 'spans', title: 'Spans (x2 / y2)' },
    { id: 'interactive', title: 'Interactive (compose a layer live)' },
  ],
};
