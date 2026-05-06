import type { ChartLayout, TooltipContent } from '@opendata-ai/openchart-core';
import type { TooltipManager } from '../tooltip';

/**
 * Wire keyboard navigation on the SVG element.
 * Arrow keys move focus between mark elements. Enter/Space shows tooltip.
 * Escape hides tooltip. Returns a cleanup function.
 */
export function wireKeyboardNav(
  svg: SVGElement,
  container: HTMLElement,
  tooltipDescriptors: Map<string, TooltipContent>,
  tooltipManager: TooltipManager,
  layout: ChartLayout,
): () => void {
  container.setAttribute('tabindex', '0');
  container.setAttribute('aria-roledescription', 'chart');
  container.setAttribute('aria-label', layout.a11y.altText);

  const markElements: SVGElement[] = [];
  const allMarkEls = svg.querySelectorAll('[data-mark-id]');
  for (const el of allMarkEls) {
    const markId = el.getAttribute('data-mark-id');
    if (markId && tooltipDescriptors.has(markId)) {
      markElements.push(el as SVGElement);
    }
  }

  let focusIndex = -1;

  function highlightMark(index: number): void {
    if (focusIndex >= 0 && focusIndex < markElements.length) {
      markElements[focusIndex].classList.remove('oc-mark-focused');
      markElements[focusIndex].removeAttribute('aria-selected');
    }

    focusIndex = index;

    if (focusIndex >= 0 && focusIndex < markElements.length) {
      const el = markElements[focusIndex];
      el.classList.add('oc-mark-focused');
      el.setAttribute('aria-selected', 'true');
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
        highlightMark(next);
        showTooltipForFocused();
        break;
      }
      case 'ArrowLeft':
      case 'ArrowUp': {
        e.preventDefault();
        const prev = focusIndex > 0 ? focusIndex - 1 : markElements.length - 1;
        highlightMark(prev);
        showTooltipForFocused();
        break;
      }
      case 'Enter':
      case ' ': {
        e.preventDefault();
        if (focusIndex >= 0) {
          showTooltipForFocused();
        } else if (markElements.length > 0) {
          highlightMark(0);
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

  container.addEventListener('keydown', handleKeyDown);

  return () => {
    container.removeEventListener('keydown', handleKeyDown);
    container.removeAttribute('tabindex');
    container.removeAttribute('aria-roledescription');
    container.removeAttribute('aria-label');
  };
}
