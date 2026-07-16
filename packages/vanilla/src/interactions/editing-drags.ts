import {
  type Annotation,
  type AnnotationOffset,
  type ChartSpec,
  type ChromeKey,
  type ElementEdit,
  elementRef,
  type GraphSpec,
  type RangeAnnotation,
  type RefLineAnnotation,
  type TextAnnotation,
} from '@opendata-ai/openchart-core';
import { createDragHandler } from './drag-handler';

/**
 * Wire drag-to-reposition on text annotation labels.
 * Returns a cleanup function to remove all listeners.
 */
export function wireAnnotationDrag(
  svg: SVGElement,
  specAnnotations: Annotation[],
  onAnnotationEdit:
    | ((annotation: TextAnnotation, updatedOffset: AnnotationOffset) => void)
    | undefined,
  onEdit: ((edit: ElementEdit) => void) | undefined,
  setDragging: (dragging: boolean) => void,
): () => void {
  const annotationElements = svg.querySelectorAll('.oc-annotation-text');
  const cleanups: Array<() => void> = [];

  for (const el of annotationElements) {
    const indexStr = el.getAttribute('data-annotation-index');
    if (indexStr === null) continue;

    const index = Number(indexStr);
    const specAnnotation = specAnnotations[index];
    if (!specAnnotation || specAnnotation.type !== 'text') continue;

    const textAnnotation = specAnnotation as TextAnnotation;
    const annotationG = el as SVGGElement;

    annotationG.style.cursor = 'grab';

    const connectorLine = annotationG.querySelector('line.oc-annotation-connector');
    const origX2 = connectorLine ? Number(connectorLine.getAttribute('x2')) : 0;
    const origY2 = connectorLine ? Number(connectorLine.getAttribute('y2')) : 0;

    const curvedPath = annotationG.querySelector('path.oc-annotation-connector');
    const arrowhead = annotationG.querySelector('polyline.oc-annotation-arrowhead');
    const hasCurvedConnector = curvedPath !== null;

    const origDx = textAnnotation.offset?.dx ?? 0;
    const origDy = textAnnotation.offset?.dy ?? 0;

    const cleanup = createDragHandler({
      element: annotationG,
      svg: svg as unknown as SVGSVGElement,
      onMove: (dx, dy) => {
        annotationG.setAttribute('transform', `translate(${dx}, ${dy})`);

        if (connectorLine && !hasCurvedConnector) {
          connectorLine.setAttribute('x2', String(origX2 - dx));
          connectorLine.setAttribute('y2', String(origY2 - dy));
        }

        if (hasCurvedConnector) {
          if (curvedPath) curvedPath.setAttribute('display', 'none');
          if (arrowhead) arrowhead.setAttribute('display', 'none');
        }
      },
      onEnd: (dx, dy, moved) => {
        annotationG.removeAttribute('transform');

        if (connectorLine && !hasCurvedConnector) {
          connectorLine.setAttribute('x2', String(origX2));
          connectorLine.setAttribute('y2', String(origY2));
        }

        if (hasCurvedConnector) {
          if (curvedPath) curvedPath.removeAttribute('display');
          if (arrowhead) arrowhead.removeAttribute('display');
        }

        if (moved) {
          const newOffset: AnnotationOffset = {
            dx: origDx + dx,
            dy: origDy + dy,
          };
          onAnnotationEdit?.(textAnnotation, newOffset);
          onEdit?.({
            type: 'annotation',
            element: elementRef.annotation(index, textAnnotation.id),
            annotation: textAnnotation,
            offset: newOffset,
          });
        }
      },
      setDragging,
    });

    cleanups.push(cleanup);
  }

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}

/**
 * Wire drag on connector endpoint handles for text annotations.
 * Returns a cleanup function that removes handles and all listeners.
 */
