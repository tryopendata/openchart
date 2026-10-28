import type { ChartLayout, MarkFocusEvent, TooltipContent } from '@opendata-ai/openchart-core';
import type { TooltipManager } from '../tooltip';
import type { CrosshairController } from './crosshair';

/**
 * Wire keyboard navigation on the SVG element.
 * Arrow keys move focus between mark elements. Enter/Space shows tooltip.
 * Escape hides tooltip. Returns a cleanup function.
 *
 * Line and area charts have no per-mark tooltip descriptors (their values live
 * on the snap overlay), so they drive the crosshair instead: left/right step
 * snapped x positions, up/down cycle the raised series at that x. The gate is
 * an empty descriptor map, not the absence of `[data-mark-id]` -- line groups
 * do carry mark ids.
 */
export function wireKeyboardNav(
  svg: SVGElement,
  container: HTMLElement,
  tooltipDescriptors: Map<string, TooltipContent>,
  tooltipManager: TooltipManager,
  layout: ChartLayout,
  options: {
    crosshair?: CrosshairController | null;
    onFocus?: (event: MarkFocusEvent) => void;
  } = {},
): () => void {
  const { crosshair, onFocus } = options;
  container.setAttribute('tabindex', '0');
  container.setAttribute('aria-roledescription', 'chart');
  container.setAttribute('aria-label', layout.a11y.altText);

  // A click or tap focuses the container too. Only keyboard focus starts
  // navigation; a pointer keeps its own position. Touch focuses after
  // pointerup, so the flag lives until the focus, click or cancel that ends it.
  let pointerFocus = false;
  const handlePointerDown = () => {
    pointerFocus = true;
  };
  const clearPointerFocus = () => {
    pointerFocus = false;
  };
  const pointerEvents = ['click', 'pointercancel'] as const;
  container.addEventListener('pointerdown', handlePointerDown);
  for (const type of pointerEvents) container.addEventListener(type, clearPointerFocus);
  const removePointerListeners = () => {
    container.removeEventListener('pointerdown', handlePointerDown);
    for (const type of pointerEvents) container.removeEventListener(type, clearPointerFocus);
  };

  if (tooltipDescriptors.size === 0 && crosshair) {
    let lastFocus: { datum: Record<string, unknown>; series: string } | null = null;
    const announceCrosshair = (event: FocusEvent | KeyboardEvent) => {
      const focused = crosshair.focusedMark;
      if (!focused || (lastFocus?.datum === focused.datum && lastFocus.series === focused.series))
        return;
      lastFocus = focused;
      const element = svg.querySelector<SVGElement>(`[data-mark-id="${focused.markId}"]`);
      const mark = layout.marks[Number(focused.markId.slice(focused.markId.lastIndexOf('-') + 1))];
      if (element && mark)
        onFocus?.({
          datum: focused.datum,
          series: focused.series === '__default__' ? undefined : focused.series,
          key: `${mark.key ?? focused.markId}:${crosshair.currentIndex}`,
          description: element.getAttribute('aria-label') ?? undefined,
          element,
          event,
        });
    };
    const handleCrosshairFocus = (event: FocusEvent) => {
      if (pointerFocus) return clearPointerFocus();
      crosshair.hide(true);
      crosshair.stepTo(0);
      crosshair.cycleSeries(1);
      announceCrosshair(event);
    };
    // No local step index: the crosshair owns it, so ArrowRight after the
    // pointer left the chart at index 8 goes to 9 rather than restarting.
    const handleCrosshairKeys = (e: KeyboardEvent) => {
      const step = crosshair.currentIndex;
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          crosshair.stepTo(step + 1);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          crosshair.stepTo(step <= 0 ? crosshair.snapCount - 1 : step - 1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (step < 0) crosshair.stepTo(0);
          crosshair.cycleSeries(1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (step < 0) crosshair.stepTo(0);
          crosshair.cycleSeries(-1);
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          crosshair.showCurrent();
          break;
        case 'Escape':
          e.preventDefault();
          lastFocus = null;
          crosshair.hide(true);
          break;
      }
      announceCrosshair(e);
    };

    // Tabbing away leaves the crosshair and its tooltip painted otherwise.
    const handleCrosshairBlur = () => {
      crosshair.hide(true);
      lastFocus = null;
    };

    container.addEventListener('focus', handleCrosshairFocus);
    container.addEventListener('keydown', handleCrosshairKeys);
    container.addEventListener('blur', handleCrosshairBlur);

    return () => {
      container.removeEventListener('focus', handleCrosshairFocus);
      container.removeEventListener('keydown', handleCrosshairKeys);
      container.removeEventListener('blur', handleCrosshairBlur);
      removePointerListeners();
      container.removeAttribute('tabindex');
      container.removeAttribute('aria-roledescription');
      container.removeAttribute('aria-label');
    };
  }

  const markElements: SVGElement[] = [];
  const allMarkEls = svg.querySelectorAll('[data-mark-id]');
  for (const el of allMarkEls) {
    const markId = el.getAttribute('data-mark-id');
    if (markId && tooltipDescriptors.has(markId)) {
      markElements.push(el as SVGElement);
    }
  }

  let focusIndex = -1;

  function highlightMark(index: number, event?: FocusEvent | KeyboardEvent): void {
    const changed = focusIndex !== index;
    if (focusIndex >= 0 && focusIndex < markElements.length) {
      markElements[focusIndex].classList.remove('oc-mark-focused');
      markElements[focusIndex].removeAttribute('aria-selected');
    }

    focusIndex = index;

    if (focusIndex >= 0 && focusIndex < markElements.length) {
      const el = markElements[focusIndex];
      el.classList.add('oc-mark-focused');
      el.setAttribute('aria-selected', 'true');
      if (changed && event && onFocus) {
        const id = el.getAttribute('data-mark-id')!;
        const mark = layout.marks[Number(id.slice(id.lastIndexOf('-') + 1))];
        if (mark)
          onFocus({
            datum: Array.isArray(mark.data) ? (mark.data[0] ?? {}) : mark.data,
            series:
              ('seriesKey' in mark ? mark.seriesKey : undefined) ??
              el.getAttribute('data-series') ??
              undefined,
            key: mark.key ?? id,
            description: el.getAttribute('aria-label') ?? undefined,
            element: el,
            event,
          });
      }
    }
  }

  function showTooltipForFocused(): void {
    if (focusIndex < 0 || focusIndex >= markElements.length) return;

    const el = markElements[focusIndex];
    const markId = el.getAttribute('data-mark-id');
    if (!markId) return;

    const content = tooltipDescriptors.get(markId);
    if (!content) return;

    const bbox = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const x = bbox.left + bbox.width / 2 - containerRect.left;
    const y = bbox.top - containerRect.top;
    tooltipManager.show(content, x, y);
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (markElements.length === 0) return;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown': {
        e.preventDefault();
        const next = focusIndex < markElements.length - 1 ? focusIndex + 1 : 0;
        highlightMark(next, e);
        showTooltipForFocused();
        break;
      }
      case 'ArrowLeft':
      case 'ArrowUp': {
        e.preventDefault();
        const prev = focusIndex > 0 ? focusIndex - 1 : markElements.length - 1;
        highlightMark(prev, e);
        showTooltipForFocused();
        break;
      }
      case 'Enter':
      case ' ': {
        e.preventDefault();
        if (focusIndex >= 0) {
          showTooltipForFocused();
        } else if (markElements.length > 0) {
          highlightMark(0, e);
          showTooltipForFocused();
        }
        break;
      }
      case 'Escape': {
        e.preventDefault();
        tooltipManager.hide();
        highlightMark(-1);
        break;
      }
    }
  };

  // Tabbing away leaves the tooltip and the focus ring painted otherwise.
  const handleBlur = () => {
    tooltipManager.hide();
    highlightMark(-1);
  };

  const handleFocus = (event: FocusEvent) => {
    if (pointerFocus) return clearPointerFocus();
    if (markElements.length) highlightMark(0, event);
  };
  container.addEventListener('focus', handleFocus);
  container.addEventListener('keydown', handleKeyDown);
  container.addEventListener('blur', handleBlur);

  return () => {
    container.removeEventListener('focus', handleFocus);
    container.removeEventListener('keydown', handleKeyDown);
    container.removeEventListener('blur', handleBlur);
    removePointerListeners();
    container.removeAttribute('tabindex');
    container.removeAttribute('aria-roledescription');
    container.removeAttribute('aria-label');
  };
}
