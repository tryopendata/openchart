/**
 * Demo registry for the Graphs gallery page.
 *
 * Co-located sidecar (not a `.stories.tsx`, so Ladle doesn't treat it as a
 * story) listing every {@link ./graphs.stories.tsx} demo anchor in visual order,
 * plus the page's Ladle slug and sidebar group. `registry.ts` assembles these
 * into the Welcome demo index; keep this in sync with the `<Demo>`/`<Section>`
 * anchors on the page so the index can't silently drift.
 */
import type { PageEntry } from './registry';

export const page: PageEntry = {
  group: 'Graphs',
  slug: 'graphs--graphs',
  export: 'Graphs',
  demos: [
    { id: 'basic', title: 'Force-directed graph' },
    { id: 'communities', title: 'Community clusters' },
    { id: 'encoded', title: 'Encoded graph' },
    { id: 'chrome', title: 'Graph with chrome' },
    { id: 'search', title: 'Search (built-in node search)' },
    { id: 'scale', title: 'Scale: 1k / 5k / 10k / 20k nodes (click to load)' },
    { id: 'interactive', title: 'Interactive (click & hover)' },
    { id: 'choreography', title: 'Entrance & camera choreography' },
    { id: 'legend', title: 'Interactive legend' },
    { id: 'host-legend', title: 'Host-driven legend + seed node' },
    { id: 'highlight', title: 'Highlight API' },
    { id: 'seeded', title: 'Seeded layout (deterministic)' },
    { id: 'update', title: 'Update transitions (add / remove nodes)' },
    { id: 'cursor-repulsion', title: 'Cursor repulsion' },
  ],
};
