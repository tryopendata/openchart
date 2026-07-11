/**
 * Legacy-slug redirect map.
 *
 * Maps an old published `?story=` slug to its new gallery destination. Under
 * the big-bang rollout (see plans/ladle-gallery/00-overview.md, constraint
 * C4), the public site only changes at the final flip, so every deleted
 * story's slug must still resolve. Each PR that DELETES a story file adds its
 * entries here in the same commit, keeping the branch internally consistent.
 *
 * The provider reads `?story=` on mount; if it matches a key, it replaces the
 * URL with `?story=<story>` (plus `#<hash>` when set) and lets Ladle navigate.
 *
 * This starts EMPTY. The proving-ground pass (Bar & Column) adds the first
 * batch of entries for the story files it deletes.
 */
export type Redirect = { story: string; hash?: string };

const BAR_COLUMN = 'charts--bar-and-column';

export const redirects: Record<string, Redirect> = {
  // charts/bar.stories.tsx
  'bar--simple-bars': { story: BAR_COLUMN, hash: 'simple-bars' },
  'bar--grouped-bars': { story: BAR_COLUMN, hash: 'grouped-columns' },
  'bar--negative-values': { story: BAR_COLUMN, hash: 'negative-values' },

  // charts/column.stories.tsx
  'column--simple-columns': { story: BAR_COLUMN, hash: 'columns' },
  'column--grouped-columns': { story: BAR_COLUMN, hash: 'grouped-columns' },
  'column--negative-values': { story: BAR_COLUMN, hash: 'diverging-columns' },
  'column--long-axis-labels': { story: BAR_COLUMN, hash: 'long-labels' },
  'column--responsive-demo': { story: BAR_COLUMN, hash: 'grouped-columns' },

  // charts/barlist.stories.tsx
  'barlist--basic': { story: BAR_COLUMN, hash: 'bar-list' },
  'barlist--color-encoding': { story: BAR_COLUMN, hash: 'bar-list' },
  'barlist--with-subtitle': { story: BAR_COLUMN, hash: 'bar-list' },
  'barlist--custom-bar-style': { story: BAR_COLUMN, hash: 'bar-list' },
  'barlist--dark-mode': { story: BAR_COLUMN, hash: 'bar-list' },
  'barlist--compact': { story: BAR_COLUMN, hash: 'bar-list' },
  'barlist--large-dataset': { story: BAR_COLUMN, hash: 'bar-list' },
  'barlist--no-chrome': { story: BAR_COLUMN, hash: 'bar-list' },

  // editorial/bar-horizontal.stories.tsx
  'bar-horizontal--population-bar': { story: BAR_COLUMN, hash: 'simple-bars' },
  'bar-horizontal--population-bar-compact': { story: BAR_COLUMN, hash: 'simple-bars' },
  'bar-horizontal--population-bar-wide': { story: BAR_COLUMN, hash: 'simple-bars' },

  // editorial/bar-stacked.stories.tsx
  'bar-stacked--household-spending': { story: BAR_COLUMN, hash: 'stacked-bars' },
  'bar-stacked--household-spending-compact': { story: BAR_COLUMN, hash: 'stacked-bars' },
  'bar-stacked--household-spending-wide': { story: BAR_COLUMN, hash: 'stacked-bars' },

  // editorial/column-diverging.stories.tsx
  'column-diverging--temperature-anomaly': { story: BAR_COLUMN, hash: 'diverging-columns' },
  'column-diverging--temperature-anomaly-compact': {
    story: BAR_COLUMN,
    hash: 'diverging-columns',
  },
  'column-diverging--temperature-anomaly-wide': { story: BAR_COLUMN, hash: 'diverging-columns' },

  // editorial/column-stacked.stories.tsx
  'column-stacked--energy-mix': { story: BAR_COLUMN, hash: 'stacked-bars' },
  'column-stacked--energy-mix-compact': { story: BAR_COLUMN, hash: 'stacked-bars' },
  'column-stacked--energy-mix-wide': { story: BAR_COLUMN, hash: 'stacked-bars' },
};
