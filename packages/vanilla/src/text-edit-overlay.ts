/**
 * Text edit overlay: creates a positioned textarea over an SVG text element
 * for inline editing. Handles commit (Enter), cancel (Escape), and
 * click-outside-to-commit behavior.
 */

export interface TextEditOverlayConfig {
  /** The container div that holds the SVG. */
  container: HTMLElement;
  /** The root SVG element. */
  svg: SVGSVGElement;
  /** The SVG text element being edited. */
  targetElement: SVGElement;
  /** Current text content to populate the textarea. */
  currentText: string;
  /** Called when the user commits the edit (Enter or click outside). */
  onCommit: (newText: string) => void;
  /** Called when the user cancels the edit (Escape). */
  onCancel: () => void;
}

/**
 * Get the viewBox-to-pixel scale factors for an SVG element.
 * Same approach used by the drag handlers in mount.ts.
 */
function getScale(svg: SVGSVGElement): { scaleX: number; scaleY: number } {
  const viewBox = svg.viewBox?.baseVal;
  const svgRect = svg.getBoundingClientRect();
  return {
    scaleX: viewBox?.width && svgRect.width ? svgRect.width / viewBox.width : 1,
    scaleY: viewBox?.height && svgRect.height ? svgRect.height / viewBox.height : 1,
  };
}

/**
 * Read computed font styles from an SVG text element and map them to CSS.
 */
function getTextStyles(
  targetElement: SVGElement,
  scale: { scaleX: number; scaleY: number },
): {
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  color: string;
  textAlign: string;
  lineHeight: string;
} {
  const computed = window.getComputedStyle(targetElement);

  // Font size needs to be scaled from SVG viewBox units to pixel units
  const svgFontSize = parseFloat(
    targetElement.getAttribute('font-size') ?? computed.fontSize ?? '14',
  );
  const pixelFontSize = svgFontSize * scale.scaleY;

  const fontFamily = targetElement.getAttribute('font-family') ?? computed.fontFamily ?? 'inherit';
  const fontWeight = targetElement.getAttribute('font-weight') ?? computed.fontWeight ?? '400';

  // Get fill color from inline style or attribute
  const fill =
    (targetElement as SVGElement & ElementCSSInlineStyle).style.getPropertyValue('fill') ||
    targetElement.getAttribute('fill') ||
    computed.color ||
    '#000';

  // Map SVG text-anchor to CSS text-align
  const textAnchor = targetElement.getAttribute('text-anchor') ?? 'start';
  let textAlign = 'left';
  if (textAnchor === 'middle') textAlign = 'center';
  else if (textAnchor === 'end') textAlign = 'right';

  return {
    fontFamily,
    fontSize: `${pixelFontSize}px`,
    fontWeight,
    color: fill,
    textAlign,
    lineHeight: '1.3',
  };
}

/**
 * Compute the pixel position and size for the textarea based on the
 * target SVG element's bounding box.
 */
function computePosition(
  targetElement: SVGElement,
  svg: SVGSVGElement,
  container: HTMLElement,
): { top: number; left: number; width: number; height: number } {
  const bbox = (targetElement as SVGGraphicsElement).getBBox();
  const scale = getScale(svg);
  const svgRect = svg.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  // SVG viewBox coords -> pixel coords relative to the container
  const padding = 4;
  const left = bbox.x * scale.scaleX + (svgRect.left - containerRect.left) - padding;
  const top = bbox.y * scale.scaleY + (svgRect.top - containerRect.top) - padding;
  const width = bbox.width * scale.scaleX + padding * 2;
  const height = bbox.height * scale.scaleY + padding * 2;

  return {
    top: Math.max(0, top),
    left: Math.max(0, left),
    width: Math.max(width, 60),
    height: Math.max(height, 24),
  };
}

/**
 * Create an inline text editing overlay positioned over an SVG text element.
 * Returns an object with a `destroy()` method to clean up.
 */
