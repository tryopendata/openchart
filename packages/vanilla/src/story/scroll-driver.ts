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
  let lastScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
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
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY;
      if (delta > 5 || delta < -5) {
        direction = delta > 5 ? 'down' : 'up';
      }
      lastScrollY = currentY;
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
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
  }

  const progress: ScrollyProgressStore = {
    get: () => frame,
    subscribe: (cb) => {
      subscribers.add(cb);
      measureAndEmit();
      cb(frame);
      return () => {
        subscribers.delete(cb);
      };
    },
  };

  return {
    setContainer(el) {
      container = el;
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
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
      }
      mediaQuery?.removeEventListener('change', onReducedMotionChange);
      subscribers.clear();
      steps.clear();
      container = null;
    },
  };
}
