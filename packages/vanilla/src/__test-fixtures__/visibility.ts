/**
 * Play-when-seen test helpers: a fake IntersectionObserver the test drives,
 * and a page layout stub (happy-dom reports a zero-size root element, which
 * visibility.ts reads as "no layout engine" and plays at once).
 */

import { vi } from 'vitest';
import type { ObserverFactory } from '../visibility';

/** A stand-in IntersectionObserver whose intersections the test drives. */
export function createFakeObserver() {
  let callback: IntersectionObserverCallback | null = null;
  const observed = new Set<Element>();
  const unobserved: Element[] = [];
  let created = 0;
  let disconnected = 0;
  const factory: ObserverFactory = (cb) => {
    callback = cb;
    created++;
    return {
      observe: (el: Element) => observed.add(el),
      unobserve: (el: Element) => {
        observed.delete(el);
        unobserved.push(el);
      },
      disconnect: () => {
        observed.clear();
        disconnected++;
      },
    };
  };
  /** Deliver one entry: `ratio` of the element, `visibleHeight` px of a `rootHeight` px viewport. */
  function fire(target: Element, ratio: number, visibleHeight = 0, rootHeight = 800): void {
    const entry = {
      target,
      isIntersecting: ratio > 0,
      intersectionRatio: ratio,
      intersectionRect: { height: visibleHeight },
      rootBounds: { height: rootHeight },
    } as unknown as IntersectionObserverEntry;
    callback?.([entry], {} as IntersectionObserver);
  }
  return {
    factory,
    fire,
    observed,
    unobserved,
    get created() {
      return created;
    },
    get disconnected() {
      return disconnected;
    },
  };
}

/** Give the page a layout: happy-dom reports a zero-size root element. */
export function stubPageLayout() {
  return vi.spyOn(document.documentElement, 'getBoundingClientRect').mockReturnValue({
    width: 1280,
    height: 800,
    top: 0,
    left: 0,
    right: 1280,
    bottom: 800,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}
