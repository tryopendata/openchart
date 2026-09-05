/**
 * Demo registry for the Theming gallery page.
 *
 * Co-located sidecar (not a `.stories.tsx`, so Ladle doesn't treat it as a
 * story) listing every {@link ./features-theming.stories.tsx} demo anchor in visual order,
 * plus the page's Ladle slug and sidebar group. `registry.ts` assembles these
 * into the Welcome demo index; keep this in sync with the `<Demo>`/`<Section>`
 * anchors on the page so the index can't silently drift.
 */
import type { PageEntry } from './registry';

export const page: PageEntry = {
  group: 'Features',
  slug: 'features--theming',
  export: 'Theming',
  demos: [
    { id: 'presets', title: 'editorial · essay · wire · broadsheet · terminal' },
    { id: 'named-themes', title: 'Six house styles' },
    { id: 'custom', title: 'A ThemeConfig assembled from parts' },
    { id: 'dark-mode', title: 'Same spec, forced light vs. forced dark' },
    { id: 'recreations', title: 'FT-like and Economist-like' },
  ],
};