export function wireConnectorEndpointDrag(
  svg: SVGElement,
  specAnnotations: Annotation[],
  onEdit: (edit: ElementEdit) => void,
  setDragging: (dragging: boolean) => void,
): () => void {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const cleanups: Array<() => void> = [];
  const annotationGroups = svg.querySelectorAll('.oc-annotation-text');

  for (const el of annotationGroups) {
    const annotationG = el as SVGGElement;
    const indexStr = annotationG.getAttribute('data-annotation-index');
    if (indexStr === null) continue;

    const index = Number(indexStr);
    const specAnnotation = specAnnotations[index];
    if (!specAnnotation || specAnnotation.type !== 'text') continue;

    const textAnnotation = specAnnotation as TextAnnotation;

    const connectorLine = annotationG.querySelector('line.oc-annotation-connector');
    const curvedPath = annotationG.querySelector('path.oc-annotation-connector');
    if (!connectorLine && !curvedPath) continue;

    let fromX: number, fromY: number, toX: number, toY: number;
    if (connectorLine) {
      fromX = Number(connectorLine.getAttribute('x1')) || 0;
      fromY = Number(connectorLine.getAttribute('y1')) || 0;
      toX = Number(connectorLine.getAttribute('x2')) || 0;
      toY = Number(connectorLine.getAttribute('y2')) || 0;
    } else {
      const pathD = curvedPath!.getAttribute('d') ?? '';
      const mMatch = pathD.match(/M\s*([\d.e+-]+)\s+([\d.e+-]+)/);
      fromX = mMatch ? Number(mMatch[1]) : 0;
      fromY = mMatch ? Number(mMatch[2]) : 0;
      // The open-V arrowhead is a polyline "baseLeft tip baseRight": the tip is
      // the middle point.
      const arrowhead = annotationG.querySelector('polyline.oc-annotation-arrowhead');
      const points = arrowhead?.getAttribute('points')?.split(' ') ?? [];
      const [px, py] = (points[1] ?? '0,0').split(',');
      toX = Number(px) || 0;
      toY = Number(py) || 0;
    }

    const endpoints: Array<{ name: 'from' | 'to'; cx: number; cy: number }> = [
      { name: 'from', cx: fromX, cy: fromY },
      { name: 'to', cx: toX, cy: toY },
    ];

    const createdHandles: SVGCircleElement[] = [];

    for (const ep of endpoints) {
      if (!Number.isFinite(ep.cx) || !Number.isFinite(ep.cy)) continue;

      const handleEl = document.createElementNS(SVG_NS, 'circle') as SVGCircleElement;
      handleEl.setAttribute('class', 'oc-connector-handle');
      handleEl.setAttribute('data-endpoint', ep.name);
      handleEl.setAttribute('cx', String(ep.cx));
      handleEl.setAttribute('cy', String(ep.cy));
      handleEl.setAttribute('r', '4');
      handleEl.setAttribute('opacity', '0');
      handleEl.setAttribute('fill', 'currentColor');
      handleEl.setAttribute('stroke', 'currentColor');
      annotationG.appendChild(handleEl);
      createdHandles.push(handleEl);

      const origCx = ep.cx;
      const origCy = ep.cy;

      const stopProp = (e: Event) => {
        e.stopPropagation();
      };
      handleEl.addEventListener('mousedown', stopProp);
      handleEl.addEventListener('touchstart', stopProp);
      cleanups.push(() => {
        handleEl.removeEventListener('mousedown', stopProp);
        handleEl.removeEventListener('touchstart', stopProp);
      });

      const cleanup = createDragHandler({
        element: handleEl,
        svg: svg as unknown as SVGSVGElement,
        onMove: (dx, dy) => {
          handleEl.setAttribute('cx', String(origCx + dx));
          handleEl.setAttribute('cy', String(origCy + dy));

          if (connectorLine) {
            if (ep.name === 'from') {
              connectorLine.setAttribute('x1', String(origCx + dx));
              connectorLine.setAttribute('y1', String(origCy + dy));
            } else {
              connectorLine.setAttribute('x2', String(origCx + dx));
              connectorLine.setAttribute('y2', String(origCy + dy));
            }
          }
        },
        onEnd: (dx, dy, moved) => {
          handleEl.setAttribute('cx', String(origCx));
          handleEl.setAttribute('cy', String(origCy));

          if (connectorLine) {
            if (ep.name === 'from') {
              connectorLine.setAttribute('x1', String(origCx));
              connectorLine.setAttribute('y1', String(origCy));
            } else {
              connectorLine.setAttribute('x2', String(origCx));
              connectorLine.setAttribute('y2', String(origCy));
            }
          }

          if (moved) {
            const existingOffset = textAnnotation.connectorOffset?.[ep.name];
            const origEndDx = existingOffset?.dx ?? 0;
            const origEndDy = existingOffset?.dy ?? 0;
            onEdit({
              type: 'annotation-connector',
              element: elementRef.annotation(index, textAnnotation.id),
              annotation: textAnnotation,
              endpoint: ep.name,
              offset: { dx: origEndDx + dx, dy: origEndDy + dy },
            });
          }
        },
        setDragging,
      });

      cleanups.push(cleanup);
    }

    const showHandles = () => {
      for (const h of createdHandles) {
        h.setAttribute('opacity', '0.6');
      }
    };
    const hideHandles = () => {
      for (const h of createdHandles) {
        h.setAttribute('opacity', '0');
      }
    };

    annotationG.addEventListener('mouseenter', showHandles);
    annotationG.addEventListener('mouseleave', hideHandles);
    cleanups.push(() => {
      annotationG.removeEventListener('mouseenter', showHandles);
      annotationG.removeEventListener('mouseleave', hideHandles);
      for (const h of createdHandles) {
        h.remove();
      }
    });
  }

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}

