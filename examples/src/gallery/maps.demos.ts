/**
 * Demo registry for the Maps gallery page.
 *
 * Co-located sidecar listing every {@link ./maps.stories.tsx} demo anchor in
 * visual order, plus the page's Ladle slug and sidebar group. `registry.ts`
 * assembles these into the Welcome demo index.
 */
import type { PageEntry } from './registry';

export const page: PageEntry = {
  group: 'Maps',
  slug: 'maps--maps',
  export: 'Maps',
  demos: [
    { id: 'us-state-unemployment', title: 'US state unemployment' },
    { id: 'us-counties', title: 'US counties' },
    { id: 'world-equal-earth', title: 'World equal-earth' },
    { id: 'world-mercator', title: 'World mercator' },
    { id: 'interactive-choropleth', title: 'Interactive choropleth' },
    { id: 'entrance-animation', title: 'Entrance animation' },
    { id: 'data-update-recolor', title: 'Data-update recolor' },
    { id: 'zoom-to-feature', title: 'Zoom to feature' },
    { id: 'map-scrollytelling', title: 'Map scrollytelling' },
    { id: 'point-layer', title: 'Point layer' },
  ],
};
