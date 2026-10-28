import { expect, it } from 'vitest';
import { type NavigableMark, wireMarkNavigation } from '../interactions/mark-navigation';

it('specialized mark navigation reports Tab focus and the original arrow event, without leave announcements', () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  document.body.append(svg);
  const marks: NavigableMark[] = ['A', 'B'].map((key) => {
    const element = document.createElementNS(svg.namespaceURI, 'rect');
    svg.append(element);
    return { element, key, enter() {}, leave() {}, activate() {} };
  });
  const focused: Array<{ key: string; event: FocusEvent | KeyboardEvent }> = [];
  const cleanup = wireMarkNavigation(svg, marks, {
    onFocus: (mark, event) => focused.push({ key: mark.key, event }),
  });
  try {
    (marks[0].element as SVGElement).focus();
    const right = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
    marks[0].element.dispatchEvent(right);
    expect(focused).toHaveLength(2);
    expect(focused[0].key).toBe('A');
    expect(focused[0].event.type).toBe('focus');
    expect(focused[1]).toEqual({ key: 'B', event: right });
    marks[1].element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    (marks[1].element as SVGElement).blur();
    expect(focused).toHaveLength(2);
    cleanup();
    (marks[0].element as SVGElement).focus();
    expect(focused).toHaveLength(2);
  } finally {
    cleanup();
    svg.remove();
  }
});
