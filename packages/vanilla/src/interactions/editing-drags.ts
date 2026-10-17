import {
  type Annotation,
  type ChartLayout,
  type ChartSpec,
  type ChromeKey,
  elementRef,
  type GraphSpec,
  type RangeAnnotation,
  type RefLineAnnotation,
  type ResolvedAnnotation,
  type TextAnnotation,
} from '@opendata-ai/openchart-core';
import {
  createAnnotationEditContext,
  inverseLabelPlacement,
  previewAnnotationMove,
  previewConnectorOffset,
} from '@opendata-ai/openchart-engine';
import { updateAnnotationGeometry } from '../renderers/annotations';
import { createDragHandler } from './drag-handler';
import type { GestureEdit } from './gesture-edit';
import { invertScale } from './invert';
import { buildElementRef } from './selection';

/**
 * Wire drag-to-reposition on text annotation labels.
 * Returns a cleanup function to remove all listeners.
 */
export function wireAnnotationDrag(
  svg: SVGElement,
  specAnnotations: Annotation[],
  onEdit: ((edit: GestureEdit) => void) | undefined,
  setDragging: (dragging: boolean) => void,
  layout: ChartLayout,
  spec: unknown,
): () => void {
  const cleanups: Array<() => void> = [];
  const ctx = createAnnotationEditContext(layout, spec);
  for (const group of svg.querySelectorAll<SVGGElement>('.oc-annotation-text')) {
    const ref = buildElementRef(group, specAnnotations);
    if (ref?.type !== 'annotation') continue;
    const authored = specAnnotations[ref.index];
    if (authored?.type !== 'text') continue;
    let initial: ResolvedAnnotation;
    try {
      initial = previewAnnotationMove(ctx, ref, { dx: 0, dy: 0 });
    } catch {
      continue;
    }
    if (!initial.label?.visible || initial.footnoteIndex !== undefined) continue;
    const original = initial;
    let previewed = false;
    const restore = () => {
      // Preserve the click target when a pointer gesture never changed geometry.
      // Replacing label children on mouseup prevents the browser's click bubbling.
      if (!previewed) return;
      updateAnnotationGeometry(group, original, layout.theme.colors.neutral.surface);
      previewed = false;
    };
    group.style.cursor = 'grab';
    cleanups.push(
      createDragHandler({
        element: group,
        svg: svg as SVGSVGElement,
        setDragging,
        animationFrame: true,
        onMove: (dx, dy) => {
          previewed = true;
          updateAnnotationGeometry(
            group,
            previewAnnotationMove(ctx, ref, { dx, dy }),
            layout.theme.colors.neutral.surface,
          );
        },
        onCancel: restore,
        onEnd: (dx, dy, moved) => {
          restore();
          if (!moved) return;
          const preview = previewAnnotationMove(ctx, ref, { dx, dy });
          const placement = inverseLabelPlacement(ctx, ref, preview.bounds!);
          onEdit?.({
            type: 'annotation',
            element: { ...ref, path: `${ref.path}/offset` },
            annotation: authored,
            offset: placement.offset!,
            anchor: placement.anchor,
            responsive: false,
          });
        },
      }),
    );
  }
  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}

/**
 * Wire drag on connector endpoint handles for text annotations.
 * Returns a cleanup function that removes handles and all listeners.
 */
