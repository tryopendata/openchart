/**
 * Demo registry for the Edit Mode gallery page.
 *
 * Co-located sidecar (not a `.stories.tsx`, so Ladle doesn't treat it as a
 * story) listing every {@link ./features-edit-mode.stories.tsx} demo anchor in visual order,
 * plus the page's Ladle slug and sidebar group. `registry.ts` assembles these
 * into the Welcome demo index; keep this in sync with the `<Demo>`/`<Section>`
 * anchors on the page so the index can't silently drift.
 */
import type { PageEntry } from './registry';

export const page: PageEntry = {
  group: 'Features',
  slug: 'features--edit-mode',
  export: 'Edit Mode',
  demos: [{ id: 'editor', title: 'The editor' }],
};
