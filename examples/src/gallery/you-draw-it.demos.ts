import type { PageEntry } from './registry';

export const page: PageEntry = {
  group: 'Features',
  slug: 'features--you-draw-it',
  export: 'You Draw It',
  demos: [
    { id: 'draw-then-reveal', title: 'Draw then reveal' },
    { id: 'comparison-line', title: 'With a comparison line' },
  ],
};
