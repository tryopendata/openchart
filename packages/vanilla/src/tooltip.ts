/**
 * Tooltip manager: creates and positions a floating tooltip element.
 *
 * Shows tooltip content near the mouse/touch position with viewport
 * edge avoidance. Touch support via tap-to-show, tap-outside-to-hide.
 */

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

  // Hide on tap-outside for touch devices
  const handleDocumentTouch = (e: Event): void => {
    if (!container.contains(e.target as Node)) {
      hide();
    }
  };
  document.addEventListener('touchstart', handleDocumentTouch);

  function show(content: TooltipContent, x: number, y: number): void {
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
    tooltip.style.display = 'block';

    // Position with viewport edge avoidance
    const containerRect = container.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let left = x + TOOLTIP_OFFSET;
    let top = y + TOOLTIP_OFFSET;

    // Flip horizontal if overflowing right
    if (left + tooltipRect.width > containerRect.width) {
      left = x - tooltipRect.width - TOOLTIP_OFFSET;
    }
    // Flip vertical if overflowing bottom
    if (top + tooltipRect.height > containerRect.height) {
      top = y - tooltipRect.height - TOOLTIP_OFFSET;
    }

    // Clamp to container bounds
    left = Math.max(0, Math.min(left, containerRect.width - tooltipRect.width));
    top = Math.max(0, Math.min(top, containerRect.height - tooltipRect.height));

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function hide(): void {
    tooltip.style.display = 'none';
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
    .replace(/"/g, '&quot;');
}