/**
 * Wire drag on range and refline annotation labels.
 * Returns a cleanup function.
 */
export function wireAnnotationLabelDrag(
  svg: SVGElement,
  specAnnotations: Annotation[],
  onEdit: (edit: ElementEdit) => void,
  setDragging: (dragging: boolean) => void,
): () => void {
  const cleanups: Array<() => void> = [];

  const selectors = [
    '.oc-annotation-range .oc-annotation-label',
    '.oc-annotation-refline .oc-annotation-label',
  ];

  for (const selector of selectors) {
    const labels = svg.querySelectorAll(selector);

    for (const label of labels) {
      const annotationG = label.closest('.oc-annotation') as SVGGElement | null;
      if (!annotationG) continue;

      const indexStr = annotationG.getAttribute('data-annotation-index');
      if (indexStr === null) continue;

      const index = Number(indexStr);
      const specAnnotation = specAnnotations[index];
      if (!specAnnotation) continue;

      const labelEl = label as SVGTextElement;
      labelEl.style.cursor = 'grab';

      const isRange = specAnnotation.type === 'range';
      const existingLabelOffset = isRange
        ? (specAnnotation as RangeAnnotation).labelOffset
        : (specAnnotation as RefLineAnnotation).labelOffset;
      const origLabelDx = existingLabelOffset?.dx ?? 0;
      const origLabelDy = existingLabelOffset?.dy ?? 0;

      const cleanup = createDragHandler({
        element: labelEl,
        svg: svg as unknown as SVGSVGElement,
        onMove: (dx, dy) => {
          (labelEl as SVGElement & ElementCSSInlineStyle).style.transform =
            `translate(${dx}px, ${dy}px)`;
        },
        onEnd: (dx, dy, moved) => {
          (labelEl as SVGElement & ElementCSSInlineStyle).style.transform = '';

          if (moved) {
            if (isRange) {
              onEdit({
                type: 'range-label',
                element: elementRef.annotation(index, specAnnotation.id),
                annotation: specAnnotation as RangeAnnotation,
                labelOffset: { dx: origLabelDx + dx, dy: origLabelDy + dy },
              });
            } else {
              onEdit({
                type: 'refline-label',
                element: elementRef.annotation(index, specAnnotation.id),
                annotation: specAnnotation as RefLineAnnotation,
                labelOffset: { dx: origLabelDx + dx, dy: origLabelDy + dy },
              });
            }
          }
        },
        setDragging,
      });

      cleanups.push(cleanup);
    }
  }

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}

/**
 * Wire drag on chrome text elements (title, subtitle, source, byline, footer).
 * Returns a cleanup function.
 */
