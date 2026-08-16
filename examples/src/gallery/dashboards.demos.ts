/**
 * Demo registry for the Dashboards gallery page.
 *
 * Co-located sidecar (not a `.stories.tsx`, so Ladle doesn't treat it as a
 * story) listing every {@link ./dashboards.stories.tsx} demo anchor in visual order,
 * plus the page's Ladle slug and sidebar group. `registry.ts` assembles these
 * into the Welcome demo index; keep this in sync with the `<Demo>`/`<Section>`
 * anchors on the page so the index can't silently drift.
 */
import type { PageEntry } from './registry';

export const page: PageEntry = {
  group: 'Dashboards',
  slug: 'dashboards--dashboards',
  export: 'Dashboards',
  demos: [
    { id: 'sparkline-cards', title: 'Sparkline card grid' },
    { id: 'kpi-metrics', title: 'KPI metric pills' },
    { id: 'bar-list', title: 'Bar list (ranked movers)' },
    { id: 'crosshair-line', title: 'Financial line with crosshair' },
    { id: 'sector-returns', title: 'Sector returns (conditional color)' },
    { id: 'mini-dashboard', title: 'Mini-dashboard (2x2 grid)' },
    { id: 'saas-overview', title: 'SaaS analytics overview' },
    { id: 'ops-monitoring', title: 'Ops / monitoring' },
    { id: 'markets-overview', title: 'Finance / markets' },
    { id: 'incident-intelligence', title: 'Incident intelligence (AI on-call agent)' },
    { id: 'marketing-funnel', title: 'Marketing funnel' },
  ],
};
