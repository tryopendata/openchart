/**
 * Framework-agnostic scroll-step driver: element registry + rAF-throttled
 * scroll handler + subscription store. Ported from the React
 * `use-scroll-steps` hook in opendata/shared; the store design (60fps
 * frames as subscriptions, never framework state) carries over unchanged
 * because vanilla, React, Vue, and Svelte all want the same contract.
 *
 * Measurement is lazy: with zero subscribers the scroll handler does no
 * rect reads.
 */

import { computeProgress, framesEqual, quantizeFrame, type ScrollyFrame } from './progress-math';

export interface ScrollyProgressStore {
  /** Latest frame; `{step: -1, ...}` sentinel before any measurement */
  get(): ScrollyFrame;
  /** Emits the current frame immediately on subscribe, then on every change */
  subscribe(cb: (frame: ScrollyFrame) => void): () => void;
}

export interface ScrollDriverOptions {
  /** Fraction of viewport height where the trigger line sits. Default 0.4 */
  triggerPosition?: number;
}

export interface ScrollDriver {
  /** Register the scrolling container that wraps all steps. */
  setContainer(el: HTMLElement | null): void;
  /** Register a step element by index. Pass `null` to unregister. */
  registerStep(index: number, el: HTMLElement | null): void;
  /** Continuous progress as a subscription store. */
  progress: ScrollyProgressStore;
  /** Scroll a step into view (center). Honors reduced motion. */
  scrollToStep(index: number): void;
  /** Force a re-measurement (e.g. after layout changes). */
  measure(): void;
  /** Tear down scroll/resize listeners and the reduced-motion media query. */
  destroy(): void;
}

const SENTINEL_FRAME: ScrollyFrame = {
  step: -1,
  stepProgress: 0,
  progress: 0,
  direction: 'down',
};

/**
 * Create a scroll-step driver. Framework wrappers (React/Vue/Svelte hooks)
 * are thin adapters over this: they own component lifecycle, this owns the
 * measurement/subscription machinery.
 */
export function createScrollDriver(options: ScrollDriverOptions = {}): ScrollDriver {
  const triggerPosition = options.triggerPosition ?? 0.4;

  let container: HTMLElement | null = null;
  const steps = new Map<number, HTMLElement>();
  const subscribers = new Set<(frame: ScrollyFrame) => void>();

  let frame: ScrollyFrame = SENTINEL_FRAME;
  let direction: 'down' | 'up' = 'down';
  // Direction is tracked from the container's viewport-relative position, NOT
  // window.scrollY: in a host that scrolls an inner container rather than the
  // page (Ladle, modals, dashboard panes, most app shells) window.scrollY is
  // pinned at 0 and would report no movement. The container's rect top moves
  // whenever ANY ancestor scrolls, so it works in both cases.
  let lastTop: number | null = null;
  let reducedMotion = false;
  let ticking = false;

  const measureAndEmit = () => {
    if (subscribers.size === 0) return;
    if (!container || steps.size === 0) return;
    if (typeof window === 'undefined') return;

    const viewportH = window.innerHeight;
    const containerRect = container.getBoundingClientRect();
    // Skip when the story is more than a viewport away in either direction.
    if (containerRect.bottom < -viewportH || containerRect.top > viewportH * 2) return;

    const count = steps.size;
    const tops: number[] = new Array(count);
    let lastBottom = 0;
    for (let i = 0; i < count; i++) {
      const el = steps.get(i);
      if (!el) return; // sparse registration mid-mount; wait for the next tick
      const rect = el.getBoundingClientRect();
      tops[i] = rect.top;
      if (i === count - 1) lastBottom = rect.bottom;
    }

    const triggerY = viewportH * triggerPosition;
    let geometry = computeProgress(tops, lastBottom, triggerY);
    if (reducedMotion) {
      geometry = quantizeFrame(geometry, count);
    }

    const next: ScrollyFrame = { ...geometry, direction };
    if (framesEqual(frame, next)) return;
    frame = next;
    for (const cb of subscribers) cb(frame);
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      // The container rising up the viewport (top decreasing) means the reader
      // is moving down through the story.
      const currentTop = container?.getBoundingClientRect().top ?? null;
      if (currentTop !== null && lastTop !== null) {
        const delta = lastTop - currentTop;
        if (delta > 5 || delta < -5) {
          direction = delta > 5 ? 'down' : 'up';
        }
      }
      lastTop = currentTop;
      ticking = false;
      measureAndEmit();
    });
  };

  let mediaQuery: MediaQueryList | null = null;
  const onReducedMotionChange = (e: MediaQueryListEvent) => {
    reducedMotion = e.matches;
    measureAndEmit();
  };

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion = mediaQuery.matches;
    mediaQuery.addEventListener('change', onReducedMotionChange);
  }

  if (typeof window !== 'undefined') {
    // Capture phase on the document, not just `window` scroll. Scroll events do
    // not bubble, so a window listener ONLY fires when the page itself scrolls.
    // Any host that scrolls an inner container instead — Ladle (which sets
    // `body { overflow: hidden }`), modals, dashboard panes, most app shells —
    // would never notify the driver and the story sat frozen on step 0.
    // Capturing on the document sees scroll from any ancestor, and the
    // measurement below is already viewport-relative (getBoundingClientRect vs
    // innerHeight), so it needs no other change to work in both layouts.
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('resize', onScroll, { passive: true });
  }

  const progress: ScrollyProgressStore = {
    get: () => frame,
    subscribe: (cb) => {
      // Refresh `frame` from current geometry BEFORE registering `cb`, so the
      // measure pass notifies only existing subscribers. Then hand the new
      // subscriber the current frame exactly once. Registering after the
      // measure avoids the double-invoke that happened when measureAndEmit
      // changed the frame (looping over cb) and the explicit cb(frame) fired again.
      measureAndEmit();
      subscribers.add(cb);
      cb(frame);
      return () => {
        subscribers.delete(cb);
      };
    },
  };

  return {
    setContainer(el) {
      container = el;
      // Seed the direction baseline so the first scroll compares against a real
      // position rather than reporting a spurious jump from null.
      lastTop = el?.getBoundingClientRect().top ?? null;
      measureAndEmit();
    },
    registerStep(index, el) {
      if (el) {
        steps.set(index, el);
      } else {
        steps.delete(index);
      }
      measureAndEmit();
    },
    progress,
    scrollToStep(index) {
      const el = steps.get(index);
      if (!el) return;
      el.scrollIntoView({
        block: 'center',
        behavior: reducedMotion ? 'auto' : 'smooth',
      });
    },
    measure() {
      measureAndEmit();
    },
    destroy() {
      if (typeof window !== 'undefined') {
        // `capture: true` must match the addEventListener call or the listener
        // is not removed.
        document.removeEventListener('scroll', onScroll, { capture: true });
        window.removeEventListener('resize', onScroll);
      }
      mediaQuery?.removeEventListener('change', onReducedMotionChange);
      subscribers.clear();
      steps.clear();
      container = null;
    },
  };
}
