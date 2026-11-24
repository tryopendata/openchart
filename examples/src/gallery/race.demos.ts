/**
 * Demo registry for the Race gallery page.
 *
 * This sidecar stays outside Ladle's story scan. It lists the sidebar group,
 * story slug, and demo anchors in the order they appear in
 * {@link ./race.stories.tsx}. `registry.ts` uses it to build the Welcome index.
 */
import type { PageEntry } from './registry';

export const page: PageEntry = {
  group: 'Charts',
  slug: 'charts--race',
  export: 'Race',
  demos: [
    { id: 'bar', title: 'Bar race' },
    { id: 'line', title: 'Line race' },
    { id: 'table', title: 'Table race' },
    { id: 'looping-top-five', title: 'Looping top five' },
    { id: 'fixed-scale', title: 'Fixed scale' },
  ],
};
