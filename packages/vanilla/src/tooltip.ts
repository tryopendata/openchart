/**
 * Tooltip manager: creates and positions a floating tooltip element.
 *
 * Shows tooltip content near the mouse/touch position with viewport
 * edge avoidance via @floating-ui/dom. Touch support via tap-to-show,
 * tap-outside-to-hide.
 */

import type { Placement } from '@floating-ui/dom';
import { computePosition, flip, offset, shift } from '@floating-ui/dom';
import type { TooltipContent } from '@opendata-ai/openchart-core';

export interface TooltipShowOptions {
  /**
   * Floating-ui placement. Defaults to 'bottom-start' for mark hover
   * (the legacy behavior). Line/area snap-tooltips pass 'right-start'
   * so the card sits beside the snapped point and flips to 'left-start'
   * via the flip middleware when crowding the right edge.
   */
  placement?: Placement;
}

/**
 * Content accepted by {@link TooltipManager.show}. A structured
 * {@link TooltipContent} is rendered by the manager; `{ text }` is inserted as
 * plain text (escaped via textContent); `{ element }` is a caller-owned node
 * trusted verbatim (the host owns sanitization).
 */
export type TooltipInput = TooltipContent | { text: string } | { element: HTMLElement };

export interface TooltipManager {
  /** Show the tooltip with content at a given position. */
  show(content: TooltipInput, x: number, y: number, opts?: TooltipShowOptions): void;
  /** Hide the tooltip. */
  hide(): void;
  /** Remove the tooltip element and clean up event listeners. */
  destroy(): void;
}

const TOOLTIP_OFFSET = 12;

/**
 * Create a tooltip manager attached to a container element.
 *
 * The manager creates a floating div positioned relative to the container.
 * Content is rendered as a title line with optional color indicator,
 * followed by a compact list of field-value pairs.
 *
 * @param container - The parent element for the tooltip.
 * @returns TooltipManager with show/hide/destroy methods.
 */
export function createTooltipManager(container: HTMLElement): TooltipManager {
  const tooltip = document.createElement('div');
  tooltip.className = 'oc-tooltip';
  tooltip.setAttribute('role', 'tooltip');

  container.style.position = container.style.position || 'relative';
  container.appendChild(tooltip);

  // Track last content to skip innerHTML when only position changes
  let lastContentKey = '';
  // Generation counter to discard stale async position callbacks
  let currentPositionId = 0;

  // Hide on tap-outside for touch devices
  const handleDocumentTouch = (e: Event): void => {
    if (!container.contains(e.target as Node)) {
      hide();
    }
  };
  document.addEventListener('touchstart', handleDocumentTouch);

  // WCAG 1.4.13: hover-triggered content must be dismissible without moving
  // the pointer. Document-level so it works while hovering, when the chart
  // container does not have keyboard focus.
  const handleDocumentKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && tooltip.style.display === 'block') {
      hide();
    }
  };
  document.addEventListener('keydown', handleDocumentKeydown);

  function show(input: TooltipInput, x: number, y: number, opts?: TooltipShowOptions): void {
    // Custom-element form: trusted verbatim (host owns sanitization).
    if ('element' in input) {
      lastContentKey = '';
      tooltip.replaceChildren(input.element);
      position(x, y, opts);
      return;
    }
    // Plain-text form: escaped via textContent, never innerHTML.
    if ('text' in input) {
      lastContentKey = '';
      tooltip.textContent = input.text;
      position(x, y, opts);
      return;
    }

    const content = input;
    // Fast content identity check: title + field count + first/last field values
    const contentKey = `${content.title}|${content.fields.length}|${content.fields[0]?.value}|${content.fields[content.fields.length - 1]?.value}`;

    if (contentKey !== lastContentKey) {
      lastContentKey = contentKey;

      let html = '';

      // Multi-series tooltips put a swatch on each row instead of in the
      // header, so detect that case once.
      const colorRowCount = content.fields.filter((f) => f.color).length;
      const perRowSwatches = colorRowCount > 1;

      // Title row: header dot only when there's a single color (single-series)
      if (content.title) {
        const titleColor = perRowSwatches ? undefined : content.fields.find((f) => f.color)?.color;
        html += '<div class="oc-tooltip-header">';
        if (titleColor) {
          html += `<span class="oc-tooltip-dot" style="background:${esc(titleColor)}"></span>`;
        }
        html += `<span class="oc-tooltip-title">${esc(content.title)}</span>`;
        html += '</div>';
      }

      // Field rows
      if (content.fields.length > 0) {
        html += '<div class="oc-tooltip-body">';
        for (const field of content.fields) {
          html += '<div class="oc-tooltip-row">';
          html += '<span class="oc-tooltip-label">';
          if (perRowSwatches && field.color) {
            html += `<span class="oc-tooltip-row-swatch" style="background:${esc(field.color)}"></span>`;
          }
          html += `${esc(field.label)}</span>`;
          html += `<span class="oc-tooltip-value">${esc(field.value)}</span>`;
          html += '</div>';
        }
        html += '</div>';
      }

      tooltip.innerHTML = html;
    }

    position(x, y, opts);
  }

  /** Show and position the tooltip at a container-relative coordinate. */
  function position(x: number, y: number, opts?: TooltipShowOptions): void {
    tooltip.style.display = 'block';

    // Position with viewport-aware edge avoidance via @floating-ui/dom.
    // Uses a virtual element since the reference point is a coordinate,
    // not a DOM element.
    const positionId = ++currentPositionId;
    const virtualRef = {
      getBoundingClientRect() {
        const rect = container.getBoundingClientRect();
        return {
          x: rect.left + x,
          y: rect.top + y,
          width: 0,
          height: 0,
          top: rect.top + y,
          left: rect.left + x,
          right: rect.left + x,
          bottom: rect.top + y,
        };
      },
    };

    computePosition(virtualRef, tooltip, {
      placement: opts?.placement ?? 'bottom-start',
      middleware: [offset(TOOLTIP_OFFSET), flip(), shift({ padding: 8 })],
    }).then(({ x: fx, y: fy }) => {
      // Discard stale callbacks from earlier show() calls
      if (positionId !== currentPositionId) return;
      // computePosition returns coordinates relative to the tooltip's offset
      // parent (the container with position: relative), so apply directly.
      tooltip.style.left = `${fx}px`;
      tooltip.style.top = `${fy}px`;
    });
  }

  function hide(): void {
    tooltip.style.display = 'none';
    lastContentKey = '';
  }

  function destroy(): void {
    document.removeEventListener('touchstart', handleDocumentTouch);
    document.removeEventListener('keydown', handleDocumentKeydown);
    if (tooltip.parentNode) {
      tooltip.parentNode.removeChild(tooltip);
    }
  }

  return { show, hide, destroy };
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
