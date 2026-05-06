/**
 * Reusable drag handler for SVG elements.
 * Handles mouse and touch events, viewBox scaling, threshold detection,
 * click suppression after drag, and cursor state.
 */

export interface DragConfig {
  element: SVGElement;
  svg: SVGSVGElement;
  onMove: (dx: number, dy: number) => void;
  onEnd: (dx: number, dy: number, moved: boolean) => void;
  setDragging: (dragging: boolean) => void;
  threshold?: number;
}

export function createDragHandler(config: DragConfig): () => void {
  const { element, svg, onMove, onEnd, setDragging, threshold = 3 } = config;
  const cleanups: Array<() => void> = [];

  let activeDocMouseMove: ((e: MouseEvent) => void) | null = null;
  let activeDocMouseUp: ((e: MouseEvent) => void) | null = null;
  let activeDocTouchMove: ((e: TouchEvent) => void) | null = null;
  let activeDocTouchEnd: ((e: TouchEvent) => void) | null = null;
  let activeDocTouchCancel: ((e: TouchEvent) => void) | null = null;

  function getScale(): { scaleX: number; scaleY: number } {
    const viewBox = svg.viewBox?.baseVal;
    const svgRect = svg.getBoundingClientRect();
    return {
      scaleX: viewBox?.width && svgRect.width ? viewBox.width / svgRect.width : 1,
      scaleY: viewBox?.height && svgRect.height ? viewBox.height / svgRect.height : 1,
    };
  }

  function startDrag(startX: number, startY: number): void {
    setDragging(true);
    const { scaleX, scaleY } = getScale();

    element.style.cursor = 'grabbing';
    svg.style.userSelect = 'none';

    const handleMove = (clientX: number, clientY: number) => {
      const dx = (clientX - startX) * scaleX;
      const dy = (clientY - startY) * scaleY;
      onMove(dx, dy);
    };

    const cleanupDocListeners = () => {
      if (activeDocMouseMove) {
        document.removeEventListener('mousemove', activeDocMouseMove);
        activeDocMouseMove = null;
      }
      if (activeDocMouseUp) {
        document.removeEventListener('mouseup', activeDocMouseUp);
        activeDocMouseUp = null;
      }
      if (activeDocTouchMove) {
        document.removeEventListener('touchmove', activeDocTouchMove);
        activeDocTouchMove = null;
      }
      if (activeDocTouchEnd) {
        document.removeEventListener('touchend', activeDocTouchEnd);
        activeDocTouchEnd = null;
      }
      if (activeDocTouchCancel) {
        document.removeEventListener('touchcancel', activeDocTouchCancel);
        activeDocTouchCancel = null;
      }
    };

    const handleEnd = (clientX: number, clientY: number) => {
      const dx = (clientX - startX) * scaleX;
      const dy = (clientY - startY) * scaleY;
      const moved = Math.abs(dx) > threshold || Math.abs(dy) > threshold;

      onEnd(dx, dy, moved);

      if (moved) {
        element.addEventListener(
          'click',
          (clickE) => {
            clickE.stopPropagation();
          },
          { capture: true, once: true },
        );
      }

      element.style.cursor = 'grab';
      svg.style.userSelect = '';

      cleanupDocListeners();
      setDragging(false);
    };

    const onMouseMove = (moveEvent: MouseEvent) => {
      handleMove(moveEvent.clientX, moveEvent.clientY);
    };
    const onMouseUp = (upEvent: MouseEvent) => {
      handleEnd(upEvent.clientX, upEvent.clientY);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    activeDocMouseMove = onMouseMove;
    activeDocMouseUp = onMouseUp;

    const onTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length > 0) {
        moveEvent.preventDefault();
        handleMove(moveEvent.touches[0].clientX, moveEvent.touches[0].clientY);
      }
    };
    const onTouchEnd = (endEvent: TouchEvent) => {
      const touch = endEvent.changedTouches[0];
      if (touch) {
        handleEnd(touch.clientX, touch.clientY);
      } else {
        handleEnd(startX, startY);
      }
    };
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
    document.addEventListener('touchcancel', onTouchEnd);
    activeDocTouchMove = onTouchMove;
    activeDocTouchEnd = onTouchEnd;
    activeDocTouchCancel = onTouchEnd;
  }

  const handleMouseDown = (e: Event) => {
    const mouseEvent = e as MouseEvent;
    mouseEvent.preventDefault();
    startDrag(mouseEvent.clientX, mouseEvent.clientY);
  };

  const handleTouchStart = (e: Event) => {
    const touchEvent = e as TouchEvent;
    if (touchEvent.touches.length === 1) {
      touchEvent.preventDefault();
      startDrag(touchEvent.touches[0].clientX, touchEvent.touches[0].clientY);
    }
  };

  element.addEventListener('mousedown', handleMouseDown);
  element.addEventListener('touchstart', handleTouchStart, { passive: false });
  cleanups.push(() => {
    element.removeEventListener('mousedown', handleMouseDown);
    element.removeEventListener('touchstart', handleTouchStart);
  });

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
    if (activeDocMouseMove) {
      document.removeEventListener('mousemove', activeDocMouseMove);
      activeDocMouseMove = null;
    }
    if (activeDocMouseUp) {
      document.removeEventListener('mouseup', activeDocMouseUp);
      activeDocMouseUp = null;
    }
    if (activeDocTouchMove) {
      document.removeEventListener('touchmove', activeDocTouchMove);
      activeDocTouchMove = null;
    }
    if (activeDocTouchEnd) {
      document.removeEventListener('touchend', activeDocTouchEnd);
      activeDocTouchEnd = null;
    }
    if (activeDocTouchCancel) {
      document.removeEventListener('touchcancel', activeDocTouchCancel);
      activeDocTouchCancel = null;
    }
    svg.style.userSelect = '';
  };
}
