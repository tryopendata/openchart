/**
 * Reader zoom and pan for GeoMap (`geo.zoom`).
 *
 * Gestures drive the same camera the programmatic API uses (`zoomTo`,
 * `setCamera`, focus): this module only computes the next camera and hands it
 * to the mount, which owns camera state, tweens, and `onCameraChange`. The
 * math lives in map-camera.ts (`zoomCameraAt`, `panCamera`, `clampMapCamera`),
 * mirroring graph/zoom.ts's pivot-preserving zoom for the center-based camera.
 *
 * Conventions (cooperative gestures, so the map never traps page scroll):
 * - Wheel: ctrl/cmd + wheel (and trackpad pinch, which arrives as ctrl + wheel)
 *   zooms around the cursor. A plain wheel scrolls the page and flashes a hint.
 * - Mouse/pen: drag pans once zoomed in; double-click zooms in (shift zooms out).
 * - Touch: two-finger pinch zooms and pans. One finger scrolls the page at the
 *   full view and pans the map once the reader has zoomed in (touch-action is
 *   flipped to `none` while zoomed so the browser stops claiming the swipe).
 * - Keyboard (map focused): + / - zoom, arrows pan, 0 resets.
 * - Buttons: zoom in / zoom out / reset, top-right of the map area.
 *
 * Listeners sit on the container, not the SVG, because every render replaces
 * the SVG element.
 */

import type { GeoMapLayout } from '@opendata-ai/openchart-core';
import {
  clampMapCamera,
  panCamera,
  type ResolvedMapZoom,
  wheelZoomFactor,
  zoomCameraAt,
} from './map-camera';
import type { Camera } from './story/camera-math';

/** What the controller needs from the mount. */
export interface MapZoomHost {
  container: HTMLElement;
  getSvg(): SVGSVGElement | null;
  getLayout(): GeoMapLayout;
  /** Resolved `geo.zoom` for the current spec, or null when off. */
  getConfig(): ResolvedMapZoom | null;
  getCamera(): Camera;
  /** Commit a camera now (cancels any running camera tween). */
  setCamera(camera: Camera): void;
  /** Tween to a camera (snaps under prefers-reduced-motion). */
  animateCamera(camera: Camera): void;
  /** Return to the full map. */
  reset(): void;
  hideTooltip(): void;
}

export interface MapZoomController {
  /** Call after every render: re-stamps the new SVG and places the controls. */
  onRender(restoreFocus: boolean): void;
  /** Call after every camera change: syncs button states and touch-action. */
  onCamera(): void;
  destroy(): void;
}

/** Zoom factor per button press / key press / double-click. */
export const ZOOM_STEP = 2;
/** Arrow-key pan distance, as a fraction of the map frame. */
const KEY_PAN_FRACTION = 0.1;
/** Pointer travel (px) before a press becomes a drag instead of a click. */
const DRAG_THRESHOLD = 3;
/** How long the "use ctrl + scroll" hint stays up. */
const HINT_MS = 1500;
const EPS = 1e-3;

const SVG_NS = 'http://www.w3.org/2000/svg';
let clipIdCounter = 0;

const ICONS = {
  in: '<path d="M8 3v10M3 8h10"/>',
  out: '<path d="M3 8h10"/>',
  reset: '<path d="M3 8a5 5 0 1 0 1.6-3.7"/><path d="M3 2.5v2.8h2.8"/>',
};

function isMacLike(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '');
}

/** Safari's non-standard pinch event (desktop trackpad and iOS). */
interface GestureEventLike extends UIEvent {
  scale: number;
  clientX: number;
  clientY: number;
}