export function wireChromeDrag(
  svg: SVGElement,
  spec: ChartSpec | GraphSpec,
  onEdit: (edit: ElementEdit) => void,
  setDragging: (dragging: boolean) => void,
): () => void {
  const chromeTexts = svg.querySelectorAll('.oc-chrome text[data-chrome-key]');
  const cleanups: Array<() => void> = [];

  const chromeConfig = 'chrome' in spec ? spec.chrome : undefined;

  for (const el of chromeTexts) {
    const textEl = el as SVGTextElement;
    const key = textEl.getAttribute('data-chrome-key') as ChromeKey;
    if (!key) continue;

    const chromeEntry = chromeConfig?.[key];
    const existingOffset =
      typeof chromeEntry === 'object' && chromeEntry !== null ? chromeEntry.offset : undefined;
    const origChromeDx = existingOffset?.dx ?? 0;
    const origChromeDy = existingOffset?.dy ?? 0;

    textEl.style.cursor = 'grab';

    const cleanup = createDragHandler({
      element: textEl,
      svg: svg as unknown as SVGSVGElement,
      onMove: (dx, dy) => {
        (textEl as SVGElement & ElementCSSInlineStyle).style.transform =
          `translate(${dx}px, ${dy}px)`;
      },
      onEnd: (dx, dy, moved) => {
        (textEl as SVGElement & ElementCSSInlineStyle).style.transform = '';

        if (moved) {
          onEdit({
            type: 'chrome',
            key,
            text: textEl.textContent ?? '',
            offset: { dx: origChromeDx + dx, dy: origChromeDy + dy },
          });
        }
      },
      setDragging,
    });

    cleanups.push(cleanup);
  }

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}

/**
 * Wire drag on the legend group.
 * Returns a cleanup function.
 */
export function wireLegendDrag(
  svg: SVGElement,
  spec: ChartSpec | GraphSpec,
  onEdit: (edit: ElementEdit) => void,
  setDragging: (dragging: boolean) => void,
): () => void {
  // The color legend: it owns `spec.legend.offset`, which is what a drag writes
  // back. The size legend is not draggable and must not be picked up here.
  const legendG = svg.querySelector('.oc-legend:not(.oc-legend--size)') as SVGGElement | null;
  if (!legendG) return () => {};

  const cleanups: Array<() => void> = [];

  const legendConfig = 'legend' in spec ? spec.legend : undefined;
  const origLegendDx = legendConfig?.offset?.dx ?? 0;
  const origLegendDy = legendConfig?.offset?.dy ?? 0;

  legendG.style.cursor = 'grab';

  const cleanup = createDragHandler({
    element: legendG,
    svg: svg as unknown as SVGSVGElement,
    onMove: (dx, dy) => {
      (legendG as SVGElement & ElementCSSInlineStyle).style.transform =
        `translate(${dx}px, ${dy}px)`;
    },
    onEnd: (dx, dy, moved) => {
      (legendG as SVGElement & ElementCSSInlineStyle).style.transform = '';

      if (moved) {
        onEdit({ type: 'legend', offset: { dx: origLegendDx + dx, dy: origLegendDy + dy } });
      }
    },
    setDragging,
  });

  cleanups.push(cleanup);

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}

/**
 * Wire drag on series label elements (.oc-mark-label[data-series]).
 * Returns a cleanup function.
 */
export function wireSeriesLabelDrag(
  svg: SVGElement,
  spec: ChartSpec | GraphSpec,
  onEdit: (edit: ElementEdit) => void,
  setDragging: (dragging: boolean) => void,
): () => void {
  const labels = svg.querySelectorAll('.oc-mark-label');
  const cleanups: Array<() => void> = [];

  const rawLabels = 'labels' in spec ? spec.labels : undefined;
  const labelsConfig = typeof rawLabels === 'object' ? rawLabels : undefined;

  for (const label of labels) {
    const labelEl = label as SVGTextElement;
    const series =
      labelEl.getAttribute('data-series') ??
      labelEl.closest('[data-series]')?.getAttribute('data-series');
    if (!series) continue;

    const existingSeriesOffset = labelsConfig?.offsets?.[series];
    const origSeriesDx = existingSeriesOffset?.dx ?? 0;
    const origSeriesDy = existingSeriesOffset?.dy ?? 0;

    labelEl.style.cursor = 'grab';

    const cleanup = createDragHandler({
      element: labelEl,
      svg: svg as unknown as SVGSVGElement,
      onMove: (dx, dy) => {
        (labelEl as SVGElement & ElementCSSInlineStyle).style.transform =
          `translate(${dx}px, ${dy}px)`;
      },
      onEnd: (dx, dy, moved) => {
        (labelEl as SVGElement & ElementCSSInlineStyle).style.transform = '';

        if (moved) {
          onEdit({
            type: 'series-label',
            series,
            offset: { dx: origSeriesDx + dx, dy: origSeriesDy + dy },
          });
        }
      },
      setDragging,
    });

    cleanups.push(cleanup);
  }

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}
