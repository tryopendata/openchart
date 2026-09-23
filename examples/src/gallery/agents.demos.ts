/**
 * Demo registry for the Agents gallery page.
 *
 * Co-located sidecar (not a `.stories.tsx`, so Ladle doesn't treat it as a
 * story) listing the {@link ./agents.stories.tsx} section anchors, plus the
 * page's Ladle slug and sidebar group. Keep in sync with the page's Sections.
 */
import type { PageEntry } from './registry';

export const page: PageEntry = {
  group: 'Agents',
  slug: 'agents--built-for-agents',
  export: 'Built for Agents',
  demos: [
    { id: 'chat-analyst', title: 'Chat analyst: write, repair, refine' },
    { id: 'why-a-spec', title: 'Why a spec' },
    { id: 'dashboard-builder', title: 'Dashboard builder: four spec types' },
    { id: 'wire-it-up', title: 'Wire it up' },
  ],
};
