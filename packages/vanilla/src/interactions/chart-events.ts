import type { Annotation, ChartEventHandlers, ChartLayout } from '@opendata-ai/openchart-core';

/**
 * Build a map from data-mark-id to { datum, series } so event handlers
 * can look up the data row associated with a clicked/hovered mark element.
 */
function buildMarkDataMap(
  layout: ChartLayout,
): Map<string, { datum: Record<string, unknown>; series?: string }> {
  const map = new Map<string, { datum: Record<string, unknown>; series?: string }>();

  for (let i = 0; i < layout.marks.length; i++) {
    const mark = layout.marks[i];
    switch (mark.type) {
      case 'line':
        map.set(`line-${mark.seriesKey ?? i}`, {
          datum: mark.data[0] ?? {},
          series: mark.seriesKey,
        });
        break;
      case 'area':
        map.set(`area-${mark.seriesKey ?? i}`, {
          datum: mark.data[0] ?? {},
          series: mark.seriesKey,
        });
        break;
      case 'rect':
        map.set(`rect-${i}`, { datum: mark.data });
        break;
      case 'arc':
        map.set(`arc-${i}`, { datum: mark.data });
        break;
      case 'point':
        map.set(`point-${i}`, { datum: mark.data });
        break;
    }
  }

  return map;
}

/**
 * Wire chart event handlers (onMarkClick, onMarkHover, onMarkLeave) to mark
 * elements, onLegendToggle to legend entries, and onAnnotationClick to annotation
 * elements inside an SVG.
 *
 * Returns a cleanup function to remove all listeners.
 */
export function wireChartEvents(
  svg: SVGElement,
  layout: ChartLayout,
  specAnnotations: Annotation[],
  handlers: ChartEventHandlers,
): () => void {
  const cleanups: Array<() => void> = [];
  const markDataMap = buildMarkDataMap(layout);

  if (handlers.onMarkClick || handlers.onMarkHover || handlers.onMarkLeave) {
    const markElements = svg.querySelectorAll('[data-mark-id]');

    for (const el of markElements) {
      const markId = el.getAttribute('data-mark-id');
      if (!markId) continue;

      const markInfo = markDataMap.get(markId);
      if (!markInfo) continue;

      const series = markInfo.series ?? el.getAttribute('data-series') ?? undefined;

      if (handlers.onMarkClick) {
        const handleClick = (e: Event) => {
          const mouseEvent = e as MouseEvent;
          const svgRect = svg.getBoundingClientRect();
          handlers.onMarkClick!({
            datum: markInfo.datum,
            series,
            position: {
              x: mouseEvent.clientX - svgRect.left,
              y: mouseEvent.clientY - svgRect.top,
            },
            event: mouseEvent,
          });
        };
        el.addEventListener('click', handleClick);
        cleanups.push(() => el.removeEventListener('click', handleClick));
      }

      if (handlers.onMarkHover) {
        const handleEnter = (e: Event) => {
          const mouseEvent = e as MouseEvent;
          const svgRect = svg.getBoundingClientRect();
          handlers.onMarkHover!({
            datum: markInfo.datum,
            series,
            position: {
              x: mouseEvent.clientX - svgRect.left,
              y: mouseEvent.clientY - svgRect.top,
            },
            event: mouseEvent,
          });
        };
        el.addEventListener('mouseenter', handleEnter);
        cleanups.push(() => el.removeEventListener('mouseenter', handleEnter));
      }

      if (handlers.onMarkLeave) {
        const handleLeave = () => {
          handlers.onMarkLeave!();
        };
        el.addEventListener('mouseleave', handleLeave);
        cleanups.push(() => el.removeEventListener('mouseleave', handleLeave));
      }
    }
  }

  if (handlers.onAnnotationClick) {
    const annotationElements = svg.querySelectorAll('.oc-annotation');

    for (let i = 0; i < annotationElements.length; i++) {
      const el = annotationElements[i];
      const specAnnotation = specAnnotations[i];
      if (!specAnnotation) continue;

      const handleClick = (e: Event) => {
        const mouseEvent = e as MouseEvent;
        handlers.onAnnotationClick!(specAnnotation, mouseEvent);
      };

      el.addEventListener('click', handleClick);
      cleanups.push(() => el.removeEventListener('click', handleClick));
    }
  }

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}
