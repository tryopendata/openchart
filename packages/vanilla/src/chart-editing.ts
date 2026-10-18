/**
 * Select and edit interaction for chart mounts: element selection with its
 * overlay, inline text editing, keyboard nudges, and translating gestures into
 * edit transactions for the host's `onEdit`.
 *
 * The session outlives individual renders. `attach()` wires a freshly rendered
 * SVG and restores the selection overlay; `detach()` tears that wiring down
 * before the next render replaces the SVG.
 */

import type {
  Annotation,
  ChartLayout,
  ChartSpec,
  ElementRef,
  LayerSpec,
  TextAnnotation,
} from '@opendata-ai/openchart-core';
import { applyEditTransaction, cssTokenDefault } from '@opendata-ai/openchart-core';
import {
  buildElementRef,
  findElementByRef,
  getEditableElements,
  getElementText,
  invertScale,
  isTextEditable,
  refsEqual,
  renderSelectionOverlay,
  withElementPath,
} from './interactions';
import { createAnnotationNudges } from './interactions/annotation-nudges';
import { annotationSource, editToTransaction } from './interactions/edit-transactions';
import type { GestureEdit } from './interactions/gesture-edit';
import type { MountOptions } from './mount-types';
import { createTextEditOverlay, createTextEditOverlayAtPosition } from './text-edit-overlay';

const EDITABLE_HOVER_CSS = `
.oc-editable-hover {
  outline: 1.5px solid ${cssTokenDefault('--oc-editable-hover', 'light')};
  outline-offset: 2px;
  border-radius: 2px;
}
`;

function makeEditable(svg: SVGElement): void {
  svg.setAttribute('tabindex', '0');
  svg.style.outline = 'none';

  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = EDITABLE_HOVER_CSS;
  svg.insertBefore(style, svg.firstChild);
}

/** Live mount state the session reads. Getters, because renders and updates replace it. */
export interface EditSessionContext {
  container: HTMLElement;
  options: MountOptions | undefined;
  selectable: boolean;
  editing: boolean;
  spec(): ChartSpec | LayerSpec;
  layout(): ChartLayout;
  svg(): SVGElement | null;
  destroyed(): boolean;
}

export interface EditSession {
  readonly selected: ElementRef | null;
  readonly isTextEditing: boolean;
  /** Turn a gesture into an edit transaction and hand it to `onEdit`. */
  emit(edit: GestureEdit): void;
  /** The current spec's annotations, as edit gestures index them. */
  annotations(): Annotation[];
  select(target: ElementRef): void;
  deselect(): void;
  /** Commit any keyboard nudge in progress. */
  flush(): void;
  setRevision(revision: MountOptions['revision']): void;
  /** Replace the selection from a controlled update; applied on the next attach. */
  setSelection(ref: ElementRef | null | undefined): void;
  /**
   * Annotation indices whose geometry an edit gesture already previewed, when
   * the update replacing `prevLayout` applies that edit. Clears the record.
   */
  takeSettled(prevLayout: ChartLayout, layoutOnly: boolean): ReadonlySet<number> | undefined;
  /** Wire selection and keyboard editing on a freshly rendered SVG. */
  attach(svg: SVGElement): void;
  /** Tear down the current SVG's wiring and any open text editor. */
  detach(): void;
  destroy(): void;
}

