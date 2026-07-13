/**
 * Demo registry for the Data & Encoding gallery page.
 *
 * Co-located sidecar (not a `.stories.tsx`, so Ladle doesn't treat it as a
 * story) listing every {@link ./features-data-encoding.stories.tsx} demo anchor in visual order,
 * plus the page's Ladle slug and sidebar group. `registry.ts` assembles these
 * into the Welcome demo index; keep this in sync with the `<Demo>`/`<Section>`
 * anchors on the page so the index can't silently drift.
 */
import type { PageEntry } from './registry';

export const page: PageEntry = {
  group: 'Features',
  slug: 'features--data-and-encoding',
  export: 'Data & Encoding',
  demos: [
    { id: 'filter', title: 'Filter (interactive toggle)' },
    { id: 'bin', title: 'Bin → histogram' },
    { id: 'calculate', title: 'Calculate (derived field)' },
    { id: 'time-unit', title: 'TimeUnit (seasonal roll-up)' },
    { id: 'conditional-encoding', title: 'Value-driven color' },
    { id: 'linear-gradient', title: 'Linear gradient on bars' },
    { id: 'area-gradient', title: 'Area fade to transparent' },
    { id: 'facet-shared', title: 'Small multiples (shared scale)' },
    { id: 'facet-independent', title: 'Independent scales' },
    { id: 'formatters', title: 'Number and date formats' },
    { id: 'fill-patterns', title: 'Fill patterns' },
    { id: 'dash-encoding', title: 'Dash encoding' },
  ],
};