export function wireConnectorEndpointDrag(
  svg: SVGElement,
  specAnnotations: Annotation[],
  onEdit: (edit: GestureEdit) => void,
  setDragging: (dragging: boolean) => void,
  layout: ChartLayout,
  spec: unknown,
): () => void {
  const cleanups: Array<() => void> = [];
  const ctx = createAnnotationEditContext(layout, spec);
  for (const group of svg.querySelectorAll<SVGGElement>('.oc-annotation-text')) {
    const ref = buildElementRef(group, specAnnotations);
    if (ref?.type !== 'annotation') continue;
    const authored = specAnnotations[ref.index];
    if (authored?.type !== 'text') continue;
    let original: ResolvedAnnotation;
    try {
      original = previewAnnotationMove(ctx, ref, { dx: 0, dy: 0 });
    } catch {
      continue;
    }
    const connector = original.label?.connector;
    if (!connector || original.footnoteIndex !== undefined) continue;
    const handles: SVGCircleElement[] = [];
    for (const end of ['from', 'to'] as const) {
      const point = connector[end];
      const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      handle.setAttribute('class', 'oc-connector-handle');
      handle.setAttribute('data-endpoint', end);
      handle.setAttribute('cx', String(point.x));
      handle.setAttribute('cy', String(point.y));
      handle.setAttribute('r', '4');
      handle.setAttribute('opacity', '0');
      handle.setAttribute('fill', 'currentColor');
      handle.setAttribute('stroke', 'currentColor');
      handle.style.cursor = 'grab';
      group.appendChild(handle);
      handles.push(handle);
      const stop = (event: Event) => event.stopPropagation();
      handle.addEventListener('mousedown', stop);
      handle.addEventListener('touchstart', stop);
      const restore = () => {
        updateAnnotationGeometry(group, original, layout.theme.colors.neutral.surface);
        handle.setAttribute('cx', String(point.x));
        handle.setAttribute('cy', String(point.y));
      };
      cleanups.push(
        createDragHandler({
          element: handle,
          svg: svg as SVGSVGElement,
          setDragging,
          animationFrame: true,
          onMove: (dx, dy) => {
            const preview = previewConnectorOffset(ctx, ref, end, { dx, dy });
            updateAnnotationGeometry(group, preview, layout.theme.colors.neutral.surface);
            const position = preview.label?.connector?.[end] ?? point;
            handle.setAttribute('cx', String(position.x));
            handle.setAttribute('cy', String(position.y));
          },
          onCancel: restore,
          onEnd: (dx, dy, moved) => {
            restore();
            if (!moved) return;
            const previous = authored.connectorOffset?.[end];
            onEdit({
              type: 'annotation-connector',
              element: { ...ref, path: `${ref.path}/connectorOffset/${end}` },
              annotation: authored,
              endpoint: end,
              offset: { dx: (previous?.dx ?? 0) + dx, dy: (previous?.dy ?? 0) + dy },
            });
          },
        }),
      );
      cleanups.push(() => {
        handle.removeEventListener('mousedown', stop);
        handle.removeEventListener('touchstart', stop);
        handle.remove();
      });
    }
    const show = () =>
      handles.forEach((handle) => {
        handle.setAttribute('opacity', '0.6');
      });
    const hide = () =>
      handles.forEach((handle) => {
        handle.setAttribute('opacity', '0');
      });
    group.addEventListener('mouseenter', show);
    group.addEventListener('mouseleave', hide);
    cleanups.push(() => {
      group.removeEventListener('mouseenter', show);
      group.removeEventListener('mouseleave', hide);
    });
  }
  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}

/**
 * Wire drag on range and refline annotation labels.
 * Returns a cleanup function.
 */
