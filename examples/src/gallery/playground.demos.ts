/**
 * Demo registry for the Playground gallery page.
 *
 * Co-located sidecar (not a `.stories.tsx`, so Ladle doesn't treat it as a
 * story) listing the {@link ./playground.stories.tsx} demo anchor, plus the
 * page's Ladle slug and sidebar group. `registry.ts` assembles these into the
 * Welcome demo index; keep this in sync with the `<Demo>` anchor on the page so
 * the index can't silently drift.
 *
 * Playground is a single interactive surface, so it lists one demo entry.
 */
import type { PageEntry } from './registry';

export const page: PageEntry = {
  group: 'Playground',
  slug: 'playground--playground',
  export: 'Playground',
  demos: [{ id: 'explorer', title: 'Live spec explorer' }],
};
