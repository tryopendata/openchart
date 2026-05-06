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
  const legendEntries = svg.querySelectorAll('[data-legend-index]');
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
