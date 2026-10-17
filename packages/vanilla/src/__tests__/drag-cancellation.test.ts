import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDragHandler } from '../interactions/drag-handler';

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
function setup() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const element = document.createElementNS(svg.namespaceURI, 'g') as SVGGElement;
  svg.append(element);
  document.body.append(svg);
  const onEnd = vi.fn();
  const onMove = vi.fn();
  const onCancel = vi.fn();
  const setDragging = vi.fn();
  const cleanup = createDragHandler({
    svg,
    element,
    onEnd,
    onMove,
    onCancel,
    setDragging,
    animationFrame: true,
  });
  cleanups.push(cleanup);
  element.dispatchEvent(new MouseEvent('mousedown', { clientX: 10, clientY: 10 }));
  document.dispatchEvent(new MouseEvent('mousemove', { clientX: 30, clientY: 20 }));
  return { svg, element, cleanup, onEnd, onMove, onCancel, setDragging };
}

describe('drag cancellation', () => {
  it.each([
    'pointercancel',
    'touchcancel',
    'escape',
    'replacement',
    'cleanup',
  ])('%s emits no edit and restores interaction state', (path) => {
    const drag = setup();
    if (path === 'escape') document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    else if (path === 'replacement') drag.svg.dispatchEvent(new Event('oc-cancel-drag'));
    else if (path === 'cleanup') drag.cleanup();
    else document.dispatchEvent(new Event(path));
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 40, clientY: 40 }));
    expect(drag.onEnd).not.toHaveBeenCalled();
    expect(drag.onCancel).toHaveBeenCalledOnce();
    expect(drag.svg.style.userSelect).toBe('');
    expect(drag.element.style.cursor).toBe('grab');
    expect(drag.setDragging).toHaveBeenLastCalledWith(false);
  });
  it('coalesces previews into one animation frame and commits the final pointer coordinates', () => {
    let frame: FrameRequestCallback | undefined;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frame = callback;
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const drag = setup();
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 40, clientY: 30 }));
    expect(drag.onMove).not.toHaveBeenCalled();
    frame!(0);
    expect(drag.onMove).toHaveBeenCalledExactlyOnceWith(30, 20);
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 50, clientY: 40 }));
    expect(drag.onEnd).toHaveBeenCalledExactlyOnceWith(40, 30, true);
  });
});
