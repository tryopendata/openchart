/**
 * Tooltip manager: creates and positions a floating tooltip element.
 *
 * Shows tooltip content near the mouse/touch position with viewport
 * edge avoidance via @floating-ui/dom. Touch support via tap-to-show,
 * tap-outside-to-hide.
 */

import { computePosition, flip, offset, shift } from '@floating-ui/dom';
import type { TooltipContent } from '@opendata-ai/openchart-core';

export interface TooltipManager {
  /** Show the tooltip with content at a given position. */
  show(content: TooltipContent, x: number, y: number): void;
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
  tooltip.className = 'viz-tooltip';
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

  function show(content: TooltipContent, x: number, y: number): void {
    // Fast content identity check: title + field count + first/last field values
    const contentKey = `${content.title}|${content.fields.length}|${content.fields[0]?.value}|${content.fields[content.fields.length - 1]?.value}`;

    if (contentKey !== lastContentKey) {
      lastContentKey = contentKey;

      let html = '';

      // Title row: optional color dot + title text
      if (content.title) {
        const titleColor = content.fields.find((f) => f.color)?.color;
        html += '<div class="viz-tooltip-header">';
        if (titleColor) {
          html += `<span class="viz-tooltip-dot" style="background:${esc(titleColor)}"></span>`;
        }
        html += `<span class="viz-tooltip-title">${esc(content.title)}</span>`;
        html += '</div>';
      }

      // Field rows
      if (content.fields.length > 0) {
        html += '<div class="viz-tooltip-body">';
        for (const field of content.fields) {
          html += '<div class="viz-tooltip-row">';
          html += `<span class="viz-tooltip-label">${esc(field.label)}</span>`;
          html += `<span class="viz-tooltip-value">${esc(field.value)}</span>`;
          html += '</div>';
        }
        html += '</div>';
      }

      tooltip.innerHTML = html;
    }

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
      placement: 'bottom-start',
      middleware: [offset(TOOLTIP_OFFSET), flip(), shift({ padding: 5 })],
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