export function createEditSession(ctx: EditSessionContext): EditSession {
  const { container, options, selectable, editing } = ctx;

  let selectedElement: ElementRef | null =
    selectable && options?.selectedElement
      ? withElementPath(options.selectedElement, ctx.spec())
      : null;
  let overlayElement: SVGGElement | null = null;
  let isTextEditingActive = false;
  let textEditCleanup: (() => void) | null = null;
  let cleanupSelection: (() => void) | null = null;
  let cleanupKeyboardEdit: (() => void) | null = null;

  let editRevision = options?.revision;
  let settledEdit: { layout: ChartLayout; indices: ReadonlySet<number> } | null = null;
  const annotationNudges = createAnnotationNudges(
    () => ({
      layout: ctx.layout(),
      spec: ctx.spec(),
      svg: ctx.svg(),
      selected: selectedElement,
    }),
    emitEdit,
  );

  function emitEdit(edit: GestureEdit): void {
    const spec = ctx.spec();
    const tx = editToTransaction(spec, edit, editRevision);
    if (!tx) return;
    if (!applyEditTransaction(spec, tx).ok) return;
    // Placement gestures previewed the committed geometry, so the update that
    // applies them must not tween from the pre-gesture layout (release would jump).
    if (
      'element' in edit &&
      edit.element.type === 'annotation' &&
      edit.type !== 'delete' &&
      edit.type !== 'text-edit'
    ) {
      settledEdit = { layout: ctx.layout(), indices: new Set([edit.element.index]) };
    }
    options?.onEdit?.(tx);
  }

  function getSpecAnnotations(): Annotation[] {
    return annotationSource(ctx.spec()).annotations;
  }

  function closeTextEditor(): void {
    if (textEditCleanup) {
      textEditCleanup();
      textEditCleanup = null;
      isTextEditingActive = false;
    }
  }

  function selectElement(target: ElementRef): void {
    annotationNudges.flush();
    const svgElement = ctx.svg();
    if (!selectable || !svgElement) return;
    const ref = withElementPath(target, ctx.spec());

    if (!findElementByRef(svgElement, ref)) return;

    if (selectedElement && !refsEqual(selectedElement, ref)) {
      deselectElement();
    }

    selectedElement = ref;
    overlayElement = renderSelectionOverlay(svgElement, ref, ctx.layout());
    options?.onSelect?.(ref);

    (svgElement as SVGSVGElement).focus();
  }

  function deselectElement(): void {
    annotationNudges.flush();
    if (!selectedElement) return;

    if (isTextEditingActive) closeTextEditor();

    const prev = selectedElement;
    selectedElement = null;

    if (overlayElement?.parentNode) {
      overlayElement.parentNode.removeChild(overlayElement);
    }
    overlayElement = null;

    options?.onDeselect?.(prev);
  }

  function enterTextEditing(): void {
    annotationNudges.flush();
    const svgElement = ctx.svg();
    if (!svgElement || !selectedElement || isTextEditingActive) return;

    const specAnnotations = getSpecAnnotations();
    if (!isTextEditable(selectedElement, specAnnotations)) return;

    const currentText = getElementText(selectedElement, ctx.spec());
    if (currentText === null) return;

    const target = findElementByRef(svgElement, selectedElement);
    if (!target) return;

    const textEl = target.tagName === 'text' ? target : target.querySelector('text');
    if (!textEl) return;

    isTextEditingActive = true;
    const editRef = selectedElement;

    const overlay = createTextEditOverlay({
      container,
      svg: svgElement as SVGSVGElement,
      targetElement: textEl as SVGElement,
      currentText,
      onCommit: (newText: string) => {
        isTextEditingActive = false;
        textEditCleanup = null;

        if (newText !== currentText) {
          emitEdit({
            type: 'text-edit',
            element: editRef,
            oldText: currentText,
            newText,
          });
        }
      },
      onCancel: () => {
        isTextEditingActive = false;
        textEditCleanup = null;
      },
    });

    textEditCleanup = overlay.destroy;
  }

  function wireSelectionEvents(svg: SVGElement): () => void {
    const cleanups: Array<() => void> = [];

    const handleClick = (e: Event) => {
      const mouseEvent = e as MouseEvent;
      const target = mouseEvent.target as Element;

      if (isTextEditingActive) return;

      const specAnnotations = getSpecAnnotations();
      const ref = buildElementRef(target, specAnnotations);

      if (ref) {
        selectElement(ref);
      } else {
        deselectElement();
      }
    };

    svg.addEventListener('click', handleClick);
    cleanups.push(() => svg.removeEventListener('click', handleClick));

    const handleMouseEnter = (e: Event) => {
      const target = (e.target as Element).closest(
        '[data-annotation-index], [data-chrome-key], .oc-legend:not(.oc-legend--size), [data-legend-index]',
      );
      if (target) {
        (target as SVGElement).classList.add('oc-editable-hover');
      }
    };

    const handleMouseLeave = (e: Event) => {
      const target = (e.target as Element).closest('.oc-editable-hover');
      if (target) {
        (target as SVGElement).classList.remove('oc-editable-hover');
      }
    };

    svg.addEventListener('mouseenter', handleMouseEnter, true);
    svg.addEventListener('mouseleave', handleMouseLeave, true);
    cleanups.push(() => {
      svg.removeEventListener('mouseenter', handleMouseEnter, true);
      svg.removeEventListener('mouseleave', handleMouseLeave, true);
    });

    const handleDblClick = (e: Event) => {
      const mouseEvent = e as MouseEvent;
      const target = mouseEvent.target as Element;
      const specAnnotations = getSpecAnnotations();
      const ref = buildElementRef(target, specAnnotations);

      if (!editing) return;

      if (ref && isTextEditable(ref, specAnnotations)) {
        if (!refsEqual(selectedElement, ref)) {
          selectElement(ref);
        }
        enterTextEditing();
        return;
      }

      // Double-click on empty canvas: create a new annotation
      const layout = ctx.layout();
      if (!ref && layout?.xInvert && layout?.yInvert) {
        const svgEl = svg as SVGSVGElement;
        const viewBox = svgEl.viewBox?.baseVal;
        const svgRect = svgEl.getBoundingClientRect();
        if (!viewBox || !svgRect.width || !svgRect.height) return;

        const vbScaleX = viewBox.width / svgRect.width;
        const vbScaleY = viewBox.height / svgRect.height;
        const svgX = (mouseEvent.clientX - svgRect.left) * vbScaleX;
        const svgY = (mouseEvent.clientY - svgRect.top) * vbScaleY;

        const area = layout.area;
        if (svgX < area.x || svgX > area.x + area.width) return;
        if (svgY < area.y || svgY > area.y + area.height) return;

        const dataX = invertScale(layout.xInvert, svgX);
        const dataY = invertScale(layout.yInvert, svgY);

        isTextEditingActive = true;
        const overlay = createTextEditOverlayAtPosition({
          container,
          svg: svgEl,
          position: { x: svgX, y: svgY },
          onCommit: (text: string) => {
            isTextEditingActive = false;
            textEditCleanup = null;
            const annotation: TextAnnotation = { type: 'text', x: dataX, y: dataY, text };
            emitEdit({ type: 'add', annotation });
          },
          onCancel: () => {
            isTextEditingActive = false;
            textEditCleanup = null;
          },
        });
        textEditCleanup = overlay.destroy;
      }
    };

    svg.addEventListener('dblclick', handleDblClick);
    cleanups.push(() => svg.removeEventListener('dblclick', handleDblClick));

    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }

  function wireKeyboardEditEvents(svg: SVGElement): () => void {
    const handleKeyDown = (e: KeyboardEvent) => {
      const specAnnotations = getSpecAnnotations();
      if (!isTextEditingActive && editing && annotationNudges.keydown(e)) return;
      if (e.key === 'Escape' || e.key === 'Delete' || e.key === 'Backspace')
        annotationNudges.flush();

      switch (e.key) {
        case 'Delete':
        case 'Backspace': {
          if (editing && selectedElement && !isTextEditingActive) {
            e.preventDefault();
            emitEdit({ type: 'delete', element: selectedElement });
          }
          break;
        }

        case 'Escape': {
          e.preventDefault();
          if (isTextEditingActive && textEditCleanup) {
            closeTextEditor();
          } else if (selectedElement) {
            deselectElement();
          }
          break;
        }

        case 'Tab': {
          if (!isTextEditingActive) {
            const editables = getEditableElements(ctx.spec(), ctx.layout());
            if (!editables.length) break;
            annotationNudges.flush();
            const currentIndex = editables.findIndex((r) => refsEqual(r, selectedElement));
            const nextIndex = e.shiftKey ? currentIndex - 1 : currentIndex + 1;
            // Past either end (or Shift+Tab with nothing selected), release the
            // selection and let native Tab move focus out of the chart.
            if (
              nextIndex < 0 ||
              nextIndex >= editables.length ||
              (e.shiftKey && currentIndex < 0)
            ) {
              if (selectedElement) deselectElement();
              break;
            }
            e.preventDefault();
            selectElement(editables[nextIndex]);
          }
          break;
        }

        case 'Enter': {
          if (editing && selectedElement && !isTextEditingActive) {
            if (isTextEditable(selectedElement, specAnnotations)) {
              e.preventDefault();
              enterTextEditing();
            }
          }
          break;
        }
      }
    };

    svg.addEventListener('keydown', handleKeyDown);
    const flushNudges = () => annotationNudges.flush();
    const releaseNudge = (event: KeyboardEvent) => annotationNudges.keyup(event);
    svg.addEventListener('keyup', releaseNudge);
    // A nudge held while focus leaves never sees its keyup; commit it instead of stranding it.
    svg.addEventListener('focusout', flushNudges);
    window.addEventListener('blur', flushNudges);
    const startGesture = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Element;
      const ref = buildElementRef(target, getSpecAnnotations());
      const previousLayout = ctx.layout();
      // Capture the specific handle before a controlled update replaces it.
      const role = target.closest('.oc-connector-handle, .oc-anchor-handle, .oc-annotation-label');
      const roleClass = role?.getAttribute('class');
      const endpoint = role?.getAttribute('data-endpoint');
      annotationNudges.flush();
      const svgElement = ctx.svg();
      if (ctx.destroyed() || !ref || !svgElement || ctx.layout() === previousLayout) return;
      const group = findElementByRef(svgElement, ref);
      if (!group) return;
      const replacement = roleClass
        ? ([...group.querySelectorAll('*')].find(
            (el) =>
              el.getAttribute('class') === roleClass &&
              el.getAttribute('data-endpoint') === endpoint,
          ) ?? group)
        : group;
      event.stopImmediatePropagation();
      event.preventDefault();
      const init = { bubbles: true, cancelable: true };
      replacement.dispatchEvent(
        event.type === 'mousedown'
          ? new MouseEvent('mousedown', {
              ...init,
              clientX: (event as MouseEvent).clientX,
              clientY: (event as MouseEvent).clientY,
              button: (event as MouseEvent).button,
            })
          : new TouchEvent('touchstart', {
              ...init,
              touches: [...(event as TouchEvent).touches],
              changedTouches: [...(event as TouchEvent).changedTouches],
            }),
      );
    };
    svg.addEventListener('mousedown', startGesture, true);
    svg.addEventListener('touchstart', startGesture, true);
    document.addEventListener('pointercancel', flushNudges, true);
    document.addEventListener('touchcancel', flushNudges, true);

    return () => {
      svg.removeEventListener('keydown', handleKeyDown);
      svg.removeEventListener('keyup', releaseNudge);
      svg.removeEventListener('focusout', flushNudges);
      window.removeEventListener('blur', flushNudges);
      svg.removeEventListener('mousedown', startGesture, true);
      svg.removeEventListener('touchstart', startGesture, true);
      document.removeEventListener('pointercancel', flushNudges, true);
      document.removeEventListener('touchcancel', flushNudges, true);
    };
  }

  function attach(svg: SVGElement): void {
    makeEditable(svg);
    cleanupSelection = wireSelectionEvents(svg);
    cleanupKeyboardEdit = wireKeyboardEditEvents(svg);

    if (selectedElement) {
      const target = findElementByRef(svg, selectedElement);
      if (target) {
        overlayElement = renderSelectionOverlay(svg, selectedElement, ctx.layout());
      } else {
        selectedElement = null;
        overlayElement = null;
      }
    }
  }

  function detach(): void {
    cleanupSelection?.();
    cleanupSelection = null;
    cleanupKeyboardEdit?.();
    cleanupKeyboardEdit = null;
    closeTextEditor();
    overlayElement = null;
  }

  return {
    get selected() {
      return selectedElement;
    },
    get isTextEditing() {
      return isTextEditingActive;
    },
    emit: emitEdit,
    annotations: getSpecAnnotations,
    select: selectElement,
    deselect: deselectElement,
    flush: () => annotationNudges.flush(),
    setRevision(revision) {
      editRevision = revision;
    },
    setSelection(ref) {
      selectedElement = selectable && ref ? withElementPath(ref, ctx.spec()) : null;
    },
    takeSettled(prevLayout, layoutOnly) {
      const settled =
        settledEdit?.layout === prevLayout && !layoutOnly ? settledEdit.indices : undefined;
      settledEdit = null;
      return settled;
    },
    attach,
    detach,
    destroy() {
      detach();
      selectedElement = null;
    },
  };
}
