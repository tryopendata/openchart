/**
 * Play-when-seen (RFC D13): hold a chart's entrance until the reader can see it.
 *
 * One IntersectionObserver per page, created lazily and disconnected once no
 * targets remain. Mounts observe their container (which survives re-renders),
 * never the SVG they rebuild.
 *
 * An element counts as seen when at least 25% of it is in the viewport, or
 * when the visible part covers at least 25% of the viewport's height, so an
 * element taller than four viewports still plays.
 *
 * Without IntersectionObserver, or without page layout (no window, a
 * zero-height viewport, or a page whose root element has no width: happy-dom,
 * SSR), the callback fires synchronously, which keeps those environments on
 * the play-at-mount path. A zero-size element on a page that does lay out
 * (a chart in a closed tab or accordion) is observed like any other: it plays
 * once it gets a size and is seen.
 */

import { prefersReducedMotion } from './motion/tween';

/** Share of the element (or of the viewport's height) that counts as seen. */
export const SEEN_RATIO = 0.25;

const THRESHOLDS = [0, SEEN_RATIO, 1];

/** Builds the shared observer. Injectable so tests can drive intersections. */
export type ObserverFactory = (
  callback: IntersectionObserverCallback,
  options: IntersectionObserverInit,
) => Pick<IntersectionObserver, 'observe' | 'unobserve' | 'disconnect'>;

const defaultFactory: ObserverFactory = (callback, options) =>
  new IntersectionObserver(callback, options);

let factory: ObserverFactory | null = null;
let observer: ReturnType<ObserverFactory> | null = null;
const targets = new Map<Element, Set<() => void>>();

/**
 * Replace the observer factory (tests). Pass null to restore the browser's
 * IntersectionObserver. Drops the current shared observer and its targets.
 */
export function setObserverFactory(next: ObserverFactory | null): void {
  observer?.disconnect();
  observer = null;
  targets.clear();
  factory = next;
}

/** Whether an intersection entry counts as seen. */
export function isSeen(
  entry: Pick<IntersectionObserverEntry, 'isIntersecting' | 'intersectionRatio'> & {
    intersectionRect: { height: number };
    rootBounds: { height: number } | null;
  },
): boolean {
  if (!entry.isIntersecting) return false;
  if (entry.intersectionRatio >= SEEN_RATIO) return true;
  const viewport = entry.rootBounds?.height ?? 0;
  return viewport > 0 && entry.intersectionRect.height >= SEEN_RATIO * viewport;
}

function release(element: Element): void {
  targets.delete(element);
  observer?.unobserve(element);
  if (targets.size === 0) {
    observer?.disconnect();
    observer = null;
  }
}

function onIntersect(entries: IntersectionObserverEntry[]): void {
  for (const entry of entries) {
    if (!isSeen(entry)) continue;
    const callbacks = targets.get(entry.target);
    if (!callbacks) continue;
    release(entry.target);
    for (const cb of callbacks) cb();
  }
}

/**
 * Whether the page lays elements out at all. The root element always has a
 * width in a browser; DOM shims without a layout engine (happy-dom) report
 * zero for it even when a test stubs the container's own rect. Only the page
 * is checked: an element's own size says nothing about whether it will be
 * seen later.
 */
function hasLayout(): boolean {
  if (typeof window === 'undefined' || !window.innerHeight) return false;
  return document.documentElement.getBoundingClientRect().width > 0;
}

/**
 * Call `cb` once `element` is seen. Returns a cancel function. Fires
 * synchronously (returning a no-op cancel) when visibility can't be measured.
 */
export function whenSeen(element: Element, cb: () => void): () => void {
  const make = factory ?? (typeof IntersectionObserver === 'function' ? defaultFactory : null);
  if (!make || !hasLayout()) {
    cb();
    return () => {};
  }
  observer ??= make(onIntersect, { threshold: THRESHOLDS });
  let callbacks = targets.get(element);
  if (!callbacks) {
    callbacks = new Set();
    targets.set(element, callbacks);
    observer.observe(element);
  }
  // Wrap so the same cb registered twice gets two independent subscriptions.
  const entry = () => cb();
  callbacks.add(entry);
  return () => {
    const current = targets.get(element);
    if (!current?.delete(entry)) return;
    if (current.size === 0) release(element);
  };
}

/** Number of elements the shared observer is watching (tests). */
export function observedCount(): number {
  return targets.size;
}

/**
 * Hold a freshly rendered entrance until `container` is seen, then call
 * `play`. While held, `root` carries `--oc-play-state: paused`, which every
 * generated entrance rule reads, so each element sits in its from-state
 * (fill-mode both).
 *
 * `trigger: 'mount'` and reduced motion play at once. Returns a cancel
 * function while the entrance is held, or null when `play` already ran.
 */
export function playWhenSeen(
  container: Element,
  root: Element & ElementCSSInlineStyle,
  trigger: 'visible' | 'mount' | undefined,
  play: () => void,
): (() => void) | null {
  if (trigger === 'mount' || prefersReducedMotion()) {
    play();
    return null;
  }
  root.style.setProperty('--oc-play-state', 'paused');
  let played = false;
  const cancel = whenSeen(container, () => {
    played = true;
    root.style.removeProperty('--oc-play-state');
    play();
  });
  return played ? null : cancel;
}
