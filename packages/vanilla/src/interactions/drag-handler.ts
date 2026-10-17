/** Mouse/touch drag lifecycle, with one cancellation path and optional frame-coalesced previews. */
export interface DragConfig {
  element: SVGElement;
  svg: SVGSVGElement;
  onMove: (dx: number, dy: number) => void;
  onEnd: (dx: number, dy: number, moved: boolean) => void;
  onCancel?: () => void;
  onStart?: () => void;
  setDragging: (dragging: boolean) => void;
  threshold?: number;
  animationFrame?: boolean;
}

export function createDragHandler(config: DragConfig): () => void {
  const { element, svg, onMove, onEnd, setDragging, threshold = 3 } = config;
  let cancelActive: (() => void) | undefined;

  function startDrag(startX: number, startY: number): void {
    cancelActive?.();
    config.onStart?.();
    setDragging(true);
    const viewBox = svg.viewBox?.baseVal;
    const rect = svg.getBoundingClientRect();
    const scaleX = viewBox?.width && rect.width ? viewBox.width / rect.width : 1;
    const scaleY = viewBox?.height && rect.height ? viewBox.height / rect.height : 1;
    element.style.cursor = 'grabbing';
    svg.style.userSelect = 'none';
    let frame: number | undefined;
    let dx = 0;
    let dy = 0;
    let active = true;
    const preview = () => {
      frame = undefined;
      if (active) onMove(dx, dy);
    };
    const move = (x: number, y: number) => {
      dx = (x - startX) * scaleX;
      dy = (y - startY) * scaleY;
      if (!config.animationFrame) preview();
      else if (frame === undefined) frame = requestAnimationFrame(preview);
    };
    const detach = () => {
      active = false;
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined;
      document.removeEventListener('mousemove', mouseMove);
      document.removeEventListener('mouseup', mouseUp);
      document.removeEventListener('touchmove', touchMove);
      document.removeEventListener('touchend', touchEnd);
      document.removeEventListener('touchcancel', cancel);
      document.removeEventListener('pointercancel', cancel);
      document.removeEventListener('keydown', keyDown, true);
      svg.removeEventListener('oc-cancel-drag', cancel);
      element.style.cursor = 'grab';
      svg.style.userSelect = '';
      cancelActive = undefined;
    };
    const cancel = () => {
      if (!active) return;
      detach();
      config.onCancel?.();
      setDragging(false);
    };
    const end = (x: number, y: number) => {
      if (!active) return;
      dx = (x - startX) * scaleX;
      dy = (y - startY) * scaleY;
      const moved = Math.abs(dx) > threshold || Math.abs(dy) > threshold;
      detach();
      onEnd(dx, dy, moved);
      if (moved)
        element.addEventListener('click', (event) => event.stopPropagation(), {
          capture: true,
          once: true,
        });
      setDragging(false);
    };
    const mouseMove = (event: MouseEvent) => move(event.clientX, event.clientY);
    const mouseUp = (event: MouseEvent) => end(event.clientX, event.clientY);
    const touchMove = (event: TouchEvent) => {
      if (!event.touches.length) return;
      event.preventDefault();
      move(event.touches[0].clientX, event.touches[0].clientY);
    };
    const touchEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      end(touch?.clientX ?? startX, touch?.clientY ?? startY);
    };
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancel();
      }
    };
    document.addEventListener('mousemove', mouseMove);
    document.addEventListener('mouseup', mouseUp);
    document.addEventListener('touchmove', touchMove, { passive: false });
    document.addEventListener('touchend', touchEnd);
    document.addEventListener('touchcancel', cancel);
    document.addEventListener('pointercancel', cancel);
    document.addEventListener('keydown', keyDown, true);
    svg.addEventListener('oc-cancel-drag', cancel);
    cancelActive = cancel;
  }

  const mouseDown = (event: MouseEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    startDrag(event.clientX, event.clientY);
  };
  const touchStart = (event: TouchEvent) => {
    if (event.touches.length !== 1) return;
    event.preventDefault();
    startDrag(event.touches[0].clientX, event.touches[0].clientY);
  };
  element.addEventListener('mousedown', mouseDown);
  element.addEventListener('touchstart', touchStart, { passive: false });
  return () => {
    element.removeEventListener('mousedown', mouseDown);
    element.removeEventListener('touchstart', touchStart);
    cancelActive?.();
  };
}