export function createTextEditOverlay(config: TextEditOverlayConfig): { destroy: () => void } {
  const { container, svg, targetElement, currentText, onCommit, onCancel } = config;

  let destroyed = false;

  // Hide the underlying SVG text element (not display:none to preserve layout)
  const originalOpacity = targetElement.getAttribute('opacity');
  targetElement.setAttribute('opacity', '0');

  // Compute position and styles
  const scale = getScale(svg);
  const styles = getTextStyles(targetElement, scale);
  const position = computePosition(targetElement, svg, container);

  // Create the textarea
  const textarea = document.createElement('textarea');
  textarea.value = currentText;

  // Ensure container is positioned so absolute children work
  const containerPosition = window.getComputedStyle(container).position;
  const containerWasStatic = containerPosition === 'static';
  if (containerWasStatic) {
    container.style.position = 'relative';
  }

  // Style the textarea to match the SVG text
  Object.assign(textarea.style, {
    position: 'absolute',
    top: `${position.top}px`,
    left: `${position.left}px`,
    width: `${position.width}px`,
    minHeight: `${position.height}px`,
    fontFamily: styles.fontFamily,
    fontSize: styles.fontSize,
    fontWeight: styles.fontWeight,
    color: styles.color,
    textAlign: styles.textAlign,
    lineHeight: styles.lineHeight,
    padding: '2px 4px',
    margin: '0',
    border: '1px solid rgba(79, 70, 229, 0.4)', // intentionally 0.4, not --oc-editable-hover (0.35)
    borderRadius: '3px',
    background: 'rgba(255, 255, 255, 0.95)',
    outline: 'none',
    resize: 'none',
    overflow: 'hidden',
    boxSizing: 'border-box',
    zIndex: '10000',
    // Remove default textarea appearance
    WebkitAppearance: 'none',
    appearance: 'none',
  } as Record<string, string>);

  container.appendChild(textarea);

  // Auto-select all text
  textarea.focus();
  textarea.select();

  // Cleanup function
  function destroy(): void {
    if (destroyed) return;
    destroyed = true;

    // Restore SVG text visibility
    if (originalOpacity !== null) {
      targetElement.setAttribute('opacity', originalOpacity);
    } else {
      targetElement.removeAttribute('opacity');
    }

    // Remove event listeners
    textarea.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('mousedown', handleClickOutside);
    resizeObserver.disconnect();

    // Restore container position if we changed it
    if (containerWasStatic) {
      container.style.position = '';
    }

    // Remove the textarea
    if (textarea.parentNode) {
      textarea.parentNode.removeChild(textarea);
    }
  }

  function commit(): void {
    if (destroyed) return;
    const newText = textarea.value;
    destroy();
    onCommit(newText);
  }

  function cancel(): void {
    if (destroyed) return;
    destroy();
    onCancel();
  }

  // Keyboard handling
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  };

  textarea.addEventListener('keydown', handleKeyDown);

  // Click outside to commit
  const handleClickOutside = (e: MouseEvent) => {
    if (!textarea.contains(e.target as Node)) {
      commit();
    }
  };

  // Delay attaching click-outside so the current click event doesn't trigger it
  requestAnimationFrame(() => {
    if (!destroyed) {
      document.addEventListener('mousedown', handleClickOutside);
    }
  });

  // Reposition on container resize
  const resizeObserver = new ResizeObserver(() => {
    if (destroyed) return;
    const newPosition = computePosition(targetElement, svg, container);
    textarea.style.top = `${newPosition.top}px`;
    textarea.style.left = `${newPosition.left}px`;
    textarea.style.width = `${newPosition.width}px`;
    textarea.style.minHeight = `${newPosition.height}px`;
  });
  resizeObserver.observe(container);

  return { destroy };
}

// ---------------------------------------------------------------------------
// Position-based overlay (for creating new annotations at a click position)
// ---------------------------------------------------------------------------

export interface TextEditOverlayAtPositionConfig {
  container: HTMLElement;
  svg: SVGSVGElement;
  position: { x: number; y: number };
  onCommit: (text: string) => void;
  onCancel: () => void;
}

export function createTextEditOverlayAtPosition(config: TextEditOverlayAtPositionConfig): {
  destroy: () => void;
} {
  const { container, svg, position, onCommit, onCancel } = config;

  let destroyed = false;

  const scale = getScale(svg);
  const svgRect = svg.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  const padding = 4;
  const left = position.x * scale.scaleX + (svgRect.left - containerRect.left) - padding;
  const top = position.y * scale.scaleY + (svgRect.top - containerRect.top) - padding;

  const computedStyle = window.getComputedStyle(svg);
  const fontFamily = computedStyle.getPropertyValue('--oc-font-family').trim() || 'inherit';
  const textColor =
    computedStyle.getPropertyValue('--oc-text-color').trim() || computedStyle.color || '#333';
  const surfaceColor =
    computedStyle.getPropertyValue('--oc-surface-color').trim() || 'rgba(255, 255, 255, 0.95)';
  const fontSize = 13 * scale.scaleY;

  const textarea = document.createElement('textarea');
  textarea.value = '';
  textarea.placeholder = 'Type annotation text...';

  const containerPosition = window.getComputedStyle(container).position;
  const containerWasStatic = containerPosition === 'static';
  if (containerWasStatic) {
    container.style.position = 'relative';
  }

  Object.assign(textarea.style, {
    position: 'absolute',
    top: `${Math.max(0, top)}px`,
    left: `${Math.max(0, left)}px`,
    width: '160px',
    minHeight: '24px',
    fontFamily,
    fontSize: `${fontSize}px`,
    fontWeight: '400',
    color: textColor,
    textAlign: 'left',
    lineHeight: '1.3',
    padding: '2px 4px',
    margin: '0',
    border: '1px solid rgba(79, 70, 229, 0.4)',
    borderRadius: '3px',
    background: surfaceColor,
    outline: 'none',
    resize: 'none',
    overflow: 'hidden',
    boxSizing: 'border-box',
    zIndex: '10000',
    WebkitAppearance: 'none',
    appearance: 'none',
  } as Record<string, string>);

  container.appendChild(textarea);
  textarea.focus();

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;

    textarea.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('mousedown', handleClickOutside);

    if (containerWasStatic) {
      container.style.position = '';
    }

    if (textarea.parentNode) {
      textarea.parentNode.removeChild(textarea);
    }
  }

  function commit(): void {
    if (destroyed) return;
    const text = textarea.value.trim();
    destroy();
    if (text) {
      onCommit(text);
    } else {
      onCancel();
    }
  }

  function cancel(): void {
    if (destroyed) return;
    destroy();
    onCancel();
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  };

  textarea.addEventListener('keydown', handleKeyDown);

  const handleClickOutside = (e: MouseEvent) => {
    if (!textarea.contains(e.target as Node)) {
      commit();
    }
  };

  requestAnimationFrame(() => {
    if (!destroyed) {
      document.addEventListener('mousedown', handleClickOutside);
    }
  });

  return { destroy };
}
