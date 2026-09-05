import type { ChartLayout, ElementEdit } from '@opendata-ai/openchart-core';
import type { HoverEmphasis } from './hover-emphasis';

/**
 * Wire legend entries as toggle buttons: click or Enter/Space toggles series
 * visibility, hover and keyboard focus hover-link the series in the chart.
 * Returns a cleanup function.
 */
export function wireLegendInteraction(
  svg: SVGElement,
  _layout: ChartLayout,
  toggleSeries: (series: string) => boolean,
  onLegendToggle?: (series: string, visible: boolean) => void,
  onEdit?: (edit: ElementEdit) => void,
  emphasis?: HoverEmphasis,
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

    const toggle = () => {
      const label = entry.getAttribute('data-legend-label');
      if (!label) return;

      const nowHidden = toggleSeries(label);
      onLegendToggle?.(label, !nowHidden);
      onEdit?.({ type: 'legend-toggle', series: label, hidden: nowHidden });
    };

    const handleClick = () => toggle();

    const handleKeyDown = (e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.key !== 'Enter' && ke.key !== ' ') return;
      ke.preventDefault();
      toggle();
    };

    // Legend hover always dims the rest, on single- and multi-series charts
    // alike: picking a name off the legend is a deliberate gesture, not the
    // incidental sweep that mark hover is.
    const handleEnter = () => {
      const label = entry.getAttribute('data-legend-label');
      // A toggled-off series has nothing left to raise in the chart.
      if (!label || entry.getAttribute('data-legend-active') === 'false') return;
      emphasis?.setSeries(label);
    };
    const handleLeave = () => emphasis?.clear();

    entry.addEventListener('click', handleClick);
    entry.addEventListener('keydown', handleKeyDown);
    entry.addEventListener('mouseenter', handleEnter);
    entry.addEventListener('mouseleave', handleLeave);
    entry.addEventListener('focus', handleEnter);
    entry.addEventListener('blur', handleLeave);
    cleanups.push(() => {
      entry.removeEventListener('click', handleClick);
      entry.removeEventListener('keydown', handleKeyDown);
      entry.removeEventListener('mouseenter', handleEnter);
      entry.removeEventListener('mouseleave', handleLeave);
      entry.removeEventListener('focus', handleEnter);
      entry.removeEventListener('blur', handleLeave);
    });
  }

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}