export function createMapZoomController(host: MapZoomHost): MapZoomController {
  const { container } = host;
  const clipId = `oc-map-zoom-clip-${++clipIdCounter}`;

  let overlay: HTMLDivElement | null = null;
  let buttons: { in: HTMLButtonElement; out: HTMLButtonElement; reset: HTMLButtonElement } | null =
    null;
  let hint: HTMLDivElement | null = null;
  let hintTimer: ReturnType<typeof setTimeout> | null = null;

  // Gesture state
  let drag: {
    id: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    moved: boolean;
  } | null = null;
  let suppressClick = false;
  let pinch: { dist: number; x: number; y: number } | null = null;
  let touchPan: { x: number; y: number; moved: boolean } | null = null;
  let gestureStartK: number | null = null;

  // -------------------------------------------------------------------------
  // Geometry helpers
  // -------------------------------------------------------------------------

  function vb() {
    return host.getLayout().mapSize;
  }

  function clamp(camera: Camera): Camera {
    const cfg = host.getConfig();
    return clampMapCamera(camera, vb(), cfg?.maxZoom ?? 1);
  }

  function clampK(k: number): number {
    const cfg = host.getConfig();
    return Math.min(Math.max(k, 1), cfg?.maxZoom ?? 1);
  }

  /** CSS px -> SVG user units (the viewBox scales uniformly). */
  function svgRect(): DOMRect | null {
    const svg = host.getSvg();
    let rect = svg?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return rect;
  }

  /** Client coordinates -> map frame (0..mapSize, before the camera). */
  function toMapFrame(
    clientX: number,
    clientY: number,
  ): { x: number; y: number; inside: boolean } | null {
    const rect = svgRect();
    if (!rect) return null;
    const layout = host.getLayout();
    const x = (clientX - rect.left) * (layout.width / rect.width) - layout.area.x;
    const y = (clientY - rect.top) * (layout.height / rect.height) - layout.area.y;
    const inside = x >= 0 && y >= 0 && x <= layout.area.width && y <= layout.area.height;
    return { x, y, inside };
  }

  function unitsPerPx(): number {
    const rect = svgRect();
    return rect ? host.getLayout().width / rect.width : 1;
  }

  function isZoomed(): boolean {
    return host.getCamera().k > 1 + EPS;
  }

  function fromControls(e: Event): boolean {
    const t = e.target as Element | null;
    return !!t?.closest?.('.oc-map-zoom');
  }

  function zoomAround(factor: number, x: number, y: number, animate: boolean): void {
    const cam = host.getCamera();
    const next = clamp(zoomCameraAt(cam, vb(), clampK(cam.k * factor), x, y));
    if (animate) host.animateCamera(next);
    else host.setCamera(next);
  }

  function zoomAtCenter(factor: number): void {
    const { width, height } = vb();
    zoomAround(factor, width / 2, height / 2, true);
  }

  // -------------------------------------------------------------------------
  // Hint
  // -------------------------------------------------------------------------

  function showHint(): void {
    if (!hint) return;
    hint.setAttribute('data-visible', '');
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = setTimeout(() => {
      hint?.removeAttribute('data-visible');
      hintTimer = null;
    }, HINT_MS);
  }

  // -------------------------------------------------------------------------
  // Wheel (+ Safari trackpad gesture events)
  // -------------------------------------------------------------------------

  function onWheel(e: WheelEvent): void {
    if (!host.getConfig() || fromControls(e)) return;
    const p = toMapFrame(e.clientX, e.clientY);
    if (!p?.inside) return;
    if (!e.ctrlKey && !e.metaKey) {
      // Plain wheel belongs to the page. Only nag on vertical scrolls.
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) showHint();
      return;
    }
    e.preventDefault();
    // The reader found the gesture; drop any hint still on screen.
    hint?.removeAttribute('data-visible');
    zoomAround(wheelZoomFactor(e), p.x, p.y, false);
  }

  function onGestureStart(e: Event): void {
    if (!host.getConfig()) return;
    e.preventDefault();
    gestureStartK = host.getCamera().k;
  }

  function onGestureChange(e: Event): void {
    if (!host.getConfig() || gestureStartK === null) return;
    e.preventDefault();
    // On iOS the touch handlers already own the pinch; this path is desktop
    // Safari's trackpad pinch, which sends no ctrl + wheel.
    if (pinch) return;
    const g = e as GestureEventLike;
    const p = toMapFrame(g.clientX, g.clientY);
    if (!p) return;
    const cam = host.getCamera();
    host.setCamera(clamp(zoomCameraAt(cam, vb(), clampK(gestureStartK * g.scale), p.x, p.y)));
  }

  function onGestureEnd(e: Event): void {
    if (gestureStartK === null) return;
    e.preventDefault();
    gestureStartK = null;
  }

  // -------------------------------------------------------------------------
  // Mouse / pen drag (touch is handled by the touch handlers below)
  // -------------------------------------------------------------------------

  function onPointerDown(e: PointerEvent): void {
    if (e.pointerType === 'touch' || e.button !== 0) return;
    if (!host.getConfig() || fromControls(e) || !isZoomed()) return;
    const p = toMapFrame(e.clientX, e.clientY);
    if (!p?.inside) return;
    drag = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      moved: false,
    };
  }

  /**
   * Text selection starts on mousedown, before a press is known to be a drag
   * or a double-click, and would highlight the chrome text. Block it for map
   * presses that can become either, and keep the click-to-focus that the
   * default action would have given.
   */
  function onMouseDown(e: MouseEvent): void {
    if (e.button !== 0 || !host.getConfig() || fromControls(e)) return;
    if (!isZoomed() && e.detail < 2) return;
    const p = toMapFrame(e.clientX, e.clientY);
    if (!p?.inside) return;
    e.preventDefault();
    host.getSvg()?.focus({ preventScroll: true });
  }

  function onPointerMove(e: PointerEvent): void {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_THRESHOLD) return;
      drag.moved = true;
      const svg = host.getSvg();
      try {
        svg?.setPointerCapture(e.pointerId);
      } catch {
        // Capture is a nicety (keeps the drag alive off the map); not required.
      }
      svg?.classList.add('oc-map--panning');
      host.hideTooltip();
    }
    e.preventDefault();
    const s = unitsPerPx();
    const dx = (e.clientX - drag.lastX) * s;
    const dy = (e.clientY - drag.lastY) * s;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    host.setCamera(clamp(panCamera(host.getCamera(), dx, dy)));
  }

  function endDrag(e: PointerEvent): void {
    if (!drag || e.pointerId !== drag.id) return;
    const svg = host.getSvg();
    if (drag.moved) {
      suppressClick = true;
      // The click (if any) fires synchronously after pointerup; clear the flag
      // afterwards so a drag that produces no click doesn't eat the next one.
      setTimeout(() => {
        suppressClick = false;
      }, 0);
    }
    try {
      if (svg?.hasPointerCapture?.(e.pointerId)) svg.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    svg?.classList.remove('oc-map--panning');
    drag = null;
  }

  function onClickCapture(e: MouseEvent): void {
    if (!suppressClick) return;
    suppressClick = false;
    e.stopPropagation();
    e.preventDefault();
  }

  function onDblClick(e: MouseEvent): void {
    if (!host.getConfig() || fromControls(e)) return;
    const p = toMapFrame(e.clientX, e.clientY);
    if (!p?.inside) return;
    e.preventDefault();
    zoomAround(e.shiftKey ? 1 / ZOOM_STEP : ZOOM_STEP, p.x, p.y, true);
  }

  // -------------------------------------------------------------------------
  // Touch
  // -------------------------------------------------------------------------

  function touchPoint(t: Touch) {
    return toMapFrame(t.clientX, t.clientY);
  }

  function startPinch(e: TouchEvent): void {
    const a = touchPoint(e.touches[0]!);
    const b = touchPoint(e.touches[1]!);
    if (!a || !b) return;
    pinch = {
      dist: Math.hypot(b.x - a.x, b.y - a.y) || 1,
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
    };
    touchPan = null;
  }

  function startTouchPan(t: Touch): void {
    touchPan = isZoomed() ? { x: t.clientX, y: t.clientY, moved: false } : null;
  }

  function onTouchStart(e: TouchEvent): void {
    if (!host.getConfig() || fromControls(e)) return;
    if (e.touches.length >= 2) {
      const a = touchPoint(e.touches[0]!);
      if (!a?.inside) return;
      // Claim the pinch before the browser does (page zoom / scroll).
      e.preventDefault();
      host.hideTooltip();
      startPinch(e);
    } else if (e.touches.length === 1) {
      const p = touchPoint(e.touches[0]!);
      if (!p?.inside) return;
      // No preventDefault: a tap must still produce a click.
      startTouchPan(e.touches[0]!);
    }
  }

  function onTouchMove(e: TouchEvent): void {
    if (!host.getConfig()) return;
    if (pinch && e.touches.length >= 2) {
      e.preventDefault();
      const a = touchPoint(e.touches[0]!);
      const b = touchPoint(e.touches[1]!);
      if (!a || !b) return;
      const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const x = (a.x + b.x) / 2;
      const y = (a.y + b.y) / 2;
      let cam = host.getCamera();
      cam = zoomCameraAt(cam, vb(), clampK(cam.k * (dist / pinch.dist)), x, y);
      cam = panCamera(cam, x - pinch.x, y - pinch.y);
      host.setCamera(clamp(cam));
      pinch = { dist, x, y };
      return;
    }
    if (touchPan && e.touches.length === 1) {
      const t = e.touches[0]!;
      if (!touchPan.moved) {
        if (Math.hypot(t.clientX - touchPan.x, t.clientY - touchPan.y) < DRAG_THRESHOLD) return;
        touchPan.moved = true;
        host.hideTooltip();
      }
      if (e.cancelable) e.preventDefault();
      const s = unitsPerPx();
      const dx = (t.clientX - touchPan.x) * s;
      const dy = (t.clientY - touchPan.y) * s;
      touchPan.x = t.clientX;
      touchPan.y = t.clientY;
      host.setCamera(clamp(panCamera(host.getCamera(), dx, dy)));
    }
  }

  function onTouchEnd(e: TouchEvent): void {
    if (e.touches.length >= 2) {
      startPinch(e);
      return;
    }
    pinch = null;
    if (e.touches.length === 1) {
      // Lifting one finger of a pinch hands off to a one-finger pan.
      startTouchPan(e.touches[0]!);
      if (touchPan) touchPan.moved = true;
    } else {
      touchPan = null;
    }
  }

  // -------------------------------------------------------------------------
  // Keyboard
  // -------------------------------------------------------------------------

  function onKeyDown(e: KeyboardEvent): void {
    if (!host.getConfig() || e.target !== host.getSvg()) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const { width, height } = vb();
    switch (e.key) {
      case '+':
      case '=':
        zoomAtCenter(ZOOM_STEP);
        break;
      case '-':
      case '_':
        zoomAtCenter(1 / ZOOM_STEP);
        break;
      case '0':
        host.reset();
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown': {
        // At the full view there is nowhere to pan: let the page scroll.
        if (!isZoomed()) return;
        const dx =
          e.key === 'ArrowLeft'
            ? width * KEY_PAN_FRACTION
            : e.key === 'ArrowRight'
              ? -width * KEY_PAN_FRACTION
              : 0;
        const dy =
          e.key === 'ArrowUp'
            ? height * KEY_PAN_FRACTION
            : e.key === 'ArrowDown'
              ? -height * KEY_PAN_FRACTION
              : 0;
        host.setCamera(clamp(panCamera(host.getCamera(), dx, dy)));
        break;
      }
      default:
        return;
    }
    e.preventDefault();
  }

  // -------------------------------------------------------------------------
  // Controls overlay
  // -------------------------------------------------------------------------

  function makeButton(kind: 'in' | 'out' | 'reset', label: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'oc-map-zoom-btn';
    btn.setAttribute('data-zoom', kind);
    btn.setAttribute('aria-label', label);
    btn.title = label;
    btn.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICONS[kind]}</svg>`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (kind === 'in') zoomAtCenter(ZOOM_STEP);
      else if (kind === 'out') zoomAtCenter(1 / ZOOM_STEP);
      else host.reset();
    });
    return btn;
  }

  function ensureOverlay(showControls: boolean): void {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'oc-map-zoom';
      hint = document.createElement('div');
      hint.className = 'oc-map-zoom-hint';
      hint.setAttribute('aria-hidden', 'true');
      hint.textContent = isMacLike()
        ? 'Use ⌘ + scroll to zoom the map'
        : 'Use Ctrl + scroll to zoom the map';
      overlay.appendChild(hint);
      if (getComputedStyle(container).position === 'static') {
        container.style.position = 'relative';
      }
      container.appendChild(overlay);
    }
    if (showControls && !buttons) {
      const group = document.createElement('div');
      group.className = 'oc-map-zoom-controls';
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', 'Map zoom');
      buttons = {
        in: makeButton('in', 'Zoom in'),
        out: makeButton('out', 'Zoom out'),
        reset: makeButton('reset', 'Reset zoom'),
      };
      group.append(buttons.in, buttons.out, buttons.reset);
      overlay.appendChild(group);
    } else if (!showControls && buttons) {
      buttons.in.parentElement?.remove();
      buttons = null;
    }
  }

  function removeOverlay(): void {
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = null;
    overlay?.remove();
    overlay = null;
    buttons = null;
    hint = null;
  }

  /** Pin the overlay to the map area, in % so it tracks the SVG's scaling. */
  function placeOverlay(layout: GeoMapLayout): void {
    if (!overlay || !layout.width || !layout.height) return;
    const { area, width, height } = layout;
    overlay.style.left = `${(area.x / width) * 100}%`;
    overlay.style.top = `${(area.y / height) * 100}%`;
    overlay.style.width = `${(area.width / width) * 100}%`;
    overlay.style.height = `${(area.height / height) * 100}%`;
  }

  function ensureClip(svg: SVGSVGElement, layout: GeoMapLayout): void {
    if (svg.querySelector(`#${clipId}`)) return;
    let defs = svg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS(SVG_NS, 'defs');
      svg.insertBefore(defs, svg.firstChild);
    }
    const clip = document.createElementNS(SVG_NS, 'clipPath');
    clip.setAttribute('id', clipId);
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('width', String(layout.area.width));
    rect.setAttribute('height', String(layout.area.height));
    clip.appendChild(rect);
    defs.appendChild(clip);
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  function onRender(restoreFocus: boolean): void {
    const cfg = host.getConfig();
    const svg = host.getSvg();
    if (!cfg || !svg) {
      removeOverlay();
      return;
    }
    const layout = host.getLayout();
    svg.setAttribute('tabindex', '0');
    svg.setAttribute('aria-keyshortcuts', '+ - 0 ArrowUp ArrowDown ArrowLeft ArrowRight');
    ensureClip(svg, layout);
    ensureOverlay(cfg.controls);
    placeOverlay(layout);
    if (restoreFocus) svg.focus({ preventScroll: true });
    onCamera();
  }

  function onCamera(): void {
    const cfg = host.getConfig();
    const svg = host.getSvg();
    if (!cfg || !svg) return;
    const cam = host.getCamera();
    const zoomed = cam.k > 1 + EPS;
    const { width, height } = vb();
    const atFullView =
      !zoomed && Math.abs(cam.cx - width / 2) < EPS && Math.abs(cam.cy - height / 2) < EPS;

    // Clip only while zoomed: at the full view nothing overflows, and a clip
    // would shave points that straddle the frame edge.
    const group = svg.querySelector('.oc-map-group');
    if (zoomed) group?.setAttribute('clip-path', `url(#${clipId})`);
    else group?.removeAttribute('clip-path');

    // One finger scrolls the page at the full view; once zoomed it pans.
    (svg as SVGSVGElement & ElementCSSInlineStyle).style.touchAction = zoomed
      ? 'none'
      : 'pan-x pan-y';
    if (zoomed) svg.setAttribute('data-oc-zoomed', '');
    else svg.removeAttribute('data-oc-zoomed');

    if (buttons) {
      setDisabled(buttons.in, cam.k >= cfg.maxZoom - EPS, svg);
      setDisabled(buttons.out, !zoomed, svg);
      setDisabled(buttons.reset, atFullView, svg);
    }
  }

  function setDisabled(btn: HTMLButtonElement, disabled: boolean, svg: SVGSVGElement): void {
    if (btn.disabled === disabled) return;
    // A disabled button drops focus to <body>; hand it to the map instead so
    // keyboard users keep their place.
    const hadFocus = disabled && document.activeElement === btn;
    btn.disabled = disabled;
    if (hadFocus) svg.focus({ preventScroll: true });
  }

  const touchOpts: AddEventListenerOptions = { passive: false };
  container.addEventListener('wheel', onWheel, { passive: false });
  container.addEventListener('pointerdown', onPointerDown);
  container.addEventListener('mousedown', onMouseDown);
  container.addEventListener('pointermove', onPointerMove);
  container.addEventListener('pointerup', endDrag);
  container.addEventListener('pointercancel', endDrag);
  container.addEventListener('click', onClickCapture, true);
  container.addEventListener('dblclick', onDblClick);
  container.addEventListener('touchstart', onTouchStart, touchOpts);
  container.addEventListener('touchmove', onTouchMove, touchOpts);
  container.addEventListener('touchend', onTouchEnd);
  container.addEventListener('touchcancel', onTouchEnd);
  container.addEventListener('gesturestart', onGestureStart);
  container.addEventListener('gesturechange', onGestureChange);
  container.addEventListener('gestureend', onGestureEnd);
  container.addEventListener('keydown', onKeyDown);

  return {
    onRender,
    onCamera,
    destroy() {
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', endDrag);
      container.removeEventListener('pointercancel', endDrag);
      container.removeEventListener('click', onClickCapture, true);
      container.removeEventListener('dblclick', onDblClick);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
      container.removeEventListener('gesturestart', onGestureStart);
      container.removeEventListener('gesturechange', onGestureChange);
      container.removeEventListener('gestureend', onGestureEnd);
      container.removeEventListener('keydown', onKeyDown);
      const svg = host.getSvg();
      svg?.removeAttribute('tabindex');
      removeOverlay();
    },
  };
}
