import type { ChartLayout, ElementEdit } from '@opendata-ai/openchart-core';

/**
 * Wire click handlers on legend entries to toggle series visibility.
 * Returns a cleanup function.
 */
export function wireLegendInteraction(
  svg: SVGElement,
  _layout: ChartLayout,
  toggleSeries: (series: string) => boolean,
  onLegendToggle?: (series: string, visible: boolean) => void,
  onEdit?: (edit: ElementEdit) => void,
): () => void {
  // Scoped OUT of the size legend explicitly. Clicking a legend entry toggles a
  // *series*, and a size legend's circles are values, not series -- clicking
  // "500M" must not try to hide a series by that name. The size legend already
  // emits no `data-legend-index`, but a bare `[data-legend-index]` sweep would
  // silently pick one up the moment that changed, and the failure would be a
  // click that quietly hides the wrong thing rather than an error.
  const legendEntries = svg.querySelectorAll(
    '.oc-legend:not(.oc-legend--size) [data-legend-index]',
  );
  const cleanups: Array<() => void> = [];

  for (const entry of legendEntries) {
    if (entry.getAttribute('data-legend-overflow') === 'true') continue;

    const handleClick = () => {
      const label = entry.getAttribute('data-legend-label');
      if (!label) return;

      const nowHidden = toggleSeries(label);
      onLegendToggle?.(label, !nowHidden);
      onEdit?.({ type: 'legend-toggle', series: label, hidden: nowHidden });
    };

    entry.addEventListener('click', handleClick);
    cleanups.push(() => entry.removeEventListener('click', handleClick));
  }

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}