export function wireAnnotationLabelDrag(
  svg: SVGElement,
  specAnnotations: Annotation[],
  onEdit: (edit: GestureEdit) => void,
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
        onCancel: () => {
          labelEl.style.transform = '';
        },
        onEnd: (dx, dy, moved) => {
          (labelEl as SVGElement & ElementCSSInlineStyle).style.transform = '';

          if (moved) {
            if (isRange) {
              onEdit({
                type: 'range-label',
                element: elementRef.annotation(
                  index,
                  specAnnotation.id,
                  `${annotationG.getAttribute('data-annotation-path') ?? `/annotations/${index}`}/labelOffset`,
                ),
                annotation: specAnnotation as RangeAnnotation,
                labelOffset: { dx: origLabelDx + dx, dy: origLabelDy + dy },
              });
            } else {
              onEdit({
                type: 'refline-label',
                element: elementRef.annotation(
                  index,
                  specAnnotation.id,
                  `${annotationG.getAttribute('data-annotation-path') ?? `/annotations/${index}`}/labelOffset`,
                ),
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
  onEdit: (edit: GestureEdit) => void,
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
      onCancel: () => {
        textEl.style.transform = '';
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
  onEdit: (edit: GestureEdit) => void,
  setDragging: (dragging: boolean) => void,
): () => void {
  // The color legend: it owns `spec.legend.offset`, which is what a drag writes
  // back. The size legend is not draggable and must not be picked up here.
  const legendG = svg.querySelector('.oc-legend:not(.oc-legend--size)') as SVGGElement | null;
  if (!legendG) return () => {};

  const cleanups: Array<() => void> = [];

  const legendConfig = 'legend' in spec ? spec.legend : undefined;
  // Only the chart LegendConfig object carries a draggable `offset`; the graph
  // legend union (boolean | { interactive; counts }) does not.
  const legendOffset =
    legendConfig && typeof legendConfig === 'object' && 'offset' in legendConfig
      ? legendConfig.offset
      : undefined;
  const origLegendDx = legendOffset?.dx ?? 0;
  const origLegendDy = legendOffset?.dy ?? 0;

  legendG.style.cursor = 'grab';

  const cleanup = createDragHandler({
    element: legendG,
    svg: svg as unknown as SVGSVGElement,
    onMove: (dx, dy) => {
      (legendG as SVGElement & ElementCSSInlineStyle).style.transform =
        `translate(${dx}px, ${dy}px)`;
    },
    onCancel: () => {
      legendG.style.transform = '';
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
 * Wire drag on annotation anchor handles (the data-point dot).
 * Dragging the anchor repositions the annotation in data space, emitting
 * new x/y values via onEdit. Returns a cleanup function.
 */
export function wireAnchorDrag(
  svg: SVGElement,
  specAnnotations: Annotation[],
  layout: ChartLayout,
  onEdit: ((edit: GestureEdit) => void) | undefined,
  setDragging: (d: boolean) => void,
): () => void {
  if (!onEdit || !layout.xInvert || !layout.yInvert) return () => {};

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

    const resolved = layout.annotations.find((a) => a.specIndex === index);
    if (!resolved?.dot) continue;

    const anchorX = resolved.dot.x;
    const anchorY = resolved.dot.y;

    const handleEl = document.createElementNS(SVG_NS, 'circle') as SVGCircleElement;
    handleEl.setAttribute('class', 'oc-anchor-handle');
    handleEl.setAttribute('cx', String(anchorX));
    handleEl.setAttribute('cy', String(anchorY));
    handleEl.setAttribute('r', '4');
    handleEl.setAttribute('opacity', '0');
    handleEl.setAttribute('fill', 'currentColor');
    handleEl.setAttribute('stroke', 'currentColor');
    handleEl.style.cursor = 'grab';
    annotationG.appendChild(handleEl);

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
        handleEl.setAttribute('cx', String(anchorX + dx));
        handleEl.setAttribute('cy', String(anchorY + dy));
      },
      onCancel: () => {
        handleEl.setAttribute('cx', String(anchorX));
        handleEl.setAttribute('cy', String(anchorY));
      },
      onEnd: (dx, dy, moved) => {
        handleEl.setAttribute('cx', String(anchorX));
        handleEl.setAttribute('cy', String(anchorY));

        if (moved) {
          const newX = invertScale(layout.xInvert!, anchorX + dx);
          const newY = invertScale(layout.yInvert!, anchorY + dy);
          onEdit({
            type: 'annotation-anchor',
            element: elementRef.annotation(
              index,
              textAnnotation.id,
              annotationG.getAttribute('data-annotation-path') ?? `/annotations/${index}`,
            ),
            annotation: textAnnotation,
            x: newX,
            y: newY,
          });
        }
      },
      setDragging,
    });

    cleanups.push(cleanup);

    const showHandle = () => {
      handleEl.setAttribute('opacity', '0.6');
    };
    const hideHandle = () => {
      handleEl.setAttribute('opacity', '0');
    };

    annotationG.addEventListener('mouseenter', showHandle);
    annotationG.addEventListener('mouseleave', hideHandle);
    cleanups.push(() => {
      annotationG.removeEventListener('mouseenter', showHandle);
      annotationG.removeEventListener('mouseleave', hideHandle);
      handleEl.remove();
    });
  }

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}
