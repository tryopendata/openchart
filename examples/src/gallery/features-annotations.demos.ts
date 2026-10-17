import type { ChartSpec } from '@opendata-ai/openchart-core';
/**
 * Demo registry for the Annotations gallery page.
 *
 * Co-located sidecar (not a `.stories.tsx`, so Ladle doesn't treat it as a
 * story) listing every {@link ./features-annotations.stories.tsx} demo anchor in visual order,
 * plus the page's Ladle slug and sidebar group. `registry.ts` assembles these
 * into the Welcome demo index; keep this in sync with the `<Demo>`/`<Section>`
 * anchors on the page so the index can't silently drift.
 */
import type { PageEntry } from './registry';

export const page: PageEntry = {
  group: 'Features',
  slug: 'features--annotations',
  export: 'Annotations',
  demos: [
    { id: 'text-annotation', title: 'Text callout with a dot marker' },
    { id: 'connectors', title: 'Straight, curve, and drop-line' },
    { id: 'range-bands', title: 'x-band and y-band' },
    { id: 'range-rectangle', title: 'Rectangle with extendToEdges: false' },
    { id: 'reference-lines', title: 'Averages, thresholds, and event markers' },
    { id: 'resize-stability', title: 'Annotations stay pinned through resize' },
    { id: 'auto-thinning', title: 'Narrow-width demotion to numbered footnotes' },
  ],
};

/** Track A geometry fixtures. These do not join visual baselines until phase 5. */
export const annotationGestureSpec: ChartSpec = {
  mark: 'point',
  animation: false,
  responsive: { autoThin: false },
  data: [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
  ],
  encoding: { x: { field: 'x', type: 'quantitative' }, y: { field: 'y', type: 'quantitative' } },
  chrome: { title: 'Move a callout', subtitle: 'Drag the label; its data point stays fixed.' },
  annotations: [
    {
      type: 'text',
      id: 'callout',
      x: 10,
      y: 5,
      text: 'A heading',
      subtitle: 'A wider second line',
      connector: { type: 'curve', bend: 0 },
      dot: true,
      responsive: false,
    },
  ],
};
export const annotationCurveSpecs: ChartSpec[] = [-1, -0.5, 0, 0.5, 1].flatMap((bend) =>
  [false, true].map((arrow) => ({
    ...annotationGestureSpec,
    chrome: { title: `Bend ${bend}${arrow ? ' with arrow' : ''}` },
    annotations: [
      {
        type: 'text',
        id: `bend-${bend}-${arrow}`,
        x: 9,
        y: 2,
        text: `Bend ${bend}`,
        subtitle: arrow ? 'Arrow' : 'Marker',
        anchor: 'left',
        offset: { dx: -25, dy: -75 },
        connector: { type: 'curve', bend, arrow },
        responsive: false,
      },
    ],
  })),
);

/** Shared crowded-callout layout for browser invariants and the preview benchmark. */
export const annotationCrowdedSpec: ChartSpec = {
  ...annotationGestureSpec,
  responsive: { autoThin: true },
  chrome: { title: 'Crowded callouts' },
  annotations: Array.from({ length: 14 }, (_, index) => ({
    type: 'text',
    id: `crowded-${index}`,
    x: index >= 12 ? 5 : 1 + (index % 4) * 2.5,
    y: index >= 12 ? 5 : 2 + Math.floor(index / 4) * 3,
    text: index >= 12 ? 'Kept inline' : `Callout ${index + 1}`,
    subtitle: 'Context for the observation',
    connector: 'curve',
    priority: index,
    ...(index >= 12
      ? { responsive: false, anchor: 'left' as const, offset: { dx: -20, dy: -30 } }
      : {}),
  })),
};
