/** Keyboard access to the same evidence and actions as pointer inspection. */
export interface NavigableMark {
  element: Element;
  key: string;
  enter: (event: MouseEvent) => void;
  leave: () => void;
  activate: () => void;
}

/** Capture logical focus before replacing a specialized renderer's SVG. */
export function captureMarkFocus(svg: SVGSVGElement | null): string | null {
  const active = document.activeElement;
  if (!svg || !active || !svg.contains(active)) return null;
  return active.getAttribute('data-navigation-key') ?? '';
}

/** Restore a surviving mark, or the chart itself when that mark was removed. */
export function restoreMarkFocus(svg: SVGSVGElement, key: string | null): void {
  if (key === null) return;
  const matches = [...svg.querySelectorAll<SVGElement>('[data-navigation-key]')].filter(
    (element) => element.getAttribute('data-navigation-key') === key,
  );
  const target = matches.length === 1 ? matches[0] : svg;
  if (target === svg && !svg.hasAttribute('tabindex')) svg.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}

/**
 * One tab stop per chart; arrows traverse marks, Enter/Space activate, Escape
 * dismisses inspection. Tab always retains its native page-navigation behavior.
 */
export function wireMarkNavigation(svg: SVGSVGElement, marks: NavigableMark[]): () => void {
  const cleanups: Array<() => void> = [];
  // An image is atomic to assistive technology; a group exposes its focusable marks.
  if (svg.getAttribute('role') === 'img') svg.setAttribute('role', 'group');
  marks.forEach((mark, index) => {
    const element = mark.element as SVGElement;
    element.setAttribute('tabindex', index === 0 ? '0' : '-1');
    element.setAttribute('data-navigation-key', mark.key);
    const focus = () => {
      for (const other of marks) other.element.setAttribute('tabindex', '-1');
      element.setAttribute('tabindex', '0');
      const bounds = element.getBoundingClientRect();
      mark.enter(
        new MouseEvent('focus', {
          clientX: bounds.left + bounds.width / 2,
          clientY: bounds.top + bounds.height / 2,
        }),
      );
    };
    const keydown = (event: KeyboardEvent) => {
      let next: number | undefined;
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          next = Math.min(index + 1, marks.length - 1);
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          next = Math.max(index - 1, 0);
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = marks.length - 1;
          break;
        case 'Enter':
        case ' ':
          mark.activate();
          break;
        case 'Escape':
          mark.leave();
          break;
        default:
          return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (next !== undefined && next !== index)
        (marks[next].element as SVGElement).focus({ preventScroll: true });
    };
    element.addEventListener('focus', focus);
    element.addEventListener('blur', mark.leave);
    element.addEventListener('keydown', keydown);
    cleanups.push(() => {
      element.removeEventListener('focus', focus);
      element.removeEventListener('blur', mark.leave);
      element.removeEventListener('keydown', keydown);
    });
  });
  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}
